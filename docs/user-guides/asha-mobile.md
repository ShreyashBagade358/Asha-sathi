# ASHA Sathi - ASHA Mobile App Guide

Field guide for the ASHA mobile app (`apps/mobile-asha`). The app works
offline-first, supports Hindi (and other regional languages via the
localisation bundle), and syncs to the server when connectivity is available.

## Getting started

1. Install the app from the Play Store / internal distribution, or build the
   APK from CI artifacts.
2. Log in with the credentials issued by your PHC/block admin.
3. On first launch the app downloads your **area (village) data**, the work
   plan, and any pending notifications.

> If the network is unavailable at first login, contact your supervisor - the
> first sync must complete before offline mode is usable for your area.

## Dashboard and work plan

- **Dashboard** (`dashboard_screen.dart`) shows today's key numbers: pending
  tasks, due ANCs, due immunizations, eligible-couple follow-ups and incentives
  to be claimed.
- **Work plan** (`work_plan_screen.dart`) lists the day's scheduled visits
  grouped by household, with the reason for the visit and any high-risk flags.
  Tap an item to jump straight to the beneficiary record.

## Households and beneficiaries

- **Households** (`household_list_screen.dart`): register new households
  (`household_form_screen.dart`) with family details; view all members from
  `household_detail_screen.dart`.
- **Beneficiaries** (`beneficiary_list_screen.dart`): search (by name / ABHA /
  RCH id) and register women, children and other family members
  (`beneficiary_form_screen.dart`). `beneficiary_detail_screen.dart` is the
  single landing page for every service the person is enrolled in.

## Maternal care (RCH)

- **Register pregnancy** (`pregnancy_registration_screen.dart`): LMP, expected
  delivery date, obstetric history, co-morbidities.
- **ANC** (`anc_record_screen.dart`): record each ANC visit - blood pressure,
  Hb, blood sugar, fundal height, foetal heart rate; the app flags high-risk
  indicators using the maternal risk model.
- **High-risk list (HRP)** (`hrp_list_screen.dart`): auto-populated from risk
  scoring; tap to review the reason and take follow-up action.
- **Micro birth plan** (`micro_birth_plan_screen.dart`): delivery intent,
  transport, referral facility and PPIUCD preference.
- **Delivery** (`delivery_record_screen.dart`): outcome, place, birth details
  (also feeds the child record).
- **PNC** (`pnc_record_screen.dart`): postnatal checkups for mother and
  newborn at day 3/7/14/21/28.

## Child care (RCH)

- **Registration** (`child_registration_screen.dart`): birth details, birth
  weight, feeding.
- **Immunization** (`immunization_screen.dart` + `immunization_record_screen.dart`):
  schedule per the national schedule; mark each dose given, record the due
  date and view the full record.
- **Growth** (`growth_chart_screen.dart`): track weight-for-age / height-for-age
  and MUAC; WHO z-scores and MAM/SAM status are computed **offline** on the
  device (no network required).
- **HBNC** (`hbnc_visit_screen.dart`) and **HBYC** (`hbyc_visit_screen.dart`):
  home-based newborn and young-child visit checklists, including danger-sign
  screening.

## Eligible couples

- **Register couple** (`ec_registration_screen.dart`) and manage the list
  (`ec_list_screen.dart`).
- **Follow-up** (`ec_followup_screen.dart`): non-pregnant couples on the
  follow-up schedule; record family-planning counselling and updates.

## NCD and disease control

- **CBAC screening** (`cbac_screening_form_screen.dart`): community-based
  assessment for 30+ adults; the NCD model scores diabetes and hypertension
  risk from the measurements you enter.
- **Due list** (`ncd_due_list_screen.dart`): adults due for screening or a
  follow-up measurement.
- **Disease control** (`disease_case_*_screens.dart`): register notifiable
  cases and record follow-up; the **outbreak map** (`disease_outbreak_map_screen.dart`)
  shows reported cases in your area.

## Death reports

Register maternal / infant / child deaths (`death_report_form_screen.dart`),
review the list (`death_report_list_screen.dart`) and view the details with
cause and verification status (`death_report_detail_screen.dart`).

## Incentives

- **Claims** (`incentive_claim_screen.dart`, `incentive_list_screen.dart`):
  file incentive claims for completed services (ANC, institutional delivery,
  immunization, etc.) and track their approval status.
- **Village forms** (`village_form_screen.dart`, `village_form_list_screen.dart`):
  fill in monthly village health forms and submit them for the block.

## ABHA and AI assistant

- **ABHA** (`abha_*_screens.dart`): create or link an ABHA (Ayushman Bharat
  Health Account) for a beneficiary, manage consent, and check linkage status.
  See `docs/abdm-integration/ABDM.md` for the ABDM integration details.
- **AI assistant** (`ai_assistant_chat_screen.dart`): ask clinical and
  work-flow questions in your own language (subject to the approved-use
  policy); answers are advisory, not a substitute for clinical judgement.

## Training

Track training modules and certificates (`training_list_screen.dart`,
`training_detail_screen.dart`, `training_certificate_screen.dart`). Attend the
assigned modules to keep your profile and incentives updated.

## Notifications

Alerts for due visits, high-risk beneficiaries, incentive approvals and system
messages. Notifications respect the app's language settings and are shown both
in-app and as push/local notifications.

## Offline mode and sync

The app is **offline-first**:

- All reads come from the local SQLite database (`core/offline/database.dart`).
- Writes (new registrations, visit records, claims) are queued in
  `core/offline/sync_queue.dart` and uploaded when connectivity returns.
- `core/offline/sync_engine.dart` resolves conflicts (server wins for edited
  records, with the local change kept as an audit entry) and downloads the
  latest work plan, schedules and reference data.

Use the **Sync screen** to:

- See the pending queue and last-sync time.
- Force a sync now.
- Review sync conflicts and errors (`sync_failed_*` screens) and retry.

### Best practices

- Sync at least once a day, preferably on the office Wi-Fi.
- Keep the app updated - model and dictionary updates are delivered with app
  updates.
- If a sync fails, fix the underlying connection before retrying; queued data
  is not lost.

## Settings and languages

- Language is selectable in-app (Hindi and more, see `core/l10n/app_strings.dart`
  and `core/config/languages.dart`).
- App theme and region defaults are managed centrally via the PHC admin
  dashboard.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| Cannot log in | Check credentials / internet; confirm your account is active and assigned to a sub-centre. |
| Data not loading | Pull to refresh / force sync from the Sync screen. |
| Sync failed | Check connectivity, retry; review the queue for conflicts. |
| Session expired | Log in again (tokens are refreshed automatically when online). |
| Wrong language | Change it in Settings. |
| Model flags a beneficiary high-risk | Follow the referral pathway shown on screen; contact your MO/ANM if unsure. |

For PHC/block admins: the **PHC admin app** (`apps/mobile-phc-admin`) manages
users, area assignment, forms review and approvals, and the **web dashboard**
(`apps/web-dashboard`) provides the aggregate view for officials.
