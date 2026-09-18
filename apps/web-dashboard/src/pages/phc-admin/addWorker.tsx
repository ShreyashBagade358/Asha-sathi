import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import { useUIStore } from '@/stores/ui.store'
import { ashaService } from '@/services/asha.service'
import { isAxiosError } from 'axios'
import { PhcSidebar } from '@/components/layout/PhcSidebar'

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

const PHONE_RE = /^[6-9]\d{9}$/

export default function AddNewAshaWorkerPhcAdmin() {
  const addAshaWorker = useAppStore((s) => s.addAshaWorker)
  const { addToast } = useUIStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [village, setVillage] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [email, setEmail] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [subcenter, setSubcenter] = useState('')
  const [doj, setDoj] = useState('')

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return addToast('error', 'Full Name is required')
    if (!PHONE_RE.test(phone.replace(/\s/g, ''))) {
      return addToast('error', 'Enter a valid 10-digit mobile number starting with 6-9')
    }
    if (dob) {
      const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)
      if (age < 18) return addToast('error', 'ASHA worker must be at least 18 years old')
    }
    if (aadhaar && !/^\d{4}\s?\d{4}\s?\d{4}$/.test(aadhaar.trim())) {
      return addToast('error', 'Aadhaar must be 12 digits (e.g. 1234 5678 9012)')
    }
    if (emergencyPhone && !PHONE_RE.test(emergencyPhone.replace(/\s/g, ''))) {
      return addToast('error', 'Emergency number must be a valid 10-digit mobile')
    }

    setSaving(true)
    try {
      const created = await ashaService.createASHA({
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
        village: village || undefined,
        email: email.trim() || undefined,
        date_of_birth: dob || undefined,
        gender: (gender || undefined) as 'female' | 'male' | 'other' | undefined,
        aadhaar: aadhaar.trim() || undefined,
        emergency_contact_name: emergencyName.trim() || undefined,
        emergency_contact_phone: emergencyPhone.replace(/\D/g, '') || undefined,
        sub_center: subcenter || undefined,
        date_of_joining: doj || undefined,
      })
      addAshaWorker(created)
      addToast('success', `${created.name} registered. ASHA ID: ${created.ashaId}. They can now login with ${created.phone} via OTP.`)
      navigate('/phc/ashas')
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const detail = (err.response?.data as { detail?: string })?.detail
        if (status === 409) {
          addToast('error', detail ?? 'A user with this phone number already exists')
        } else if (status === 401 || status === 403) {
          addToast('error', 'Your session expired. Please login again.')
        } else if (detail) {
          addToast('error', typeof detail === 'string' ? detail : JSON.stringify(detail))
        } else {
          addToast('error', 'Could not reach server. Is the backend running on port 8000?')
        }
      } else {
        addToast('error', 'Something went wrong while saving')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/phc/ashas')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">person_add</span>
                Register New ASHA Worker
              </h2>
              <p className="text-caption text-on-surface-variant">
                <button onClick={() => navigate('/phc/ashas')} className="text-primary hover:underline">Workers</button>
                <span className="mx-1 text-outline">/</span>
                <span>New Worker</span>
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={saveForm} className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 flex flex-col gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full bg-surface-container border-2 border-dashed border-gray-300 flex flex-col items-center justify-center mb-4 cursor-pointer hover:bg-surface-container-high transition-colors group">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant group-hover:text-primary transition-colors">add_a_photo</span>
                  <span className="text-caption text-on-surface-variant group-hover:text-primary transition-colors">Upload Photo</span>
                </div>
                <h3 className="text-headline-md text-on-surface">Profile Picture</h3>
                <p className="text-caption text-on-surface-variant mt-1 mb-4">JPG or PNG. Max size 5MB.</p>
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-0.5 rounded-full mb-4">ASHA Worker</span>
                <div className="w-full bg-surface-container-low rounded-lg p-3 border border-outline-variant flex items-center gap-3 mt-auto">
                  <span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
                  <div className="text-left">
                    <span className="block text-label-md text-on-surface font-medium">ID Verification</span>
                    <span className="block text-caption text-on-surface-variant">Required for activation</span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h3 className="text-headline-md text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
                  Credentials
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="username">Assigned Username / ID</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">person</span>
                      </span>
                      <input className={`${inputCls} pl-11`} id="username" placeholder="e.g. ASHA-1042" type="text" />
                    </div>
                    <p className="text-caption text-on-surface-variant">Auto-generated based on district code if left blank.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-8 flex flex-col gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <div className="border-b border-outline-variant px-6 py-4 flex items-center gap-3">
                  <span className="text-lg font-bold text-blue-600">1</span>
                  <h3 className="text-headline-md font-semibold text-on-surface">Personal Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-6">
                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="fullName">Full Name *</label>
                    <input className="py-2.5 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" id="fullName" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="dob">Date of Birth *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                      </span>
                      <input className={`${inputCls} pl-11`} id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="gender">Gender *</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-10`} id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                        <option value="" disabled>Select Gender</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                      </select>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant pointer-events-none">
                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="aadhaar">Aadhaar Number *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                      </span>
                      <input className={`${inputCls} pl-11 font-mono tracking-widest`} id="aadhaar" pattern="\d{4}\s\d{4}\s\d{4}" placeholder="XXXX XXXX XXXX" type="text" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <div className="border-b border-outline-variant px-6 py-4 flex items-center gap-3">
                  <span className="text-lg font-bold text-blue-600">2</span>
                  <h3 className="text-headline-md font-semibold text-on-surface">Contact Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="mobile">Mobile Number *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">phone_iphone</span>
                      </span>
                      <input className={`${inputCls} pl-11`} id="mobile" placeholder="+91" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="email">Email Address (Optional)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">mail</span>
                      </span>
                      <input className={`${inputCls} pl-11`} id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant">Emergency Contact *</label>
                    <div className="flex flex-col md:flex-row gap-3">
                      <input className={`${inputCls} flex-1`} placeholder="Contact Name" type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
                      <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                          <span className="material-symbols-outlined text-[20px]">sos</span>
                        </span>
                        <input className={`${inputCls} pl-11`} placeholder="Emergency Number" type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <div className="border-b border-outline-variant px-6 py-4 flex items-center gap-3">
                  <span className="text-lg font-bold text-blue-600">3</span>
                  <h3 className="text-headline-md font-semibold text-on-surface">Work Assignment</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="subcenter">Reporting Sub-center *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">local_hospital</span>
                      </span>
                      <select className={`${inputCls} pl-11 appearance-none pr-10`} id="subcenter" value={subcenter} onChange={(e) => setSubcenter(e.target.value)}>
                        <option value="" disabled>Select Sub-center</option>
                        <option value="Sub Center Khasra">Sub Center Khasra</option>
                      </select>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant pointer-events-none">
                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="village">Assigned Village *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">location_on</span>
                      </span>
                      <select className={`${inputCls} pl-11 appearance-none pr-10`} id="village" value={village} onChange={(e) => setVillage(e.target.value)}>
                        <option value="" disabled>Select Village</option>
                        <option value="Khasra">Khasra</option>
                      </select>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant pointer-events-none">
                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface-variant" htmlFor="doj">Date of Joining *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">event_available</span>
                      </span>
                      <input className={`${inputCls} pl-11`} id="doj" type="date" value={doj} onChange={(e) => setDoj(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pb-4 sticky bottom-0 bg-surface/95 backdrop-blur-sm py-4 -mx-6 px-6 border-t border-outline-variant/50 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
                <button
                  className="flex items-center justify-center rounded-full px-6 py-2 font-label-md text-label-md font-semibold border border-gray-300 text-gray-600 transition-colors hover:bg-surface-container-highest"
                  type="button"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </button>
                <button
                  className="flex items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-2 font-label-md text-label-md font-semibold text-white shadow-sm transition-colors hover:bg-green-700 active:scale-[0.98] disabled:opacity-60"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Save Worker Details
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
