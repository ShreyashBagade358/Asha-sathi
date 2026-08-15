# ASHA Sathi - Project Structure

## Overview
A healthcare platform for Indian ASHA frontline workers using a monorepo with Turbo + Melos + pnpm.

```
asha-sathi/
├── apps/                    # Application projects
│   ├── backend/             # FastAPI + Python backend
│   │   ├── app/             # Core application code
│   │   │   ├── api/v1/      # One flat router module per domain
│   │   │   ├── core/        # Config, DB, security, supabase
│   │   │   ├── models/      # 21+ SQLAlchemy models
│   │   │   ├── schemas/     # Pydantic request/response schemas
│   │   │   ├── services/    # Business logic
│   │   │   ├── tasks/       # Celery async tasks
│   │   │   └── main.py      # App entry point
│   │   ├── requirements/    # base.txt, dev.txt, prod.txt
│   │   ├── alembic/         # DB migrations
│   │   ├── tests/           # Backend test suite
│   │   └── .env.example     # Environment variables template
│   ├── ml-training/         # ML pipeline (ONNX models)
│   │   ├── src/             # Models, features, serving, training
│   │   ├── artifacts/       # Trained model artifacts + config (gitignored)
│   │   ├── data/            # Raw + processed datasets
│   │   ├── notebooks/       # EDA + training notebooks
│   │   └── pyproject.toml   # ML common dependencies
│   ├── mobile-asha/         # Flutter app for ASHA workers
│   │   ├── lib/             # Main Dart code
│   │   ├── features/        # 17 feature modules
│   │   ├── pubspec.yaml     # Flutter dependencies
│   │   └── test/            # Flutter tests
│   ├── mobile-patient/      # Flutter app for beneficiaries
│   │   ├── lib/             # Main Dart code
│   │   ├── features/        # 7 feature modules
│   │   └── pubspec.yaml
│   └── mobile-phc-admin/    # Flutter app for PHC staff
│       ├── lib/             # Main Dart code
│       ├── features/        # 6 feature modules
│       └── pubspec.yaml
│   └── web-dashboard/       # React + Vite admin dashboard
│       └── src/pages/       # Role-based pages (auth, asha, phc, phc-admin,
│                            # district, state, super)
├── packages/                # Shared monorepo packages
│   ├── design-system/       # Shared UI components
│   │   ├── flutter/         # Flutter widgets (8 components)
│   │   ├── react/           # React components (scaffold)
│   │   └── tokens/          # Design tokens
│   ├── shared-types/        # Cross-language type definitions
│   │   ├── dart/            # Dart type definitions
│   │   ├── typescript/      # TypeScript type definitions
│   │   └── python/          # Python type definitions
│   ├── ml-common/           # ML utilities (feature_spec, risk_utils)
│   └── supabase-client/     # Thin Supabase clients per language
│       ├── dart/            # Flutter Supabase client
│       ├── typescript/      # React Supabase client
│       └── python/          # Python Supabase client
├── docker/                  # Docker infrastructure
│   ├── docker-compose.yml   # Local dev stack
│   ├── docker-compose.prod.yml  # Production overrides
│   ├── kubernetes/          # Helm charts
│   └── monitoring/          # Prometheus, Grafana, Loki, Tempo
├── docs/                    # Project documentation
│   ├── design/              # Project designs (drawio, synopsis PDFs)
│   ├── design-mocks/        # Archived Stitch AI mockup screens
│   ├── architecture/        # System design, ERD, sequence diagrams
│   ├── api/                 # OpenAPI spec, Postman collection
│   ├── abdm-integration/    # ABDM M1/M2/M3 guides
│   ├── deployment/          # Helm, Docker deploy guides
│   ├── ml-models/           # Model cards and metrics
│   └── database/            # ERD diagrams
├── scripts/                 # Automation scripts
│   ├── setup-dev.sh         # Full development environment setup
│   ├── seed-data.sh         # Seed demo data
│   ├── generate-types.sh    # OpenAPI → Dart/TS clients
│   ├── db-migrate.sh        # Run alembic migrations
│   └── deploy.sh            # Deployment script
├── postman/                 # Postman workspace (globals, collections, specs)
├── .github/                 # CI/CD workflows
│   ├── workflows/           # ci.yml, cd.yml, codeql.yml
│   └── dependabot.yml
├── melos.yaml               # Flutter workspace bootstrap config
├── package.json             # Root pnpm workspace config
├── pnpm-workspace.yaml      # pnpm workspace definition
└── turbo.json               # Turbo build pipeline config
```

## Key Application Details

### Backend API (apps/backend)
- **Framework**: FastAPI + SQLAlchemy 2 (async) + Pydantic 2
- **API**: 25+ routers under `/api/v1` (105+ endpoints)
- **Database**: PostgreSQL 16 + asyncpg
- **Cache**: Redis 7
- **Auth**: JWT + OAuth2 password flow
- **Offline sync**: Versioned batched sync endpoints
- **ABDM**: M1 (identity), M2 (consent), M3 (data exchange)
- **ML**: ONNX model serving via inference service
- **Tasks**: Celery for reminders, sync jobs, notifications

### Flutter Apps
| App | Target | Features |
|-----|--------|----------|
| `mobile-asha` | ASHA workers | 17 modules: maternal, child, NCD, incentives, household, sync, training, etc. Offline-first with drift/sqflite |
| `mobile-patient` | Beneficiaries | 7 modules: health_records, appointments, emergency, reminders, schemes, profile, grievance |
| `mobile-phc-admin` | PHC/ANN/MOIC | 6 modules: dashboard, facility_mgmt, staff_mgmt, beneficiary_review, alerts, reports |

### React Dashboard (apps/web-dashboard)
- **Framework**: React 18 + TypeScript + Vite + Tailwind CSS
- **State**: React Query + Zustand
- **Supabase**: Auth, Realtime, Storage
- **Design System**: via `asha-design-system` package
- **Pages**: role-based — auth, asha, phc-admin, phc, district, state, super
- **API**: `/api/v1` proxy to backend

### Shared Packages
- `design-system/flutter`: 8 reusable Flutter components (buttons, cards, text fields, etc.)
- `design-system/react`: Scaffold (types currently being populated)
- `ml-common`: Python ML utilities (feature_spec.py, risk_utils.py)
- `shared-types`: Cross-language type definitions (Dart/TS/Python - currently scaffolded)
- `supabase-client`: Thin Supabase clients per language (Dart/TS/Python - currently scaffolded)

## Quick Start for New Users

```bash
# 1. Install prerequisites
# - Node.js >= 20, pnpm >= 8
# - Python >= 3.11
# - Flutter >= 3.22 with toolchains
# - Docker >= 24 (or Homebrew PostgreSQL + Redis)

# 2. Install dependencies
pnpm install  # root + web-dashboard
cd apps/backend && pip install -r requirements/base.txt

# 3. Start infrastructure
brew services start postgresql@14  # or use Docker
brew services start redis

# 4. Setup environment
cp .env.example .env
# Edit .env with your local values

# 5. Create DB and run migrations
# psql -U postgres -c "CREATE USER asha WITH PASSWORD 'asha_dev_password';"
# psql -U postgres -c "CREATE DATABASE asha_sathi OWNER asha;"
cd apps/backend && alembic upgrade head

# 6. Seed demo data
python -m scripts.seed  # phone: 9876543210 / pass: asha@123

# 7. Start services
# Backend
cd apps/backend && uvicorn app.main:app --reload --port 8000

# Dashboard
cd apps/web-dashboard && pnpm dev  # http://localhost:5173

# Flutter (one at a time)
cd apps/mobile-asha && flutter run
```

## Available Scripts

### Root (via pnpm)
- `pnpm dev` - Start all dev servers
- `pnpm build` - Build all projects
- `pnpm lint` - Lint all projects
- `pnpm typecheck` - Typecheck all projects
- `pnpm test` - Run all tests
- `pnpm format` - Format all files

### Backend
- `cd apps/backend && pytest --cov=app` - Run tests with coverage
- `cd apps/backend && ruff check app && mypy app` - Lint + typecheck
- `cd apps/backend && alembic upgrade head` - Run migrations
- `cd apps/backend && python -m scripts.seed` - Seed data

### Flutter
- `melos run analyze` - Analyze all Flutter packages
- `melos run test` - Run tests for all Flutter packages
- `melos run format` - Format Dart files

### Docker
- `docker compose -f docker/docker-compose.yml up -d` - Start infra
- `docker compose --profile supabase up -d` - Add Supabase

## API Documentation
- **Swagger UI**: http://localhost:8000/docs
- **OpenAPI JSON**: http://localhost:8000/api/v1/openapi.json
- **25+ router modules**: auth, users, ashas, households, beneficiaries, pregnancies, children, ncd, diseases, deaths, ai, vaccination, notifications, referrals, reporting, dashboard, verification, consent, audit, config, sync, abdm
- **105+ API paths** across all modules

## Directory Navigation Tips

### Finding API Routers
`apps/backend/app/api/v1/` - All 42 router modules organized by domain:
- `auth/`, `users/`, `ashas/`, `households/`, `beneficiaries/`
- `pregnancies/`, `children/`, `eligible_couples/`, `ncd/`, `diseases/`
- `deaths/`, `ai/`, `vaccination/`, `notifications/`, `referrals/`
- `reporting/`, `dashboard/`, `verification/`, `consent/`, `audit/`
- `config/`, `sync/`, `abdm/`

### Finding Flutter Features
`apps/mobile-asha/lib/features/` - 17 feature directories:
- `abha/`, `ai_assistant/`, `beneficiary/`, `child/`, `dashboard/`
- `death_reports/`, `disease_control/`, `eligible_couple/`, `household/`
- `incentives/`, `ncd/`, `notifications/`, `settings/`, `sync/`, `training/`

### Finding Design System Components
`packages/design-system/flutter/lib/components/` - 8 Flutter widgets:
- `asha_button.dart`, `asha_card.dart`, `asha_section_header.dart`
- `asha_text_field.dart`, `bottom_nav_bar.dart`, `error_screens.dart`
- `status_chip.dart`, `top_app_bar.dart`

### Finding ML Models
`apps/ml-training/src/models/` - 5 model categories:
- `anemia/`, `child_growth/`, `maternal_risk/`, `ncd_risk/`, `voice/`
- `apps/ml-training/src/serving/inference.py` - ONNX inference service
- `apps/ml-training/src/training/pipeline.py` - Training pipeline

## Need Help?
- **CONTRIBUTING.md**: Branching model, commit conventions, PR process
- **docs/README.md**: Full documentation index
- **.env.example**: Environment variable templates
- **scripts/setup-dev.sh**: Automated setup script