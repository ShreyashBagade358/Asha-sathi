import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

interface LogoutButtonProps {
  className?: string
  children?: ReactNode
}

function cleanClass(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw.startsWith("className='") && raw.endsWith("'")) {
    return raw.slice("className='".length, -1)
  }
  return raw
}

export function LogoutButton({ className, children }: LogoutButtonProps) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <button type="button" className={cleanClass(className)} onClick={handleLogout}>
      {children}
    </button>
  )
}
