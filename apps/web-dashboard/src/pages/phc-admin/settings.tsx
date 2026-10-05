import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { configService, type AppConfigEntry } from '@/services/config.service'
import { useUIStore } from '@/stores/ui.store'
import { useAuth } from '@/hooks/useAuth'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { SearchableSelect } from '@/components/common/SearchableSelect'

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

/** Keep a pre-filled/saved value visible even when it is not in the fetched list. */
function withValue(options: { id: string; name: string }[], value: string) {
  if (!value || options.some((o) => o.id === value)) return options
  return [{ id: value, name: value }, ...options]
}

/** App-config keys owned by this settings page (see `PUT /config/app`). */
const PROFILE_KEY = 'phc.profile'
const NOTIFICATIONS_KEY = 'phc.notifications'

interface ProfileValue {
  name?: string
  phone?: string
  email?: string
}

interface NotificationPrefs {
  highRisk?: boolean
  taskReminders?: boolean
  syncAlerts?: boolean
  systemUpdates?: boolean
}

function readValue<T>(entries: AppConfigEntry[] | undefined, key: string): T | undefined {
  return entries?.find((e) => e.key === key)?.value as T | undefined
}

export default function SettingsPhcAdmin() {
  const { addToast } = useUIStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [phcName, setPhcName] = useState('')
  const [block, setBlock] = useState('')
  const [district, setDistrict] = useState('')
  const [stateName, setStateName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const [alertsEnabled, setAlertsEnabled] = useState<boolean | null>(null)
  const [tasksEnabled, setTasksEnabled] = useState<boolean | null>(null)
  const [syncAlerts, setSyncAlerts] = useState<boolean | null>(null)
  const [systemAlerts, setSystemAlerts] = useState<boolean | null>(null)

  const statesQuery = useQuery({
    queryKey: ['config', 'states'],
    queryFn: () => configService.getStates(),
  })

  const states = statesQuery.data ?? []
  const selectedState = states.find((s) => s.name === stateName)

  const districtsQuery = useQuery({
    queryKey: ['config', 'districts', selectedState?.id],
    queryFn: () => configService.getDistricts(selectedState!.id),
    enabled: !!selectedState?.id,
  })

  const districts = districtsQuery.data ?? []
  const selectedDistrict = districts.find((d) => d.name === district)

  const blocksQuery = useQuery({
    queryKey: ['config', 'blocks', selectedDistrict?.id],
    queryFn: () => configService.getBlocks(selectedDistrict!.id),
    enabled: !!selectedDistrict?.id,
  })

  const blocks = blocksQuery.data ?? []
  const selectedBlock = blocks.find((b) => b.name === block)

  const phcListQuery = useQuery({
    queryKey: ['config', 'phcs', selectedBlock?.id],
    queryFn: () => configService.getPHCs(selectedBlock!.id),
    enabled: !!selectedBlock?.id,
  })

  const phcList = phcListQuery.data ?? []

  const phcInfoQuery = useQuery({
    queryKey: ['config', 'phc', user?.stateId],
    queryFn: () => configService.getPHC(user!.stateId!),
    enabled: !!user?.stateId,
  })

  const phcRecord = phcInfoQuery.data as Record<string, unknown> | undefined

  const configQuery = useQuery({
    queryKey: ['config', 'app'],
    queryFn: () => configService.getFullAppConfig(),
  })

  const savedProfile = readValue<ProfileValue>(configQuery.data, PROFILE_KEY)
  const savedPrefs = readValue<NotificationPrefs>(configQuery.data, NOTIFICATIONS_KEY)

  const prefilled = phcRecord
    ? {
        name: String(phcRecord.name ?? ''),
        phone: String(phcRecord.phone ?? ''),
        email: String(phcRecord.email ?? ''),
        block: String(phcRecord.block ?? ''),
        district: String(phcRecord.district ?? ''),
        state: String(phcRecord.state ?? ''),
      }
    : undefined

  const effectivePhcName = phcName || savedProfile?.name || prefilled?.name || ''
  const effectiveBlock = block || prefilled?.block || ''
  const effectiveDistrict = district || prefilled?.district || ''
  const effectiveState = stateName || prefilled?.state || ''
  const effectivePhone = contactPhone || savedProfile?.phone || prefilled?.phone || ''
  const effectiveEmail = contactEmail || savedProfile?.email || prefilled?.email || ''

  const prefs: Required<NotificationPrefs> = {
    highRisk: alertsEnabled ?? savedPrefs?.highRisk ?? true,
    taskReminders: tasksEnabled ?? savedPrefs?.taskReminders ?? true,
    syncAlerts: syncAlerts ?? savedPrefs?.syncAlerts ?? false,
    systemUpdates: systemAlerts ?? savedPrefs?.systemUpdates ?? true,
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      configService.putAppConfig([
        {
          key: PROFILE_KEY,
          value: { name: effectivePhcName, phone: effectivePhone, email: effectiveEmail },
          description: 'PHC contact profile edited from the PHC admin settings page',
          isPublic: false,
        },
        {
          key: NOTIFICATIONS_KEY,
          value: prefs,
          description: 'PHC admin notification preferences',
          isPublic: false,
        },
      ]),
    onSuccess: () => {
      addToast('success', 'Settings saved successfully.')
      queryClient.invalidateQueries({ queryKey: ['config', 'app'] })
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const saveSettings = () => {
    if (saveMutation.isPending) return
    saveMutation.mutate()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-on-surface-variant">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
                Settings
              </h2>
              <p className="text-caption text-on-surface-variant">PHC profile and preferences</p>
            </div>
          </div>
          <button
            type="button"
            onClick={saveSettings}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 rounded-full bg-green-600 px-6 py-2 font-label-md text-label-md font-semibold text-white shadow-sm transition-colors hover:bg-green-700 active:scale-[0.98] disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[18px] ${saveMutation.isPending ? 'animate-spin' : ''}`}>
              {saveMutation.isPending ? 'progress_activity' : 'save'}
            </span>
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <p className="mb-4 flex items-start gap-2 text-caption text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] leading-none">info</span>
              <span>Contact details and notification preferences are stored in app settings when you press Save Changes.</span>
            </p>
            {statesQuery.isLoading ? (
              <LoadingState label="Loading geography…" />
            ) : statesQuery.isError ? (
              <ErrorState message={getErrorMessage(statesQuery.error)} onRetry={statesQuery.refetch} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_name">PHC Name</label>
                  <input
                    id="phc_name"
                    className="py-2.5 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    type="text"
                    value={effectivePhcName}
                    onChange={(e) => setPhcName(e.target.value)}
                    placeholder="Select PHC below to auto-fill"
                  />
                </div>
                <SearchableSelect
                  id="phc_state"
                  label="State"
                  options={withValue(states.map((s) => ({ id: s.name, name: s.name })), effectiveState)}
                  value={effectiveState}
                  onChange={(name) => { setStateName(name); setDistrict(''); setBlock(''); setPhcName('') }}
                  placeholder="Select state..."
                  loading={statesQuery.isLoading}
                  loadingLabel="Loading states…"
                  emptyLabel="No states found"
                />
                <SearchableSelect
                  id="phc_district"
                  label="District"
                  options={withValue(districts.map((d) => ({ id: d.name, name: d.name })), effectiveDistrict)}
                  value={effectiveDistrict}
                  onChange={(name) => { setDistrict(name); setBlock(''); setPhcName('') }}
                  placeholder="Select district..."
                  loading={districtsQuery.isLoading}
                  loadingLabel="Loading districts…"
                  disabled={!selectedState?.id}
                  disabledHint="Select a state first"
                  emptyLabel="No districts found"
                />
                <SearchableSelect
                  id="phc_block"
                  label="Block / Taluk"
                  options={withValue(blocks.map((b) => ({ id: b.name, name: b.name })), effectiveBlock)}
                  value={effectiveBlock}
                  onChange={(name) => { setBlock(name); setPhcName('') }}
                  placeholder="Select block / tehsil..."
                  loading={blocksQuery.isLoading}
                  loadingLabel="Loading blocks…"
                  disabled={!selectedDistrict?.id}
                  disabledHint="Select a district first"
                  emptyLabel="No blocks found"
                />
                <SearchableSelect
                  id="phc_select"
                  label="PHC"
                  options={withValue(phcList.map((p) => ({ id: p.name, name: p.name })), effectivePhcName)}
                  value={effectivePhcName}
                  onChange={setPhcName}
                  placeholder="Select PHC..."
                  loading={phcListQuery.isLoading}
                  loadingLabel="Loading PHCs…"
                  disabled={!selectedBlock?.id}
                  disabledHint="Select a block first"
                  emptyLabel="No PHCs found"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_phone">Contact Phone</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant">+91</span>
                    <input id="phc_phone" className={`${inputCls} pl-12`} type="tel" value={effectivePhone} onChange={(e) => setContactPhone(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-label-md text-on-surface-variant" htmlFor="phc_email">Contact Email</label>
                  <input id="phc_email" className={inputCls} type="email" value={effectiveEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
              </div>
            )}
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <h3 className="text-lg font-semibold text-on-surface px-5 pt-5 pb-2">Notifications</h3>
            <div className="flex flex-col divide-y divide-outline-variant/50">
              {[
                { label: 'High-risk alerts', hint: 'Get notified for high-risk patients', enabled: prefs.highRisk, onToggle: () => setAlertsEnabled(!prefs.highRisk) },
                { label: 'Task reminders', hint: 'Daily follow-up and vaccination reminders', enabled: prefs.taskReminders, onToggle: () => setTasksEnabled(!prefs.taskReminders) },
                { label: 'Sync alerts', hint: 'Notifications when data sync fails', enabled: prefs.syncAlerts, onToggle: () => setSyncAlerts(!prefs.syncAlerts) },
                { label: 'System updates', hint: 'App updates and maintenance notices', enabled: prefs.systemUpdates, onToggle: () => setSystemAlerts(!prefs.systemUpdates) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-label-md text-on-surface">{item.label}</p>
                    <p className="text-caption text-on-surface-variant">{item.hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    onClick={item.onToggle}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${item.enabled ? 'bg-primary' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-on-primary shadow-sm transition-transform ${item.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <h3 className="text-headline-md font-semibold text-on-surface px-5 pt-5 pb-2">Data Management</h3>
            <div className="p-5 pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-label-md text-on-surface">Last sync</p>
                  <p className="text-caption text-on-surface-variant">Today, 10:30 AM</p>
                </div>
                <button className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 font-label-md text-label-md font-semibold text-white transition-colors hover:bg-blue-700">
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                  Sync Now
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-label-md text-on-surface">Clear local cache</p>
                  <p className="text-caption text-on-surface-variant">Removes temporarily cached data</p>
                </div>
                <button className="flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2 font-label-md text-label-md font-semibold text-error transition-colors hover:bg-error-container/40">
                  <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                  Clear Cache
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}