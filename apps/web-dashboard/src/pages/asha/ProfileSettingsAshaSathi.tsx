import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { useUIStore } from '@/stores/ui.store'

interface SettingRow {
  key: string
  label: string
  hint: string
  icon: 'bell' | 'globe' | 'download' | 'shield' | 'refresh' | 'phone'
}

const SETTINGS: SettingRow[] = [
  { key: 'offlineMode', label: 'Offline-first mode', hint: 'Save data locally and sync when connected', icon: 'download' },
  { key: 'notifications', label: 'Push notifications', hint: 'Alerts for HRP, dues and follow-ups', icon: 'bell' },
  { key: 'autoSync', label: 'Auto-sync on Wi-Fi', hint: 'Upload pending records automatically', icon: 'refresh' },
  { key: 'language', label: 'Hindi interface', hint: 'Switch UI language to Hindi', icon: 'globe' },
  { key: 'dataSaver', label: 'Low data mode', hint: 'Reduce images and media usage', icon: 'shield' },
]

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-surface-variant'}`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </span>
  )
}

export default function ProfileSettingsAshaSathi() {
  const { t } = useLocalization()
  const { user, logout } = useAuth()
  const { addToast } = useUIStore()

  const [settings, setSettings] = useState<Record<string, boolean>>({
    offlineMode: true,
    notifications: true,
    autoSync: false,
    language: user?.language === 'hi',
    dataSaver: false,
  })

  const fullName = user?.fullName ?? 'ASHA Worker'
  const role = user?.role.replace('_', ' ') ?? 'asha'

  const rows = [
    { label: t('common.phone'), value: user?.phone ?? '—' },
    { label: t('asha.primaryLanguage'), value: user?.language === 'hi' ? t('asha.hindi') : 'English' },
    { label: t('common.state'), value: user?.stateName ?? user?.stateId ?? '—' },
    { label: t('common.district'), value: user?.districtName ?? user?.districtId ?? '—' },
    { label: t('common.phc'), value: user?.phcName ?? user?.phcId ?? '—' },
    { label: t('nav.villages'), value: user?.villages?.length ? user.villages.join(', ') : '—' },
  ]

  const toggleSetting = (key: string) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
    addToast('success', 'Setting updated')
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t('asha.profileTitle')}
        subtitle={t('asha.profileSubtitle')}
        breadcrumbs={[{ label: t('asha.profileTitle') }]}
      />

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-card">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-headline-md font-bold text-on-primary">
          {(fullName.charAt(0) || '?').toUpperCase()}
        </div>
        <div className="text-center">
          <p className="font-headline-md text-headline-md font-semibold text-on-surface">{fullName}</p>
          <p className="font-body-md text-body-md capitalize text-on-surface-variant">{role}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 font-caption text-caption font-semibold text-on-secondary-container">
            <Icon name="checkCircle" size={14} />
            {t('asha.profileActive')}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-variant px-3 py-1 font-caption text-caption font-semibold text-on-surface-variant">
            <Icon name="refresh" size={14} />
            {t('asha.synced')}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-2 font-label-md text-label-md uppercase tracking-wide text-on-surface-variant">
          {t('nav.accountInfo')}
        </p>
        <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                i < rows.length - 1 ? 'border-b border-outline-variant' : ''
              }`}
            >
              <span className="font-caption text-caption text-on-surface-variant">{row.label}</span>
              <span className="truncate text-right font-body-md text-body-md font-medium text-on-surface">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-label-md text-label-md uppercase tracking-wide text-on-surface-variant">
          {t('asha.settingsTitle')}
        </p>
        <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
          {SETTINGS.map((setting, i) => (
            <button
              key={setting.key}
              type="button"
              onClick={() => toggleSetting(setting.key)}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-container ${
                i < SETTINGS.length - 1 ? 'border-b border-outline-variant' : ''
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                <Icon name={setting.icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-label-md text-label-md font-semibold text-on-surface">{setting.label}</span>
                <span className="block font-caption text-caption text-on-surface-variant">{setting.hint}</span>
              </span>
              <Toggle on={settings[setting.key]} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          to="/asha/sync"
          className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card transition-colors hover:bg-surface-container"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon name="download" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-label-md text-label-md font-semibold text-on-surface">{t('asha.openSyncCenter')}</span>
            <span className="block font-caption text-caption text-on-surface-variant">{t('asha.profileSyncHint')}</span>
          </span>
          <Icon name="chevronRight" size={20} className="text-on-surface-variant" />
        </Link>

        <button
          type="button"
          onClick={() => void logout().then(() => { window.location.assign('/login') })}
          className="flex items-center justify-center gap-2 rounded-full border border-outline px-5 py-3 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-variant"
        >
          <Icon name="logOut" size={18} />
          {t('common.logout')}
        </button>
      </div>
    </div>
  )
}
