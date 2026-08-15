import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface LogoutButtonProps {
  className?: string
  children?: ReactNode
}

export function LogoutButton({ className, children }: LogoutButtonProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      {children ?? 'Logout'}
    </button>
  )
}
