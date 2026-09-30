Simplest form — open two terminals, run these copied commands:

Terminal 1 — backend:
cd /Users/shreyash/Downloads/asha-sathi/apps/backend
source .venv/bin/activate
uvicorn app.main:app --reload


Terminal 2 — frontend:
cd /Users/shreyash/Downloads/asha-sathi/apps/web-dashboard
npm run dev
Then open http://localhost:3000 — phone 9876543210, OTP 1234.


- 9876543210 → asha
- 9876543211 → anm
- 9876543212 → moic




wo processes, two terminals.
Terminal 1 — backend (must be running first; the app logs in against it):
cd /Users/shreyash/Downloads/asha-sathi/apps/backend
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload


Terminal 2 — Expo app:
cd /Users/shreyash/Downloads/asha-sathi/apps/mobile-expo
npx expo start


Then open Expo Go on your phone and scan the QR, or type exp://192.168.143.74:8081.
Notes:
- --host 0.0.0.0 is required — without it the phone can't reach the API.
- apps/mobile-expo/.env already points at http://192.168.143.74:8000/api/v1. If your laptop's IP changes, update that file, not the phone.
- alembic upgrade head is only needed once, but I left it in since 0005 was unapplied on this machine.
- Seed data (if the DB is ever empty again): .venv/bin/python -m app.seed from the backend dir.
Login: phone 9876543210, OTP 1234.




Role	Email	Phone	Password
ASHA worker	sunita.asha@example.in (mailto:sunita.asha@example.in)	9876543210	asha@123
ANM	anita.anm@example.in (mailto:anita.anm@example.in)	9876543211	asha@123
MOIC	moic.sarojini@example.in (mailto:moic.sarojini@example.in)	9876543212	asha@123
DPM	dpm.lucknow@example.in (mailto:dpm.lucknow@example.in)	9876543213	asha@123
STATE_ADMIN	state.admin@example.in (mailto:state.admin@example.in)	9876543214	asha@123
SUPER_ADMIN	super.admin@example.in (mailto:super.admin@example.in)	9876543215	asha@123
PATIENT	(none)	9876543216	asha@123