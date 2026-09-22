import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
  Logger, UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AUDITED_PERMISSIONS, Permission } from './permissions'
import { PERMISSION_KEY, PUBLIC_KEY, SELF_OR_KEY, AuthUser } from './rbac.decorators'
import { AuditService } from './audit.service'

/**
 * Jedini čuvar ulaza. Registruje se GLOBALNO (APP_GUARD), pa je svaka ruta
 * zatvorena dok se izričito ne otvori sa @Public() ili @RequirePermission().
 * Ruta bez ijedne oznake se odbija — "zaboravio sam dekorator" ne smije
 * proizvesti otvoren endpoint.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name)

  constructor(private readonly reflector: Reflector, private readonly audit: AuditService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true

    const request = ctx.switchToHttp().getRequest()
    const user = request.user as AuthUser | undefined
    if (!user) throw new UnauthorizedException('Nisi prijavljen.')

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSION_KEY, targets)
    const selfOr = this.reflector.getAllAndOverride<{ permission: Permission; param: string }>(SELF_OR_KEY, targets)

    if (!required && !selfOr) {
      // zatvoreno po defaultu: greška u konfiguraciji, ne u zahtjevu
      this.logger.error(`Ruta ${request.method} ${request.url} nema RBAC oznaku — odbijam.`)
      throw new ForbiddenException('Ruta nije konfigurisana.')
    }

    if (selfOr && request.params?.[selfOr.param] === user.id) return true

    const needed = [...(required ?? []), ...(selfOr ? [selfOr.permission] : [])]
    const missing = needed.filter((permission) => !user.permissions.includes(permission))

    if (missing.length > 0) {
      await this.audit.denied(user.id, needed, request)
      throw new ForbiddenException(`Nedostaje ovlaštenje: ${missing.join(', ')}`)
    }

    // svaki dodir osjetljivog podatka ostavlja trag, i kad prođe
    const sensitive = needed.filter((permission) => AUDITED_PERMISSIONS.has(permission))
    if (sensitive.length > 0) await this.audit.granted(user.id, sensitive, request)

    return true
  }
}
