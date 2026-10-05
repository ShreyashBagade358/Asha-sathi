# Running ASHA Sathi

Three processes, three terminals. Start the backend first — the web app and the
Expo app both log in against it.

## Terminal 1 — backend (port 8000)

```sh
cd apps/backend
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```


## Terminal 2 — web dashboard (port 5173)

```sh
cd apps/web-dashboard
npm run dev
```

Then open **http://localhost:5173**. Vite proxies `/api/*` to
`http://localhost:8000`, so no CORS setup is needed for the browser.

## Terminal 3 — Expo app

```sh
cd apps/mobile-expo
npx expo start
```

Scan the QR with Expo Go, or open `exp://<your-lan-ip>:8081`.

- `apps/mobile-expo/.env` sets `EXPO_PUBLIC_API_URL` to a LAN address (currently
  `http://10.143.86.208:8000/api/v1`). It must be your machine's LAN IP, not
  `localhost` — `localhost` resolves to the phone itself. If your IP changes,
  edit that file, not the phone.

## Re-seeding (only if the DB is empty)

```sh
cd apps/backend
.venv/bin/python -m app.seed
```

## Geography (full India)

The location dropdowns come from the Census 2011 village directory — 36
states/UTs, 666 districts, 5,997 blocks (taluk/tehsil), 652,179 villages. The
import is idempotent and preserves the seeded demo chain (Uttar Pradesh →
Lucknow → Sarojini Nagar → PHC Sarojini Nagar → Khasra):

```sh
cd apps/backend
.venv/bin/python -m scripts.import_geo
```

The CSV (43 MB) is downloaded once into `apps/backend/data/` (gitignored);
re-runs skip existing rows and take a few seconds. Blocks that have no PHC get
a placeholder `{block} PHC` and `{block} Sub-Centre`, flagged by
`phcs.address = "Auto-created by geo import to host village records"`.



### Seeded accounts

Phone	Password	Role
8010159779	Shreyash@123	admin (Shreyash Bagade)
9156664235	Ritesh@123	admin (Ritesh Patil)
8010867650	Samruddhi@123	asha worker (Samruddhi Gore)
9604522015	Namrata@123	patient (Namrata Belwekar)

Where each role lands after login:

- `asha` → `/asha/home`
- `admin` → `/phc/dashboard`
- `patient` → `/patient/dashboard`

Name
Shreya Bagade
Sign-in ID (mobile number)
8010159778
Password
Ash@9778WPBI