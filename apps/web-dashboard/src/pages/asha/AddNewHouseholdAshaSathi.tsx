import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import { getErrorMessage } from '@/components/common/ErrorState'
import { householdService } from '@/services/household.service'
import { configService } from '@/services/config.service'

const inputCls =
  'h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

type Field = 'hhid' | 'headName' | 'villageId' | 'phone'

const PHONE_RE = /^[6-9]\d{9}$/

const AMENITIES = [
  { key: 'toilet', labelKey: 'asha.toilet', icon: 'wc' },
  { key: 'electricity', labelKey: 'asha.electricity', icon: 'bolt' },
  { key: 'clean_water', labelKey: 'asha.amenityCleanWater', icon: 'water_drop' },
  { key: 'lpg_connection', labelKey: 'asha.lpgConnection', icon: 'local_fire_department' },
] as const

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="font-caption text-caption text-error" role="alert">
      {message}
    </p>
  )
}

export default function AddNewHouseholdAshaSathi() {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()
  const { user } = useAuth()
  const phcId = user?.phcId
  const today = new Date().toISOString().slice(0, 10)

  const [hhid, setHhid] = useState('')
  const [headName, setHeadName] = useState('')
  const [villageId, setVillageId] = useState('')
  const [address, setAddress] = useState('')
  const [ward, setWard] = useState('')
  const [familySize, setFamilySize] = useState('')
  const [phone, setPhone] = useState('')
  const [amenities, setAmenities] = useState<Record<string, boolean>>({})
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  // Once the worker edits the generated ID, an arriving scan must not clobber it.
  const [hhidTouched, setHhidTouched] = useState(false)

  // Scope the HHID scan to this worker's own households — the next number is
  // computed from their registrations, and no one else's rows are fetched.
  const householdsQuery = useQuery({
    queryKey: ['households', 'hhid-scan', user?.id ?? ''],
    queryFn: () => householdService.listHouseholds({ ashaId: user?.id, page: 1, pageSize: 1000 }),
  })

  const { data: villages, isLoading: villagesLoading } = useQuery({
    queryKey: ['villages', phcId],
    queryFn: () => configService.getVillages(phcId!),
    enabled: Boolean(phcId),
  })

  // Pre-fill the next sequential HHID: HH-YYYY-NNNN.
  useEffect(() => {
    if (hhidTouched || !householdsQuery.data) return
    const prefix = `HH-${new Date().getFullYear()}-`
    const maxSeq = householdsQuery.data.items
      .map((household) => household.householdId ?? '')
      .filter((id) => id.startsWith(prefix))
      .map((id) => parseInt(id.slice(prefix.length), 10))
      .filter((seq) => Number.isFinite(seq))
      .reduce((max, seq) => Math.max(max, seq), 0)
    setHhid(`${prefix}${String(maxSeq + 1).padStart(4, '0')}`)
  }, [householdsQuery.data, hhidTouched])

  const setField = <K extends Field>(key: K, value: string) => {
    if (key === 'hhid') setHhid(value)
    if (key === 'headName') setHeadName(value)
    if (key === 'villageId') setVillageId(value)
    if (key === 'phone') setPhone(value.replace(/\D/g, ''))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const validate = (): Partial<Record<Field, string>> => {
    const next: Partial<Record<Field, string>> = {}
    // The server's HouseholdCreate requires min_length=3 on hhid.
    if (!hhid.trim()) next.hhid = t('asha.errHhidRequired')
    else if (hhid.trim().length < 3) next.hhid = t('asha.errHhidShort')
    if (!headName.trim()) next.headName = t('asha.errHeadNameRequired')
    if (!villageId) next.villageId = t('asha.errVillageRequired')
    if (phone && !PHONE_RE.test(phone)) next.phone = t('asha.errPhoneInvalid')
    return next
  }

  const toggleAmenity = (key: string) =>
    setAmenities((prev) => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = true
      return next
    })

  const createMutation = useMutation({
    mutationFn: () =>
      householdService.createHousehold({
        hhid: hhid.trim(),
        villageId,
        headName: headName.trim(),
        address: address.trim() || undefined,
        ward: ward.trim() || undefined,
        familySize: familySize ? Number(familySize) : undefined,
        contactPhone: phone ? `+91${phone}` : undefined,
        amenities: Object.keys(amenities).length ? amenities : undefined,
        consentGiven: consent,
        consentDate: consent ? today : undefined,
        consentVersion: consent ? 'v1' : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['households'] })
      addToast('success', t('asha.householdSavedToast'))
      navigate('/asha/households')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (createMutation.isPending) return
    const found = validate()
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    if (!consent) return addToast('error', t('asha.errConsentRequired'))
    createMutation.mutate()
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={t('asha.addHousehold')}
        subtitle={t('asha.addHouseholdSubtitle')}
        breadcrumbs={[
          { label: t('nav.ashaHome'), to: '/asha/home' },
          { label: t('nav.ashaHouseholds'), to: '/asha/households' },
          { label: t('asha.addHousehold') },
        ]}
      />

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <Icon name="box" size={20} className="text-primary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('asha.familyHousehold')}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="household_hhid">
                {t('asha.householdIdLabel')} *
              </label>
              <input
                id="household_hhid"
                className={inputCls}
                placeholder="HH-YYYY-NNNN"
                required
                type="text"
                value={hhid}
                aria-invalid={!!errors.hhid}
                aria-describedby="household_hhid-hint"
                onChange={(e) => {
                  setHhidTouched(true)
                  setField('hhid', e.target.value)
                }}
              />
              <p id="household_hhid-hint" className="font-caption text-caption text-on-surface-variant">
                {t('asha.householdIdAutoHint')}
              </p>
              <FieldError message={errors.hhid} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="household_head">
                {t('asha.headOfFamily')} *
              </label>
              <input
                id="household_head"
                className={inputCls}
                placeholder={t('asha.legalNamePlaceholder')}
                required
                type="text"
                value={headName}
                aria-invalid={!!errors.headName}
                aria-describedby="household_head-error"
                onChange={(e) => setField('headName', e.target.value)}
              />
              <div id="household_head-error">
                <FieldError message={errors.headName} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <SearchableSelect
                id="household_village"
                label={`${t('asha.villageLocality')}`}
                required
                options={(villages ?? []).map((v) => ({ id: v.id, name: v.name, code: v.code }))}
                showCode
                value={villageId}
                onChange={(id) => setField('villageId', id)}
                placeholder={t('asha.selectVillage')}
                loading={villagesLoading}
                loadingLabel={t('asha.loadingVillages')}
                emptyLabel={t('asha.selectVillage')}
              />
              <FieldError message={errors.villageId} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="household_ward">
                {t('asha.wardLabel')}
              </label>
              <input
                id="household_ward"
                className={inputCls}
                type="text"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="household_family_size">
                {t('asha.familySizeLabel')}
              </label>
              <input
                id="household_family_size"
                className={inputCls}
                min="1"
                max="99"
                type="number"
                value={familySize}
                onChange={(e) => setFamilySize(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="household_phone">
                {t('asha.phoneLabel')}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-on-surface-variant">
                  +91
                </span>
                <input
                  id="household_phone"
                  className={`${inputCls} pl-12`}
                  maxLength={10}
                  placeholder={t('asha.phonePlaceholder')}
                  type="tel"
                  value={phone}
                  aria-invalid={!!errors.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </div>
              <FieldError message={errors.phone} />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="household_address">
                {t('asha.addressOptional')}
              </label>
              <input
                id="household_address"
                className={inputCls}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <span className="material-symbols-outlined text-[20px] text-primary">home_work</span>
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('asha.amenities')}
            </h2>
            <span className="ml-auto font-caption text-caption text-on-surface-variant">
              {t('asha.optionalField')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
            {AMENITIES.map((a) => {
              const on = Boolean(amenities[a.key])
              return (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAmenity(a.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-3 font-label-md text-label-md font-semibold transition-colors ${
                    on
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline bg-surface text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                  <span className="truncate">{t(a.labelKey)}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <Icon name="shield" size={20} className="text-primary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('asha.consentTitle')} *
            </h2>
          </div>
          <label className="flex cursor-pointer items-start gap-3 p-5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[color:var(--color-primary,#4F46E5)]"
            />
            <span className="font-body-md text-body-md text-on-surface">
              {t('asha.consentRegister')}
              <span className="mt-1 block font-caption text-caption text-on-surface-variant">
                {t('asha.consentRecordedOn', {
                  date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                })}
              </span>
            </span>
          </label>
        </section>

        <div className="flex items-center justify-end gap-3 pb-4">
          <button
            className="flex h-touch-target items-center justify-center rounded-full px-5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-highest"
            type="button"
            onClick={() => navigate('/asha/households')}
          >
            {t('common.cancel')}
          </button>
          <button
            className="flex h-touch-target items-center justify-center gap-2 rounded-full bg-primary px-6 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
            type="submit"
            disabled={createMutation.isPending}
          >
            <Icon name="save" size={18} />
            {t('asha.saveHousehold')}
          </button>
        </div>
      </form>
    </div>
  )
}
