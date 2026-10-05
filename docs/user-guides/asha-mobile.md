# ASHA Sathi - ASHA Mobile App Guide

Field guide for the ASHA mobile app (`apps/mobile-expo`). The app is built
with Expo (React Native + Expo Router), works offline-first, and syncs to the
server when connectivity is available.

> **Status:** the app is being built incrementally. The offline-first data
> model, sync engine and the screens listed here are the target. Sections
> marked _planned_ are not yet implemented.

## Getting started

1. Install **Expo Go** on your phone, then start the app:
   `cd apps/mobile-expo && npx expo start` and scan the QR code.
2. Point the app at the backend. Physical devices cannot use `localhost`; set
   `EXPO_PUBLIC_API_URL` to your machine's LAN address, for example
   `http://192.168.1.10:8000/api/v1`.
3. Log in with the phone number issued by your PHC/block admin and request an
   OTP.
4. On first launch the app downloads your **area (village) data**, the work
   plan, and any pending notifications.

> If the network is unavailable at first login, contact your supervisor - the
> first sync must complete before offline mode is usable for your area.

## Dashboard and work plan

- **Dashboard** (`app/dashboard`) shows today's key numbers: pending
  tasks, due ANCs, due immunizations, eligible-couple follow-ups and incentives
  to be claimed.
- **Work plan** (`app/work_plan`) lists the day's scheduled visits
  grouped by household, with the reason for the visit and any high-risk flags.
  Tap an item to jump straight to the beneficiary record.

## Households and beneficiaries

- **Households** (`app/household_list`): register new households
  (`app/household_form`) with family details; view all members from
  `app/household_detail`.
- **Beneficiaries** (`app/beneficiary_list`): search (by name / ABHA /
  RCH id) and register women, children and other family members
  (`app/beneficiary_form`). `app/beneficiary_detail` is the
  single landing page for every service the person is enrolled in.

## Maternal care (RCH)

- **Register pregnancy** (`app/pregnancy_registration`): LMP, expected
  delivery date, obstetric history, co-morbidities.
- **ANC** (`app/anc_record`): record each ANC visit - blood pressure,
  Hb, blood sugar, fundal height, foetal heart rate; the app flags high-risk
  indicators using the maternal risk model.
- **High-risk list (HRP)** (`app/hrp_list`): auto-populated from risk
  scoring; tap to review the reason and take follow-up action.
- **Micro birth plan** (`app/micro_birth_plan`): delivery intent,
  transport, referral facility and PPIUCD preference.
- **Delivery** (`app/delivery_record`): outcome, place, birth details
  (also feeds the child record).
- **PNC** (`app/pnc_record`): postnatal checkups for mother and
  newborn at day 3/7/14/21/28.

## Child care (RCH)

- **Registration** (`app/child_registration`): birth details, birth
  weight, feeding.
- **Immunization** (`app/immunization` + `app/immunization_record`):
  schedule per the national schedule; mark each dose given, record the due
  date and view the full record.
- **Growth** (`app/growth_chart`): track weight-for-age / height-for-age
  and MUAC; WHO z-scores and MAM/SAM status are computed **offline** on the
  device (no network required).
  - **Progress photos**: capture a photo at the point of measurement. Photos are
    queued offline and uploaded when connectivity returns; the chart shows a
    photo timeline so visible growth can be compared over time. A photo can be
    removed from a measurement on the same screen.
- **HBNC** (`app/hbnc_visit`) and **HBYC** (`app/hbyc_visit`):
  home-based newborn and young-child visit checklists, including danger-sign
  screening.

## Eligible couples

- **Register couple** (`app/ec_registration`) and manage the list
  (`app/ec_list`).
- **Follow-up** (`app/ec_followup`): non-pregnant couples on the
  follow-up schedule; record family-planning counselling and updates.

## NCD and disease control

- **CBAC screening** (`app/cbac_screening_form`): community-based
  assessment for 30+ adults; the NCD model scores diabetes and hypertension
  risk from the measurements you enter.
- **Due list** (`app/ncd_due_list`): adults due for screening or a
  follow-up measurement.
- **Disease control** (`app/disease_case_*`): register notifiable
  cases and record follow-up; the **outbreak map** (`app/disease_outbreak_map`)
  shows reported cases in your area.

## Death reports

Register maternal / infant / child deaths (`app/death_report_form`),
review the list (`app/death_report_list`) and view the details with
cause and verification status (`app/death_report_detail`).

## Incentives

- **Claims** (`app/incentive_claim`, `app/incentive_list`):
  file incentive claims for completed services (ANC, institutional delivery,
  immunization, etc.) and track their approval status.
- **Village forms** (`app/village_form`, `app/village_form_list`):
  fill in monthly village health forms and submit them for the block.

## ABHA and AI assistant

- **ABHA** (`app/abha_*`): create or link an ABHA (Ayushman Bharat
  Health Account) for a beneficiary, manage consent, and check linkage status.
  See `docs/abdm-integration/ABDM.md` for the ABDM integration details.
- **AI assistant** (`app/ai_assistant_chat`): ask clinical and
  work-flow questions in your own language (subject to the approved-use
  policy); answers are advisory, not a substitute for clinical judgement.

## Training

Track training modules and certificates (`app/training_list`,
`app/training_detail`, `app/training_certificate`). Attend the
assigned modules to keep your profile and incentives updated.

## Notifications

Alerts for due visits, high-risk beneficiaries, incentive approvals and system
messages. Notifications respect the app's language settings and are shown both
in-app and as push/local notifications.

## Offline mode and sync

The app is **offline-first**:

- All reads come from the local SQLite database (`src/db/`), which is the
  source of truth for the UI.
- Writes (new registrations, visit records, claims) are appended to a durable
  `sync_queue` table and uploaded when connectivity returns.
- `src/sync/` watches network state with NetInfo and drives sync
  automatically. Each queued write carries a `client_request_id` so a retry
  after a dropped connection cannot create duplicates.
- Pull uses an `updated_at` watermark, so edits made on the server (for
  example by a supervisor on the web dashboard) reach the device.
- Stale writes are detected with optimistic concurrency and surface as
  conflicts for review instead of silently overwriting.

Use the **Sync screen** to:

- See the pending queue and last-sync time.
- Force a sync now.
- Review sync conflicts and errors and retry.

### Best practices

- Sync at least once a day, preferably on the office Wi-Fi.
- Keep the app updated - model and dictionary updates are delivered with app
  updates.
- If a sync fails, fix the underlying connection before retrying; queued data
  is not lost.

## Settings and languages

- Language is selectable in-app.
- App theme and region defaults are managed centrally via the PHC admin
  dashboard.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| Cannot log in | Check credentials / internet; confirm your account is active and assigned to a sub-centre. |
| Data not loading | Pull to refresh / force sync from the Sync screen. |
| Sync failed | Check connectivity, retry; review the queue for conflicts. |
| Session expired | Tokens refresh automatically while online; log in again if the refresh token is also expired. |
| Wrong language | Change it in Settings. |
| Model flags a beneficiary high-risk | Follow the referral pathway shown on screen; contact your PHC admin if unsure. |

For PHC/block admins, the **web dashboard** (`apps/web-dashboard`) manages
users, area assignment, forms review and approvals, and provides the aggregate
view for officials.
