# ASHA Sathi - Deployment Guide

How ASHA Sathi is built, packaged and shipped to each environment, including
rollback and backup procedures.

## Environments

| Environment | Branch | URL pattern | Purpose |
| ----------- | ------ | ----------- | ------- |
| `development` | `develop` (local) | `http://localhost` | Local docker compose, hot reload |
| `staging` | `develop` | `api.staging.asha-sathi.gov.in` | Pre-prod validation (Helm) |
| `production` | `main` / `v*` tags | `api.asha-sathi.gov.in`, `dashboard.asha-sathi.gov.in` | Live rollout (Helm) |

Helm overrides live in the chart as `values.dev.yaml`, `values.staging.yaml`,
`values.prod.yaml`. Environment-specific secrets are never committed - see
[Secrets](#secrets).

## Delivery targets

There are two supported ways to run the platform:

1. **Single VM / disaster-recovery fallback** - Docker Compose
   (`docker-compose.yml` + `docker-compose.prod.yml`).
2. **Production Kubernetes** - the Helm chart under
   `docker/kubernetes/charts/asha-sathi` (EKS / GKE / AKS / k3s).

## 1. Docker Compose (dev and single-node VM)

Prerequisites: Docker Engine + Compose v2, an `.env` file (see `.env.example`).

### Local development

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up -d --build
```

Services: `postgres`, `redis`, `backend` (reload on source changes),
`web-dashboard`, optional `ml-serving` (`--profile ml`), `adminer`, and the
optional Supabase stack (`--profile supabase`).

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f backend
```

### Production-style single node

```bash
cd docker
set -a; source ../.env; set +a   # export DATABASE_URL, JWT_SECRET, SUPABASE_*, IMAGE_TAG
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Production overrides (from `docker-compose.prod.yml`):

- `restart: always`, healthchecks and CPU/memory limits on every service
- backend runs with a **read-only root filesystem** (`tmpfs` for `/tmp`),
  dropped capabilities, `no-new-privileges`
- images are fully baked by CI - **no host source mounts**
- an `nginx` container terminates TLS (certificate chain under
  `docker/nginx/certs`, see the header comment for self-signed generation)
  and routes `/` -> web-dashboard, `/api/` -> backend, and Supabase gateway
  paths to the Kong gateway

> Note: the compose `nginx` service depends on `supabase-kong`; either enable
> the `supabase` profile or remove that dependency on a pure-FastAPI install.

## 2. Kubernetes via Helm

Prerequisites: `helm` 3.15+, `kubectl`, cluster admin access, an ingress
controller (nginx) and cert-manager.

```bash
helm dependency update docker/kubernetes/charts/asha-sathi

# Staging
helm upgrade --install asha-sathi docker/kubernetes/charts/asha-sathi \
  --namespace staging --create-namespace \
  -f docker/kubernetes/charts/asha-sathi/values.staging.yaml \
  --set global.imageTag=staging \
  --set-file 'secretOverride.DATABASE_URL=./secrets/staging/DATABASE_URL' \
  --wait --timeout 10m

# Production
helm upgrade --install asha-sathi docker/kubernetes/charts/asha-sathi \
  --namespace production --create-namespace \
  -f docker/kubernetes/charts/asha-sathi/values.prod.yaml \
  --set global.imageTag=latest \
  --set-file 'secretOverride.DATABASE_URL=./secrets/prod/DATABASE_URL' \
  --set-file 'secretOverride.JWT_SECRET=./secrets/prod/JWT_SECRET' \
  --set-file 'secretOverride.SUPABASE_SERVICE_KEY=./secrets/prod/SUPABASE_SERVICE_KEY' \
  --wait --timeout 15m
```

The chart provisions:

- `backend` deployment + service + HPA (CPU/memory autoscaling), rolling update
  strategy (`maxUnavailable: 1`, `maxSurge: 1`)
- `web` deployment + service + HPA (static dashboard behind nginx)
- `ml` deployment + service (disabled via `ml.enabled: false` if not needed)
- `configmap` + `secret` (secret values must be supplied via
  `secretOverride.*` at install time - never stored in Git)
- `ingress` (api + dashboard hosts, cert-manager `letsencrypt-prod` issuer)
- `network-policy` (default-deny + ingress from the ingress controller)
- optional `pvc` (used only when `postgresql.managePvc: true`)
- Bitnami `postgresql` / `redis` and Prometheus / Grafana subcharts
  (configurable via `postgresql.*`, `redis.*`, `monitoring.*`)

### Useful ops commands

```bash
kubectl -n production get pods -l app.kubernetes.io/component=backend
kubectl -n production get hpa
kubectl -n production rollout status deployment/asha-sathi-backend
helm history asha-sathi -n production
helm list -A
```

## Secrets

- `.env.example` documents every required variable; production secrets are
  read from the environment or mounted files - **never** committed.
- In Kubernetes, secrets are injected with `--set-file 'secretOverride.*=<file>'`
  (or SOPS / SealedSecrets / an external secrets operator for GitOps).
- Rotate `JWT_SECRET` and the Supabase service key immediately if a leak is
  suspected. `JWT_SECRET` must be long and random (openssl rand -hex 32).

## CI/CD

See `.github/workflows/`:

- **`ci.yml`** - lint, tests and build for backend / web / mobile; Docker
  images are pushed to GHCR (`ghcr.io/yourorg/asha-sathi-*`) on `main` and
  `develop`; Flutter APK/AAB artifacts are uploaded on tagged builds.
- **`cd.yml`** - deploys to **staging** from `develop` and to **production**
  from `main`/`v*` tags (manual `workflow_dispatch` also supported). Both jobs
  run `helm upgrade --install`, then a `/health` smoke test and a Slack
  notification. `concurrency` groups prevent overlapping deploys.
- **`codeql.yml`** - daily + push-triggered CodeQL static analysis.
- **`dependabot.yml`** - automated dependency PRs for pip / npm / pub / GH
  Actions, with weekly grouping.

Required repository secrets: `KUBE_CONFIG_STAGING`, `KUBE_CONFIG_PRODUCTION`,
`DATABASE_URL_FILE`, `JWT_SECRET_FILE`, `SUPABASE_SERVICE_KEY_FILE`,
`SLACK_WEBHOOK_URL`, and the GHCR token / `GITHUB_TOKEN` permissions for
image pushes.

## Rollback strategy

Deployments use `RollingUpdate`, so a bad release can be rolled back without
downtime:

```bash
# Helm - roll back to the previous revision
helm history asha-sathi -n production
helm rollback asha-sathi <revision> -n production --wait --timeout 10m
```

- **App code:** rollback = redeploy the previous image tag (or the previous
  Helm revision). Images are immutable and tagged with the git SHA / version.
- **DB schema:** migrations are forward-only and guarded by
  `scripts/db-migrate.sh` (Alembic). A release that requires a destructive
  migration must be handled manually with a pre-migration backup; never roll
  back schema beyond a backup point.
- **ML models:** point `global.imageTag` back to the previous `ml-serving`
  image; ONNX models are versioned and never overwritten in place.

## Backups

`scripts/backup.sh` takes a consistent PostgreSQL dump (plus optional S3/object
store upload):

```bash
./scripts/backup.sh ./backups --database-url "$DATABASE_URL"
```

- Daily logical dumps (`pg_dump --format=custom`) with retention (default 14
  days) and encryption-ready output.
- Add a nightly Kubernetes `CronJob` in production, or run the script from the
  ops host; restore with `pg_restore`.
- `redisdata` (Redis) is persistent via append-only file + volume; it holds
  only ephemeral/cache data and can be rebuilt on failure.
- Test restores periodically in a staging environment. Back up the Supabase
  managed database separately per your provider's tooling.

## Database migrations

Alembic-style migrations are executed through `scripts/db-migrate.sh`:

```bash
./scripts/db-migrate.sh upgrade head   # or "revision --autogenerate" while developing
```

In Kubernetes run migrations as a one-off job before the app rollout
(`kubectl -n production run migrate --rm -i --image=ghcr.io/yourorg/asha-sathi-backend:latest -- python -m alembic upgrade head`),
or extend the chart with an init/Job hook.

## Observability

- **Prometheus** scrapes `/metrics` on the backend (annotated in the Helm
  values and compose). Postgres, node and the ML serving service are exposed
  via exporters (`docker-compose.monitoring.yml`).
- **Grafana** ships a pre-provisioned dashboard
  (`docker/grafana/dashboards/asha-overview.json`): active ASHAs, API request
  rate, error rate, latency p95/p50, sync conflicts and ML calls.
- **Logs:** Loki + Promtail aggregate `docker` logs; **Tempo** receives traces
  for the backend. See `docker/loki/`, `docker/promtail/`, `docker/tempo/`.
- Alerting rules should extend the Prometheus config (`alerting.yml`) with
  p95 latency, error rate and Pod-restart thresholds.

## Rollout checklist (production)

1. Images built and pushed to GHCR by CI with a unique tag.
2. Secrets supplied to the cluster (never in Git).
3. `helm dependency update` run; chart `lint` + `template` clean.
4. Migrations executed (one-off job).
5. `helm upgrade --install` with `--wait`; smoke test `/health`.
6. Dashboards / alerts verified; Slack notification received.
7. Backup CronJob in place and a restore test documented.
