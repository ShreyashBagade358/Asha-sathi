import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ASHAButton, ASHACard, ASHAInput } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'

interface OtpState {
  phone: string
  otpRequestId?: string
  expiresIn?: number
}

export default function OtpPage() {
  const { t } = useLocalization()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, verifyOtp, requestOtp } = useAuth()

  const state = location.state as OtpState | null
  const phone = state?.phone ?? ''

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  if (!phone) {
    return <Navigate to="/login" replace />
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(otp)) {
      setError(t('common.otpRequired'))
      return
    }
    setError(null)
    setLoading(true)
    try {
      await verifyOtp(phone, otp, state?.otpRequestId)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.verifyFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await requestOtp(phone)
      setCountdown(30)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.requestOtpFailed'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <div className="w-full max-w-sm">
        <ASHACard title={t('auth.enterOtp')} subtitle={t('auth.otpHint', { phone })}>
          <form onSubmit={handleVerify} className="space-y-4" noValidate>
            <ASHAInput
              label={t('common.otp')}
              type="tel"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              errorText={error ?? undefined}
            />
            <ASHAButton type="submit" fullWidth loading={loading} disabled={otp.length < 6} label={t('common.verify')} />
            <div className="flex justify-center">
              <ASHAButton
                variant="outline"
                fullWidth={false}
                loading={resending}
                disabled={countdown > 0}
                onClick={handleResend}
                label={countdown > 0 ? t('common.resendIn', { seconds: countdown }) : t('common.resendOtp')}
              />
            </div>
          </form>
        </ASHACard>
      </div>
    </div>
  )
}
