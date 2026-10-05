import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '@/stores/ui.store'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useAuth } from '@/hooks/useAuth'
import { householdService } from '@/services/household.service'
import { configService } from '@/services/config.service'
import { getErrorMessage } from '@/components/common/ErrorState'
import { SearchableSelect } from '@/components/common/SearchableSelect'

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

const inputClsPad =
  'py-2.5 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export default function AddNewHouseholdPhcAdmin() {
  const navigate = useNavigate()
  const { addToast } = useUIStore()
  const qc = useQueryClient()
  const { user } = useAuth()
  const phcId = user?.phcId

  const [hhid, setHhid] = useState('')
  const [headName, setHeadName] = useState('')
  const [village, setVillage] = useState('')
  const [ward, setWard] = useState('')
  const [familySize, setFamilySize] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const villages = useQuery({
    queryKey: ['villages', phcId],
    queryFn: () => configService.getVillages(phcId!),
    enabled: Boolean(phcId),
  })

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
    if (!hhid.trim() || !headName.trim() || !village) {
      addToast('error', 'Please fill Household ID, Head of Family and Village')
      return
    }
    createHousehold.mutate()
  }

  const villageOptions = villages.data ?? []

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/phc/households')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">group_add</span>
                Register Household
              </h2>
              <p className="text-caption text-on-surface-variant">
                <button onClick={() => navigate('/phc/households')} className="text-primary hover:underline">Households</button>
                <span className="mx-1 text-outline">/</span>
                <span>New Household</span>
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <form className="max-w-4xl mx-auto flex flex-col gap-5" onSubmit={submitForm}>
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">family_restroom</span>
                <h3 className="text-headline-md font-bold text-on-surface">Household Information</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="hhid">Household ID *</label>
                  <input className={inputClsPad} id="hhid" placeholder="e.g. HH-2024-0001" type="text" value={hhid} onChange={(e) => setHhid(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="headName">Head of Family *</label>
                  <input className={inputClsPad} id="headName" placeholder="Enter full name" type="text" value={headName} onChange={(e) => setHeadName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <SearchableSelect
                    id="village"
                    label="Village *"
                    required
                    options={villageOptions.map((v) => ({ id: v.id, name: v.name, code: v.code }))}
                    showCode
                    value={village}
                    onChange={setVillage}
                    placeholder="Select village"
                    loading={villages.isLoading}
                    loadingLabel="Loading villages…"
                    disabled={!phcId}
                    disabledHint="No PHC assigned"
                    emptyLabel="No villages configured"
                    error={villages.isError ? 'Could not load villages. Please retry.' : undefined}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="ward">Ward</label>
                  <input className={inputCls} id="ward" placeholder="e.g. Ward 3" type="text" value={ward} onChange={(e) => setWard(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="familySize">Family Size</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[20px]">group</span>
                    </span>
                    <input className={`${inputCls} pl-11`} id="familySize" min="1" max="20" placeholder="Number of members" type="number" value={familySize} onChange={(e) => setFamilySize(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phone">Phone Number</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-sm">+91</span>
                    <input className={`${inputCls} pl-12`} id="phone" pattern="[0-9]{10}" placeholder="10-digit mobile" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-outline-variant px-5 py-4">
                <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
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

            <div className="flex items-center justify-end gap-3 pb-4">
              <button
                className="flex items-center justify-center rounded-full px-6 py-2 font-label-md text-label-md font-semibold text-gray-600 transition-colors hover:bg-surface-container-highest"
                type="button"
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded-full bg-green-600 hover:bg-green-700 px-6 py-2 font-label-md text-label-md font-semibold text-white shadow-sm transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                type="submit"
                disabled={createHousehold.isPending}
              >
                <span className="material-symbols-outlined text-[18px]">{createHousehold.isPending ? 'progress_activity' : 'save'}</span>
                {createHousehold.isPending ? 'Saving…' : 'Save Household'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
