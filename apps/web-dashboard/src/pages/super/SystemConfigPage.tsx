import { useEffect, useState } from 'react'
import { ASHAButton, ASHACard, StatusChip } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/common/Icons'

const DEFAULT_APP_CONFIG = {
  app: {
    name: 'ASHA Sathi',
    environment: 'production',
    languages: ['en', 'hi'],
    otpResendCooldownSeconds: 30,
  },
  realtime: {
    enabled: true,
    tables: ['beneficiaries', 'pregnancies', 'anc_visits', 'immunizations', 'incentive_claims', 'sync_logs'],
  },
  reporting: {
    csvExportLimit: 10000,
    excelExportLimit: 5000,
    includePIIByDefault: false,
  },
  cache: {
    dashboardTtlSeconds: 300,
    listTtlSeconds: 60,
  },
}

const INTEGRATIONS = [
  { name: 'ABDM (ABHA)', status: 'connected' as const },
  { name: 'Supabase Realtime', status: 'connected' as const },
  { name: 'SMTP / SMS Gateway', status: 'connected' as const },
  { name: 'NIKSHAY (TB)', status: 'degraded' as const },
  { name: 'ANMOL / RCH', status: 'disconnected' as const },
]

type ConfigShape = typeof DEFAULT_APP_CONFIG

export default function SystemConfigPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const [json, setJson] = useState(() => JSON.stringify(DEFAULT_APP_CONFIG, null, 2))
  const [valid, setValid] = useState(true)
  const [realtimeOn, setRealtimeOn] = useState(DEFAULT_APP_CONFIG.realtime.enabled)

  useEffect(() => {
    try {
      JSON.parse(json) as ConfigShape
      setValid(true)
    } catch {
      setValid(false)
    }
  }, [json])

  const handleSave = () => {
    if (!valid) {
      addToast('error', t('state.configInvalid'))
      return
    }
    addToast('success', t('state.configSaved'))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.systemConfig')}
        subtitle={t('super.systemConfigSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/super/users' }, { label: t('nav.systemConfig') }]}
        actions={
          <ASHAButton fullWidth={false} icon={<Icon name="save" size={16} />} onClick={handleSave} disabled={!valid} label={t('state.saveConfig')} />
        }
      />

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ASHACard title="app.config.json">
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            className={`h-[440px] w-full rounded-md border bg-surface-container-lowest p-3 font-mono text-body-md text-on-surface outline-none focus:border-primary ${valid ? 'border-outline' : 'border-error'}`}
          />
          <div className="mt-3">
            <StatusChip status={valid ? 'success' : 'danger'} label={valid ? 'Valid JSON' : t('state.configInvalid')} />
          </div>
        </ASHACard>

        <div className="space-y-6">
          <ASHACard title={t('super.integrations')}>
            <div className="space-y-3">
              {INTEGRATIONS.map((int) => (
                <div key={int.name} className="flex items-center justify-between rounded-md border border-outline-variant px-3 py-2.5">
                  <p className="text-body-md font-medium text-on-surface">{int.name}</p>
                  <StatusChip
                    status={int.status === 'connected' ? 'success' : int.status === 'degraded' ? 'warning' : 'danger'}
                    label={int.status}
                  />
                </div>
              ))}
            </div>
          </ASHACard>

          <ASHACard title={t('state.featureFlags')}>
            <div className="flex items-center justify-between rounded-md border border-outline-variant px-3 py-2.5">
              <div>
                <p className="text-body-md font-semibold text-on-surface">Supabase Realtime</p>
                <p className="text-label-md text-on-surface-variant">realtime.enabled</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={realtimeOn}
                onClick={() => setRealtimeOn((v) => !v)}
                className={`relative h-7 w-12 rounded-full transition-colors ${realtimeOn ? 'bg-tertiary' : 'bg-surface-container-highest'}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${realtimeOn ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </ASHACard>
        </div>
      </div>
    </div>
  )
}
