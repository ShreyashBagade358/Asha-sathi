# CRUD API Test Plan

Backend CRUD + permission verification for the ASHA Sathi API, implemented in
`apps/backend/tests/test_crud_api.py`.

## Goal

Prove, through the public HTTP API, that every core entity can be **created,
read, updated and deleted** by an authorized role, and that **unauthorized
roles are rejected** — i.e. the create/read/update/delete surface is complete
end-to-end, not just wired.

## Harness

| Concern | Decision |
| --- | --- |
| Test DB | In-memory SQLite (`sqlite+aiosqlite:///:memory:`) |
| App access | `httpx.AsyncClient` over `ASGITransport(app)` (no live server) |
| Isolation | `_clean_tables` autouse fixture truncates every table before each test |
| Auth | `auth_headers(phone, role)` factory mints a JWT via `create_access_token` |
| Seed/verify data | Created per test through the API; IDs are `uuid4()`-based |
| Run | `cd apps/backend && python -m pytest tests/test_crud_api.py` |

Test records are prefixed `TEST-` so they are trivially identifiable for cleanup
(Phase 4).

## Test cases

| # | Test | Covers |
| --- | --- | --- |
| 1 | `test_household_and_beneficiary_crud` | Household create/read/update/**hard delete**; beneficiary create/read (by `id` and `beneficiary_id`)/update/**soft delete** → `status=inactive`; household members list |
| 2 | `test_pregnancy_lifecycle_crud` | Pregnancy create/read/update/delete; ANC visit (increments `anc_count`, sets `last_anc_date`); PNC visit; birth plan create+update; delivery marks pregnancy `delivered` |
| 3 | `test_child_health_crud` | Child create/read/delete; immunization create + status update; growth record; HBNC; HBYC |
| 4 | `test_eligible_couple_crud` | EC create/read/update/delete; follow-up create + list |
| 5 | `test_referral_lifecycle` | Referral create; state machine `initiated → accepted → completed`; duplicate accept → **409**; follow-up create + list; outcome update; delete |
| 6 | `test_ncd_and_death_and_disease_crud` | NCD create/read/due/delete; death report create/read/update/delete; disease case create/read/update/delete |
| 7 | `test_asha_directory_crud_admin_only` | ASHA create/read/patch by `asha_id` code; ASHA role → 403 on directory |
| 8 | `test_user_management_crud_super_admin_only` | User create/read/update/soft-delete (`is_active=false`); ASHA & MOIC → 403 |
| 9 | `test_notifications_crud_and_broadcast_guard` | Notification create/read/mark-read; broadcast allowed for MOIC, **403 for ASHA**; reminder schedule create + list |
| 10 | `test_create_village_admin_chain` | Village create + list under a seeded State→District→Block→PHC→SubCenter chain |
| 11 | `test_verification_approve_reject` | Pending queue visible to MOIC, death report approved → `verified`; ASHA → 403 |
| 12 | `test_sanitize_and_audit_admin_gated` | Sanitize summary + fix for MOIC; audit logs list; ASHA → 403 on both |
| 13 | `test_dashboard_and_reports_readonly` | Dashboard `kpis/phc/state`; all six report kinds; vaccination coverage |
| 14 | `test_sync_device_register_and_status` | Device register, sync status, sync pull |
| 15 | `test_permission_boundary_sweep` | Negative matrix across users/ashas/audit/sanitize/verification/broadcast; `state_admin` allowed on users |
| 16 | `test_inactive_user_rejected` | Deactivated user → **401** |
| 17 | `test_child_requires_existing_beneficiary` | Child create with unknown beneficiary → **404** |

## Endpoint / role matrix

| Entity | Create | Read | Update | Delete | Authorized roles |
| --- | --- | --- | --- | --- | --- |
| Household | ✅ | ✅ | ✅ | hard | any authenticated |
| Beneficiary | ✅ | ✅ | ✅ | soft | any authenticated |
| Pregnancy + ANC/PNC/Delivery/Birth plan | ✅ | ✅ | ✅ | hard | any authenticated |
| Child + Immunization/Growth/HBNC/HBYC | ✅ | ✅ | ✅ | hard | any authenticated |
| Eligible couple + follow-up | ✅ | ✅ | ✅ | hard | any authenticated |
| Referral + follow-up | ✅ | ✅ | ✅ | hard | any authenticated |
| NCD screening | ✅ | ✅ | — | hard | any authenticated |
| Death report | ✅ | ✅ | ✅ | hard | any authenticated |
| Disease case | ✅ | ✅ | ✅ * | hard | any authenticated |
| Village config | ✅ | ✅ | — | — | any authenticated |
| ASHA directory | ✅ | ✅ | ✅ | — | ANM/MOIC/BPM/DPM/state/super admin |
| User management | ✅ | ✅ | ✅ | soft | super admin, state admin |
| Notification | ✅ | ✅ | mark-read | — | any authenticated |
| Broadcast | ✅ | — | — | — | MOIC/BPM/DPM/state/super admin |
| Verification | — | ✅ | approve/reject | — | ANM/MOIC/BPM/DPM/state/super admin |
| Sanitize / Audit | ✅ (fix) | ✅ | — | — | admin roles |
| Dashboard / Reports | — | ✅ | — | — | any authenticated |
| Sync device/status/pull | ✅ | ✅ | — | — | any authenticated |

\* `PUT /diseases/{id}` reuses the create schema, so `disease_type` is required in the update body.

## Contract quirks captured

- `GET /ncd/due` requires the `from_date` query parameter.
- `PUT /api/v1/diseases/{id}` requires `disease_type` (create schema reused).
- ASHA directory detail/update use the `asha_id` code (`ASH-…`), **not** the user UUID.
- `GET /verification/pending` and approve/reject are available to ANM, MOIC,
  BPM, DPM, state admin and super admin — not ASHA.
- Beneficiary delete is a soft delete (`status=inactive`) and the record remains
  readable; household delete is a hard delete (subsequent GET → 404).
- Dashboard `phc`/`state` require the caller to be linked to a PHC/state.
- Broadcast returns `200`; device registration returns `200`.

## Defects found and fixed

1. **Immunization create crashed** — `app/api/v1/children.py` passed `child_id`
   both inside `payload.model_dump()` and as a keyword argument, raising
   `TypeError: got multiple values for keyword argument 'child_id'`. Fixed with
   `payload.model_dump(exclude={"child_id"})`.

## Environment prerequisites (Phase 0)

Dev login bypass phones (fixed OTP `1234`, `APP_ENV=dev`), seeded in
`app/seed.py` and listed in `app/core/config.py` / `.env`:

| Phone | Role |
| --- | --- |
| 9876543210 | asha |
| 9876543211 | anm |
| 9876543212 | moic |
| 9876543213 | dpm |
| 9876543214 | state_admin |
| 9876543215 | super_admin |
| 9876543216 | patient |

## How to run

```bash
cd apps/backend
python -m pytest tests/test_crud_api.py -q     # this suite only
python -m pytest -q                            # full backend suite
```
