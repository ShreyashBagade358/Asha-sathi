import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function LoginAshaSathi() {
  const navigate = useNavigate()
  const { isAuthenticated, isHydrating, requestOtp } = useAuth()
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
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { otpRequestId, expiresIn } = await requestOtp(digits)
      navigate('/otp', { state: { phone: digits, otpRequestId, expiresIn } })
    } catch {
      setError('Unable to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
<div className="absolute top-0 right-0 w-2/3 h-full bg-primary-container opacity-20 -z-10 rounded-bl-full hidden md:block"></div><div className="absolute bottom-0 left-0 w-full h-1/3 bg-surface-container -z-10 block md:hidden"></div><div className="w-full max-w-md bg-surface-container-lowest md:rounded-xl md:shadow-[0px_8px_16px_rgba(0,0,0,0.1)] border md:border-outline-variant/30 flex flex-col overflow-hidden h-full md:h-auto border-none shadow-none md:p-0">
<div className="px-lg pt-xl pb-md flex flex-col items-center text-center bg-surface-container-lowest"><div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-md shadow-sm"><span className="material-symbols-outlined text-display-lg" style={{ fontVariationSettings: '\'FILL\' 1' }}>health_and_safety</span></div><h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary font-bold tracking-tight">ASHA Sathi</h1><p className="font-body-md text-body-md text-on-surface-variant mt-sm">Login to access your healthcare portal</p></div>
<div className="px-lg pb-xl flex-grow flex flex-col justify-center bg-surface-container-lowest">
<div className="flex justify-center mb-lg gap-sm"><button className="px-md py-sm rounded-full font-label-md text-label-md bg-primary text-on-primary border border-primary transition-colors flex items-center gap-xs"><span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: '\'FILL\' 1' }}>medical_services</span>
                    Health Worker
                </button><button className="px-md py-sm rounded-full font-label-md text-label-md bg-surface-container text-on-surface-variant border border-outline-variant hover:bg-surface-container-high transition-colors flex items-center gap-xs"><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person</span>
                    Patient
                </button></div><form className="space-y-form-gap" onSubmit={handleSubmit} noValidate>
<div className="flex flex-col gap-xs relative"><label className="font-label-md text-label-md text-on-surface font-semibold" htmlFor="mobile">Mobile Number or Email</label><div className="relative"><span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant">phone_iphone</span><input className="w-full h-[48px] pl-10 pr-sm py-sm bg-surface rounded-lg border border-outline-variant text-on-surface font-body-md text-body-md focus:border-primary focus:ring-2 focus:ring-primary-container outline-none transition-all placeholder:text-outline" id="mobile" placeholder="Enter mobile or email" type="text" inputMode="numeric" autoComplete="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} aria-invalid={!!error} /></div>{error && <p className="font-caption text-caption text-error">{error}</p>}</div>
<button className="w-full h-[48px] bg-[#005EB8] hover:bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-sm hover:shadow transition-all flex items-center justify-center gap-sm mt-md group" type="submit" disabled={loading || phone.length < 10}>
                    {loading ? 'Sending…' : 'Send OTP'}
                    {!loading && <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>}</button><div className="flex justify-center pt-sm"><Link className="font-label-md text-label-md text-primary hover:text-on-primary-fixed-variant hover:underline transition-colors" to="/login">Login with Password</Link></div></form>
<div className="mt-xl p-md bg-surface-container-low rounded-lg border border-outline-variant/50 flex gap-md items-start"><span className="material-symbols-outlined text-tertiary-container mt-xs" style={{ fontVariationSettings: '\'FILL\' 1' }}>info</span><div><h3 className="font-label-md text-label-md text-on-surface">Need Help?</h3><p className="font-caption text-caption text-on-surface-variant mt-xs">Contact your district coordinator if you are unable to access your assigned patient lists.</p></div></div></div></div>
    </>
  )
}
