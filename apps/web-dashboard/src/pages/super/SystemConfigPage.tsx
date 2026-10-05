import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ASHAButton, ASHACard, StatusChip } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/common/Icons'
import { getErrorMessage } from '@/components/common/ErrorState'
import { configService } from '@/services/config.service'

const DEFAULT_STORE: Record<string, unknown> = {
  'app.name': 'ASHA Sathi',
  'app.environment': 'production',
  'app.languages': ['en', 'hi'],
  'otp.resend_cooldown_seconds': 30,
  'realtime.enabled': true,
  'reporting.csv_export_limit': 10000,
  'integration.abdm.enabled': true,
  'integration.supabase_realtime.enabled': true,
  'integration.smtp_sms.enabled': true,
  'integration.nikshay.enabled': false,
  'integration.anmol_rch.enabled': false,
}

const INTEGRATIONS = [
  { key: 'integration.abdm.enabled', name: 'ABDM (ABHA)' },
  { key: 'integration.supabase_realtime.enabled', name: 'Supabase Realtime' },
  { key: 'integration.smtp_sms.enabled', name: 'SMTP / SMS Gateway' },
  { key: 'integration.nikshay.enabled', name: 'NIKSHAY (TB)' },
  { key: 'integration.anmol_rch.enabled', name: 'ANMOL / RCH' },
]

export default function SystemConfigPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [json, setJson] = useState<string | null>(null)
  const [valid, setValid] = useState(true)
  const [parsed, setParsed] = useState<Record<string, unknown>>(DEFAULT_STORE)

  const configQuery = useQuery({
    queryKey: ['app-config'],
    queryFn: () => configService.getFullAppConfig(),
  })

  useEffect(() => {
    if (json !== null || !configQuery.data) return
    const store: Record<string, unknown> = { ...DEFAULT_STORE }
    for (const entry of configQuery.data) store[entry.key] = entry.value
    setParsed(store)
    setJson(JSON.stringify(store, null, 2))
  }, [configQuery.data, json])

  useEffect(() => {
    if (json === null) return
    try {
      const value = JSON.parse(json) as unknown
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        setValid(false)
        return
      }
      setParsed(value as Record<string, unknown>)
      setValid(true)
    } catch {
      setValid(false)
    }
  }, [json])

  const saveMutation = useMutation({
    mutationFn: () => {
      const entries = Object.entries(parsed).map(([key, value]) => ({ key, value }))
      return configService.putAppConfig(entries)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-config'] })
      addToast('success', t('state.configSaved'))
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleSave = () => {
    if (!valid) {
      addToast('error', t('state.configInvalid'))
      return
    }
    saveMutation.mutate()
  }

  const integrationStates = useMemo(
    () =>
      INTEGRATIONS.map((int) => ({
        ...int,
        enabled: typeof parsed[int.key] === 'boolean' ? (parsed[int.key] as boolean) : false,
      })),
    [parsed],
  )

  const toggleIntegration = (key: string, enabled: boolean) => {
    const next = { ...parsed, [key]: enabled }
    setParsed(next)
    setJson(JSON.stringify(next, null, 2))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.systemConfig')}
        subtitle={t('super.systemConfigSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/super/users' }, { label: t('nav.systemConfig') }]}
        actions={
          <ASHAButton
            fullWidth={false}
            icon={<Icon name="save" size={16} />}
            onClick={handleSave}
            disabled={!valid || saveMutation.isPending}
            label={saveMutation.isPending ? t('common.loading') : t('state.saveConfig')}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ASHACard title="app config">
          {configQuery.isPending && json === null ? (
            <p className="text-body-md text-on-surface-variant">{t('common.loading')}</p>
          ) : (
            <>
              <textarea
                value={json ?? ''}
                onChange={(e) => setJson(e.target.value)}
                spellCheck={false}
                className={`h-[440px] w-full rounded-md border bg-surface-container-lowest p-3 font-mono text-body-md text-on-surface outline-none focus:border-primary ${valid ? 'border-outline' : 'border-error'}`}
              />
              <div className="mt-3">
                <StatusChip status={valid ? 'success' : 'danger'} label={valid ? 'Valid JSON' : t('state.configInvalid')} />
              </div>
            </>
          )}
        </ASHACard>

        <ASHACard title={t('super.integrations')}>
          <div className="space-y-3">
            {integrationStates.map((int) => (
              <div key={int.key} className="flex items-center justify-between rounded-md border border-outline-variant px-3 py-2.5">
                <div>
                  <p className="text-body-md font-medium text-on-surface">{int.name}</p>
                  <p className="font-mono text-label-md text-on-surface-variant">{int.key}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip status={int.enabled ? 'success' : 'neutral'} label={int.enabled ? t('super.connected') : t('super.disconnected')} />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={int.enabled}
                    aria-label={int.name}
                    onClick={() => toggleIntegration(int.key, !int.enabled)}
                    className={`relative h-7 w-12 rounded-full transition-colors ${int.enabled ? 'bg-tertiary' : 'bg-surface-container-highest'}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${int.enabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ASHACard>
      </div>
    </div>
  )
}
