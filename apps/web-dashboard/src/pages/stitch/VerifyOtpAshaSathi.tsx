import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface OtpState {
  phone: string
  otpRequestId?: string
  expiresIn?: number
}

const OTP_LENGTH = 6

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

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (otp.length !== OTP_LENGTH) {
      setError('Enter all 6 digits')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await verifyOtp(phone, otp, state?.otpRequestId)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Invalid or expired OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await requestOtp(phone)
      setCountdown(45)
      setError(null)
    } catch {
      setError('Unable to resend OTP. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const minutes = Math.floor(countdown / 60).toString().padStart(2, '0')
  const seconds = (countdown % 60).toString().padStart(2, '0')

  return (
    <>
<main className="flex-1 flex flex-col justify-center items-center p-md md:p-lg">
<div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-lg md:p-xl flex flex-col relative overflow-hidden">
<button aria-label="Go back" className="absolute top-lg left-lg w-touch-target h-touch-target flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary -ml-sm -mt-sm" onClick={() => navigate('/login')}><span aria-hidden className="material-symbols-outlined">arrow_back</span></button>
<div className="text-center mt-xl mb-xl"><h1 className="font-headline-md text-headline-md text-primary font-bold mb-xs">ASHA Sathi</h1><h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface mb-sm">Verify your identity</h2><p className="font-body-md text-body-md text-on-surface-variant px-sm">
                    Enter the 6-digit verification code sent to <br /><strong className="font-semibold text-on-surface">{maskedPhone}</strong></p></div>
<form className="flex flex-col gap-form-gap w-full" onSubmit={handleVerify} noValidate>
<div className="flex justify-between items-center gap-xs md:gap-sm mb-sm" id="otp-container">{digits.map((digit, i) => (
<input key={i} ref={(el) => { inputRefs.current[i] = el }} aria-label={`Digit ${i + 1}`} autoFocus={i === 0} className="w-12 md:w-14 h-touch-target md:h-14 text-center font-headline-lg text-headline-lg border border-outline-variant rounded-lg bg-surface focus:border-primary focus:ring-2 focus:ring-primary outline-none transition-all" maxLength={1} inputMode="numeric" type="text" value={digit} onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} onPaste={handlePaste} />
))}</div>
{error && <p className="font-caption text-caption text-error -mt-sm">{error}</p>}
<div className="flex flex-row justify-between items-center mb-md"><span className="font-body-md text-body-md text-on-surface-variant">
                        Didn't receive code?
                    </span><div className="flex items-center gap-xs"><span aria-hidden className="material-symbols-outlined text-outline text-[18px]">schedule</span><span className="font-label-md text-label-md text-outline" id="timer">{minutes}:{seconds}</span><button className="hidden font-label-md text-label-md text-primary hover:text-on-primary-fixed-variant focus:outline-none underline underline-offset-2" id="resend-btn" type="button" onClick={handleResend} disabled={resending}>
                            Resend Code
                        </button></div></div>
<button className="w-full h-touch-target bg-primary text-on-primary font-label-md text-label-md rounded-full shadow-sm hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all flex items-center justify-center gap-sm mt-sm disabled:opacity-50" type="submit" disabled={loading || otp.length !== OTP_LENGTH}>
                    {loading ? 'Verifying…' : 'Verify and Login'}
                    {!loading && <span aria-hidden className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '\'FILL\' 1' }}>login</span>}</button></form>
<div className="mt-xl text-center"><Link className="font-label-md text-label-md text-primary hover:underline underline-offset-4 flex items-center justify-center gap-xs" to="/account-recovery"><span aria-hidden className="material-symbols-outlined text-[16px]">help</span>
                    Need help logging in?
                </Link></div></div>
<p className="font-caption text-caption text-on-surface-variant mt-lg opacity-70">
            Secure Environment • District Health Office
        </p></main>
    </>
  )
}
