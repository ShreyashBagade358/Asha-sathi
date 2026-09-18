import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon, type IconName } from '@/components/common/Icons'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { MOCK_HOUSEHOLDS } from '@/pages/asha/mockData'

const memberIcon: Record<string, IconName> = {
  'm1': 'users',
  'm2': 'heart',
  'm3': 'users',
  'm4': 'users',
  'm5': 'users',
  'm6': 'users',
  'm7': 'heart',
}

export default function HouseholdVisitSurveyAshaSathi() {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const household = MOCK_HOUSEHOLDS.find((h) => h.id === id) ?? MOCK_HOUSEHOLDS[0]

  const [water, setWater] = useState(false)
  const [toilet, setToilet] = useState(false)
  const [fever, setFever] = useState<'yes' | 'no' | ''>('')

  const complete = () => navigate('/asha/checkup-completed')

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Breadcrumbs
        items={[{ label: t('nav.ashaHouseholds'), to: '/asha/households' }, { label: t('nav.visitSurvey') }]}
      />

      <div className="flex items-center gap-2">
        <Link
          to="/asha/households"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high active:scale-95"
          aria-label={t('common.back')}
        >
          <Icon name="chevronLeft" size={22} />
        </Link>
        <h1 className="font-headline-lg text-headline-lg font-bold text-primary">{t('asha.householdVisit')}</h1>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
        <span className="absolute bottom-0 left-0 top-0 w-2 bg-primary" />
        <div className="pl-2">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <p className="font-caption text-caption text-on-surface-variant">{t('asha.householdIdLabel')}</p>
              <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">{household.id}</h2>
            </div>
            <span className="rounded-full bg-secondary-container px-3 py-1 font-caption text-caption font-semibold text-on-secondary-container">
              {t('asha.active')}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 font-body-md text-body-md text-on-surface">
            <Icon name="users" size={18} className="text-outline" />
            <span>
              <strong>{t('asha.head')}:</strong> {household.headName}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 font-body-md text-body-md text-on-surface">
            <Icon name="mapPin" size={18} className="text-outline" />
            <span>{t('asha.villageBlock', { village: household.village })}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.familyMembers')}</h3>
          <span className="rounded-full bg-surface-container-high px-3 py-1 font-caption text-caption text-on-surface">
            {household.members.length} {t('asha.members')}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {household.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-touch-target w-touch-target items-center justify-center rounded-full ${
                    member.risk === 'high'
                      ? 'bg-error-container text-on-error-container'
                      : member.flag === 'Immunization Due'
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface-container-high text-primary'
                  }`}
                >
                  <Icon name={memberIcon[member.id] ?? 'users'} size={20} />
                </span>
                <div>
                  <h4 className="font-body-md text-body-md font-bold text-on-surface">{member.name}</h4>
                  <p className="font-caption text-caption text-on-surface-variant">
                    {member.gender}, {member.age}y
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {member.risk === 'high' ? (
                  <span className="rounded-full bg-error-container px-3 py-1 font-caption text-caption text-on-error-container">
                    {t('asha.highRisk')}
                  </span>
                ) : null}
                {member.flag && member.risk !== 'high' ? (
                  <span className="rounded-full bg-secondary-container px-3 py-1 font-caption text-caption text-on-secondary-container">
                    {member.flag === 'Immunization Due' ? t('asha.immunizationDue') : member.flag}
                  </span>
                ) : null}
                <button type="button" aria-label={t('asha.viewMember')} className="flex h-touch-target w-touch-target items-center justify-center rounded-full text-outline transition-colors hover:bg-surface-container-low">
                  <Icon name="chevronRight" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-1 flex h-touch-target w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
        >
          <Icon name="plus" size={18} />
          {t('asha.addFamilyMember')}
        </button>
      </section>

      <section className="mt-1 flex flex-col gap-3">
        <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.householdSurvey')}</h3>
        <div className="flex flex-col gap-3">
          {[
            { label: t('asha.cleanWater'), hint: t('asha.cleanWaterHint'), value: water, set: setWater },
            { label: t('asha.functionalToilet'), hint: t('asha.toiletHint'), value: toilet, set: setToilet },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
              <div className="pr-4">
                <h4 className="font-body-md text-body-md font-bold text-on-surface">{item.label}</h4>
                <p className="mt-1 font-caption text-caption text-on-surface-variant">{item.hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={item.value}
                onClick={() => item.set(!item.value)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${item.value ? 'bg-secondary' : 'bg-outline-variant'}`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${item.value ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
            </div>
          ))}

          <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card">
            <div>
              <h4 className="font-body-md text-body-md font-bold text-on-surface">{t('asha.recentFever')}</h4>
              <p className="mt-1 font-caption text-caption text-on-surface-variant">{t('asha.feverHint')}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              {(['yes', 'no'] as const).map((value) => (
                <label key={value} className="flex-1 cursor-pointer">
                  <input className="peer sr-only" name="fever" type="radio" checked={fever === value} onChange={() => setFever(value)} />
                  <div
                    className={`flex h-touch-target w-full items-center justify-center rounded-xl border py-4 text-center font-label-md text-label-md transition-all peer-checked:font-bold ${
                      fever === value
                        ? 'border-primary bg-primary-container text-on-primary-container'
                        : 'border-outline-variant text-on-surface-variant'
                    }`}
                  >
                    {value === 'yes' ? t('common.yes') : t('common.no')}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-1 flex flex-col gap-3">
        <button
          type="button"
          onClick={complete}
          className="flex h-touch-target w-full items-center justify-center rounded-xl bg-primary font-label-md text-label-md font-bold text-on-primary shadow-md transition-all hover:bg-on-primary-fixed-variant active:scale-95"
        >
          <Icon name="checkCircle" className="mr-2" size={20} />
          {t('asha.completeVisit')}
        </button>
      </section>
    </div>
  )
}
