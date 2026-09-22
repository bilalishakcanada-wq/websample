import { Injectable, Logger } from '@nestjs/common'
import type { Request } from 'express'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Permission } from './permissions'

/**
 * Audit ide u public.audit_log (append-only tabela; vidi 01_rbac.sql).
 * Neuspjeh upisa NE ruši zahtjev, ali se glasno loguje — audit koji ruši
 * produkciju niko ne drži uključenim, a to je gore od povremenog propusta.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)
  private readonly admin: SupabaseClient

  constructor() {
    this.admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  granted(actorId: string, permissions: Permission[], req: Request) {
    return this.write(actorId, permissions, req, 'access.granted')
  }

  denied(actorId: string, permissions: Permission[], req: Request) {
    return this.write(actorId, permissions, req, 'access.denied')
  }

  private async write(actorId: string, permissions: Permission[], req: Request, action: string) {
    const { error } = await this.admin.from('audit_log').insert({
      actor_id: actorId,
      permission: permissions.join(','),
      action,
      subject_type: 'http',
      details: {
        method: req.method,
        path: req.originalUrl ?? req.url,
        params: req.params,
        ip: req.ip,
        user_agent: req.headers['user-agent'],
      },
    })
    if (error) this.logger.error(`Audit upis nije uspio: ${error.message}`)
  }
}
