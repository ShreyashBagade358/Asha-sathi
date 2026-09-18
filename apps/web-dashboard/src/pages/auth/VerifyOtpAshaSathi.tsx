import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface OtpState {
  phone: string
  otpRequestId?: string
  expiresIn?: number
  role?: string
}

const OTP_LENGTH = 4

const HERO_FEATURES = [
  { icon: 'vaccines', title: 'Immunization tracking', desc: 'Child & maternal vaccination schedules on time' },
  { icon: 'monitor_heart', title: 'High-risk alerts', desc: 'Real-time NCD & pregnancy risk monitoring' },
  { icon: 'sync', title: 'Offline-first sync', desc: 'Works in low-connectivity rural areas' },
]

export default function VerifyOtpAshaSathi() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, verifyOtp, requestOtp } = useAuth()
  const state = location.state as OtpState | null
  const phone = state?.phone ?? ''

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(45)
  const [shakeKey, setShakeKey] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  if (!phone) {
    return <Navigate to="/login" replace />
  }

  const maskedPhone = `+91 ******${phone.slice(-3)}`

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    setError(null)
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!text) return
    const next = Array(OTP_LENGTH).fill('')
    text.split('').forEach((ch, i) => { next[i] = ch })
    setDigits(next)
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus()
  }

  const otp = digits.join('')
  const otpComplete = otp.length === OTP_LENGTH

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!otpComplete) {
      setError('Enter all 6 digits')
      setShakeKey((k) => k + 1)
      return
    }
    setError(null)
    setLoading(true)
    try {
      await verifyOtp(phone, otp, state?.otpRequestId)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP. Please try again.')
      setShakeKey((k) => k + 1)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await requestOtp(phone)
      setCountdown(45)
      setDigits(Array(OTP_LENGTH).fill(''))
      setError(null)
      inputRefs.current[0]?.focus()
    } catch {
      setError('Unable to resend OTP. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const minutes = Math.floor(countdown / 60).toString().padStart(2, '0')
  const seconds = (countdown % 60).toString().padStart(2, '0')

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section
        aria-hidden
        className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-on-primary-fixed lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-on-primary"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-container opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 -left-16 h-64 w-64 rounded-full bg-tertiary-container opacity-30 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-8 h-40 w-40 rounded-full border border-white/10 animate-float" />

        <div className="relative flex items-center gap-3 animate-fade-up">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-on-primary ring-1 ring-white/20">
            <span className="material-symbols-outlined fill-icon text-[26px]">health_and_safety</span>
          </div>
          <div>
            <p className="font-headline-md text-headline-md font-bold leading-tight">ASHA Sathi</p>
            <p className="font-caption text-caption text-on-primary/70">Frontline Health Digitization</p>
          </div>
        </div>

        <div className="relative max-w-md animate-fade-up animate-delay-100">
          <h1 className="font-headline-lg text-[40px] leading-tight font-extrabold tracking-tight">
            Secure sign-in with OTP
          </h1>
          <p className="mt-4 font-body-md text-body-md text-on-primary/80">
            One-time password keeps every login safe for health workers, patients and PHC administrators.
          </p>
          <ul className="mt-8 space-y-4">
            {HERO_FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <span className="material-symbols-outlined fill-icon text-[20px]">{feature.icon}</span>
                </span>
                <div>
                  <p className="font-label-md text-label-md font-semibold">{feature.title}</p>
                  <p className="font-caption text-caption text-on-primary/70">{feature.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-6 animate-fade-up animate-delay-200">
          <div>
            <p className="font-headline-md text-[28px] font-bold leading-none">24+</p>
            <p className="font-caption text-caption text-on-primary/70 mt-1">Care modules</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <p className="font-headline-md text-[28px] font-bold leading-none">3</p>
            <p className="font-caption text-caption text-on-primary/70 mt-1">Mobile apps</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <p className="font-headline-md text-[28px] font-bold leading-none">100%</p>
            <p className="font-caption text-caption text-on-primary/70 mt-1">Offline capable</p>
          </div>
        </div>
      </section>

      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined fill-icon text-[32px]">health_and_safety</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">ASHA Sathi</h1>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Verify your identity</p>
          </div>

          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-card sm:p-8">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 font-label-md text-label-md font-semibold text-on-surface-variant transition-colors hover:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              Back
            </button>

            <div className="mt-4">
              <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">Verify your identity</h2>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                Enter the 4-digit code sent to <strong className="font-semibold text-on-surface">{maskedPhone}</strong>
              </p>
            </div>

            <form className="mt-6" onSubmit={handleVerify} noValidate>
              <div
                key={shakeKey}
                className="grid grid-cols-4 gap-2 sm:gap-3"
                role="group"
                aria-label="One-time password"
              >
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el }}
                    aria-label={`Digit ${i + 1}`}
                    autoFocus={i === 0}
                    className={`h-14 w-full rounded-lg border bg-surface text-center font-headline-lg text-headline-lg text-on-surface outline-none transition-all sm:h-16 ${
                      error
                        ? 'border-error focus:ring-2 focus:ring-error/20'
                        : 'border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20'
                    }`}
                    maxLength={1}
                    inputMode="numeric"
                    type="text"
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                  />
                ))}
              </div>

              {error && (
                <div role="alert" className="animate-shake mt-3 flex items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5">
                  <span className="material-symbols-outlined fill-icon text-[18px] text-error">error</span>
                  <p className="font-caption text-caption font-medium text-on-error-container">{error}</p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <span className="font-body-md text-body-md text-on-surface-variant">Didn't receive the code?</span>
                {countdown > 0 ? (
                  <span className="flex items-center gap-1.5 font-label-md text-label-md text-outline">
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                    {minutes}:{seconds}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="font-label-md text-label-md font-semibold text-primary underline-offset-4 transition-colors hover:text-on-primary-fixed-variant hover:underline disabled:opacity-50"
                  >
                    {resending ? 'Resending…' : 'Resend Code'}
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !otpComplete}
                className="group mt-6 flex h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all duration-200 hover:bg-on-primary-fixed-variant hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
                    Verifying…
                  </>
                ) : (
                  <>
                    Verify and Login
                    <span className="material-symbols-outlined fill-icon text-[20px] transition-transform duration-200 group-hover:translate-x-1">login</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex justify-center">
              <Link
                to="/account-recovery"
                className="flex items-center gap-1.5 font-label-md text-label-md font-semibold text-primary transition-colors hover:text-on-primary-fixed-variant hover:underline"
              >
                <span className="material-symbols-outlined text-[18px]">help</span>
                Need help logging in?
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center font-caption text-caption text-on-surface-variant/70">
            Secure Environment • District Health Office
          </p>
        </div>
      </main>
    </div>
  )
}
