import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '@/stores/ui.store'
import { useAuth } from '@/hooks/useAuth'
import { householdService } from '@/services/household.service'
import { configService } from '@/services/config.service'
import { getErrorMessage } from '@/components/common/ErrorState'
import { SearchableSelect } from '@/components/common/SearchableSelect'

const inputClsPad =
  'py-2.5 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

const PHONE_RE = /^[6-9]\d{9}$/

const AMENITIES = [
  { key: 'toilet', label: 'Toilet', icon: 'wc' },
  { key: 'electricity', label: 'Electricity', icon: 'bolt' },
  { key: 'clean_water', label: 'Clean Water', icon: 'water_drop' },
  { key: 'lpg_connection', label: 'LPG Connection', icon: 'local_fire_department' },
] as const

export default function AddNewHouseholdPhcAdmin() {
  const navigate = useNavigate()
  const { addToast } = useUIStore()
  const qc = useQueryClient()
  const { user } = useAuth()
  const phcId = user?.phcId
  const today = new Date().toISOString().slice(0, 10)

  // Household Information
  const [hhid, setHhid] = useState('')
  const [headName, setHeadName] = useState('')
  const [ward, setWard] = useState('')
  const [familySize, setFamilySize] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  // Cascade (super admin has no PHC of their own)
  const [statePick, setStatePick] = useState('')
  const [district, setDistrict] = useState('')
  const [block, setBlock] = useState('')
  const [phcSelect, setPhcSelect] = useState('')
  const [village, setVillage] = useState('')

  // Amenities & consent
  const [amenities, setAmenities] = useState<Record<string, boolean>>({})
  const [consent, setConsent] = useState(false)

  const effectiveStateId = user?.stateId || statePick

  const statesQuery = useQuery({
    queryKey: ['config', 'states'],
    queryFn: () => configService.getStates(),
    enabled: !phcId && !user?.stateId,
  })
  const districtsQuery = useQuery({
    queryKey: ['config', 'districts', effectiveStateId],
    queryFn: () => configService.getDistricts(effectiveStateId!),
    enabled: !phcId && Boolean(effectiveStateId),
  })
  const blocksQuery = useQuery({
    queryKey: ['config', 'blocks', district],
    queryFn: () => configService.getBlocks(district),
    enabled: !phcId && Boolean(district),
  })
  const phcListQuery = useQuery({
    queryKey: ['config', 'phcs', block],
    queryFn: () => configService.getPHCs(block),
    enabled: !phcId && Boolean(block),
  })
  const selectedPhcId = phcId || phcSelect
  const villagesQuery = useQuery({
    queryKey: ['villages', selectedPhcId],
    queryFn: () => configService.getVillages(selectedPhcId),
    enabled: Boolean(selectedPhcId),
  })

  const villageOptions = (villagesQuery.data ?? []).map((v) => ({ id: v.id, name: v.name, code: v.code }))
  const selectedPhcName =
    (!phcId && phcListQuery.data?.find((p) => p.id === phcSelect)?.name) || user?.phcName || null

  const createHousehold = useMutation({
    mutationFn: () =>
      householdService.createHousehold({
        hhid: hhid.trim(),
        villageId: village,
        headName: headName.trim(),
        ward: ward.trim() || undefined,
        familySize: familySize ? Number(familySize) : undefined,
        contactPhone: phone ? `+91${phone}` : undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        amenities: Object.keys(amenities).length ? amenities : undefined,
        consentGiven: consent,
        consentDate: consent ? today : undefined,
        consentVersion: consent ? 'v1' : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] })
      addToast('success', `Household for ${headName.trim()} registered successfully.`)
      navigate('/phc/households')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hhid.trim() || hhid.trim().length < 3) return addToast('error', 'Household ID must be at least 3 characters (e.g. HH-2026-0001)')
    if (!headName.trim()) return addToast('error', 'Head of Family is required')
    if (!phcId) {
      if (!user?.stateId && !statePick) return addToast('error', 'Select the state')
      if (!district) return addToast('error', 'Select the district')
      if (!block) return addToast('error', 'Select the block')
      if (!phcSelect) return addToast('error', 'Select the PHC')
    }
    if (!village) return addToast('error', 'Select the village')
    if (phone && !PHONE_RE.test(phone)) return addToast('error', 'Enter a valid 10-digit mobile number')
    if (!consent) return addToast('error', 'Household head consent is required for registration')
    createHousehold.mutate()
  }

  const toggleAmenity = (key: string) =>
    setAmenities((prev) => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = true
      return next
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/phc/households')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
      </div>

      <form className="max-w-4xl mx-auto flex w-full flex-col gap-5" onSubmit={submitForm}>
        {!phcId && (
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
            <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
              <span className="material-symbols-outlined text-[20px] text-primary">location_on</span>
              <h3 className="text-headline-sm font-semibold text-on-surface">Location</h3>
              {selectedPhcName && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 text-caption font-semibold text-on-primary-container">
                  <span className="material-symbols-outlined text-[14px]">local_hospital</span>
                  {selectedPhcName}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
              {!user?.stateId && (
                <SearchableSelect
                  id="state"
                  label="State *"
                  options={(statesQuery.data ?? []).map((st) => ({ id: st.id, name: st.name, code: st.code }))}
                  showCode
                  value={statePick}
                  onChange={(id) => {
                    setStatePick(id)
                    setDistrict('')
                    setBlock('')
                    setPhcSelect('')
                    setVillage('')
                  }}
                  placeholder="Select state"
                  loading={statesQuery.isLoading}
                  loadingLabel="Loading states…"
                  emptyLabel="No states available"
                />
              )}
              <SearchableSelect
                id="district"
                label="District *"
                options={(districtsQuery.data ?? []).map((d) => ({ id: d.id, name: d.name, code: d.code }))}
                showCode
                value={district}
                onChange={(id) => {
                  setDistrict(id)
                  setBlock('')
                  setPhcSelect('')
                  setVillage('')
                }}
                placeholder={effectiveStateId ? 'Select district' : 'Select a state first'}
                loading={districtsQuery.isLoading}
                loadingLabel="Loading districts…"
                emptyLabel="No districts in this state"
              />
              <SearchableSelect
                id="block"
                label="Block *"
                options={(blocksQuery.data ?? []).map((b) => ({ id: b.id, name: b.name, code: b.code }))}
                showCode
                value={block}
                onChange={(id) => {
                  setBlock(id)
                  setPhcSelect('')
                  setVillage('')
                }}
                placeholder={district ? 'Select block' : 'Select a district first'}
                loading={blocksQuery.isLoading}
                loadingLabel="Loading blocks…"
                emptyLabel="No blocks in this district"
              />
              <SearchableSelect
                id="phc"
                label="PHC *"
                options={(phcListQuery.data ?? []).map((p) => ({ id: p.id, name: p.name, code: p.code }))}
                showCode
                value={phcSelect}
                onChange={(id) => {
                  setPhcSelect(id)
                  setVillage('')
                }}
                placeholder={block ? 'Select PHC' : 'Select a block first'}
                loading={phcListQuery.isLoading}
                loadingLabel="Loading PHCs…"
                emptyLabel="No PHCs in this block"
              />
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
            <span className="material-symbols-outlined text-[20px] text-primary">family_restroom</span>
            <h3 className="text-headline-md font-bold text-on-surface">Household Information</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant" htmlFor="hhid">Household ID *</label>
              <input className={inputClsPad} id="hhid" placeholder="e.g. HH-2026-0001" type="text" value={hhid} onChange={(e) => setHhid(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant" htmlFor="headName">Head of Family *</label>
              <input className={inputClsPad} id="headName" placeholder="Enter full name" type="text" value={headName} onChange={(e) => setHeadName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <SearchableSelect
                id="village"
                label="Village *"
                options={villageOptions}
                showCode
                value={village}
                onChange={setVillage}
                placeholder="Select village"
                loading={villagesQuery.isLoading}
                loadingLabel="Loading villages…"
                disabled={!selectedPhcId}
                disabledHint={phcId ? 'No PHC assigned' : 'Select the PHC first'}
                emptyLabel="No villages configured — add one in Village Management"
                error={villagesQuery.isError ? 'Could not load villages. Please retry.' : undefined}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant" htmlFor="ward">Ward</label>
              <input className={inputClsPad} id="ward" placeholder="e.g. Ward 3" type="text" value={ward} onChange={(e) => setWard(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant" htmlFor="familySize">Family Size</label>
              <input className={inputClsPad} id="familySize" min="1" max="99" placeholder="Number of members" type="number" value={familySize} onChange={(e) => setFamilySize(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant" htmlFor="phone">Phone Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-on-surface-variant">+91</span>
                <input className={`${inputClsPad} pl-12`} id="phone" placeholder="10-digit mobile" type="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
            <span className="material-symbols-outlined text-[20px] text-primary">home_work</span>
            <h3 className="text-headline-md font-semibold text-on-surface">Amenities</h3>
            <span className="ml-auto text-label-sm text-on-surface-variant">Optional</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
            {AMENITIES.map((a) => {
              const on = Boolean(amenities[a.key])
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => toggleAmenity(a.key)}
                  className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-label-md font-semibold transition-colors ${
                    on
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline bg-surface text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                  {a.label}
                  <span className={`material-symbols-outlined ml-auto text-[18px] ${on ? 'text-primary' : 'text-outline'}`}>
                    {on ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
            <span className="material-symbols-outlined text-[20px] text-primary">location_on</span>
            <h3 className="text-headline-md font-semibold text-on-surface">Address & Notes</h3>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant" htmlFor="address">Full Address</label>
              <input className={inputClsPad} id="address" placeholder="House number, street, landmark..." type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface-variant" htmlFor="notes">Notes</label>
              <textarea
                className="min-h-[80px] resize-y rounded-lg border border-outline bg-surface p-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                id="notes"
                placeholder="Any additional notes about this household..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
            <span className="material-symbols-outlined text-[20px] text-primary">handshake</span>
            <h3 className="text-headline-md font-semibold text-on-surface">Consent *</h3>
          </div>
          <label className="flex cursor-pointer items-start gap-3 p-5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[color:var(--color-primary,#4F46E5)]"
            />
            <span className="text-body-md text-on-surface">
              The head of the household has given consent for registration and health services under ASHA Sathi (v1).
              <span className="mt-1 block text-label-sm text-on-surface-variant">
                Consent recorded on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </span>
          </label>
        </section>

        <div className="flex items-center justify-end gap-3 pb-4">
          <button
            className="flex items-center justify-center rounded-full px-6 py-2 font-label-md text-label-md font-semibold text-gray-600 transition-colors hover:bg-surface-container-highest"
            type="button"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
            disabled={createHousehold.isPending}
          >
            <span className="material-symbols-outlined text-[18px]">{createHousehold.isPending ? 'progress_activity' : 'save'}</span>
            {createHousehold.isPending ? 'Saving…' : 'Save Household'}
          </button>
        </div>
      </form>
    </div>
  )
}
