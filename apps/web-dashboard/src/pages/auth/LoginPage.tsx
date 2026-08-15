import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ASHAButton, ASHACard, ASHAInput } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'

export default function LoginPage() {
  const { t } = useLocalization()
  const { isAuthenticated, isHydrating, requestOtp } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated && !isHydrating) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(t('common.phoneInvalid'))
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { otpRequestId, expiresIn } = await requestOtp(digits)
      navigate('/otp', { state: { phone: digits, otpRequestId, expiresIn } })
    } catch {
      setError(t('common.requestOtpFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h1 className="text-headline-lg text-on-surface">{t('common.appName')}</h1>
          <p className="text-body-md text-on-surface-variant">{t('auth.loginSubtitle')}</p>
        </div>

        <ASHACard title={t('common.login')} subtitle={t('auth.enterPhoneHint')}>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <ASHAInput
              label={t('common.phone')}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              errorText={error ?? undefined}
            />
            <ASHAButton type="submit" fullWidth loading={loading} disabled={phone.length < 10} label={t('common.sendOtp')} />
          </form>
        </ASHACard>
      </div>
    </div>
  )
}
