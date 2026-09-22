import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Permission } from './permissions'

export const PERMISSION_KEY = 'rbac:permissions'
export const PUBLIC_KEY = 'rbac:public'
export const SELF_OR_KEY = 'rbac:selfOr'

/**
 * Ruta traži SVE navedene permisije (AND, ne OR — ako trebaš OR, napravi
 * eksplicitnu permisiju za taj slučaj umjesto da labaviš pravilo).
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSION_KEY, permissions)

/** Ruta je namjerno otvorena (login, health, javni oglasi). Mora biti eksplicitno. */
export const Public = () => SetMetadata(PUBLIC_KEY, true)

/**
 * Vlasnik resursa smije i bez permisije; svi ostali trebaju navedenu permisiju.
 * `param` je ime rute parametra koji nosi user id (npr. :userId).
 */
export const SelfOr = (permission: Permission, param = 'userId') =>
  SetMetadata(SELF_OR_KEY, { permission, param })

export interface AuthUser {
  id: string
  roles: string[]
  permissions: Permission[]
  isInternal: boolean
  kycVerified: boolean
  canTransact: boolean
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined
    return data ? user?.[data] : user
  },
)
