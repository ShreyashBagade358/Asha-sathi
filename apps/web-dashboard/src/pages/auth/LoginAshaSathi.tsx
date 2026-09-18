import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

type LoginRole = 'health-worker' | 'patient' | 'phc-admin'

const ROLES: { id: LoginRole; label: string; icon: string }[] = [
  { id: 'health-worker', label: 'Health Worker', icon: 'medical_services' },
  { id: 'patient', label: 'Patient', icon: 'person' },
  { id: 'phc-admin', label: 'PHC Admin', icon: 'admin_panel_settings' },
]

const HERO_FEATURES = [
  { icon: 'vaccines', title: 'Immunization tracking', desc: 'Child & maternal vaccination schedules on time' },
  { icon: 'monitor_heart', title: 'High-risk alerts', desc: 'Real-time NCD & pregnancy risk monitoring' },
  { icon: 'sync', title: 'Offline-first sync', desc: 'Works in low-connectivity rural areas' },
]

const isPhoneValid = (value: string) => /^[6-9]\d{9}$/.test(value)

export default function LoginAshaSathi() {
  const navigate = useNavigate()
  const { isAuthenticated, isHydrating, requestOtp } = useAuth()
  const [role, setRole] = useState<LoginRole>('health-worker')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)

  if (isAuthenticated && !isHydrating) {
    return <Navigate to="/dashboard" replace />
  }

  const digits = phone.replace(/\D/g, '')
  const hasTyped = digits.length > 0
  const phoneValid = hasTyped && isPhoneValid(digits)
  const phoneInvalid = hasTyped && !phoneValid

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isPhoneValid(digits)) {
      setError('Enter a valid 10-digit mobile number')
      setShakeKey((k) => k + 1)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { otpRequestId, expiresIn } = await requestOtp(digits)
      navigate('/otp', { state: { phone: digits, otpRequestId, expiresIn } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP. Please try again.')
      setShakeKey((k) => k + 1)
    } finally {
      setLoading(false)
    }
  }

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
            Empowering frontline health workers
          </h1>
          <p className="mt-4 font-body-md text-body-md text-on-primary/80">
            Register households, track pregnancies, immunize children, screen for NCDs — all with full offline support.
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
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Login to access your healthcare portal</p>
          </div>

          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-card sm:p-8">
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">Welcome back</h2>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Choose your role to continue</p>

            <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-surface-container p-1" role="tablist" aria-label="Login role">
              {ROLES.map((r) => {
                const active = role === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 transition-all duration-200 ${
                      active ? 'bg-surface-container-lowest text-primary shadow-sm ring-1 ring-outline-variant/50' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[20px] ${active ? 'fill-icon' : ''}`}>{r.icon}</span>
                    <span className="font-caption text-caption font-semibold leading-tight">{r.label}</span>
                  </button>
                )
              })}
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mobile" className="font-label-md text-label-md font-semibold text-on-surface">
                  Mobile Number or Email
                </label>
                <div
                  className={`flex items-center overflow-hidden rounded-lg border bg-surface transition-all focus-within:ring-2 ${
                    phoneInvalid
                      ? 'border-error focus-within:ring-error/20'
                      : phoneValid
                        ? 'border-secondary focus-within:ring-secondary/20'
                        : 'border-outline-variant focus-within:border-primary focus-within:ring-primary/20'
                  }`}
                >
                  <span className="flex h-[48px] items-center gap-1 border-r border-outline-variant/60 bg-surface-container-lowest px-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[20px]">phone_iphone</span>
                    <span className="font-label-md text-label-md font-semibold">+91</span>
                  </span>
                  <input
                    id="mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    placeholder="Enter mobile number"
                    className="h-[48px] flex-1 bg-transparent px-3 font-body-md text-body-md text-on-surface outline-none placeholder:text-outline"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                      if (error) setError(null)
                    }}
                    aria-invalid={phoneInvalid}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  {phoneValid && (
                    <span className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </span>
                  )}
                </div>
                {phoneInvalid && (
                  <p className="font-caption text-caption text-error" role="alert">
                    Enter a valid 10-digit mobile number
                  </p>
                )}
              </div>

              {error && (
                <div
                  key={shakeKey}
                  role="alert"
                  className="animate-shake flex items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5"
                >
                  <span className="material-symbols-outlined fill-icon text-[18px] text-error">error</span>
                  <p className="font-caption text-caption font-medium text-on-error-container">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || digits.length < 10}
                className="group flex h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all duration-200 hover:bg-on-primary-fixed-variant hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send OTP
                    <span className="material-symbols-outlined text-[20px] transition-transform duration-200 group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>

              <div className="flex justify-center">
                <Link
                  to="/login"
                  className="font-label-md text-label-md font-semibold text-primary transition-colors hover:text-on-primary-fixed-variant hover:underline"
                >
                  Login with Password
                </Link>
              </div>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
              <span className="material-symbols-outlined fill-icon mt-0.5 text-[18px] text-tertiary">info</span>
              <div>
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">Need Help?</h3>
                <p className="mt-0.5 font-caption text-caption text-on-surface-variant">
                  Contact your district coordinator if you are unable to access your assigned patient lists.
                </p>
              </div>
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
