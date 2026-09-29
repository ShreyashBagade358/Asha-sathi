# ASHA Sathi — Expo mobile app

Offline-first field app for ASHA workers. Built with Expo (React Native) and
Expo Router, and runs in **Expo Go** without a custom native build.

## How it works

SQLite is the source of truth for the UI, not a cache:

```
  screen  ->  SQLite (expo-sqlite)  ->  sync_queue (durable outbox)
                     ^                        |
                     |                        v
             NetInfo trigger  ------->  POST /sync/push  (idempotent)
                     |                        |
                     +-----------  POST /sync/pull  (updated_at watermark)
```

- Every write commits locally first and appends to `sync_queue`. The form
  clears immediately regardless of connectivity.
- Each queued write carries a stable `client_request_id`. Retrying after a
  dropped connection replays the server's stored response instead of creating a
  duplicate row.
- Push runs before pull. Pulling first would download server rows that the
  queued local edits are about to overwrite.
- Stale writes are rejected by the server with a conflict rather than
  clobbering newer data. Conflicts land in `sync_conflicts` for review.
- `NetInfo` triggers a sync when connectivity returns.

## Setup

```bash
cd apps/mobile-expo
pnpm install --ignore-workspace
cp .env.example .env
npx expo start
```

Scan the QR code with Expo Go.

### Pointing at the backend

A physical device cannot reach your machine on `localhost` — from the phone,
`localhost` is the phone. Set your machine's LAN address:

```bash
# macOS
ipconfig getifaddr en0
# Linux
hostname -I
```

```bash
# apps/mobile-expo/.env
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/api/v1
```

The phone and the machine must be on the same network.

## Scripts

| Command | Purpose |
| --- | --- |
| `npx expo start` | Dev server + QR code |
| `npx expo export --platform android` | Produce a production bundle |
| `npx tsc --noEmit` | Typecheck |
| `npx expo-doctor` | SDK compatibility check |

## Layout

```
app/                      Expo Router routes
  _layout.tsx             Root: DB init + network watcher
  index.tsx               Auth gate
  login.tsx               OTP login
  (app)/
    index.tsx             Dashboard
    patients.tsx          Beneficiary list + search
    patient/[id].tsx      Detail
    register.tsx          Offline-first registration
    sync.tsx              Queue, status, conflicts
src/
  config.ts               EXPO_PUBLIC_API_URL + client constants
  types.ts                Shared API and queue types
  auth/
    api.ts                HTTP client, single-flight 401 refresh
    session.ts            Login, session restore, device id
    tokenStore.ts         expo-secure-store wrapper
  db/database.ts          Schema, queue, entities, watermark
  sync/
    engine.ts             push / pull / conflict handling
    network.ts            NetInfo watcher and sync scheduling
```

## Notes

- `node-linker=hoisted` in `.npmrc` is required: Metro resolves modules the way
  npm lays them out, and pnpm's default isolated store hides transitive
  dependencies such as `query-string`.
- The app is installed with `--ignore-workspace` so it keeps its own
  `node_modules` and lockfile. The pnpm workspace and the web dashboard are
  unaffected.
- `query-string` is an explicit dependency because `expo-router@4.0.22` imports
  it without declaring it.
