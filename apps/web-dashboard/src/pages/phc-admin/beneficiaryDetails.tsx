import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function riskBadgeFromPregnancy(pregnancies: { highRisk: boolean; hrpLevel?: string }[]) {
  const latest = pregnancies.length > 0 ? pregnancies[0] : null
  if (!latest) return { bg: 'bg-secondary-container', text: 'text-on-secondary-container', dot: 'bg-secondary', label: 'Low Risk' }
  if (latest.hrpLevel === 'high') return { bg: 'bg-error-container', text: 'text-on-error-container', dot: 'bg-error', label: 'High Risk' }
  if (latest.hrpLevel === 'medium') return { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', dot: 'bg-tertiary', label: 'Medium' }
  if (latest.highRisk) return { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', dot: 'bg-tertiary', label: 'Medium' }
  return { bg: 'bg-secondary-container', text: 'text-on-secondary-container', dot: 'bg-secondary', label: 'Low Risk' }
}

function statusBadge(s: string) {
  if (s === 'completed' || s === 'resolved' || s === 'given') return { bg: 'bg-secondary-container', text: 'text-on-secondary-container', dot: 'bg-secondary' }
  if (s === 'pending' || s === 'open' || s === 'scheduled' || s === 'due') return { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', dot: 'bg-tertiary' }
  if (s === 'overdue') return { bg: 'bg-error-container', text: 'text-on-error-container', dot: 'bg-error' }
  return { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', dot: 'bg-outline' }
}

function ageFromDob(dob: string): number {
  if (!dob) return 0
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return 0
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return Math.max(0, a)
}

export default function BeneficiariesPhcAdmin2() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['beneficiary-detail', id],
    queryFn: () => beneficiaryService.getBeneficiary(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
          <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center px-6 shrink-0 z-10">
            <button onClick={() => navigate('/phc/beneficiaries')} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span className="text-label-md font-semibold">Back</span>
            </button>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <LoadingState label="Loading beneficiary…" />
          </div>
        </main>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
          <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center px-6 shrink-0 z-10">
            <button onClick={() => navigate('/phc/beneficiaries')} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span className="text-label-md font-semibold">Back</span>
            </button>
          </header>
          <div className="flex-1 flex items-center justify-center px-6">
            <ErrorState message={getErrorMessage(error)} />
          </div>
        </main>
      </div>
    )
  }

  const { beneficiary: patient, pregnancies, ancVisits, children, immunizations } = data
  const rb = riskBadgeFromPregnancy(pregnancies)
  const age = ageFromDob(patient.dob)

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/phc/beneficiaries')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                {patient.name}
              </h2>
              <p className="text-caption text-on-surface-variant">
                <button onClick={() => navigate('/phc/beneficiaries')} className="text-primary hover:underline">Beneficiaries</button>
                <span className="mx-1 text-outline">/</span>
                <span>{patient.abhaId || patient.id}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold ${rb.bg} ${rb.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${rb.dot}`}></span>
              {rb.label}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <span className={`flex h-24 w-24 items-center justify-center rounded-full text-headline-lg font-headline-lg ${
                  rb.label === 'High Risk' ? 'bg-error-container text-on-error-container' : patient.isPregnant ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary-container text-on-primary-container'
                }`}>
                  {initials(patient.name)}
                </span>
                {rb.label === 'High Risk' && (
                  <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-error text-on-error">
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
                  </span>
                )}
              </div>
              <h1 className="text-headline-lg text-on-surface mb-1">{patient.name}</h1>
              <p className="text-body-md text-on-surface-variant mb-2">{patient.abhaId || `ID: ${patient.id}`}</p>
              <div className="flex gap-2 mb-4">
                {patient.isPregnant && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container text-on-tertiary-container px-3 py-1 text-caption font-semibold">
                    <span className="material-symbols-outlined text-[12px]">pregnant_woman</span>
                    Pregnant
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold ${rb.bg} ${rb.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${rb.dot}`}></span>
                  {rb.label}
                </span>
              </div>
              <div className="flex w-full gap-2 mt-auto">
                {patient.phone ? (
                  <a href={`tel:+91${patient.phone}`} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary-container px-4 py-2 text-label-md font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary">
                    <span className="material-symbols-outlined text-[18px]">call</span>
                    Call
                  </a>
                ) : (
                  <button disabled className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary-container/50 px-4 py-2 text-label-md font-semibold text-on-primary-container/50 cursor-not-allowed">
                    <span className="material-symbols-outlined text-[18px]">call</span>
                    Call
                  </button>
                )}
                <button className="flex flex-1 items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container">
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  Message
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
              <h3 className="text-headline-md text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                Personal Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Age', value: age > 0 ? `${age} years` : '—', icon: 'cake' },
                  { label: 'Gender', value: patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '—', icon: 'person' },
                  { label: 'Phone', value: patient.phone ? `+91 ${patient.phone}` : '—', icon: 'phone' },
                  { label: 'Marital Status', value: patient.maritalStatus ? patient.maritalStatus.charAt(0).toUpperCase() + patient.maritalStatus.slice(1) : '—', icon: 'favorite' },
                  { label: 'Village', value: patient.village || '—', icon: 'location_on' },
                  { label: 'Registered', value: patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', icon: 'calendar_today' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{item.icon}</span>
                    <div>
                      <p className="text-caption text-on-surface-variant">{item.label}</p>
                      <p className="text-body-md text-on-surface font-medium">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {patient.ashaId && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </span>
                <div>
                  <p className="text-label-md text-on-surface-variant">Assigned ASHA Worker</p>
                  <p className="text-body-md text-on-surface font-medium">{patient.ashaId}</p>
                </div>
              </div>
              <Link to={`/phc/ashas/${patient.ashaId}`} className="flex items-center gap-1.5 rounded-full border border-outline px-3 py-1.5 text-label-md font-semibold text-primary hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[14px]">visibility</span>
                View Profile
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Pregnancies</span>
                <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">pregnant_woman</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{pregnancies.length}</div>
              <div className="text-caption text-on-surface-variant mt-1">ANC records</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">ANC Visits</span>
                <div className="bg-tertiary-container text-on-tertiary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">medical_services</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{ancVisits.length}</div>
              <div className="text-caption text-on-surface-variant mt-1">Total visits</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="text-label-md text-on-surface-variant">Children</span>
                <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">child_care</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface font-display-lg">{children.length}</div>
              <div className="text-caption text-on-surface-variant mt-1">Registered children</div>
            </div>
          </div>

          {ancVisits.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">stethoscope</span>
                <h3 className="text-headline-md font-semibold text-on-surface">ANC Visits</h3>
                <span className="text-caption text-on-surface-variant ml-auto">{ancVisits.length} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container-low/50">
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Visit #</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Date</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Week</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">BP</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Weight</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Hb</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Fundal Height</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ancVisits.slice(0, 5).map((v, i) => (
                      <tr key={v.id} className={`transition-colors hover:bg-surface-container-low/40 ${i < ancVisits.length - 1 ? 'border-b border-outline-variant/40' : ''} ${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}>
                        <td className="px-5 py-3 text-body-md text-on-surface font-medium">{v.visitNumber}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface whitespace-nowrap">{v.date || '—'}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface">{v.gestationWeek || '—'}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface">{v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : '—'}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface">{v.weightKg ? `${v.weightKg} kg` : '—'}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface">{v.haemoglobin ? `${v.haemoglobin} g/dL` : '—'}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface">{v.fundalHeight ? `${v.fundalHeight} cm` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {pregnancies.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">pregnant_woman</span>
                <h3 className="text-headline-md font-semibold text-on-surface">Pregnancy Records</h3>
              </div>
              <div className="p-5 space-y-4">
                {pregnancies.map((p) => {
                  const prb = p.hrpLevel === 'high'
                    ? { bg: 'bg-error-container', text: 'text-on-error-container', dot: 'bg-error', label: 'High Risk' }
                    : p.hrpLevel === 'medium'
                      ? { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', dot: 'bg-tertiary', label: 'Medium' }
                      : { bg: 'bg-secondary-container', text: 'text-on-secondary-container', dot: 'bg-secondary', label: 'Low Risk' }
                  return (
                    <div key={p.id} className="bg-surface rounded-xl p-5 border border-outline-variant/50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-body-md font-medium text-on-surface">Pregnancy Record</p>
                          <p className="text-caption text-on-surface-variant">LMP: {p.lmp || '—'} · EDD: {p.edd || '—'}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${prb.bg} ${prb.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${prb.dot}`}></span>
                          {prb.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <p className="text-caption text-on-surface-variant">Gravida</p>
                          <p className="text-body-md font-medium text-on-surface">{p.gravida || '—'}</p>
                        </div>
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <p className="text-caption text-on-surface-variant">Para</p>
                          <p className="text-body-md font-medium text-on-surface">{p.para || '—'}</p>
                        </div>
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <p className="text-caption text-on-surface-variant">Status</p>
                          <p className="text-body-md font-medium text-on-surface capitalize">{p.status}</p>
                        </div>
                        <div className="bg-surface-container-low rounded-lg p-3">
                          <p className="text-caption text-on-surface-variant">Registered</p>
                          <p className="text-body-md font-medium text-on-surface">{p.registeredAt ? new Date(p.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                        </div>
                      </div>
                      {p.complications.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-outline-variant/50">
                          <p className="text-caption text-on-surface-variant mb-1">Complications</p>
                          <div className="flex flex-wrap gap-1.5">
                            {p.complications.map((c, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-error-container/50 text-on-error-container px-2.5 py-0.5 text-caption font-medium">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {children.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">child_care</span>
                <h3 className="text-headline-md font-semibold text-on-surface">Children</h3>
                <span className="text-caption text-on-surface-variant ml-auto">{children.length} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container-low/50">
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Name</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Gender</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Birth Weight</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Delivery Type</th>
                      <th className="px-5 py-3 text-label-md font-semibold text-on-surface-variant">Born at Facility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((c, i) => (
                      <tr key={c.id} className={`transition-colors hover:bg-surface-container-low/40 ${i < children.length - 1 ? 'border-b border-outline-variant/40' : ''} ${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}>
                        <td className="px-5 py-3 text-body-md text-on-surface font-medium">{c.name}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface capitalize">{c.gender}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface">{c.birthWeightKg ? `${c.birthWeightKg} kg` : '—'}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface capitalize">{c.deliveryType}</td>
                        <td className="px-5 py-3 text-body-md text-on-surface">{c.bornAtFacility ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {immunizations.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">vaccines</span>
                <h3 className="text-headline-md font-semibold text-on-surface">Immunizations</h3>
                <span className="text-caption text-on-surface-variant ml-auto">{immunizations.length} total</span>
              </div>
              <div className="divide-y divide-outline-variant/50">
                {immunizations.slice(0, 10).map((im) => {
                  const fsb = statusBadge(im.status)
                  return (
                    <div key={im.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-container-low/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${fsb.bg} ${fsb.text}`}>
                          <span className="material-symbols-outlined text-[18px]">{im.status === 'given' ? 'check_circle' : im.status === 'overdue' ? 'warning' : 'schedule'}</span>
                        </span>
                        <div>
                          <p className="text-body-md text-on-surface font-medium">{im.vaccineName}</p>
                          <p className="text-caption text-on-surface-variant">Dose {im.doseNumber} · Due: {im.dueDate || '—'}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${fsb.bg} ${fsb.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${fsb.dot}`}></span>
                        {im.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {pregnancies.length === 0 && ancVisits.length === 0 && children.length === 0 && immunizations.length === 0 && (
            <EmptyState
              title="No timeline records"
              description="No pregnancy, ANC visit, child, or immunization records found for this beneficiary."
              icon="timeline"
            />
          )}
        </div>
      </main>
    </div>
  )
}
