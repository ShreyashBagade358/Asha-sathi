import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { useUIStore } from '@/stores/ui.store'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ageFromDob(iso: string): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000)))
}

function weekFromLmp(lmp: string): number {
  if (!lmp) return 0
  const start = new Date(lmp).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / (7 * 86400000)))
}

export default function PregnancyDetailsPhcAdmin() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { addToast } = useUIStore()

  const { data: pregnancy, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pregnancy', id],
    queryFn: () => pregnancyService.getPregnancy(id ?? ''),
    enabled: !!id,
  })

  const { data: visits, isLoading: visitsLoading, isError: visitsError, error: visitsErrorObj, refetch: visitsRefetch } = useQuery({
    queryKey: ['pregnancy-anc', id],
    queryFn: () => pregnancyService.listANCVisits(id ?? ''),
    enabled: !!id,
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const { data: pncVisits } = useQuery({
    queryKey: ['pregnancy-pnc', id],
    queryFn: () => pregnancyService.listPNCVisits(id ?? ''),
    enabled: !!id,
  })

  const { data: delivery } = useQuery({
    queryKey: ['pregnancy-delivery', id],
    queryFn: () => pregnancyService.getDeliveryOutcome(id ?? ''),
    enabled: !!id,
  })

  const [openForm, setOpenForm] = useState<'anc' | 'pnc' | 'delivery' | 'birthplan' | null>(null)
  const [ancForm, setAncForm] = useState({ visitDate: '', bpSystolic: '', bpDiastolic: '', weightKg: '', hemoglobin: '' })
  const [pncForm, setPncForm] = useState({ visitDate: '', bpSystolic: '', bpDiastolic: '', bleedingStatus: 'normal', breastfeedingStatus: 'exclusive', referralMade: false })
  const [deliveryForm, setDeliveryForm] = useState({ deliveryDate: '', placeOfDelivery: 'phc', deliveryType: 'normal', outcome: 'live_birth', birthWeightGrams: '' })
  const [birthPlanForm, setBirthPlanForm] = useState({ transportArranged: false, bloodDonorArranged: false, companionName: '', companionPhone: '', emergencyContactName: '', emergencyContactPhone: '', fundsArranged: false })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pregnancy-anc', id] })
    qc.invalidateQueries({ queryKey: ['pregnancy-pnc', id] })
    qc.invalidateQueries({ queryKey: ['pregnancy-delivery', id] })
    qc.invalidateQueries({ queryKey: ['pregnancies'] })
  }

  const addAncMutation = useMutation({
    mutationFn: () => pregnancyService.addANCVisit(id ?? '', {
      visitDate: ancForm.visitDate,
      bpSystolic: ancForm.bpSystolic ? Number(ancForm.bpSystolic) : undefined,
      bpDiastolic: ancForm.bpDiastolic ? Number(ancForm.bpDiastolic) : undefined,
      weightKg: ancForm.weightKg ? Number(ancForm.weightKg) : undefined,
      hemoglobin: ancForm.hemoglobin ? Number(ancForm.hemoglobin) : undefined,
    }),
    onSuccess: () => { invalidate(); setOpenForm(null); setAncForm({ visitDate: '', bpSystolic: '', bpDiastolic: '', weightKg: '', hemoglobin: '' }); addToast('success', 'ANC visit recorded.') },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const addPncMutation = useMutation({
    mutationFn: () => pregnancyService.addPNCVisit(id ?? '', {
      visitDate: pncForm.visitDate,
      bpSystolic: pncForm.bpSystolic ? Number(pncForm.bpSystolic) : undefined,
      bpDiastolic: pncForm.bpDiastolic ? Number(pncForm.bpDiastolic) : undefined,
      bleedingStatus: pncForm.bleedingStatus,
      breastfeedingStatus: pncForm.breastfeedingStatus,
      referralMade: pncForm.referralMade,
    }),
    onSuccess: () => { invalidate(); setOpenForm(null); addToast('success', 'PNC visit recorded.') },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const recordDeliveryMutation = useMutation({
    mutationFn: () => pregnancyService.recordDelivery(id ?? '', {
      deliveryDate: deliveryForm.deliveryDate,
      placeOfDelivery: deliveryForm.placeOfDelivery,
      deliveryType: deliveryForm.deliveryType,
      outcome: deliveryForm.outcome,
      birthWeightGrams: deliveryForm.birthWeightGrams ? Number(deliveryForm.birthWeightGrams) : undefined,
    }),
    onSuccess: () => { invalidate(); setOpenForm(null); addToast('success', 'Delivery outcome recorded.') },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const saveBirthPlanMutation = useMutation({
    mutationFn: () => pregnancyService.saveBirthPlan(id ?? '', {
      transportArranged: birthPlanForm.transportArranged,
      bloodDonorArranged: birthPlanForm.bloodDonorArranged,
      companionName: birthPlanForm.companionName,
      companionPhone: birthPlanForm.companionPhone,
      emergencyContactName: birthPlanForm.emergencyContactName,
      emergencyContactPhone: birthPlanForm.emergencyContactPhone,
      fundsArranged: birthPlanForm.fundsArranged,
    }),
    onSuccess: () => { invalidate(); setOpenForm(null); addToast('success', 'Birth plan saved.') },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const beneficiary = useMemo(() => {
    if (!pregnancy) return undefined
    return benData?.items?.find((b) => b.id === pregnancy.beneficiaryId)
  }, [benData, pregnancy])

  const deleteMutation = useMutation({
    mutationFn: () => pregnancyService.deletePregnancy(id ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pregnancies'] })
      addToast('success', 'Pregnancy record deleted.')
      navigate('/phc/maternal')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const confirmDelete = () => {
    if (window.confirm('Delete this pregnancy record? This cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) {
    return (
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading pregnancy details…" />
        </div>
    )
  }

  if (isError) {
    return (
        <div className="flex items-center justify-center py-24">
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </div>
    )
  }

  if (!pregnancy) {
    return (
        <div className="flex items-center justify-center py-24">
          <EmptyState title="Pregnancy not found" icon="pregnant_woman" />
        </div>
    )
  }

  const week = weekFromLmp(pregnancy.lmp)
  const age = beneficiary ? ageFromDob(beneficiary.dob) : null
  const hrp = pregnancy.hrpLevel ?? (pregnancy.highRisk ? 'high' : 'low')

  return (
      <div className="mx-auto w-full max-w-[1440px] flex flex-col gap-6">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <a href="/phc/maternal" className="flex items-center gap-1 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span className="text-sm">Back to Directory</span>
          </a>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-display-lg font-bold shrink-0">
              {(beneficiary?.name ?? '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-label-md flex items-center gap-1 ${hrp === 'high' || hrp === 'medium' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  {hrp === 'high' || hrp === 'medium' ? 'High Risk' : 'Standard Risk'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-on-surface-variant text-body-md">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">id_card</span> ID: {pregnancy.id.replace(/-/g, '').slice(0, 6).toUpperCase()}</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">cake</span> {age != null ? `${age} Years` : '—'}</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">home</span> {beneficiary?.village ?? '—'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={() => navigate(`/phc/beneficiaries/${pregnancy.beneficiaryId}`)}
              className="border border-primary text-primary px-4 py-2 rounded-full font-label-md hover:bg-primary hover:text-on-primary transition-colors h-12 flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              <span className="material-symbols-outlined">edit</span>
              Edit Profile
            </button>
            <button
              onClick={() => navigate('/phc/referrals/new')}
              className="bg-error text-on-error px-4 py-2 rounded-full font-label-md hover:opacity-90 transition-opacity h-12 flex items-center justify-center gap-1 w-full sm:w-auto shadow-sm"
            >
              <span className="material-symbols-outlined">local_hospital</span>
              Refer Patient
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="border border-error text-error px-4 py-2 rounded-full font-label-md hover:bg-error-container/40 transition-colors h-12 flex items-center justify-center gap-1 w-full sm:w-auto disabled:opacity-50"
            >
              <span className="material-symbols-outlined">delete</span>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant shadow-sm border-l-4 border-l-primary flex flex-col justify-center">
            <p className="text-caption text-on-surface-variant mb-1">Expected Delivery Date (EDD)</p>
            <p className="text-2xl font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">calendar_month</span>
              {formatDate(pregnancy.edd)}
            </p>
          </div>
          <div className={`bg-surface-container-lowest p-4 rounded-lg border border-outline-variant shadow-sm ${hrp === 'high' || hrp === 'medium' ? 'border-l-4 border-l-error' : 'border-l-4 border-l-primary'} flex flex-col justify-center`}>
            <p className="text-caption text-on-surface-variant mb-1">Gestational Age</p>
            <p className={`text-2xl font-semibold flex items-center gap-2 ${hrp === 'high' || hrp === 'medium' ? 'text-error' : 'text-on-surface'}`}>
              <span className="material-symbols-outlined">pregnant_woman</span>
              {week > 0 ? `${week} Weeks` : '—'}
            </p>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant shadow-sm flex flex-col justify-center">
            <p className="text-caption text-on-surface-variant mb-1">Status</p>
            <p className="text-2xl font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">bloodtype</span>
              {pregnancy.status.charAt(0).toUpperCase() + pregnancy.status.slice(1)}
            </p>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant shadow-sm flex flex-col justify-center">
            <p className="text-caption text-on-surface-variant mb-1">Gravida / Para</p>
            <p className="text-2xl font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">family_restroom</span>
              G{pregnancy.gravida || '—'} P{pregnancy.para || '—'}
            </p>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center">
            <h2 className="text-xl font-semibold text-on-surface">Antenatal Care (ANC) Schedule</h2>
            <button
              onClick={() => setOpenForm(openForm === 'anc' ? null : 'anc')}
              className="flex items-center gap-1 bg-primary text-on-primary px-3 py-1.5 rounded-full text-label-md hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Antenatal Care (ANC) Visit
            </button>
          </div>
          {openForm === 'anc' ? (
            <div className="p-4 border-b border-outline-variant bg-surface-container-low grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
              <label className="text-caption text-on-surface-variant">Visit date *
                <input type="date" value={ancForm.visitDate} onChange={(e) => setAncForm({ ...ancForm, visitDate: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" required />
              </label>
              <label className="text-caption text-on-surface-variant">BP systolic
                <input type="number" value={ancForm.bpSystolic} onChange={(e) => setAncForm({ ...ancForm, bpSystolic: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" placeholder="120" />
              </label>
              <label className="text-caption text-on-surface-variant">BP diastolic
                <input type="number" value={ancForm.bpDiastolic} onChange={(e) => setAncForm({ ...ancForm, bpDiastolic: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" placeholder="80" />
              </label>
              <label className="text-caption text-on-surface-variant">Weight (kg)
                <input type="number" step="0.1" value={ancForm.weightKg} onChange={(e) => setAncForm({ ...ancForm, weightKg: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
              </label>
              <label className="text-caption text-on-surface-variant">Hb (g/dL)
                <input type="number" step="0.1" value={ancForm.hemoglobin} onChange={(e) => setAncForm({ ...ancForm, hemoglobin: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
              </label>
              <button
                onClick={() => addAncMutation.mutate()}
                disabled={!ancForm.visitDate || addAncMutation.isPending}
                className="bg-primary text-on-primary px-4 py-2 rounded-full text-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {addAncMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : null}
          <div className="p-6 flex-1 flex flex-col gap-4 bg-surface-container-lowest">
            {visitsLoading ? (
              <LoadingState label="Loading antenatal care visits…" />
            ) : visitsError ? (
              <ErrorState message={getErrorMessage(visitsErrorObj)} onRetry={visitsRefetch} />
            ) : (visits ?? []).length === 0 ? (
              <EmptyState title="No antenatal care visits recorded" icon="pregnant_woman" />
            ) : (
              <div className="relative border-l-2 border-surface-variant ml-3 space-y-6 pb-2">
                {(visits ?? []).map((v) => (
                  <div key={v.id} className="relative pl-5">
                    <span className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-secondary text-on-secondary flex items-center justify-center border-4 border-surface-container-lowest">
                      <span className="material-symbols-outlined text-[12px]">check</span>
                    </span>
                    <div className="bg-surface rounded-lg p-4 border border-outline-variant">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-label-md text-on-surface">Antenatal visit {v.visitNumber}{v.gestationWeek > 0 ? ` - ${v.gestationWeek} Weeks` : ''}</h3>
                        </div>
                        <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded text-caption">Completed</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <p className="text-caption text-outline">Blood Pressure</p>
                          <p className="text-body-md font-semibold text-on-surface">{(v.bpSystolic != null && v.bpDiastolic != null) ? `${v.bpSystolic}/${v.bpDiastolic} mmHg` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-caption text-outline">Weight</p>
                          <p className="text-body-md text-on-surface">{v.weightKg != null ? `${v.weightKg} kg` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-caption text-outline">Hb Level</p>
                          <p className="text-body-md text-on-surface">{v.haemoglobin != null ? `${v.haemoglobin} g/dL` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-caption text-outline">FHR</p>
                          <p className="text-body-md text-on-surface">{v.foetalHeartRate != null ? `${v.foetalHeartRate} bpm` : '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center">
              <h2 className="text-xl font-semibold text-on-surface">Postnatal Care (PNC) Visits</h2>
              <button
                onClick={() => setOpenForm(openForm === 'pnc' ? null : 'pnc')}
                className="flex items-center gap-1 bg-primary text-on-primary px-3 py-1.5 rounded-full text-label-md hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Postnatal Care (PNC) Visit
              </button>
            </div>
            {openForm === 'pnc' ? (
              <div className="p-4 border-b border-outline-variant bg-surface-container-low grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
                <label className="text-caption text-on-surface-variant">Visit date *
                  <input type="date" value={pncForm.visitDate} onChange={(e) => setPncForm({ ...pncForm, visitDate: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
                </label>
                <label className="text-caption text-on-surface-variant">Bleeding
                  <select value={pncForm.bleedingStatus} onChange={(e) => setPncForm({ ...pncForm, bleedingStatus: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface">
                    <option value="normal">Normal</option>
                    <option value="heavy">Heavy</option>
                    <option value="profuse">Profuse</option>
                  </select>
                </label>
                <label className="text-caption text-on-surface-variant">Breastfeeding
                  <select value={pncForm.breastfeedingStatus} onChange={(e) => setPncForm({ ...pncForm, breastfeedingStatus: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface">
                    <option value="exclusive">Exclusive</option>
                    <option value="partial">Partial</option>
                    <option value="none">None</option>
                  </select>
                </label>
                <label className="text-caption text-on-surface-variant">BP systolic
                  <input type="number" value={pncForm.bpSystolic} onChange={(e) => setPncForm({ ...pncForm, bpSystolic: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
                </label>
                <label className="flex items-center gap-2 text-body-md text-on-surface self-end pb-1.5">
                  <input type="checkbox" checked={pncForm.referralMade} onChange={(e) => setPncForm({ ...pncForm, referralMade: e.target.checked })} />
                  Referral made
                </label>
                <button
                  onClick={() => addPncMutation.mutate()}
                  disabled={!pncForm.visitDate || addPncMutation.isPending}
                  className="bg-primary text-on-primary px-4 py-2 rounded-full text-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {addPncMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
            <div className="p-5">
              {(pncVisits ?? []).length === 0 ? (
                <p className="text-body-md text-on-surface-variant">No postnatal care visits recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {(pncVisits ?? []).map((v) => (
                    <div key={v.id} className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface p-3">
                      <div>
                        <p className="text-body-md font-semibold text-on-surface">Postnatal visit {v.visit_number} · {formatDate(v.visit_date)}</p>
                      </div>
                      {v.referral_made ? (
                        <span className="bg-error-container text-on-error-container px-2 py-1 rounded text-caption">Referred</span>
                      ) : (
                        <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded text-caption">OK</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center">
              <h2 className="text-xl font-semibold text-on-surface">Delivery Outcome</h2>
              {!delivery ? (
                <button
                  onClick={() => setOpenForm(openForm === 'delivery' ? null : 'delivery')}
                  className="flex items-center gap-1 bg-primary text-on-primary px-3 py-1.5 rounded-full text-label-md hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Record Delivery
                </button>
              ) : null}
            </div>
            {openForm === 'delivery' ? (
              <div className="p-4 border-b border-outline-variant bg-surface-container-low grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
                <label className="text-caption text-on-surface-variant">Delivery date *
                  <input type="date" value={deliveryForm.deliveryDate} onChange={(e) => setDeliveryForm({ ...deliveryForm, deliveryDate: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
                </label>
                <label className="text-caption text-on-surface-variant">Place
                  <select value={deliveryForm.placeOfDelivery} onChange={(e) => setDeliveryForm({ ...deliveryForm, placeOfDelivery: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface">
                    <option value="home">Home</option>
                    <option value="phc">PHC</option>
                    <option value="chc">CHC</option>
                    <option value="private_hospital">Private hospital</option>
                  </select>
                </label>
                <label className="text-caption text-on-surface-variant">Type
                  <select value={deliveryForm.deliveryType} onChange={(e) => setDeliveryForm({ ...deliveryForm, deliveryType: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface">
                    <option value="normal">Normal</option>
                    <option value="c-section">C-section</option>
                    <option value="assisted">Assisted</option>
                  </select>
                </label>
                <label className="text-caption text-on-surface-variant">Outcome
                  <select value={deliveryForm.outcome} onChange={(e) => setDeliveryForm({ ...deliveryForm, outcome: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface">
                    <option value="live_birth">Live birth</option>
                    <option value="stillbirth">Stillbirth</option>
                    <option value="early_neonatal_death">Early neonatal death</option>
                  </select>
                </label>
                <label className="text-caption text-on-surface-variant">Birth weight (g)
                  <input type="number" value={deliveryForm.birthWeightGrams} onChange={(e) => setDeliveryForm({ ...deliveryForm, birthWeightGrams: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" placeholder="2800" />
                </label>
                <button
                  onClick={() => recordDeliveryMutation.mutate()}
                  disabled={!deliveryForm.deliveryDate || recordDeliveryMutation.isPending}
                  className="bg-primary text-on-primary px-4 py-2 rounded-full text-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {recordDeliveryMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
            <div className="p-5">
              {delivery ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-body-md font-semibold text-on-surface">{formatDate(delivery.delivery_date ?? '')}</p>
                  </div>
                  <div>
                    <p className="text-body-md text-on-surface">{delivery.place_of_delivery ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-body-md text-on-surface">{delivery.delivery_type ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-body-md text-on-surface">{delivery.birth_weight_grams != null ? `${delivery.birth_weight_grams} g` : '—'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-body-md text-on-surface-variant">Delivery not recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center">
            <h2 className="text-xl font-semibold text-on-surface">Birth Plan</h2>
            <button
              onClick={() => setOpenForm(openForm === 'birthplan' ? null : 'birthplan')}
              className="flex items-center gap-1 bg-primary text-on-primary px-3 py-1.5 rounded-full text-label-md hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">{openForm === 'birthplan' ? 'close' : 'edit'}</span>
              {openForm === 'birthplan' ? 'Close' : 'Edit Plan'}
            </button>
          </div>
          {openForm === 'birthplan' ? (
            <div className="p-4 border-b border-outline-variant bg-surface-container-low grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <label className="flex items-center gap-2 text-body-md text-on-surface">
                <input type="checkbox" checked={birthPlanForm.transportArranged} onChange={(e) => setBirthPlanForm({ ...birthPlanForm, transportArranged: e.target.checked })} />
                Transport arranged
              </label>
              <label className="flex items-center gap-2 text-body-md text-on-surface">
                <input type="checkbox" checked={birthPlanForm.bloodDonorArranged} onChange={(e) => setBirthPlanForm({ ...birthPlanForm, bloodDonorArranged: e.target.checked })} />
                Blood donor arranged
              </label>
              <label className="flex items-center gap-2 text-body-md text-on-surface">
                <input type="checkbox" checked={birthPlanForm.fundsArranged} onChange={(e) => setBirthPlanForm({ ...birthPlanForm, fundsArranged: e.target.checked })} />
                Funds arranged
              </label>
              <label className="text-caption text-on-surface-variant">Companion name
                <input type="text" value={birthPlanForm.companionName} onChange={(e) => setBirthPlanForm({ ...birthPlanForm, companionName: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
              </label>
              <label className="text-caption text-on-surface-variant">Companion phone
                <input type="tel" value={birthPlanForm.companionPhone} onChange={(e) => setBirthPlanForm({ ...birthPlanForm, companionPhone: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
              </label>
              <label className="text-caption text-on-surface-variant">Emergency contact
                <input type="text" value={birthPlanForm.emergencyContactName} onChange={(e) => setBirthPlanForm({ ...birthPlanForm, emergencyContactName: e.target.value })} className="mt-1 w-full border border-outline-variant rounded-lg px-2 py-1.5 text-body-md bg-surface" />
              </label>
              <button
                onClick={() => saveBirthPlanMutation.mutate()}
                disabled={saveBirthPlanMutation.isPending}
                className="bg-primary text-on-primary px-4 py-2 rounded-full text-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saveBirthPlanMutation.isPending ? 'Saving…' : 'Save Plan'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
  )
}
