import { useEffect, useState } from 'react'
import { ASHAButton, ASHACard, StatusChip } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/common/Icons'

const DEFAULT_CONFIG = {
  state: 'Bihar',
  policy: {
    hrpReferralThresholdBp: '>=140/90',
    hrpReferralThresholdHb: '<7.0',
    ancSchedule: [12, 20, 28, 36],
    cashIncentive: {
      institutionalDelivery: 500,
      anc4Completion: 400,
      immunizationCompletion: 300,
    },
  },
  features: {
    abhaIntegration: true,
    ncdScreening: true,
    aiHrpPrediction: false,
    villageHeatmap: true,
    exportToDistrict: true,
  },
  sync: {
    requiredIntervalMinutes: 1440,
    allowManualSync: true,
  },
}

const FEATURE_FLAGS = [
  { key: 'abhaIntegration', label: 'ABHA integration' },
  { key: 'ncdScreening', label: 'NCD screening module' },
  { key: 'aiHrpPrediction', label: 'AI-based HRP prediction' },
  { key: 'villageHeatmap', label: 'Village coverage heatmap' },
  { key: 'exportToDistrict', label: 'Export reports to district' },
]

type ConfigShape = typeof DEFAULT_CONFIG

export default function PolicyConfigPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const [json, setJson] = useState(() => JSON.stringify(DEFAULT_CONFIG, null, 2))
  const [config, setConfig] = useState<ConfigShape>(DEFAULT_CONFIG)
  const [valid, setValid] = useState(true)

  useEffect(() => {
    try {
      const parsed = JSON.parse(json) as ConfigShape
      setValid(true)
      setConfig(parsed)
    } catch {
      setValid(false)
    }
  }, [json])

  const toggleFlag = (key: string) => {
    const next = { ...config, features: { ...config.features, [key]: !config.features[key as keyof ConfigShape['features']] } }
    setConfig(next)
    setJson(JSON.stringify(next, null, 2))
  }

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
        title={t('nav.policyConfig')}
        subtitle={t('state.policyConfigSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/state/dashboard' }, { label: t('nav.policyConfig') }]}
        actions={
          <ASHAButton fullWidth={false} icon={<Icon name="save" size={16} />} onClick={handleSave} disabled={!valid} label={t('state.saveConfig')} />
        }
      />

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ASHACard title={t('state.configJson')}>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            className={`h-[420px] w-full rounded-md border bg-surface-container-lowest p-3 font-mono text-body-md text-on-surface outline-none focus:border-primary ${valid ? 'border-outline' : 'border-error'}`}
          />
          <div className="mt-3 flex items-center gap-3">
            <StatusChip status={valid ? 'success' : 'danger'} label={valid ? 'Valid JSON' : t('state.configInvalid')} />
            <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="refresh" size={16} />} onClick={() => setJson(JSON.stringify(DEFAULT_CONFIG, null, 2))} label={t('state.validateConfig')} />
          </div>
        </ASHACard>

        <ASHACard title={t('state.featureFlags')}>
          <div className="space-y-3">
            {FEATURE_FLAGS.map((flag) => {
              const enabled = config.features[flag.key as keyof ConfigShape['features']]
              return (
                <div key={flag.key} className="flex items-center justify-between rounded-md border border-outline-variant px-3 py-2.5">
                  <div>
                    <p className="text-body-md font-semibold text-on-surface">{flag.label}</p>
                    <p className="font-mono text-label-md text-on-surface-variant">{flag.key}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleFlag(flag.key)}
                    className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? 'bg-tertiary' : 'bg-surface-container-highest'}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-6 rounded-md border border-outline-variant p-3">
            <p className="mb-2 text-label-lg text-on-surface">{t('charts.indicator')}</p>
            <div className="grid grid-cols-2 gap-3 text-label-md text-on-surface-variant">
              <div>
                <p>HRP referral BP</p>
                <p className="font-mono text-on-surface">{config.policy.hrpReferralThresholdBp}</p>
              </div>
              <div>
                <p>HRP referral Hb</p>
                <p className="font-mono text-on-surface">{config.policy.hrpReferralThresholdHb}</p>
              </div>
              <div>
                <p>Institutional delivery ₹</p>
                <p className="font-mono text-on-surface">{config.policy.cashIncentive.institutionalDelivery}</p>
              </div>
              <div>
                <p>ANC4 completion ₹</p>
                <p className="font-mono text-on-surface">{config.policy.cashIncentive.anc4Completion}</p>
              </div>
            </div>
          </div>
        </ASHACard>
      </div>
    </div>
  )
}
