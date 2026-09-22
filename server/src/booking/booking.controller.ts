/**
 * Booking kontroler (Node/NestJS).
 *
 * ČITAJ PRIJE UPOTREBE: ovo NIJE mjesto gdje se pravila brane. Poso.ba frontend
 * zove Supabase direktno, pa bi napadač ovaj servis jednostavno preskočio.
 * Pravila žive u bazi (supabase/booking/*.sql): matrica prelaza, FOR UPDATE,
 * zabrana jednostranog otkazivanja, nepromjenjiv chat.
 *
 * Ovaj sloj postoji zbog onoga što baza ne radi dobro: prijem fajlova kao dokaza,
 * idempotentni ključevi na HTTP nivou i uredne poruke o greškama na našem jeziku.
 * Svaka ruta na kraju zove RPC — baza ostaje jedini sudija.
 */
import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException,
  Param, Post, UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { RequirePermission } from '../rbac/rbac.decorators'
import { CurrentUser, type AuthUser } from '../rbac/rbac.decorators'
import { requireIdempotencyKey, validate } from '../security/security.middleware'
import { SupabaseService } from './supabase.service'

const SubmitWorkDto = z.object({
  report: z.string().trim().min(20, 'Izvještaj mora imati bar 20 znakova'),
  evidenceUrls: z.array(z.string().url()).max(10).default([]),
}).strict().refine((v) => v.report.length >= 20 || v.evidenceUrls.length > 0,
  'Priloži dokaz: slike ili izvještaj')

const RevisionDto = z.object({ reason: z.string().trim().min(10).max(1000) }).strict()
const CancelDto = z.object({
  reasonCode: z.enum(['no_show', 'scope_change', 'quality', 'mutual', 'other']),
  detail: z.string().trim().max(1000).optional(),
}).strict()
const RespondDto = z.object({ accept: z.boolean(), note: z.string().trim().max(1000).optional() }).strict()
const DisputeDto = z.object({
  reasonCode: z.enum(['not_delivered', 'quality', 'payment_refused', 'off_platform', 'other']),
  claim: z.string().trim().min(20).max(4000),
  evidenceUrls: z.array(z.string().url()).max(20).default([]),
}).strict()

/** Greške iz baze se prevode u HTTP status — bez propuštanja internih detalja. */
const DB_ERRORS: Record<string, { status: 'forbidden' | 'conflict' | 'bad'; poruka: string }> = {
  JEDNOSTRANO_OTKAZIVANJE_NIJE_MOGUCE: { status: 'forbidden', poruka: 'Posao je u toku. Pošalji zahtjev za sporazumni prekid ili otvori spor.' },
  NEDOZVOLJEN_PRELAZ: { status: 'conflict', poruka: 'Ta radnja nije moguća u trenutnom stanju posla.' },
  DOKAZ_JE_OBAVEZAN: { status: 'bad', poruka: 'Priloži dokaz o obavljenom poslu.' },
  ISKORISTENE_SVE_ISPRAVKE: { status: 'conflict', poruka: 'Iskorištene su sve ispravke. Otvori spor ako rad nije po dogovoru.' },
  NA_SVOJ_ZAHTJEV_SE_NE_ODGOVARA: { status: 'forbidden', poruka: 'Na vlastiti zahtjev za prekid ne možeš odgovoriti.' },
  VEC_NAMIRENO: { status: 'conflict', poruka: 'Ova uplata je već obrađena.' },
  NEMA_ZAHTJEVA: { status: 'conflict', poruka: 'Nema otvorenog zahtjeva za prekid.' },
  FORBIDDEN: { status: 'forbidden', poruka: 'Nemaš pravo na ovu radnju.' },
}

@Controller('jobs/:listingId')
export class BookingController {
  constructor(private readonly db: SupabaseService) {}

  private raise(error: { message?: string } | null): never | void {
    if (!error?.message) return
    const key = Object.keys(DB_ERRORS).find((k) => error.message!.includes(k))
    const mapped = key ? DB_ERRORS[key] : null
    if (!mapped) throw new BadRequestException({ error: 'GRESKA', poruka: 'Radnja nije uspjela.' })
    const payload = { error: key, poruka: mapped.poruka }
    if (mapped.status === 'forbidden') throw new ForbiddenException(payload)
    if (mapped.status === 'conflict') throw new ConflictException(payload)
    throw new BadRequestException(payload)
  }

  /** Izvođač predaje rad sa dokazom → pokreće se rok od 72 h. */
  @Post('submit-work')
  @UseGuards(/* RbacGuard je globalan */)
  async submitWork(
    @Param('listingId') listingId: string,
    @Body(validate(SubmitWorkDto)) body: z.infer<typeof SubmitWorkDto>,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.canTransact) throw new ForbiddenException({ poruka: 'Nalog nije verifikovan.' })
    const { data, error } = await this.db.asUser(user).rpc('submit_work', {
      p_listing: listingId, p_report: body.report, p_evidence: body.evidenceUrls,
    })
    this.raise(error)
    return { stanje: data?.work_state, rokZaPregled: data?.review_deadline }
  }

  /** Klijent odobrava → novac ide izvođaču. Idempotency-Key je obavezan. */
  @Post('approve')
  async approve(@Param('listingId') listingId: string, @CurrentUser() user: AuthUser) {
    const { data, error } = await this.db.asUser(user).rpc('approve_work', { p_listing: listingId })
    this.raise(error)
    return { status: data?.status, isplaceno: data?.net_amount }
  }

  @Post('request-revision')
  async requestRevision(
    @Param('listingId') listingId: string,
    @Body(validate(RevisionDto)) body: z.infer<typeof RevisionDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const { data, error } = await this.db.asUser(user).rpc('request_revision', {
      p_listing: listingId, p_reason: body.reason,
    })
    this.raise(error)
    return { stanje: data?.work_state, ispravki: data?.revision_count }
  }

  /**
   * NEMA rute za direktan povrat novca.
   * Prekid ide isključivo kroz zahtjev + pristanak druge strane, ili kroz spor.
   * Ovo je ono što ste tražili kao "blokada rute za povrat dok je posao u toku":
   * ruta jednostavno ne postoji, a baza odbija i direktan poziv cancel_job_payment.
   */
  @Post('request-cancellation')
  async requestCancellation(
    @Param('listingId') listingId: string,
    @Body(validate(CancelDto)) body: z.infer<typeof CancelDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const { data, error } = await this.db.asUser(user).rpc('request_cancellation', {
      p_listing: listingId, p_reason_code: body.reasonCode, p_detail: body.detail ?? null,
    })
    this.raise(error)
    return { zahtjev: data?.id, stanje: 'ceka_odgovor_druge_strane' }
  }

  @Post('respond-cancellation')
  async respondCancellation(
    @Param('listingId') listingId: string,
    @Body(validate(RespondDto)) body: z.infer<typeof RespondDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const { data, error } = await this.db.asUser(user).rpc('respond_cancellation', {
      p_listing: listingId, p_accept: body.accept, p_note: body.note ?? null,
    })
    this.raise(error)
    return { stanje: data?.work_state, status: data?.status }
  }

  @Post('dispute')
  async openDispute(
    @Param('listingId') listingId: string,
    @Body(validate(DisputeDto)) body: z.infer<typeof DisputeDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const { data, error } = await this.db.asUser(user).rpc('open_dispute', {
      p_listing: listingId, p_reason_code: body.reasonCode,
      p_claim: body.claim, p_evidence: body.evidenceUrls,
    })
    this.raise(error)
    return { spor: data?.id, stanje: 'zamrznuto' }
  }
}

export const bookingMiddleware = [requireIdempotencyKey]
