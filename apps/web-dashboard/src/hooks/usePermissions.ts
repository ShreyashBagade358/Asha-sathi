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

const ROLE_MATRIX: Record<PermissionAction, Role[]> = {
  'asha:view': ['moic', 'bpm', 'dpm', 'state_admin', 'super_admin'],
  'asha:edit': ['moic', 'bpm', 'dpm', 'state_admin', 'super_admin'],
  'beneficiary:view': ['asha', 'anm', 'moic', 'bpm', 'dpm', 'state_admin', 'super_admin'],
  'beneficiary:edit': ['asha', 'anm', 'moic', 'bpm', 'dpm', 'state_admin', 'super_admin'],
  'reports:view': ['moic', 'bpm', 'dpm', 'state_admin', 'super_admin'],
  'alerts:view': ['moic', 'bpm', 'dpm', 'state_admin', 'super_admin'],
  'alerts:resolve': ['moic', 'bpm', 'dpm', 'state_admin', 'super_admin'],
  'resources:allocate': ['dpm', 'state_admin', 'super_admin'],
  'users:manage': ['state_admin', 'super_admin'],
  'policy:manage': ['state_admin', 'super_admin'],
  'config:manage': ['super_admin'],
  'audit:view': ['state_admin', 'super_admin'],
  'deploy:view': ['super_admin'],
}

export function can(role: Role | undefined, action: PermissionAction): boolean {
  if (!role) return false
  if (role === 'super_admin') return true
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
