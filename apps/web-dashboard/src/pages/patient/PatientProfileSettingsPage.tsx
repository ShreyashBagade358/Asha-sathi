import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { useAppStore, patientPortalProfile } from '@/stores/app.store'
import { Icon, type IconName } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'

interface SettingRow {
  key: string
  label: string
  hint: string
  icon: IconName
}

const SETTINGS: SettingRow[] = [
  { key: 'pushNotifications', label: 'patient.pushNotifications', hint: 'patient.pushNotificationsHint', icon: 'bell' },
  { key: 'reminders', label: 'patient.reminderNotifs', hint: 'patient.reminderNotifsHint', icon: 'calendar' },
  { key: 'dataSaver', label: 'patient.dataSaver', hint: 'patient.dataSaverHint', icon: 'shield' },
]

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-surface-variant'}`}
      aria-hidden="true"
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  )
}

export default function PatientProfileSettingsPage() {
  const { t } = useLocalization()
  const { user, logout } = useAuth()
  const { addToast } = useUIStore()
  const patients = useAppStore((s) => s.patients)
  const [settings, setSettings] = useState<Record<string, boolean>>({
    pushNotifications: true,
    reminders: true,
    dataSaver: false,
  })
  const [language, setLanguage] = useState<'en' | 'hi'>(user?.language === 'hi' ? 'hi' : 'en')

  const profile = patientPortalProfile(patients)
  const fullName = user?.fullName || profile.name
  const role = 'Patient'

  const rows = [
    { label: t('patient.abhaId'), value: profile.abhaId },
    { label: t('common.phone'), value: user?.phone ?? profile.phone },
    { label: t('patient.dob'), value: profile.dob },
    { label: t('patient.bloodGroup'), value: profile.bloodGroup },
    { label: t('patient.assignedPhc'), value: profile.phc },
    { label: t('patient.assignedAsha'), value: profile.ashaWorker },
  ]

  const toggleSetting = (key: string) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
    addToast('success', t('patient.settingUpdatedToast'))
  }

  const selectLanguage = (lang: 'en' | 'hi') => {
    if (lang === language) return
    setLanguage(lang)
    addToast('success', t('patient.settingUpdatedToast'))
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t('patient.profileTitle')}
        subtitle={t('patient.profileSubtitle')}
        breadcrumbs={[{ label: t('patient.profileTitle') }]}
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
            {t('patient.profileActive')}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-variant px-3 py-1 font-caption text-caption font-semibold text-on-surface-variant">
            <Icon name="mapPin" size={14} />
            {profile.village}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-2 font-label-md text-label-md uppercase tracking-wide text-on-surface-variant">
          {t('patient.accountInfo')}
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
          {t('patient.settingsTitle')}
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
                <span className="block font-label-md text-label-md font-semibold text-on-surface">{t(setting.label)}</span>
                <span className="block font-caption text-caption text-on-surface-variant">{t(setting.hint)}</span>
              </span>
              <Toggle on={settings[setting.key]} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 font-label-md text-label-md uppercase tracking-wide text-on-surface-variant">
          {t('patient.languageLabel')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(['en', 'hi'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => selectLanguage(lang)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 font-label-md text-label-md font-semibold shadow-card transition-colors ${
                language === lang
                  ? 'border-primary bg-primary-container text-on-primary-container'
                  : 'border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon name="globe" size={18} />
              {lang === 'en' ? t('patient.english') : t('patient.hindi')}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void logout().then(() => { window.location.assign('/login') })}
        className="flex items-center justify-center gap-2 rounded-full border border-outline px-5 py-3 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-variant"
      >
        <Icon name="logOut" size={18} />
        {t('common.logout')}
      </button>
    </div>
  )
}
