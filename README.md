# ASHA Sathi

A healthcare platform that digitises the work of Indian **ASHA (Accredited Social Health Activist)** frontline workers. ASHA Sathi helps ASHAs register households, track pregnancies (ANC/PNC), immunize children, screen for NCDs, refer high-risk cases, manage village-level data, and claim government incentives — with full **offline-first sync** for low-connectivity rural areas and **ABDM (Ayushman Bharat Digital Mission)** integration for ABHA health records.

---

## Table of contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Monorepo structure](#monorepo-structure)
- [Quickstart](#quickstart)
- [Environment variables](#environment-variables)
- [Module documentation](#module-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [ABDM integration](#abdm-integration)
- [ML pipeline](#ml-pipeline)
- [Contributing](#contributing)

## Overview

ASHA Sathi is built as a **turborepo + melos monorepo** with:

- **Three Flutter mobile apps** — `mobile-asha` (for ASHA workers), `mobile-patient` (beneficiary self-service), `mobile-phc-admin` (PHC staff / ANM / MOIC).
- **A React dashboard** (`web-dashboard`) for block/district/state-level supervisors and program managers.
- **A FastAPI backend** exposing a versioned REST API (`/api/v1`) with offline-sync endpoints, ABDM integration and role-based access.
- **An ML pipeline** (`ml-training`) for maternal-risk, child-growth and NCD-risk models served via a lightweight inference service.
- **PostgreSQL 16 + Redis** for primary data and caching/queues; optional **Supabase** (PostgREST/Realtime/Auth/Storage) for realtime features.
- **Kubernetes (Helm)** and **Docker Compose** deployment paths with full CI/CD and observability.

## Architecture

```
                        +-------------------------------+
                        |         Mobile apps            |
                        |  ASHA / Patient / PHC Admin    |
                        |   (Flutter, offline-first)     |
                        +---------------+---------------+
                                        | HTTPS + sync (batched, versioned)
                                        v
  +-------------------+     +-----------+-----------+     +-------------------+
  |   React dashboard |     |   FastAPI backend     |     |   ML serving      |
  |  (supervisors,    |---->|   /api/v1             |<--->|  (onnxruntime)    |
  |   PHC/block)      |     |  auth . sync . ABDM   |     |  risk scoring     |
  +-------------------+     +-----------+-----------+     +-------------------+
                                        |                    |
                   +--------------------+--------------------+-----------+
                   |                    |                              |
                   v                    v                              v
            +------------+        +--------+                  +----------------+
            | PostgreSQL |        | Redis  |                  |  Supabase      |
            | 16 (async) |        | 7      |                  |  (optional)    |
            +------------+        +--------+                  | realtime/auth  |
                                                                +----------------+
                                        |
                                        v
                   +--------------------+--------------------+
                   |  External integrations                |
                   |  ABDM (ABHA, consent, HIR)            |
                   |  SMS (Twilio) . Push (FCM)            |
                   |  RCH / Ni-kshay / VHND exports        |
                   +---------------------------------------+
```

**Observability:** Prometheus (metrics) + Grafana (dashboards) + Loki (logs) + Tempo (traces) run alongside the stack; the backend exposes `/metrics` via `prometheus-fastapi-instrumentator`.

## Tech stack

| Layer         | Technology                                                      |
| ------------- | --------------------------------------------------------------- |
| Mobile        | Flutter 3.22+, Dart, melos workspaces, freezed / json_serializable |
| Dashboard     | React 18, TypeScript, Vite, pnpm                                |
| Backend       | Python 3.11+, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic 2 |
| Data          | PostgreSQL 16, Redis 7, Supabase (optional)                     |
| ML            | scikit-learn, XGBoost, onnxruntime, MLflow (registry)           |
| Infra         | Docker Compose, Helm, nginx, GitHub Actions, GHCR               |
| Observability | Prometheus, Grafana, Loki, Tempo, promtail, postgres-exporter   |
| Integrations  | ABDM gateway, Twilio SMS, FCM push                              |

## Monorepo structure

```
asha-sathi/
├── apps/
│   ├── backend/                # FastAPI service (REST API + sync + ABDM)
│   │   ├── alembic/            # database migrations
│   │   ├── app/
│   │   │   ├── api/v1/         # versioned routers (one flat module per domain)
│   │   │   ├── core/           # config, db, security, supabase
│   │   │   ├── models/         # SQLAlchemy models (24+ tables)
│   │   │   ├── schemas/        # Pydantic request/response schemas
│   │   │   ├── services/       # business logic
│   │   │   └── tasks/          # Celery tasks (reminders, sync jobs)
│   │   └── requirements/       # base / dev / prod dependency sets
│   ├── ml-training/            # model training + serving (onnxruntime)
│   │   ├── artifacts/          # trained model artifacts + config (gitignored)
│   │   ├── data/               # raw + processed datasets
│   │   ├── notebooks/          # EDA + training notebooks
│   │   └── src/                # data, features, models, serving, export
│   ├── mobile-asha/            # Flutter app for ASHA workers
│   ├── mobile-patient/         # Flutter app for beneficiaries
│   ├── mobile-phc-admin/       # Flutter app for PHC / ANM / MOIC
│   └── web-dashboard/          # React + Vite admin dashboard
│       └── src/pages/          # role-based pages (auth, asha, phc, phc-admin, ...)
├── packages/
│   ├── design-system/          # shared Flutter + web design system
│   ├── shared-types/           # shared types (Dart / TS / Python)
│   ├── supabase-client/        # thin Supabase clients per language
│   └── ml-common/              # shared ML utilities
├── docker/
│   ├── docker-compose.yml      # local dev stack
│   ├── docker-compose.prod.yml # production overrides (+ nginx ingress)
│   ├── docker-compose.monitoring.yml
│   ├── grafana/ prometheus/ loki/ promtail/ tempo/ nginx/ supabase/
│   └── kubernetes/charts/asha-sathi/   # Helm chart
├── .github/
│   ├── workflows/              # ci.yml, cd.yml, codeql.yml
│   └── dependabot.yml
├── scripts/                    # setup, seed, migrate, backup, deploy
├── docs/
│   ├── design/                 # project designs (drawio, synopsis PDFs)
│   ├── design-mocks/           # archived Stitch AI mockup screens
│   └── architecture/ api/ abdm-integration/ database/ deployment/ ml-models/
├── postman/                    # Postman workspace (globals, collections, specs)
├── melos.yaml                  # Flutter workspace bootstrap
├── pnpm-workspace.yaml
└── turbo.json
```

## Quickstart

### Prerequisites

- Node.js **>= 20**, pnpm **>= 8** (`npm i -g pnpm@8`)
- Python **>= 3.11**, PostgreSQL client tools
- Flutter **>= 3.22** with Android/iOS toolchains
- Docker **>= 24** (Docker Desktop recommended)

### 1. Automatic setup

```bash
./scripts/setup-dev.sh
```

This checks prerequisites, installs pnpm/melos/Python deps, creates `.env` files
from `.env.example`, starts Postgres + Redis and runs `alembic upgrade head`.

### 2. Seed demo data

```bash
./scripts/seed-data.sh          # uses python -m app.seed
# login phone 9876543210 / password asha@123 (dev only)
```

The seed populates the full UP health hierarchy, demo users, households,
beneficiaries, a child **with immunizations and 6 monthly growth records**,
pregnancies, an NCD screening, KPIs, claims, tasks and notifications. It is
idempotent for naturally-keyed records, so re-running it is safe.

### 3. Run the stack

```bash
docker compose -f docker/docker-compose.yml up -d          # infra
docker compose --profile supabase up -d                    # optional Supabase
cd apps/backend && uvicorn app.main:app --reload           # API on :8000
cd apps/web-dashboard && pnpm dev                          # dashboard on :3000
cd apps/mobile-asha && flutter run                         # ASHA app
```

Adminer DB console: http://localhost:8081 · Prometheus: http://localhost:9090 · Grafana: http://localhost:3001

### 4. Generate typed clients

```bash
./scripts/generate-types.sh    # OpenAPI -> Dart + TypeScript clients
```

## Environment variables

| Variable                 | Description                              | Default (dev)                                          |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`           | Async SQLAlchemy DSN                     | `postgresql+asyncpg://asha:asha_dev@localhost:5432/asha_sathi` |
| `REDIS_URL`              | Redis connection                         | `redis://localhost:6379/0`                             |
| `JWT_SECRET`             | JWT signing secret (CHANGE ME in prod)   | `change-me-in-production`                              |
| `SUPABASE_URL`           | Optional Supabase instance URL           | `http://localhost:18000`                               |
| `SUPABASE_ANON_KEY`      | Supabase anon key (placeholder)          | `CHANGE_ME_SUPABASE_ANON_KEY`                          |
| `SUPABASE_SERVICE_KEY`   | Supabase service-role key (placeholder)  | `CHANGE_ME_SUPABASE_SERVICE_KEY`                       |
| `VITE_API_URL`           | Dashboard API base URL                   | `http://localhost:8000/api/v1`                         |
| `API_V1_PREFIX`          | API prefix                               | `/api/v1`                                              |
| `CORS_ORIGINS`           | Allowed origins (comma separated)        | `http://localhost:3000,http://localhost:5173`          |
| `ABDM_CLIENT_ID/SECRET`  | ABDM gateway credentials                 | (empty)                                                |

> Never commit real secrets. `.env*` are git-ignored; `.env.example` is committed with placeholders.

## Module documentation

See [docs/README.md](docs/README.md) for the full index:

| Doc                                              | Contents                                    |
| ------------------------------------------------ | ------------------------------------------- |
| [docs/architecture/system-design.md](docs/architecture/system-design.md) | Layered design, 14 app modules, data flows, sequence diagrams |
| [docs/database/erd.drawio](docs/database/erd.drawio) | ERD of all core tables (draw.io)            |
| [docs/api/openapi.md](docs/api/openapi.md)       | API reference + example request/response    |
| [docs/postman/](docs/postman/)                   | Postman collection + environment            |
| [docs/abdm-integration/ABDM.md](docs/abdm-integration/ABDM.md) | ABDM M1/M2/M3 integration guide            |
| [docs/ml-models/models.md](docs/ml-models/models.md) | ML model cards                            |
| [docs/deployment/deployment.md](docs/deployment/deployment.md) | Environments, deploy, rollback, backups |

## Testing

```bash
# Backend (uses aiosqlite/fakeredis in CI)
cd apps/backend && pytest --cov=app

# Lint + types
cd apps/backend && ruff check app && mypy app

# ML pipeline
cd apps/ml-training && pytest

# JS/TS
pnpm lint && pnpm typecheck

# Flutter (all three apps)
melos run analyze && melos run test

# Formatting
pnpm format                      # prettier (json/md/yaml/ts/py/dart)
melos run format                 # dart format
```

CI runs all of the above in `.github/workflows/ci.yml` (lint → test → build/push).

## Deployment

Two supported paths — see [docs/deployment/deployment.md](docs/deployment/deployment.md):

1. **Kubernetes (recommended):** Helm chart at `docker/kubernetes/charts/asha-sathi`.

   ```bash
   helm dependency update docker/kubernetes/charts/asha-sathi
   helm upgrade --install asha-sathi docker/kubernetes/charts/asha-sathi \
     -f docker/kubernetes/charts/asha-sathi/values.staging.yaml \
     --set-file 'secretOverride.DATABASE_URL=./secrets/staging/DATABASE_URL' \
     --namespace staging --create-namespace --wait
   ```

2. **Docker Compose (single VM):**

   ```bash
   ./scripts/deploy.sh deploy
   ```

CI/CD: pushes to `develop` deploy staging; tags `v*` / merges to `main` deploy production
(`.github/workflows/cd.yml`), followed by a `/health` smoke test and Slack notification.

## ABDM integration

ASHA Sathi implements the **Ayushman Bharat Digital Mission** M1 (identity), M2 (consent)
and M3 (data exchange) flows:

- **M1 — ABHA number:** create/link ABHA via the gateway, Aadhaar + mobile OTP KYC.
- **M2 — consent:** request consent artefacts from the beneficiary (purpose, HI types,
  date range) and notify the consent manager.
- **M3 — health records:** push ANC/immunization records as FHIR bundles (HIP role),
  and pull records into the dashboard (HIU role).

Read [docs/abdm-integration/ABDM.md](docs/abdm-integration/ABDM.md) for endpoints,
config, and sandbox testing instructions.

## ML pipeline

Three models are trained in `apps/ml-training` and served via a small FastAPI/ONNX
service (docker profile `ml`, Helm `ml.enabled`):

| Model             | Target                                        | Artifact                 |
| ----------------- | --------------------------------------------- | ------------------------ |
| **Maternal risk** | high-risk pregnancy classification + score    | ONNX + risk explainer    |
| **Child growth**  | underweight/stunting/wasting (z-score bands)  | ONNX classifier          |
| **NCD risk**      | diabetes/hypertension risk from CBAC screen   | ONNX classifier          |

Full model cards, features, metrics and quantization notes:
[docs/ml-models/models.md](docs/ml-models/models.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching model, commit conventions,
PR process and code style. TL;DR:

- Branch from `develop`: `feature/<short-name>` or `fix/<short-name>`.
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
- All PRs need lint + tests green before merge.

---

Licensed under the [MIT License](LICENSE). © 2026 ASHA Sathi Contributors.
