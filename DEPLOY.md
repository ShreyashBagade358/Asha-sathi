# Deploy ASHA Sathi — Free Tier (Vercel + Render + Neon)

Three services, zero cost. ~15 minutes.

```
┌─────────────┐  VITE_API_URL   ┌─────────────┐  DATABASE_URL  ┌─────────┐
│   Vercel    │ ──────────────▶ │   Render    │ ─────────────▶ │  Neon   │
│  (web app)  │   HTTPS calls   │ (FastAPI)   │   Postgres     │   DB    │
└─────────────┘                 └─────────────┘                └─────────┘
```

---

## Step 1 — Neon (database, 2 min)

1. Sign up at **https://neon.tech** (free, GitHub login OK).
2. Create a project — region: **Mumbai (ap-south-1)** or nearest.
3. Copy the connection string. It looks like:
   ```
   postgresql://user:password@ep-xxxxx.aws.neon.tech/neondb?sslmode=require
   ```
4. **Convert it for the backend** (the app needs the `+asyncpg` driver):
   ```
   postgresql+asyncpg://user:password@ep-xxxxx.aws.neon.tech/neondb?sslmode=require
   ```
   (Just insert `+asyncpg` after `postgresql`. The app strips `sslmode` automatically — fixed in `app/core/database.py`.)

> Keep this URL — you'll paste it into Render next.

## Step 2 — Render (backend API, 5 min)

1. Sign up at **https://render.com** (free plan OK), connect your GitHub.
2. **New → Web Service**, pick the `asha-sathi` repo.
3. Render auto-reads `render.yaml` from the repo root. Confirm:
   - **Root Directory**: leave empty
   - **Runtime**: Docker
   - **Plan**: Free
4. Set the environment variables Render didn't auto-generate:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon URL with `+asyncpg` (from Step 1) |
   | `JWT_SECRET_KEY` | *(auto-generated — leave it)* |
   | `APP_ENV` | `prod` |
   | `CORS_ORIGINS` | `["https://your-app.vercel.app"]` ← update after Step 3 |

5. Click **Create Web Service**. First deploy takes ~3 min (Docker build + `alembic upgrade head` runs automatically via `start.sh`).
6. Note your API URL: **`https://asha-sathi-api.onrender.com`**

### Seed demo data (optional, 1 min)

After the first deploy, on Render: **Shell** tab → run:

```bash
python -m app.seed
```

This creates the demo ASHA workers, patients, households and PHC hierarchy.

> Free-tier Render services **spin down after 15 min idle** — first request after idle takes ~30 s to wake up.

## Step 3 — Vercel (web dashboard, 3 min)

1. Sign up at **https://vercel.com** (free, GitHub login OK).
2. **Add New → Project**, import the `asha-sathi` repo.
3. Vercel reads `vercel.json` from the repo root. Confirm:
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm --filter web-dashboard build` *(auto from vercel.json)*
   - **Output Directory**: `apps/web-dashboard/dist` *(auto from vercel.json)*
4. Add the environment variable:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://asha-sathi-api.onrender.com/api/v1` |

5. **Deploy**. First build takes ~1 min. You get a URL like:
   `https://asha-sathi.vercel.app`

6. **Go back to Render** and update `CORS_ORIGINS` to your actual Vercel URL:
   ```
   ["https://asha-sathi.vercel.app"]
   ```
   (Use the exact URL Vercel gave you.) Render redeploys automatically.

## Step 4 — Verify (1 min)

1. Open your Vercel URL → login page loads.
2. Log in with a seeded account (see `run.md` for the full list), e.g.:
   - ASHA worker: phone `9876543210`, OTP `1234` *(dev bypass — only when `APP_ENV=dev`)*
   - Patient: phone `9604522015`, password `Namrata@123`
3. API health check: open `https://asha-sathi-api.onrender.com/health` → `{"status":"ok"}`

## Step 5 — Expo Go (phone, 2 min)

The Expo app talks to the same backend. On your phone (same Wi-Fi not needed — it hits the public URL):

1. Edit `apps/mobile-expo/.env`:
   ```
   EXPO_PUBLIC_API_URL=https://asha-sathi-api.onrender.com/api/v1
   ```
2. Restart Expo: `npx expo start -c`
3. Scan the QR code with Expo Go.

---

## Updating after first deploy

- **Push to `main`** → Render auto-redeploys the API (migrations run on boot).
- **Push to `main`** → Vercel auto-redeploys the web app.
- **DB migrations**: automatic on every Render deploy (`alembic upgrade head` in `start.sh`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Web login → CORS error | Update `CORS_ORIGINS` on Render to the exact Vercel URL (including `https://`) |
| API 502 on first request | Render free tier is waking up (~30 s) — retry |
| `password authentication failed` | Neon URL missing `+asyncpg`, or credentials rotated |
| `sslmode` error | Should be fixed already — pull latest `main` |
| Vercel build fails on `asha-design-system` | Run `pnpm install` locally, commit `pnpm-lock.yaml` |
| Expo can't reach API | `EXPO_PUBLIC_API_URL` must be the Render URL, not localhost — restart with `-c` |

## Cost summary

| Service | Plan | Limits |
|---|---|---|
| Neon | Free | 0.5 GB storage, 24/7 compute (scales to zero) |
| Render | Free | 512 MB RAM, sleeps after 15 min idle |
| Vercel | Hobby | 100 GB bandwidth/mo |
| **Total** | **$0** |

## Staging Deployment

This guide assumes you are setting up a **staging** environment separate from production.
Use separate staging credentials and a separate database from production.

### 1. Staging Neon Database

1. Sign up at **https://neon.tech** (free, GitHub login OK).
2. Create a **staging** project — region: **Mumbai (ap-south-1)** or nearest.
3. Copy the connection string. It looks like:
   ```
   postgresql://user:password@ep-xxxxx.aws.neon.tech/neondb?sslmode=require
   ```
4. **Convert it for the backend** (the app needs the `+asyncpg` driver):
   ```
   postgresql+asyncpg://user:password@ep-xxxxx.aws.neon.tech/neondb?sslmode=require
   ```
5. **Important**: Name your staging database differently than production, e.g.
   `stasha_sathi` or `asha_sathi_staging`.

### 2. Managed Redis Instance (Required for Celery)

1. Sign up at **[RedisCloud](https://rediscloud.com/)** or **[Upstash](https://upstash.com/)** (both have free tiers).
2. Create a Redis instance and note the connection URL.
3. The URL format is typically:
   ```
   redis://:password@host:port/db
   ```
   or for Upstash:
   ```
   rediss://username:password@hostname:port
   ```
4. **Test the connection** locally before deploying:
   ```bash
   redis-cli -u "redis://:password@host:port/db ping"
   ```

### 3. Render Environment Variables (Staging)

Set these environment variables on your Render service (override as needed for staging):

| Variable | Staging Value | Production Value |
|---|---|---|
| `APP_ENV` | `staging` | `prod` |
| `DEBUG` | `false` | `false` |
| `DATABASE_URL` | Staging Neon URL with `+asyncpg` | Production Neon URL with `+asyncpg` |
| `JWT_SECRET_KEY` | Render auto-generates | Render auto-generates |
| `CORS_ORIGINS` | `["https://your-staging-vercel-app.vercel.app"]` | `["https://your-prod-vercel-app.vercel.app"]` |
| `REDIS_URL` | Your RedisCloud/Upstash URL | Your RedisCloud/Upstash URL |
| `REDIS_URL` | *(optional if using dev fallback)* | *(same as staging)* |

### 4. Vercel Frontend (Staging)

1. Sign up at **https://vercel.com** (free, GitHub login OK).
2. **Add New → Project**, import the `asha-sathi` repo.
3. Set the environment variable:
   - `VITE_API_URL`: `https://<your-render-staging-url>/api/v1`
4. Deploy. You get a URL like: `https://<staging-hash>.vercel.app`
5. **Update Render CORS**: Go back to Render and update `CORS_ORIGINS` to your actual Vercel staging URL:
   ```
   ["https://<your-staging-vercel-app.vercel.app>"]
   ```

### 5. Health-Check Verification (Staging)

After deployment, verify:

| Check | Expected |
|---|---|
| Render health endpoint | `https://<render-url>/health` → `{"status":"ok"}` |
| API connectivity | Open `https://<render-url>/api/v1/health` in browser |
| OTP send endpoint | Test with a phone number; OTP should be sent |
| Login with ASHA credentials | Phone `9876543210`, OTP `1234` (only when `APP_ENV=dev` or `staging`) |
| CORS headers | Verify `Access-Control-Allow-Origin` matches your Vercel URL |

### 6. OTP and Login Verification (Staging)

1. **OTP send**: Send OTP to a phone number; verify the response includes OTP info
2. **OTP verify**: Submit the OTP code; verify successful login
3. **Login bypass**: When `APP_ENV=staging`, the dev OTP bypass `1234` should work for test phones
   (`9876543210` → ASHA, `9876543215` → admin, `9876543216` → patient)
4. **Login with real credentials**: Verify that ASHA/admin/patient accounts can log in with their
   passwords (not just OTP bypass)

### 7. Two-ASHA Household Isolation Testing (Staging)

Test that two different ASHA workers cannot access each other's households:

1. **ASHA Account A** (phone: `9876543210`):
   - Register a beneficiary/household
   - Verify only ASHA A can view that household
   - Verify ASHA B cannot see that household

2. **ASHA Account B** (phone: `9876543215` or another test phone):
   - Attempt to list households; should return `[]` or only B's households
   - Register a separate beneficiary; verify isolation

3. **Verification**: Use the API endpoints `/api/v1/households/` with each ASHA's auth token
   and confirm that household data is never cross-contaminated.

### 8. Safe Demo Seed Instructions for Staging

**Never run `python -m app.seed` against production.**

To seed a staging database:

1. Set `APP_ENV=staging` (or ensure it's not `prod`)
2. On Render shell, run:
   ```bash
   python -m app.seed
   ```
3. This creates demo geography, users, households, beneficiaries, KPIs, etc. in the **staging** database.
4. **Seed idempotency**: Running the seed multiple times is safe for records with natural unique keys
   (geography, users by phone, households by hhid, beneficiaries by beneficiary_id).
5. **KPIs**: ASHA KPIs are seeded for 2 monthly periods; running again will not duplicate them
   because `_get_or_create` checks for existing records.

### 9. Clear Warning Never to Seed Production

⚠️ **CRITICAL**: The seed command checks `APP_ENV` and refuses to run when `APP_ENV=prod`:

```python
if os.getenv("APP_ENV") == "prod":
    raise RuntimeError(
        "Seed command refused: APP_ENV=prod. "
        "Do not seed a production database. Use a staging database instead."
    )
```

Running the seed against a production database will overwrite or duplicate demo records and
could interfere with real ASHA worker data. Always use a **separate staging database**.

### 10. Deployment Checklist Summary

**Before deploying to staging:**
- [ ] Create staging Neon database (separate from production)
- [ ] Create managed Redis instance (RedisCloud/Upstash)
- [ ] Set Render environment variables (APP_ENV=staging, DEBUG=false, REDIS_URL, CORS_ORIGINS)
- [ ] Deploy Render backend
- [ ] Deploy Vercel frontend with VITE_API_URL pointing to staging Render URL
- [ ] Update Render CORS to actual Vercel staging domain
- [ ] Test health endpoint
- [ ] Test OTP send/verify
- [ ] Test two-ASHA household isolation
- [ ] Verify no secrets are exposed in VITE/EXPO_PUBLIC variables

**After staging verification:**
- [ ] Plan production data migration
- [ ] Update all configuration for production values
- [ ] APP_ENV=prod, no seed command execution
- [ ] Final production readiness review

## Redis Configuration

- Celery requires a Redis broker for task queue and notification processing.
- **Development**: `redis://localhost:6379` works on localhost.
- **Production (Render Free tier)**: Redis is not available on the free tier.
  - Option A: Use a managed Redis service (RedisCloud, Upstash, Redis Labs, etc.).
    - Set `REDIS_URL` to `redis://:password@host:port/db?ssl=true`.
    - Update the Render service environment variable `REDIS_URL`.
  - Option B: Run Redis separately and expose it, or accept that Celery tasks
    will fail without a Redis broker in production.
- **OTP service fallback**: The OTP service has an in-memory fallback for development,
  but production OTP generation and verification depend on Redis being available.
- If Redis is unavailable, consider disabling Celery or using a synchronous task
  execution model for critical notifications.

### Render Redis Add-on

Render does not provide a free managed Redis. To use Redis in production:

1. Sign up at [RedisCloud](https://rediscloud.com/), [Upstash](https://upstash.com/),
   or another managed Redis provider.
2. Create a Redis instance and note the connection URL.
3. Add `REDIS_URL` to your Render environment variables with the connection string.
4. Ensure the Redis instance allows connections from Render's infrastructure.

Alternatively, for staging/development on Render, you can port-forward a local Redis,
but this is not recommended for production. |
