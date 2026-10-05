# CRUD UI Checklist

Page-by-page audit of create / read / update / delete affordances across the
web dashboard (`apps/web-dashboard/src/pages/`).

Companion to [`crud-test-plan.md`](./crud-test-plan.md), which verifies the
backend HTTP surface. This document covers **what the UI actually exposes and
whether it is wired to a real service** — not just whether a button exists.

## Goal

Confirm, per page, that create/read/update/delete actions are present and call
the API (or state clearly that they are absent / UI-only), so backend coverage
and user-facing capability stay in sync.

## Legend

| Mark | Meaning |
| --- | --- |
| ✅ | Wired — calls a real service/API (or a real persisted store for field-app pages) |
| ⚠️ | Partial — affordance exists but is UI-only, toast-only, mock, local-state, or a stub |
| ❌ | Absent — no such affordance |
| — | Not applicable to the page |

## Scope

89 route pages across 8 areas (the task's "95 pages" includes a few shared
components/layouts not covered here):

| Area | Pages |
| --- | --- |
| `phc-admin/` | 40 |
| `asha/` | 20 |
| `auth/` | 6 |
| `patient/` | 8 |
| `phc/` | 5 |
| `state/` | 4 |
| `district/` | 3 |
| `super/` | 3 |
| **Total** | **89** |

## Scorecard

- **Fully wired (API) CRUD** is concentrated in `phc-admin/` and `phc/`:
  households, beneficiaries, pregnancies, children, referrals, notifications,
  ASHA create + village assignment, sanitize.
- **`asha/` field-app pages** are now split: patient registration, child health,
  checkups, immunization, referrals, follow-ups, profile language and PHC
  settings call the API; the remainder still persist to a local Zustand
  `persist` store (`app.store`, localStorage) with **no API side effects**
  (⚠️ below because they never sync).
- **`state/`, `district/`, `super/`** are read-only or mock demos;
  create/update actions are toast/local-state stubs. `patient/` now reads and
  edits its own record via `/patients/me`.
- **Delete is the weakest dimension**: only 5 pages have a wired delete, all in
  `phc-admin/` (households, beneficiaries, pregnancy details, child profile,
  referral details). No other area exposes delete at all.
- See **Buildability & scope** for which gaps are UI-only vs. blocked on backend.

---

## `phc-admin/` (40 pages)

| Page | Purpose | Create | Read | Update | Delete | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `addHousehold.tsx` | Register household form | ❌ | — | — | — | **Stub** — submit only toasts + navigates, no API |
| `addPatient.tsx` | Create beneficiary | ✅ incl. `village`/`risk`/`notes` + photo | ✅ list households | — | — | |
| `addVillage.tsx` | Create village | ✅ | ✅ | — | — | |
| `addWorker.tsx` | Create ASHA worker | ✅ + one-time password shown | — | — | — | Dead Username input removed; avatar upload |
| `alerts.tsx` | Alerts inbox | ✅ `POST /notifications/broadcast` | ✅ | — | — | |
| `analytics.tsx` | Analytics dashboards | — | ✅ 5 services | — | — | Read-only aggregation |
| `ashaPerformance.tsx` | ASHA performance | — | ❌ | — | — | **Static stub** (39 lines) |
| `auditLogs.tsx` | Audit log | — | ⚠️ store mock | — | — | No API |
| `beneficiaries.tsx` | Beneficiary directory | ✅ link→addPatient | ✅ search+village+page | — | ✅ `deleteBeneficiary` | Risk Level column renders stored `risk` |
| `beneficiaryDetails.tsx` | Beneficiary detail | — | ✅ + photo | ❌ | ❌ | Disabled button; one button with no `onClick` |
| `checkupHistory.tsx` | Visit history | — | ⚠️ store mock | — | — | No API |
| `childProfile.tsx` | Child detail | — | ✅ child + immunizations + growth photos | — | ✅ `deleteChild` | Record dose → schedule |
| `childVaccinationReport.tsx` | Vaccination report | — | ✅ | — | — | |
| `children.tsx` | Children directory | ❌ no create link | ✅ | — | — | No "add child" CTA |
| `criticalAlerts.tsx` | Critical alerts | — | ❌ | — | — | **Static stub** (28 lines) |
| `dashboard.tsx` | PHC overview | — | ✅ 7 services | — | — | Read-only |
| `followUps.tsx` | EC follow-ups | — | ✅ | — | — | Only tab filters wired |
| `householdDetails.tsx` | Household detail | — | ✅ + members | ❌ | ❌ | No edit; survey link static |
| `householdSurvey.tsx` | Household survey | — | ❌ | — | — | **Static stub** (26 lines) |
| `households.tsx` | Household directory | ⚠️ link→**stub** addHousehold | ✅ | — | ✅ `deleteHousehold` | Create target is non-wired |
| `maternalHealth.tsx` | Maternal overview | ⚠️ Register→list (no form) | ✅ | — | — | **"Intervene" dead**; ANC-4 hardcoded; `ashaFor()` hardcoded "ASHA" |
| `maternalReport.tsx` | Maternal report | — | ✅ | — | — | |
| `newBirth.tsx` | Birth registration | ✅ `createChild` | ✅ | — | — | |
| `newCheckup.tsx` | ANC checkup | ✅ `addANCVisit` | ✅ | — | — | |
| `newReferral.tsx` | Create referral | ✅ | ✅ | — | — | |
| `newVaccination.tsx` | Record dose | ✅ `createImmunization` (incl. `batch_number`) | ✅ | — | — | |
| `notifications.tsx` | Notifications | — | ✅ | ✅ mark read | — | |
| `nutritionMonitoring.tsx` | Nutrition tracking | ✅ growth record | ✅ growth + photos | — | — | Photos shown in timeline |
| `pregnancyDetails.tsx` | Pregnancy detail | — | ✅ + ANC visits | — | ✅ `deletePregnancy` | |
| `pregnantWomen.tsx` | Pregnant women list | ❌ no register form | ✅ | — | — | No create page exists in this area |
| `referralDetails.tsx` | Referral detail | — | ✅ | ✅ accept+complete | ✅ `deleteReferral` | |
| `referrals.tsx` | Referral list | ✅ link→newReferral | ✅ | ✅ accept+complete | — | |
| `report.tsx` | Reports | — | ✅ | ⚠️ export only | — | |
| `riskAnalysis.tsx` | Risk analysis | — | ❌ | — | — | **Static stub** (35 lines) |
| `sanitize.tsx` | Data repair tool | — | ✅ summary | ✅ `sanitize.fix` | — | Admin utility |
| `settings.tsx` | PHC configuration | — | ✅ config | ✅ `PUT /config/app` | — | Prefills, then merges `phc.profile` / `phc.notifications` |
| `vaccination.tsx` | Vaccination coverage | ❌ no record link | ✅ | — | — | |
| `vaccinationSchedule.tsx` | Child vaccination record | ⚠️ dead "Record Dose" | ✅ | — | — | Button has no handler |
| `workerProfile.tsx` | ASHA profile | — | ✅ + avatar | — | — | |
| `workers.tsx` | ASHA directory | ✅ link→addWorker | ✅ | — | — | No status toggle / delete |

### `phc-admin/` follow-ups

1. `addHousehold` is a mock — wire `householdService.createHousehold`.
2. Dead handlers: `maternalHealth` "Intervene", `vaccinationSchedule` "Record
   Dose", `beneficiaryDetails` disabled/unwired. (`nutritionMonitoring` record
   and growth/photo wiring are now done.)
3. No pregnancy-registration form — `pregnantWomen` and `maternalHealth`
   "Register" both point at the list page.
4. Static placeholder pages: `ashaPerformance`, `criticalAlerts`,
   `householdSurvey`, `riskAnalysis`; mock-store pages: `auditLogs`,
   `checkupHistory`.
5. `children.tsx` / `vaccination.tsx` have no create CTA.

---

## `asha/` (20 pages)

Field-worker app. Pages marked ✅ now call the API; the rest still write to the
persisted Zustand store (`app.store`, localStorage) with **no API side effects**
(⚠️ = persisted locally only). `ProfileSettings` logout uses `authService`.

| Page | Purpose | Create | Read | Update | Delete | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `AddNewPatientAshaSathi.tsx` | Register patient | ✅ `POST /patients/register` + photo | ❌ | ❌ | ❌ | Village/ward picked from API; password shown once |
| `AshaWorkerHomeAshaSathi.tsx` | Worker dashboard | ⚠️ link only | ⚠️ store | ⚠️ toggle task | ❌ | "Review Now" + visit button dead |
| `AssignedHouseholdsAshaSathi.tsx` | Assigned households | ❌ dead FAB | ⚠️ `MOCK_HOUSEHOLDS` | ❌ | ❌ | FAB no `onClick`; "Planned" disabled |
| `CheckUpCompletedAshaSathi.tsx` | Checkup success | ❌ | ❌ static | ❌ | ❌ | Dates/sync text hardcoded |
| `ChildHealthAshaSathi.tsx` | Child health registry | ✅ `createChild` | ✅ | ❌ | ❌ | Schedule link hardcoded |
| `ConnectionErrorAshaSathi.tsx` | Offline/error screen | ❌ | ❌ | ❌ | ❌ | "Retry" is fake timeout |
| `FollowUpAshaSathi.tsx` | Follow-up visits | ❌ (no create form) | ✅ `GET /referrals` + `/referrals/{id}/followups` | ❌ dropped "Mark Done" | ❌ | No complete/overdue endpoint |
| `HealthCheckUpAshaSathi.tsx` | Checkup records | ✅ ANC/NCD screening create | ✅ | ❌ | ❌ | "View Checkup" → generic page |
| `HealthSurveyAshaSathi.tsx` | Health survey list | ❌ | ⚠️ `MOCK_SURVEYS` | ❌ | ❌ | Link hardcoded |
| `HouseholdVisitSurveyAshaSathi.tsx` | Household visit survey | ⚠️ local toggles | ⚠️ mock | ⚠️ never persisted | ❌ | Add member / chevron dead; answers not saved |
| `ImmunizationScheduleAshaSathi.tsx` | Vaccination schedule | ❌ | ✅ | ✅ `updateImmunization` | ❌ | Certificate = toast; patient fallback |
| `MyHealthProfileAshaSathi.tsx` | Patient health profile | ❌ | ⚠️ store + hardcoded | ❌ | ❌ | Vitals/history/prescriptions hardcoded |
| `NotificationsAshaSathi.tsx` | Notification inbox | ❌ | ⚠️ store | ⚠️ mark read | ❌ | No API push/poll |
| `OfflineSyncCenterAshaSathi.tsx` | Offline sync queue | ❌ | ⚠️ `SYNC_QUEUE` | ⚠️ simulated | ❌ | Sync faked via `setTimeout` |
| `PatientDashboardAshaSathi.tsx` | Patient list + search | ❌ no add | ⚠️ store | ❌ | ❌ | Store-only |
| `PatientDetailsAshaSathi.tsx` | Patient detail (tabs) | ⚠️ toast | ⚠️ store + hardcoded | ⚠️ toast "Edit" | ❌ | Edit / Refer Specialist toast-only |
| `PregnancyTrackingAshaSathi.tsx` | Pregnancy registry | ⚠️ local store | ⚠️ store | ❌ | ❌ | Profile link hardcoded; `ancVisits:0` |
| `ProfileSettingsAshaSathi.tsx` | Profile & settings | ❌ | ✅ user + state | ✅ language → `PUT /auth/me`; ⚠️ 4 toggles local | ❌ | Offline/auto-sync toggles have no backend field |
| `ReferralAshaSathi.tsx` | Referrals | ✅ `POST /referrals` | ✅ | ❌ | ❌ | No status-update UI |
| `TasksAshaSathi.tsx` | Task list | ❌ | ⚠️ store | ⚠️ toggle | ❌ | No task create |
| `mockData.ts` | Mock data module | — | — | — | — | Supplies `MOCK_*` arrays |

---

## `auth/` (6 pages)

| Page | Purpose | Create | Read | Update | Delete | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `LoginAshaSathi.tsx` | Role+phone OTP login | ✅ `authService` | — | — | — | Role selector cosmetic (not sent); password link self-refs |
| `LoginPage.tsx` | Phone OTP login (DS) | ✅ | — | — | — | |
| `VerifyOtpAshaSathi.tsx` | 4-digit OTP verify | ✅ verify + resend | — | — | — | Error text hardcodes "6 digits" |
| `OtpPage.tsx` | 6-digit OTP verify (DS) | ✅ verify + resend | — | — | — | |
| `AccountRecoveryAshaSathi.tsx` | Password reset request | ⚠️ form, **no submit handler** | — | — | — | Never submits; support link self-refs |
| `RedirectingAshaSathi.tsx` | Auth splash | — | — | — | — | Static, no redirect logic |

---

## `patient/` (8 pages)

Patient pages read their own record from the patient-scoped API
(`GET/PUT /patients/me`, `PUT /auth/me`, `/ai`); pages still marked ⚠️ use
`useAppStore` mock state.

| Page | Purpose | Create | Read | Update | Delete | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `PatientHomePage.tsx` | Patient home | ❌ | ⚠️ mock store | ❌ | ❌ | Download = toast |
| `PatientAppointmentsPage.tsx` | Appointments | ⚠️ book = toast | ⚠️ mock | ⚠️ mark-attended local | ❌ | Booking stub |
| `PatientNotificationsPage.tsx` | Notifications | ❌ | ⚠️ mock | ⚠️ mark read local | ❌ | No service |
| `PatientHealthProfilePage.tsx` | Health profile | ❌ | ✅ `GET /patients/me` | ✅ `PUT /patients/me` (HealthProfileEditModal) | ❌ | AI risk card runs `/ai/{ncd,maternal}-risk/predict` |
| `PatientHealthRecordsPage.tsx` | Health records | ❌ | ⚠️ mock | ❌ | ❌ | Download = toast |
| `PatientVaccinationPage.tsx` | Vaccination schedule | ❌ | ⚠️ mock | ⚠️ local store | ❌ | Certificate = toast |
| `PatientReferralsPage.tsx` | Referrals | ⚠️ request = toast | ⚠️ mock | ❌ | ❌ | Request stub |
| `PatientProfileSettingsPage.tsx` | Profile settings | ❌ | ✅ user | ✅ language → `PUT /auth/me`; ⚠️ toggles local | ❌ | 3 toggles have no backend field |

---

## `phc/` (5 pages)

| Page | Purpose | Create | Read | Update | Delete | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `DashboardPage.tsx` | PHC coverage/HRP/sync | ❌ | ✅ `getPHCDashboard` | ❌ | ❌ | "Sync Now" `onClick={() => undefined}`; trends hardcoded |
| `ASHAManagementPage.tsx` | Manage ASHAs | ✅ `createASHA` | ✅ `listASHAs` | ✅ `assignVillages` | ❌ | No delete |
| `BeneficiaryManagementPage.tsx` | Beneficiary list + drawer | ❌ | ✅ list + get | ❌ | ❌ | Read-only; `exportCSV` wired |
| `ReportsPage.tsx` | Report tabs | ❌ | ✅ `getReport` | ❌ | ❌ | `exportExcel` wired |
| `AlertsPage.tsx` | Alerts ack/resolve | ❌ | ⚠️ `FALLBACK_ALERTS` | ⚠️ local ack/resolve | ❌ | No service; mock data |

---

## `state/` (4 pages)

| Page | Purpose | Create | Read | Update | Delete | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `DashboardPage.tsx` | State KPIs + district compare | ❌ | ✅ `getStateDashboard` | ❌ | ❌ | Map placeholder; trends hardcoded |
| `PolicyConfigPage.tsx` | Policy + feature flags | ❌ | ⚠️ static default | ⚠️ save = toast | ❌ | Save/persist stub |
| `AuditLogsPage.tsx` | Audit log | ❌ | ⚠️ `makeLogs()` mock | ❌ | ❌ | Entirely mock |
| `DistrictComparisonPage.tsx` | District indicators | ❌ | ✅ `getStateDashboard` | ❌ | ❌ | Toggles UI-only |

---

## `district/` (3 pages)

| Page | Purpose | Create | Read | Update | Delete | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `DashboardPage.tsx` | District KPIs + PHC compare | ❌ | ✅ `getDistrictDashboard` | ❌ | ❌ | Trend values hardcoded |
| `PHCComparisonPage.tsx` | PHC indicators | ❌ | ✅ `getDistrictDashboard` | ❌ | ❌ | Toggle-only |
| `ResourceAllocationPage.tsx` | Allocate resources to PHCs | ⚠️ local state | ⚠️ static `INITIAL_ALLOCATIONS` | ⚠️ local state | ❌ | Never persists |

---

## `super/` (3 pages)

| Page | Purpose | Create | Read | Update | Delete | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `SystemConfigPage.tsx` | App config JSON editor | ❌ | ⚠️ static default | ⚠️ save = toast | ❌ | Save stub; toggle local-only |
| `DeploymentPage.tsx` | Service status | ❌ | ⚠️ static `SERVICES` | ⚠️ restart = local | ❌ | Logs/sync/refresh toast-only |
| `UserManagementPage.tsx` | User accounts | ⚠️ `Promise.resolve` no API | ⚠️ `INITIAL_USERS` mock | ⚠️ mock mutation | ❌ | CRUD stubbed; calls `invalidateQueries` with no backend |

---

## Cross-cutting follow-ups

| Priority | Item | Location |
| --- | --- | --- |
| High | Wire household creation | `phc-admin/addHousehold.tsx` |
| High | Wire user management CRUD to `/users` API | `super/UserManagementPage.tsx` |
| High | Persist or sync ASHA field-app writes | `pages/asha/*` (local store only) |
| Medium | Remove/repair dead buttons | `maternalHealth`, `vaccinationSchedule`, `beneficiaryDetails`, `phc/DashboardPage`, `AssignedHouseholds`, `AccountRecovery` |
| Medium | Implement or delete static stubs | `ashaPerformance`, `criticalAlerts`, `householdSurvey`, `riskAnalysis` |
| Medium | Add delete affordances beyond `phc-admin` | patients (none), workers, users, referrals (list), ASHAs |
| Low | Replace hardcoded/mock data with queries | `auditLogs`, `checkupHistory`, `state/AuditLogsPage`, `AlertsPage`, `ResourceAllocationPage`, `DeploymentPage`, `SystemConfigPage` |
| Low | Fix `VerifyOtpAshaSathi` "6 digits" copy (OTP is 4) | `auth/VerifyOtpAshaSathi.tsx` |

## Buildability & scope

Which of the ⚠️/❌ gaps above are UI-only work versus blocked on backend.
Sourced from the live route inventory (158 endpoints, 25 modules in
`apps/backend/app/api/v1/`).

### Buildable now (API endpoint exists — UI work only)

| Feature | Backend endpoint(s) | Area |
| --- | --- | --- |
| Household creation (`addHousehold` stub) | `POST /households` | phc-admin |
| Household edit | `PUT /households/{id}` | phc-admin |
| Beneficiary edit | `PUT /beneficiaries/{id}` | phc-admin |
| Pregnancy registration form (missing page) | `POST /pregnancies` | phc-admin |
| Children create CTA | `POST /children` | phc-admin |
| `vaccinationSchedule` "Record Dose" | `POST /children/{id}/immunizations` | phc-admin |
| Child growth progress photos | `POST/DELETE /children/{id}/growth/{record_id}/photo` | phc-admin |
| Eligible-couple delete (`followUps`) | `DELETE /eligible-couples/{id}` | phc-admin |
| `ashaPerformance` stub | `GET /reports/asha-performance`, `GET /ashas/{id}/performance` | phc-admin |
| `riskAnalysis` stub | `POST /ai/maternal-risk\|child-growth\|ncd-risk/predict` | phc-admin |
| `auditLogs` + `state/AuditLogsPage` mock | `GET /audit/logs` | phc-admin, state |
| User management CRUD | `GET/POST/PUT/DELETE /users` | super |
| PHC dashboard "Sync Now" | `POST /sync/push`, `GET /sync/status` | phc |
| ASHA offline page writes | `POST /sync/push`, `POST /sync/pull` (19 entity tables) | asha |
| ASHA notification inbox | `GET /notifications`, `PUT /notifications/{id}/read` | asha |
| Alerts real data + deletes for NCD/death/disease | `GET /notifications`; existing `DELETE` endpoints | phc, new |
| Patient profile read/edit + AI risk (`PatientHealthProfilePage`) | `GET/PUT /patients/me`, `POST /ai/{ncd,maternal}-risk/predict` | patient |
| Profile language switch (`ProfileSettings`, `PatientProfileSettings`) | `PUT /auth/me` | asha, patient |
| PHC settings save (`settings.tsx`) | `PUT /config/app` | phc-admin |
| One-time worker/patient passwords on create | `POST /users`, `POST /ashas`, `POST /patients/register` return `password` | phc-admin, asha, super |

### Buildable with backend work (endpoint/schema missing)

| Feature | What's missing | Area |
| --- | --- | --- |
| Alerts ack / resolve | No `/alerts` route — alerts are server-side generated, surfaced only via `/notifications` | phc |
| Profile/app-settings persistence | `PUT /auth/me` used for language; the remaining toggles (offline, auto-sync, notifications, data-saver) have no backend field | asha, patient, super, state |
| Password / account recovery | No reset endpoint (`AccountRecoveryAshaSathi` cannot submit) | auth |
| Survey capture (household/health/visit) | No survey model, table or endpoint | phc-admin, asha |

### Not planned / out of scope

| Feature | Reason |
| --- | --- |
| Resource allocation (`district/ResourceAllocationPage`) | No endpoint; design concept only |
| Deployment / service status (`super/DeploymentPage`) | No endpoint; ops tooling, not CRUD |
| System config editor (`super/SystemConfigPage`) | `/config/app` PUT takes a typed `configs[]` list, not the page's free-form JSON; PHC settings page does persist its own keys |
| State policy config save (`state/PolicyConfigPage`) | Same as above |

Backend read coverage for these areas is still fully exercised — see
`crud-test-plan.md`; only the write/save paths above have no API to attach to.

## How to use

1. Backend behaviour: run `apps/backend/tests/test_crud_api.py` (see
   `crud-test-plan.md`).
2. UI behaviour: for each page marked ⚠️/❌ above, reproduce the gap manually,
   then either wire the action or explicitly mark the page read-only/mock in
   its module.
3. Update this table when a gap is closed so the checklist stays honest.
