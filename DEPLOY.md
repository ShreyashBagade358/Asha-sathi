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
| **Total** | **$0** | |
