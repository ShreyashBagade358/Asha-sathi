# ASHA Sathi

A healthcare platform that digitises the work of Indian **ASHA (Accredited Social Health Activist)** frontline workers. ASHA Sathi helps ASHAs register households, track pregnancies (ANC/PNC), immunise children, screen for NCDs, refer high-risk cases, manage village-level data, run a daily visit plan, and claim government incentives — with **offline-first sync** for low-connectivity rural areas and **ABDM (Ayushman Bharat Digital Mission)** integration for ABHA health records.

One repo, four runtimes:

| Runtime | Path | Purpose | Port |
| ------- | ---- | ------- | ---- |
| FastAPI backend | `apps/backend` | REST API, auth, sync, ABDM, task planning | `8000` |
| React dashboard | `apps/web-dashboard` | Browser app for ASHA / PHC admin / patient / district / state / super roles | `5173` (dev) |
| Expo mobile app | `apps/mobile-expo` | Native ASHA app, offline-first SQLite | Expo Go |
| ML pipeline | `apps/ml-training` | Maternal / child-growth / NCD risk models (ONNX) | — |

---

## Table of contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Repository layout (A–Z directory guide)](#repository-layout-az-directory-guide)
- [Working flow (end to end)](#working-flow-end-to-end)
- [Routing and redirections](#routing-and-redirections)
- [API surface](#api-surface)
- [Database](#database)
- [Quickstart](#quickstart)
- [Seeded accounts](#seeded-accounts)
- [Environment variables](#environment-variables)
- [Testing and quality gates](#testing-and-quality-gates)
- [Machine learning pipeline](#machine-learning-pipeline)
- [Documentation index](#documentation-index)
- [Contributing](#contributing)

## Overview

- **Offline-first ASHA app** — local SQLite is the source of truth for the UI; a sync engine pushes a durable queue and pulls server changes using an `updated_at` watermark.
- **Role-based web dashboard** — one React bundle, three role homes, guarded routes (see [Routing and redirections](#routing-and-redirections)).
- **Versioned REST API** — `/api/v1`, JWT auth, 27 domain routers, 126 paths / 180 operations, OpenAPI at `/docs`.
- **Daily visit planning** — the backend lazily and idempotently generates an ASHA's 5-a-day household plan, carries stale work forward, and marks a task complete when its survey is submitted.
- **46 PostgreSQL tables** managed by Alembic (11 revisions) with a seeded demo hierarchy (UP → Lucknow → blocks → PHCs → villages → ASHAs → households).
- **Census geography import** — 36 states/UTs, 666 districts, 5,997 blocks, 652,179 villages from the Census 2011 directory.

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Mobile | Expo (React Native), TypeScript, Expo Router, expo-sqlite, NativeWind |
| Dashboard | React 18, TypeScript, Vite, Tailwind CSS, React Router 6, React Query, Zustand |
| Design system | `asha-design-system` (`packages/design-system/react`) + design tokens |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic 2, Celery |
| Data | PostgreSQL 16 (asyncpg), Redis 7; optional Supabase client |
| ML | scikit-learn, XGBoost, ONNX Runtime, DVC |
| Quality | pytest, ruff, mypy, ESLint, Prettier, Jest, GitHub Actions (ci/cd/codeql) |

## Repository layout (A–Z directory guide)

```
asha-sathi/
├── apps/                       # Deployable applications
│   ├── backend/                # FastAPI REST API  → :8000
│   ├── data/                   # Shared raw datasets (e.g. india_villages.csv)
│   ├── ml-training/            # Model training, evaluation, ONNX export/serving
│   ├── mobile-expo/            # Expo app for ASHA workers (Expo Router)
│   └── web-dashboard/          # React + Vite browser dashboard → :5173
├── packages/                   # Shared libraries consumed by the apps
│   ├── design-system/          # react/ (shared components) + tokens/
│   ├── ml-common/              # ml_common/, preprocessing/, feature-engineering/, onnx-export/
├── docs/                       # All project documentation (see docs/README.md)
├── postman/                    # Postman workspace globals + resources
├── scripts/                    # Shell/python automation (setup, seed, migrate, deploy)
├── .github/                    # CI/CD workflows, Dependabot, CodeQL, CODEOWNERS
├── README.md                   # ← this file
├── PROJECT_STRUCTURE.md        # Condensed tree + navigation tips
├── CONTRIBUTING.md             # Branching, commits, PR rules
├── run.md                      # Day-to-day "how do I run this" cheatsheet
├── CODEOWNERS · LICENSE · .prettierrc.json · .editorconfig
├── package.json                # pnpm workspace scripts (dev/build/lint/typecheck/test)
├── pnpm-workspace.yaml         # workspace globs: packages/*, apps/web-dashboard, apps/backend, apps/ml-training
└── turbo.json                  # Turborepo task pipeline
```

### `apps/backend` — FastAPI service

```
apps/backend/
├── app/
│   ├── main.py                 # App factory: CORS, request-id middleware, router mount, lifespan
│   ├── seed.py                 # python -m app.seed — demo hierarchy + users (idempotent)
│   ├── api/v1/                 # 27 flat router modules, one per domain (see API surface)
│   ├── core/                   # config.py, database.py, security.py, supabase.py,
│   │                           # exceptions.py, logging.py
│   ├── models/                 # 21 modules → 46 tables (SQLAlchemy 2 mapped classes)
│   ├── schemas/                # Pydantic request/response models (10 modules)
│   ├── services/               # 11 business-logic services (task_plan, sync_service,
│   │                           # abdm, incentive_calc, notification, otp, images, audit, …)
│   ├── tasks/                  # celery_app.py, scheduler.py, notification_tasks.py
│   ├── ml/                     # inference client/service for ONNX models
│   └── utils/
├── alembic/ + alembic.ini      # migrations (11 versions)
├── scripts/import_geo.py       # python -m scripts.import_geo — Census 2011 villages
├── tests/                      # 14 test modules (+ conftest), 173 tests
├── requirements/               # base.txt · dev.txt · prod.txt
├── data/                       # downloaded CSVs (gitignored)
├── Dockerfile · .env.example · pyproject.toml
```

### `apps/web-dashboard` — React dashboard

```
apps/web-dashboard/
├── index.html · vite.config.ts · tailwind.config.js · tsconfig*.json · nginx.conf
├── src/
│   ├── main.tsx                # bootstrap
│   ├── App.tsx                 # ← ALL routes, guards, redirects live here
│   ├── pages/                  # 83 screens in 7 role folders
│   │   ├── auth/               # 3  Login · Account recovery · Redirecting
│   │   ├── asha/               # 22 ASHA worker screens (home, tasks, visit survey, …)
│   │   ├── patient/            # 9  Patient mobile screens
│   │   ├── phc-admin/          # 40 PHC admin screens (dashboard → sanitize)
│   │   ├── district/           # 3  District dashboard / PHC comparison / resources
│   │   ├── state/              # 3  State dashboard / district comparison / policy
│   │   └── super/              # 3  Users / system config / deployment
│   ├── components/             # asha/ charts/ common/ layout/ patient/
│   ├── services/               # 24 typed API clients (auth, asha, household, …)
│   ├── hooks/                  # useAuth, usePermissions, useTodayTasks,
│   │                           # useLocalization, usePatientProfile
│   ├── stores/                 # Zustand: auth, app, asha, ui
│   ├── i18n/                   # localisation dictionaries
│   ├── lib/ · types/ · index.css
└── package.json                # dev / build / lint / typecheck / preview
```

### `apps/mobile-expo` — Expo (Expo Router) app

```
apps/mobile-expo/
├── app/                        # file-based routes (see mobile route table)
│   ├── _layout.tsx · index.tsx · login.tsx
│   └── (app)/                  # authed area: (tabs)/ + stack screens
├── src/
│   ├── auth/                   # api.ts (login/refresh), session.ts, tokenStore.ts
│   ├── db/                     # database.ts (SQLite), tables.ts, clinical.ts, repositories
│   ├── sync/                   # engine.ts (push/pull), network.ts (netinfo gate)
│   ├── nav/                    # config.ts, TabBar.tsx, MoreSheet.tsx, useTabBadges.ts
│   ├── components/ · i18n/ · theme.ts · config.ts · cx.ts · types.ts
├── __tests__/ · jest.setup.js · mock-sqlite.js
└── app.json · metro.config.js · tailwind.config.js (NativeWind) · .env.example
```

### `apps/ml-training` — ML pipeline

```
apps/ml-training/
├── src/
│   ├── config.py · data/loaders.py · features/engineering.py
│   ├── models/                 # anemia/ · child_growth/ · maternal_risk/ · ncd_risk/ · voice/
│   ├── training/pipeline.py · evaluation/metrics.py
│   ├── export/onnx_exporter.py · serving/inference.py
├── notebooks/ · data/ · artifacts/ (gitignored) · tests/
├── dvc.yaml · pyproject.toml · requirements.txt · Dockerfile
```

### `packages/` — shared libraries

| Package | Contents |
| ------- | -------- |
| `design-system/react` | Shared React components (`Button`, `Card`, `DataTable`, `Sidebar`, `ASHAErrorScreen`, …) published as `asha-design-system` |
| `design-system/tokens` | `design-tokens.json` (colour, spacing, typography) |
| `ml-common` | `ml_common/`, `preprocessing/`, `feature-engineering/`, `onnx-export/` |

### `scripts/`

| Script | What it does |
| ------ | ------------ |
| `setup-dev.sh` | Checks Node/pnpm/Python/Docker, installs deps, provisions `.env` files, starts Postgres/Redis, runs `alembic upgrade head` |
| `seed-data.sh` | Seeds demo data (wraps `python -m app.seed`) |
| `db-migrate.sh` | Runs `alembic upgrade head` |
| `generate-types.sh` | OpenAPI → Dart + TypeScript clients |
| `deploy.sh` | Production compose build/push/up/status wrapper |
| `backup.sh` | Database backup |

### `docs/`

`architecture/` (system-design.md, data-flow.drawio) · `database/` (erd.drawio) · `api/` (openapi.md) · `abdm-integration/` (ABDM.md) · `ml-models/` (models.md) · `deployment/` (deployment.md) · `user-guides/` (asha-mobile.md) · `design/` · `design-mocks/` (Stitch UI archive) · `crud-test-plan.md` · `crud-ui-checklist.md`

### `.github/`

`workflows/ci.yml` (lint → test → build), `workflows/cd.yml` (staging on `develop`, production on `v*` / `main`), `workflows/codeql.yml`, `dependabot.yml`, `codeql/codeql-config.yml`.

## Working flow (end to end)

### Process topology

```
   ┌──────────────────────┐        ┌──────────────────────┐       ┌──────────────────────┐
   │  Terminal 1          │        │  Terminal 2          │       │  Terminal 3          │
   │  uvicorn app.main:app│        │  vite (web-dashboard)│       │  expo start (mobile) │
   │  :8000               │        │  :5173               │       │  Expo Go / emulator  │
   └──────────┬───────────┘        └──────────┬───────────┘       └──────────┬───────────┘
              │                              │                              │
              │                     /api/* proxy                            │ EXPO_PUBLIC_API_URL
              │                     (vite.config.ts)                        │ (LAN IP, must not be
              │                              │                              │  localhost on device)
              ▼                              ▼                              ▼
              └──────────────────────────────┼──────────────────────────────┘
                                             ▼
                            ┌────────────────────────────────┐
                            │  FastAPI  /api/v1               │
                            │  JWT auth → router → service    │
                            │  → SQLAlchemy async → Postgres  │
                            │  → Redis (cache/Celery)         │
                            └────────────────────────────────┘
```

### Request lifecycle (browser example)

1. User opens `http://localhost:5173/login`.
2. `App.tsx` renders the public route; `useAuth` hydrates the token from `localStorage`.
3. `auth.service.ts` POSTs `/api/v1/auth/login`; Vite proxies `/api/*` → `http://localhost:8000`.
4. `app/api/v1/auth.py` verifies the password, signs an access + refresh JWT pair, returns the user.
5. `ROLE_HOME[role]` decides the landing page; `<ProtectedRoute>` / `<RoleRoute>` guard every nested route.
6. Page-level services (e.g. `asha.service.ts`) call their endpoints with `Authorization: Bearer <jwt>`; 401 triggers refresh via `/auth/token/refresh`, then `/session-expired`.

### Authentication and redirection

```
/login  ──POST /auth/login──►  tokens + user
   │
   └──► /redirecting  ──►  ROLE_HOME:
            asha     → /asha/home
            admin    → /phc/dashboard
            patient  → /patient/dashboard

Guards (App.tsx):
  ProtectedRoute  — not authenticated  → /login        (keeps `from` in state)
  RoleRoute       — wrong role for page → ROLE_HOME[role]
  /               — index               → RoleHome → ROLE_HOME[role]
  /dashboard      —                     → RoleHome → ROLE_HOME[role]
  *               —                     → 404 error screen
  /session-expired                        session-expired screen → /login
```

Roles are `asha | admin | patient` (`app/models/user.py::Role`).

### Offline sync flow (mobile)

```
UI write ─► SQLite (source of truth) ─► sync queue (durable)
                                            │  netinfo online?
                                            ▼
                          POST /api/v1/sync/push  (batched, versioned, idempotent)
                                            │
   pull: POST /api/v1/sync/pull  ◄──────────┘   (updated_at watermark)
                                            │
                                            ▼
                                       conflicts → POST /sync/conflicts/resolve
```

Other sync endpoints: `POST /sync/devices/register`, `GET /sync/status`.

### Daily ASHA task plan flow

```
GET /api/v1/ashas/me/tasks?date=YYYY-MM-DD
   │
   ├─ stale pending tasks (older than date) ──► carried forward,
   │        metadata_json.carried_from = <original date>   (backlog never dropped)
   ├─ no tasks for the date ──► generate up to DAILY_TASK_QUOTA (5) household visits
   │        candidates = ASHA's households without a survey today
   │        (already-surveyed households are excluded → never re-planned)
   └─ already generated ──► return existing rows unchanged (idempotent)

POST /api/v1/households/{id}/survey
   └─► marks the linked pending task completed (completed_time set)
         completed tasks still count toward the quota → no refill
```

Response rows are enriched with `household_hhid` and `village_name`, so the UI can render
labels and only offer **Start visit** when the household resolves.

## Routing and redirections

All browser routes are declared in [`apps/web-dashboard/src/App.tsx`](apps/web-dashboard/src/App.tsx).

### Public routes

| Path | Screen | Notes |
| ---- | ------ | ----- |
| `/login` | `LoginAshaSathi` | POST `/auth/login` → `/redirecting` |
| `/account-recovery` | `AccountRecoveryAshaSathi` | OTP recovery flow |
| `/redirecting` | `RedirectingAshaSathi` | Chooses `ROLE_HOME[role]` |
| `/session-expired` | Session-expired screen | → `/login` |
| `*` | 404 screen | → `/dashboard` on primary action |

### Role landings

| Role | Landing route | Layout |
| ---- | ------------- | ------ |
| `asha` | `/asha/home` | `AdminLayout` (sidebar + mobile bottom nav) |
| `admin` | `/phc/dashboard` | `AdminLayout` |
| `patient` | `/patient/dashboard` | `AdminLayout` |

### ASHA worker routes — `/asha/*`

| Path | Screen |
| ---- | ------ |
| `/asha` | → `/asha/home` |
| `/asha/home` | `AshaWorkerHomeAshaSathi` |
| `/asha/tasks` | `TasksAshaSathi` (daily plan + Start visit) |
| `/asha/health-survey` | `HealthSurveyAshaSathi` |
| `/asha/households` | `AssignedHouseholdsAshaSathi` |
| `/asha/households/:id/visit` | `HouseholdVisitSurveyAshaSathi` |
| `/asha/patients` | `PatientDashboardAshaSathi` |
| `/asha/patients/new` | `AddNewPatientAshaSathi` |
| `/asha/patients/:id` | `PatientDetailsAshaSathi` |
| `/asha/patients/:id/profile` | `MyHealthProfileAshaSathi` |
| `/asha/patients/:id/immunization` | `ImmunizationScheduleAshaSathi` |
| `/asha/pregnancy` | `PregnancyTrackingAshaSathi` |
| `/asha/child-health` | `ChildHealthAshaSathi` |
| `/asha/health-checkup` | `HealthCheckUpAshaSathi` |
| `/asha/referrals` | `ReferralAshaSathi` |
| `/asha/follow-ups` | `FollowUpAshaSathi` |
| `/asha/notifications` | `NotificationsAshaSathi` |
| `/asha/sync` | `OfflineSyncCenterAshaSathi` |
| `/asha/checkup-completed` | `CheckUpCompletedAshaSathi` |
| `/asha/profile` | `ProfileSettingsAshaSathi` |
| `/asha/connection-error` | `ConnectionErrorAshaSathi` (outside the layout) |

### Patient routes — `/patient/*`

`/patient` → `/patient/dashboard`; then `dashboard`, `health-profile`, `records`, `vaccination`, `appointments`, `referrals`, `notifications`, `profile`.

### PHC admin routes — `/phc/*`

| Group | Paths |
| ----- | ----- |
| Dashboard & people | `dashboard`, `ashas`, `ashas/new`, `ashas/:id`, `beneficiaries`, `beneficiaries/new`, `beneficiaries/:id` |
| Households | `households`, `households/new`, `households/:id`, `households/:id/survey`, `villages/new` |
| Maternal | `maternal`, `maternal/pregnant`, `maternal/:id`, `births/new` |
| Children | `children`, `children/:id`, `children/:id/vaccination`, `growth-nutrition` |
| Vaccination & checkups | `vaccination`, `vaccination/new`, `health-checkups/new`, `health-checkups/history` |
| Referrals & follow-ups | `referrals`, `referrals/new`, `referrals/:id`, `follow-ups` |
| Alerts | `alerts`, `alerts/critical` |
| Reports & analytics | `reports`, `reports/maternal`, `reports/child-vaccination`, `reports/asha-performance`, `analytics`, `risk-analysis` |
| System | `notifications`, `settings`, `audit-logs`, `sanitize` |

### District / State / Super routes

| Prefix | Paths |
| ------ | ----- |
| `/district/*` | `dashboard`, `phc-comparison`, `resources` |
| `/state/*` | `dashboard`, `district-comparison`, `policy-config`, `audit-logs` |
| `/super/*` | `users`, `system-config`, `deployment` |

> District/State/Super screens are currently gated behind `ADMIN_ROLES` (`admin`).

### Mobile Expo routes (`apps/mobile-expo/app/`)

| Route | Screen |
| ----- | ------ |
| `/` | `index.tsx` (splash / session bootstrap) |
| `/login` · `/verify-otp` · `/account-recovery` · `/redirecting` | auth flow |
| `(app)/(tabs)/` | `index` Home · `tasks` · `households` · `patients` · `sync` |
| `(app)/health-survey` · `health-checkup` · `child-health` · `pregnancy` | clinical flows |
| `(app)/follow-ups` · `referrals` · `notifications` · `register` · `profile` | supporting screens |
| `(app)/patient/[id]` | patient detail |
| `(app)/patient/[id]/profile` · `[id]/immunization` | health profile, immunization schedule |
| `(app)/household/[id]` · `[id]/visit` | household detail, visit flow |
| `(app)/checkup-completed` | health check-up success state |
| `(app)/connection-error` | offline/error state |

## API surface

Base URL: `http://localhost:8000/api/v1` · Swagger UI: `http://localhost:8000/docs` · Schema: `http://localhost:8000/api/v1/openapi.json`

**27 routers · 126 paths · 180 operations** — mounted in `apps/backend/app/api/v1/router.py`:

| Prefix | Module | Prefix | Module |
| ------ | ------ | ------ | ------ |
| `/auth` | `auth.py` | `/notifications` | `notifications.py` |
| `/users` | `users.py` | `/referrals` | `referrals.py` |
| `/ashas` | `ashas.py` | `/reports` | `reporting.py` |
| `/households` | `households.py` | `/dashboard` | `dashboard.py` |
| `/beneficiaries` | `beneficiaries.py` | `/verification` | `verification.py` |
| `/patients` | `patients.py` | `/consent` | `consent.py` |
| `/pregnancies` | `pregnancies.py` | `/audit` | `audit.py` |
| `/children` | `children.py` | `/config` | `config.py` |
| `/eligible-couples` | `eligible_couples.py` | `/system` | `system.py` |
| `/ncd` | `ncd.py` | `/resources` | `resources.py` |
| `/diseases` | `diseases.py` | `/sync` | `sync.py` |
| `/deaths` | `deaths.py` | `/abdm` | `abdm.py` |
| `/ai` | `ai.py` | `/sanitize` | `sanitize.py` |
| `/vaccination` | `vaccination.py` | | |

Key endpoints:

| Method + path | Purpose |
| ------------- | ------- |
| `POST /auth/login` · `/auth/token/refresh` · `/auth/otp/send` · `/auth/otp/verify` · `/auth/biometric/register` · `/auth/biometric/verify` · `GET/PUT /auth/me` · `POST /auth/logout` | Authentication |
| `GET /ashas/me/tasks?date=` | Today's plan (lazy generate + carry-over) |
| `POST /households/{id}/survey` | Submit household survey, completes linked task |
| `POST /sync/pull` · `POST /sync/push` · `POST /sync/devices/register` · `POST /sync/conflicts/resolve` · `GET /sync/status` | Offline sync |
| `GET /health` (root) · `GET /system/status` | Health probes (CI smoke test hits `/health`) |

## Database

- **PostgreSQL 16** via `postgresql+asyncpg://…`, async SQLAlchemy 2 sessions (`app/core/database.py` → `async_session_maker`).
- **Migrations:** `alembic upgrade head` — 11 revisions in `apps/backend/alembic/versions/`.
- **46 tables** across 21 model modules, including:

| Domain | Tables |
| ------ | ------ |
| Hierarchy | `states`, `districts`, `blocks`, `phcs`, `sub_centers`, `villages`, `village_forms` |
| People | `users`, `asha_profiles`, `asha_kpis`, `beneficiaries`, `households`, `household_surveys`, `eligible_couples`, `children` |
| Maternal | `pregnancies`, `anc_visits`, `pnc_visits`, `delivery_outcomes`, `hbnc_visits`, `hbyc_visits`, `micro_birth_plans` |
| Clinical | `ncd_screenings`, `disease_cases`, `malaria_cases`, `tb_cases`, `death_reports`, `growth_records`, `immunizations`, `health_records` |
| Referrals & alerts | `referrals`, `referral_followups`, `notifications`, `reminder_schedules`, `ai_predictions` |
| Tasks & sync | `asha_tasks`, `sync_devices`, `sync_logs`, `sync_operations` |
| Program & governance | `incentive_claims`, `resource_allocations`, `consent_artifacts`, `abha_records`, `audit_logs`, `app_configs` |

## Quickstart

### Prerequisites

- Node.js **>= 20**, pnpm **>= 8** (`npm i -g pnpm@8.15.0`)
- Python **>= 3.11**
- PostgreSQL 16 and Redis 7 running locally (Homebrew services or Docker)
- Expo Go on a device (for the mobile app)

### 1. Install

```bash
pnpm install                                   # workspace packages + web-dashboard
cd apps/backend && python -m venv .venv && \
  .venv/bin/pip install -r requirements/dev.txt
cd apps/mobile-expo && npm install             # separate package manifest
```

### 2. Configure and migrate

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cd apps/backend && .venv/bin/python -m alembic upgrade head
```

### 3. Seed demo data

```bash
cd apps/backend && .venv/bin/python -m app.seed        # idempotent, safe to re-run
# optional full geography (Census 2011: 652k villages)
cd apps/backend && .venv/bin/python -m scripts.import_geo
```

### 4. Run — three terminals (see [run.md](run.md))

```sh
# Terminal 1 — API on :8000
cd apps/backend
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — dashboard on :5173 (proxies /api/* → :8000, no CORS needed)
cd apps/web-dashboard && npm run dev

# Terminal 3 — Expo app
cd apps/mobile-expo && npx expo start
```

Open **http://localhost:5173** for the dashboard, **http://localhost:8000/docs** for Swagger.
`apps/mobile-expo/.env` sets `EXPO_PUBLIC_API_URL` to your machine's **LAN IP** — `localhost`
resolves to the phone itself and will not work.

### Helper scripts

```bash
./scripts/setup-dev.sh        # prerequisites + deps + .env + migrations
./scripts/seed-data.sh        # demo data
./scripts/db-migrate.sh       # alembic upgrade head
./scripts/generate-types.sh   # OpenAPI → Dart/TS clients
```

> **Known gaps:** `scripts/setup-dev.sh` and the root `pnpm docker:*` scripts still
> point at `docker/docker-compose.yml`, which is **not present in this repo** — run
> Postgres/Redis as local services instead. Per-app `Dockerfile`s exist under
> `apps/backend`, `apps/web-dashboard` and `apps/ml-training` if you want images.

## Seeded accounts

| Phone | Password | Role | Lands on |
| ----- | -------- | ---- | -------- |
| `8010159779` | `Shreyash@123` | admin — Shreyash Bagade | `/phc/dashboard` |
| `9156664235` | `Ritesh@123` | admin — Ritesh Patil | `/phc/dashboard` |
| `8010867650` | `Samruddhi@123` | asha — Samruddhi Gore | `/asha/home` |
| `9876543210` | `asha@123` | asha — demo ASHA worker | `/asha/home` |
| `9604522015` | `Namrata@123` | patient — Namrata Belwekar | `/patient/dashboard` |

Demo hierarchy: Uttar Pradesh → Lucknow → Sarojini Nagar → PHC Sarojini Nagar → village Khasra.
Dev credentials only — rotate before any real deployment.

## Environment variables

| Variable | Description | Dev default |
| -------- | ----------- | ----------- |
| `DATABASE_URL` | Async SQLAlchemy DSN | `postgresql+asyncpg://ashadev:asha_dev_password@localhost:5432/asha_sathi` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `JWT_SECRET_KEY` / `JWT_SECRET` | JWT signing secret (**change in prod**) | `change-me-in-production` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` / `OTP_EXPIRE_MINUTES` | Token lifetimes | `30` / `7` / `5` |
| `API_V1_PREFIX` | API prefix | `/api/v1` |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000,http://localhost:5173` |
| `VITE_API_URL` | Dashboard API base | `http://localhost:8000/api/v1` |
| `EXPO_PUBLIC_API_URL` | Mobile API base (LAN IP) | `http://<lan-ip>:8000/api/v1` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` | Optional Supabase | empty / placeholders |
| `ABDM_CLIENT_ID` / `ABDM_CLIENT_SECRET` | ABDM gateway credentials | empty |

> `.env*` are git-ignored; `.env.example` files are committed with placeholders. Never commit secrets.

## Testing and quality gates

```bash
# Backend — 14 modules / 173 tests (aiosqlite + fakeredis in CI)
cd apps/backend && .venv/bin/python -m pytest -q
cd apps/backend && .venv/bin/python -m ruff check app tests
# mypy: cd apps/backend && .venv/bin/python -m mypy app
#   (currently trips on third-party numpy stubs — pin numpy<2.3 or add a
#    mypy exclusion for site-packages before relying on it)

# Dashboard
cd apps/web-dashboard && npm run lint && npm run typecheck && npm run build

# Mobile
cd apps/mobile-expo && npm run typecheck && npm run test

# ML
cd apps/ml-training && pytest

# Everything through the workspace
pnpm lint && pnpm typecheck && pnpm test && pnpm format
```

CI (`.github/workflows/ci.yml`) runs lint → tests → build; `cd.yml` deploys staging from
`develop` and production from `v*` tags / `main`, then smoke-tests `/system/health`.

## Machine learning pipeline

| Model | Target | Where |
| ----- | ------ | ----- |
| Maternal risk | high-risk pregnancy classification + score | `src/models/maternal_risk/` |
| Child growth | underweight / stunting / wasting (z-score bands) | `src/models/child_growth/` |
| NCD risk | diabetes / hypertension risk from CBAC screen | `src/models/ncd_risk/` |
| Anaemia | haemoglobin risk banding | `src/models/anemia/` |
| Voice | ASHA voice-assist experiments | `src/models/voice/` |

Training → `src/training/pipeline.py` → `src/export/onnx_exporter.py` → served by
`src/serving/inference.py` and consumed by `apps/backend/app/ml/`. Experiments tracked with DVC (`dvc.yaml`).
Model cards: [docs/ml-models/models.md](docs/ml-models/models.md).

## Documentation index

Full index: [docs/README.md](docs/README.md)

| Doc | Contents |
| --- | -------- |
| [docs/architecture/system-design.md](docs/architecture/system-design.md) | Layered design, 14 modules, data flows, sequence diagrams |
| [docs/database/erd.drawio](docs/database/erd.drawio) | ERD of core tables |
| [docs/api/openapi.md](docs/api/openapi.md) | Endpoint reference + examples |
| [docs/abdm-integration/ABDM.md](docs/abdm-integration/ABDM.md) | ABDM M1/M2/M3 integration |
| [docs/ml-models/models.md](docs/ml-models/models.md) | Model cards |
| [docs/deployment/deployment.md](docs/deployment/deployment.md) | Environments, deploy, rollback, backups |
| [docs/user-guides/asha-mobile.md](docs/user-guides/asha-mobile.md) | ASHA mobile user guide |
| [docs/crud-test-plan.md](docs/crud-test-plan.md) · [docs/crud-ui-checklist.md](docs/crud-ui-checklist.md) | CRUD QA plan + UI checklist |
| [run.md](run.md) | Day-to-day run cheatsheet |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Condensed tree + navigation tips |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR:

- Branch from `develop`: `feature/<short-name>` or `fix/<short-name>`.
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
- All PRs need lint + tests green before merge; `CODEOWNERS` routes review.

---

Licensed under the [MIT License](LICENSE). © 2026 ASHA Sathi Contributors.
