import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'

export type PermissionAction =
  | 'asha:view'
  | 'asha:edit'
  | 'beneficiary:view'
  | 'beneficiary:edit'
  | 'reports:view'
  | 'alerts:view'
  | 'alerts:resolve'
  | 'resources:allocate'
  | 'users:manage'
  | 'policy:manage'
  | 'config:manage'
  | 'audit:view'
  | 'deploy:view'

// A single `admin` role covers every supervisory area (PHC, district, state and
// super). The matrix records which actions each remaining role may perform.
const ROLE_MATRIX: Record<PermissionAction, Role[]> = {
  'asha:view': ['admin'],
  'asha:edit': ['admin'],
  'beneficiary:view': ['asha', 'admin'],
  'beneficiary:edit': ['asha', 'admin'],
  'reports:view': ['admin'],
  'alerts:view': ['admin'],
  'alerts:resolve': ['admin'],
  'resources:allocate': ['admin'],
  'users:manage': ['admin'],
  'policy:manage': ['admin'],
  'config:manage': ['admin'],
  'audit:view': ['admin'],
  'deploy:view': ['admin'],
}

export function can(role: Role | undefined, action: PermissionAction): boolean {
  if (!role) return false
  if (role === 'admin') return true
  return ROLE_MATRIX[action]?.includes(role) ?? false
}

export function usePermissions(): {
  can: (action: PermissionAction) => boolean
  role: Role | undefined
  hasRole: (...roles: Role[]) => boolean
} {
  const { user } = useAuth()

  return useMemo(
    () => ({
      can: (action: PermissionAction) => can(user?.role, action),
      role: user?.role,
      hasRole: (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
    }),
    [user],
  )
}
