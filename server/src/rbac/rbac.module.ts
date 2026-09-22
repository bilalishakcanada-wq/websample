import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { RbacGuard } from './rbac.guard'
import { AuditService } from './audit.service'
import { PrincipalMiddleware } from './principal.middleware'

/**
 * Globalni RBAC. Redoslijed je bitan:
 *   PrincipalMiddleware  -> provjeri token, učitaj uloge/permisije u request.user
 *   RbacGuard (APP_GUARD) -> propusti ili odbij
 *
 * Baza radi istu provjeru još jednom (RLS + has_permission()), pa propust u
 * jednom sloju ne otvara podatke. Dvostruka provjera je namjerna.
 */
@Global()
@Module({
  providers: [AuditService, PrincipalMiddleware, { provide: APP_GUARD, useClass: RbacGuard }],
  exports: [AuditService, PrincipalMiddleware],
})
export class RbacModule {}
