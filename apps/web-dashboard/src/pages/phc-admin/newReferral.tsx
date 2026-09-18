import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { referralService } from '@/services/referral.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { useUIStore } from '@/stores/ui.store'
import { isAxiosError } from 'axios'
import type { ReferralUrgency } from '@/pages/asha/mockData'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

const FACILITIES = [
  'District Hospital (DH)',
  'Community Health Centre (CHC)',
  'Specialist Maternal Clinic',
  'Tertiary Care Center',
]

export default function CreateNewReferralPhcAdmin() {
  const { addToast } = useUIStore()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [toFacility, setToFacility] = useState('')
  const [urgency, setUrgency] = useState<ReferralUrgency>('routine')
  const [reason, setReason] = useState('')
  const [clinicalSummary, setClinicalSummary] = useState('')
  const [fromFacility, setFromFacility] = useState('')
  const [saving, setSaving] = useState(false)

  const {
    data: beneficiariesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['beneficiaries', 'options'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const beneficiaries = beneficiariesData?.items ?? []

  const filteredPatients = beneficiaries.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
  )

  const sendReferral = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPatient) {
      addToast('error', 'Please select a patient')
      return
    }
    if (!toFacility.trim()) {
      addToast('error', 'Please choose a Destination Facility')
      return
    }
    if (!reason.trim()) {
      addToast('error', 'Please fill Reason for Referral & Clinical Notes')
      return
    }

    setSaving(true)
    try {
      const created = await referralService.createReferral({
        beneficiaryId: selectedPatient,
        referralType: 'general',
        urgency,
        reason: reason.trim(),
        clinicalSummary: clinicalSummary.trim() || undefined,
        referredTo: toFacility.trim(),
        referredFrom: fromFacility.trim() || undefined,
      })
      addToast('success', `Referral created for ${created.id}`)
      navigate('/phc/referrals')
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? err.message : 'Failed to create referral'
      addToast('error', msg)
    } finally {
      setSaving(false)
    }
  }

  const selectedPatientObj = beneficiaries.find((p) => p.id === selectedPatient)

  const urgencyOptions: { value: ReferralUrgency; label: string; icon: string; color: string; selectedBorder: string; selectedBg: string; selectedText: string }[] = [
    { value: 'routine', label: 'Routine', icon: 'assignment', color: 'text-on-surface-variant', selectedBorder: 'border-primary', selectedBg: 'bg-primary-container/30', selectedText: 'text-on-primary-container' },
    { value: 'urgent', label: 'Urgent', icon: 'timer', color: 'text-on-surface-variant', selectedBorder: 'border-tertiary', selectedBg: 'bg-tertiary-container/30', selectedText: 'text-on-tertiary-container' },
    { value: 'emergency', label: 'Emergency', icon: 'emergency', color: 'text-on-surface-variant', selectedBorder: 'border-error', selectedBg: 'bg-error-container/30', selectedText: 'text-on-error-container' },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/phc/referrals')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
              <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">send</span>
                Create New Referral
              </h2>
              <p className="text-caption text-on-surface-variant hidden md:block">
                <button onClick={() => navigate('/phc/referrals')} className="text-primary hover:underline">Referrals</button>
                <span className="mx-1 text-outline">/</span>
                <span>New Referral</span>
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <form className="max-w-4xl mx-auto flex flex-col gap-5" onSubmit={sendReferral}>

            {/* Section 1: Patient Selection */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">person_search</span>
                <h3 className="text-title-md font-bold text-on-surface">1. Patient Selection</h3>
              </div>
              <div className="p-5 flex flex-col gap-4">
                {isLoading ? (
                  <LoadingState label="Loading beneficiaries…" />
                ) : isError ? (
                  <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
                ) : (
                  <>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
                      <input
                        className={`${inputCls} pl-11`}
                        placeholder="Search by name, ID, or phone number..."
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setSelectedPatient(null) }}
                      />
                    </div>

                    {search && !selectedPatient && (
                      <div className="border border-outline-variant rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {filteredPatients.slice(0, 5).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
                            onClick={() => { setSearch(p.name); setSelectedPatient(p.id) }}
                          >
                            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-semibold text-caption shrink-0">
                              {p.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-on-surface font-medium truncate">{p.name}</div>
                              <div className="text-caption text-on-surface-variant">ID: {p.id} · {p.gender} · {p.village || '—'}</div>
                            </div>
                          </button>
                        ))}
                        {filteredPatients.length === 0 && (
                          <div className="px-4 py-6 text-center text-caption text-on-surface-variant">
                            No patients found matching "{search}"
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPatient && selectedPatientObj && (
                      <div className="relative flex items-center p-4 bg-surface border border-outline-variant rounded-lg">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary rounded-l-lg" />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <h4 className="font-semibold text-on-surface">{selectedPatientObj.name}</h4>
                              <p className="text-caption text-on-surface-variant">
                                ID: {selectedPatientObj.id} · {selectedPatientObj.gender} · {selectedPatientObj.village || '—'}
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-caption font-medium shrink-0">
                              Selected
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ml-3 p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/30 transition-colors"
                          onClick={() => { setSelectedPatient(null); setSearch('') }}
                        >
                          <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Section 2: Clinical Details */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">local_hospital</span>
                <h3 className="text-title-md font-semibold text-on-surface">2. Clinical Details</h3>
              </div>
              <div className="p-5 flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="destination">Destination Facility *</label>
                  <div className="relative">
                    <select
                      className="w-full rounded-lg border border-outline bg-surface px-4 py-2.5 text-on-surface appearance-none pr-10 transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      id="destination"
                      value={toFacility}
                      onChange={(e) => setToFacility(e.target.value)}
                    >
                      <option disabled value="">Select facility type...</option>
                      {FACILITIES.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant pointer-events-none">
                      <span className="material-symbols-outlined text-[20px]">expand_more</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-label-md text-on-surface-variant">Clinical Priority *</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {urgencyOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`flex items-center justify-center gap-2 h-12 rounded-lg font-medium transition-all ${
                          urgency === opt.value
                            ? `border-2 ${opt.selectedBorder} ${opt.selectedBg} ${opt.selectedText}`
                            : 'border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low'
                        }`}
                        onClick={() => setUrgency(opt.value)}
                      >
                        <span className="material-symbols-outlined text-[20px]">{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="reason">Reason for Referral & Clinical Notes *</label>
                  <textarea
                    className="min-h-[100px] resize-y rounded-lg border border-outline bg-surface p-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    id="reason"
                    placeholder="Enter symptoms, preliminary diagnosis, and reason for transfer..."
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="summary">Clinical Summary (Optional)</label>
                  <textarea
                    className="min-h-[80px] resize-y rounded-lg border border-outline bg-surface p-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    id="summary"
                    placeholder="Summary of vitals, lab results, treatment so far..."
                    rows={3}
                    value={clinicalSummary}
                    onChange={(e) => setClinicalSummary(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Logistics */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">directions_car</span>
                <h3 className="text-title-md font-semibold text-on-surface">3. Logistics</h3>
              </div>
              <div className="p-5 flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="fromFacility">Referring Facility</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[20px]">local_hospital</span>
                    <input className={`${inputCls} pl-11`} id="fromFacility" placeholder="E.g., PHC Danapur" type="text" value={fromFacility} onChange={(e) => setFromFacility(e.target.value)} />
                  </div>
                </div>
              </div>
            </section>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pb-4">
              <button
                className="flex items-center justify-center rounded-full px-6 py-2 font-label-md text-label-md font-semibold border-gray-300 text-gray-600 border hover:bg-gray-50 transition-colors"
                type="button"
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-2 font-label-md text-label-md font-semibold text-white shadow-sm transition-colors hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                type="submit"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Referral
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}