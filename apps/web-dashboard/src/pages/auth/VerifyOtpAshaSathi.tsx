import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui.store'
import { authService } from '@/services/auth.service'

const INPUT_CLS =
  'w-12 h-14 text-center text-headline-md font-semibold bg-surface border border-outline-variant rounded-lg text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-shadow'

export default function VerifyOtpAshaSathi() {
  const [params] = useSearchParams()
  const phone = params.get('phone') ?? ''
  const navigate = useNavigate()
  const { signInWithOtp } = useAuth()
  const { addToast } = useUIStore()

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [seconds, setSeconds] = useState(45)
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const otp = useMemo(() => digits.join(''), [digits])
  const complete = otp.length === 6 && /^\d{6}$/.test(otp)

  // Countdown for resend.
  useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  const setDigit = (index: number, value: string) => {
    const ch = value.replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = ch
      return next
    })
    if (ch && index < 5) refs.current[index + 1]?.focus()
  }

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = Array(6).fill('')
    pasted.split('').forEach((ch, i) => (next[i] = ch))
    setDigits(next)
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!complete || verifying || !phone) return
    setVerifying(true)
    try {
      await signInWithOtp(phone, otp)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const resend = async () => {
    if (resending || seconds > 0 || !phone) return
    setResending(true)
    try {
      await authService.sendOtp(phone)
      setSeconds(45)
      addToast('success', 'Code sent')
    } catch {
      addToast('error', 'Could not send the code. Try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface px-4 py-12">
      <main className="w-full max-w-md">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-headline-lg text-on-surface mb-2">Verify Code</h1>
            <p className="text-body-md text-on-surface-variant">
              Enter the 6-digit code sent to {phone ? `+91 ${phone}` : 'your mobile'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="flex justify-center gap-2" onPaste={onPaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el
                  }}
                  className={INPUT_CLS}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
                  }}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={!complete || verifying}
              className="w-full h-12 rounded-lg bg-primary text-on-primary font-label-md font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors hover:bg-primary/90"
            >
              {verifying ? <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 'Verify & Continue'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={resend}
              disabled={resending || seconds > 0}
              className="text-label-md text-primary disabled:text-on-surface-variant font-semibold"
            >
              {seconds > 0 ? `Resend code in ${seconds}s` : resending ? 'Sending…' : 'Resend code'}
            </button>
          </div>

          <div className="mt-6 text-center border-t border-outline-variant pt-6">
            <Link to="/login" className="text-body-md text-primary hover:underline">
              Back to Login
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
