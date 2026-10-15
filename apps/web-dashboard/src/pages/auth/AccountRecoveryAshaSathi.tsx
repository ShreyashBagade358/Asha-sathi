import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth.service'
import { getErrorMessage } from '@/components/common/ErrorState'

export default function AccountRecoveryAshaSathi() {
  const navigate = useNavigate()
  const [contact, setContact] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const digits = contact.replace(/\D/g, '')
    if (digits.length !== 10 || sending) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setSending(true)
    setError('')
    try {
      await authService.sendOtp(digits)
      setSent(true)
      // The OTP that verifies the number also grants a fresh session, so the
      // user lands signed-in and can change their password from settings.
      setTimeout(() => navigate(`/verify-otp?phone=${digits}`, { replace: true }), 900)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-md h-touch-target md:px-lg bg-surface dark:bg-on-background shadow-sm border-b border-outline-variant dark:border-outline">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>
            medical_services
          </span>
          <span className="text-headline-md font-headline-md font-bold text-primary dark:text-primary-fixed-dim">ASHA Sathi</span>
        </div>
        <Link
          className="font-label-md text-label-md text-primary dark:text-primary-fixed-dim flex items-center gap-xs hover:bg-surface-container transition-colors p-sm rounded-lg"
          to="/login"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Login
        </Link>
      </header>
      <main className="w-full max-w-md mx-auto mt-xxl">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-lg md:p-xl">
          <div className="text-center mb-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-on-primary-container mb-md">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 0" }}>
                lock_reset
              </span>
            </div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface mb-sm">
              Account Recovery
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Enter your registered mobile number. We'll send a one-time password (OTP) to verify you and restore access.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-form-gap">
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-xs" htmlFor="recovery_contact">
                Mobile Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-sm">
                  <span className="material-symbols-outlined text-outline">contact_mail</span>
                </span>
                <input
                  className="block w-full pl-xl pr-sm py-sm min-h-[48px] bg-surface border border-outline-variant rounded-lg text-on-surface focus:ring-2 focus:ring-primary focus:border-primary placeholder-outline-variant font-body-md text-body-md transition-shadow"
                  id="recovery_contact"
                  name="recovery_contact"
                  placeholder="e.g. 9876543210"
                  required
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={contact}
                  onChange={(e) => setContact(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
            </div>
            <div className="bg-surface-container rounded-lg p-sm border border-outline-variant/50 flex gap-sm items-start">
              <span className="material-symbols-outlined text-primary mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>
                info
              </span>
              <p className="font-caption text-caption text-on-surface-variant">
                An SMS with a one-time password will be sent to this number. Verifying the code signs you in so you can set a new password.
              </p>
            </div>
            {error ? (
              <p className="text-caption text-error font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </p>
            ) : null}
            {sent ? (
              <p className="text-caption text-success font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Code sent — redirecting to verification…
              </p>
            ) : null}
            <button
              className="w-full flex justify-center items-center gap-sm bg-primary text-on-primary font-label-md text-label-md min-h-[48px] rounded-lg shadow-sm hover:bg-on-primary-fixed-variant transition-colors active:scale-95 disabled:opacity-60"
              type="submit"
              disabled={sending}
            >
              {sending ? (
                <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Send OTP
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    send
                  </span>
                </>
              )}
            </button>
          </form>
          <div className="mt-xl text-center border-t border-outline-variant pt-lg">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Remember your password?
              <Link className="font-label-md text-label-md text-primary hover:underline ml-xs" to="/login">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
