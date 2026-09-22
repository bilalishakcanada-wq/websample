import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Permission } from './permissions'
import type { AuthUser } from './rbac.decorators'

interface CacheEntry { user: AuthUser; expiresAt: number }

/**
 * Pretvara Supabase JWT u AuthUser sa stvarnim permisijama iz baze.
 *
 * Zašto iz baze, a ne iz tokena: uloga oduzeta u 10:00 mora prestati važiti
 * odmah, a ne tek kad token istekne. Zato se permisije čitaju iz baze i drže u
 * kratkom kešu (30 s) — dovoljno da ne gnjavimo bazu na svaki zahtjev, a
 * dovoljno kratko da opoziv proradi skoro odmah.
 */
@Injectable()
export class PrincipalMiddleware implements NestMiddleware {
  private readonly admin: SupabaseClient
  private readonly cache = new Map<string, CacheEntry>()
  private static readonly TTL_MS = 30_000

  constructor() {
    this.admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = req.headers.authorization?.replace(/^Bearer /i, '')
    if (!token) return next()

    const { data, error } = await this.admin.auth.getUser(token)
    if (error || !data.user) throw new UnauthorizedException('Token nije važeći.')

    const userId = data.user.id
    const cached = this.cache.get(userId)
    if (cached && cached.expiresAt > Date.now()) {
      ;(req as Request & { user: AuthUser }).user = cached.user
      return next()
    }

    const { data: rows, error: rpcError } = await this.admin.rpc('principal_for', { p_user: userId })
    if (rpcError) throw new UnauthorizedException('Ovlaštenja se ne mogu učitati.')

    const row = Array.isArray(rows) ? rows[0] : rows
    const user: AuthUser = {
      id: userId,
      roles: row?.roles ?? [],
      permissions: (row?.permissions ?? []) as Permission[],
      isInternal: Boolean(row?.is_internal),
      kycVerified: Boolean(row?.kyc_verified),
      canTransact: Boolean(row?.can_transact),
    }

    this.cache.set(userId, { user, expiresAt: Date.now() + PrincipalMiddleware.TTL_MS })
    ;(req as Request & { user: AuthUser }).user = user
    next()
  }

  /** Poziva se kad HR promijeni ulogu — opoziv ne čeka istek keša. */
  invalidate(userId: string): void {
    this.cache.delete(userId)
  }
}
