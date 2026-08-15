# ASHA Sathi - API Reference

Base URL: `http://localhost:8000/api/v1` (dev) · `https://api.asha-sathi.gov.in/api/v1` (prod)

Interactive spec: `GET /openapi.json` or `GET /docs` (Swagger UI) / `GET /redoc`.

All responses share a common envelope:

```json
{ "success": true, "data": { }, "message": null, "errors": [] }
```

Auth: most endpoints require `Authorization: Bearer <access_token>` (from OTP
login). Use the Postman collection in `docs/postman/` for ready-made calls.

---

## Endpoint groups

| Group                 | Base path                  | Description                                          |
| --------------------- | -------------------------- | ---------------------------------------------------- |
| Auth                  | `/auth`                    | OTP request/verify, refresh, biometric, logout       |
| ASHA                  | `/asha`                    | ASHA profiles, catchment, training, supervisor view  |
| Households            | `/households`              | household registration, family members, consent      |
| Beneficiaries         | `/beneficiaries`           | person registration, demographics, ABHA linkage      |
| Maternal              | `/pregnancies`, `/anc`, `/pnc`, `/deliveries` | pregnancy + visits, delivery outcomes |
| Child                 | `/children`, `/immunization`, `/growth` | children, vaccines, HBNC/HBYC, growth charts |
| NCD                   | `/ncd`                     | CBAC screening and risk results                      |
| Disease               | `/disease`                 | malaria / TB / fever case reporting                  |
| Deaths                | `/deaths`                  | death reports + verbal autopsy                       |
| Incentives            | `/incentives`              | claims lifecycle (draft → paid)                      |
| ABDM                  | `/abdm`                    | ABHA create/link, consent, HIR push/pull             |
| Sync                  | `/sync`                    | offline-first push/pull, conflict resolution         |
| Dashboard & Reporting | `/dashboard`, `/reporting` | aggregates, exports                                  |
| Notifications         | `/notifications`           | list/mark-read, channels (push, SMS, in-app)         |
| Referrals             | `/referrals`               | create, track, close referrals                       |
| Config                | `/config`                  | public app config, feature flags                     |
| AI                    | `/ai`                      | ML risk predictions + explanations                   |
| Health                | `/health`                  | liveness/readiness probes (no auth)                  |

---

## Key endpoint examples

### 1. Auth — request OTP

`POST /auth/otp/request`

```json
{ "phone": "9876543210" }
```

`200 OK`

```json
{
  "success": true,
  "data": {
    "request_id": "otp_9f2c1e",
    "expires_in_seconds": 300,
    "resend_in_seconds": 60
  },
  "message": "OTP sent",
  "errors": []
}
```

### 2. Auth — verify OTP

`POST /auth/otp/verify`

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "device_id": "device-ab12cd34"
}
```

`200 OK`

```json
{
  "success": true,
  "data": {
    "tokens": {
      "access_token": "<jwt>",
      "refresh_token": "<jwt>",
      "token_type": "bearer",
      "expires_in": 1800
    },
    "user": {
      "id": "b7e9...",
      "phone": "9876543210",
      "full_name": "Sunita Devi",
      "role": "asha",
      "language": "hi"
    }
  },
  "message": "Login successful",
  "errors": []
}
```

### 3. Beneficiary — create

`POST /beneficiaries` (Bearer token)

```json
{
  "household_id": "a1b2...",
  "beneficiary_id": "BEN-UP-LKO-0010",
  "full_name": "Savitri Verma",
  "full_name_local": { "hi": "सवित्री वर्मा" },
  "gender": "female",
  "age_years": 30,
  "phone": "9876500010",
  "marital_status": "married",
  "is_pregnant": true
}
```

`201 Created`

```json
{
  "success": true,
  "data": {
    "id": "f4d2...",
    "beneficiary_id": "BEN-UP-LKO-0010",
    "full_name": "Savitri Verma",
    "is_pregnant": true,
    "registration_date": "2026-08-12",
    "status": "active"
  },
  "message": "Beneficiary created",
  "errors": []
}
```

### 4. ANC visit — create

`POST /anc`

```json
{
  "pregnancy_id": "c8e1...",
  "visit_number": 3,
  "visit_date": "2026-08-12",
  "bp_systolic": 118,
  "bp_diastolic": 76,
  "weight_kg": 54.1,
  "hemoglobin": 10.6,
  "danger_signs": { "bleeding": false, "convulsions": false },
  "advice_given": { "iron_folic_acid": true },
  "referral_made": false
}
```

`201 Created`

```json
{
  "success": true,
  "data": {
    "id": "9aa8...",
    "pregnancy_id": "c8e1...",
    "visit_number": 3,
    "bp_systolic": 118,
    "bp_diastolic": 76,
    "next_anc_due": "2026-09-09",
    "anc_count": 3,
    "risk_level": "low"
  },
  "message": "ANC visit recorded",
  "errors": []
}
```

### 5. Sync — push batch

`POST /sync/push`

```json
{
  "since_token": "tok_41a9",
  "ops": [
    {
      "op_id": "op_1001",
      "entity": "beneficiaries",
      "action": "upsert",
      "pk": "f4d2...",
      "data": { "full_name": "Savitri Verma", "is_pregnant": true },
      "client_updated_at": "2026-08-12T04:15:00Z"
    }
  ]
}
```

`200 OK`

```json
{
  "success": true,
  "data": {
    "server_token": "tok_41ba",
    "accepted": 1,
    "conflicts": [],
    "server_time": "2026-08-12T04:15:01Z"
  },
  "message": "Batch synced",
  "errors": []
}
```

### 6. ABDM — create ABHA

`POST /abdm/abha/create`

```json
{
  "beneficiary_id": "f4d2...",
  "full_name": "Savitri Verma",
  "phone": "9876500010",
  "date_of_birth": "1996-03-14",
  "gender": "female",
  "consent_for_abha": true
}
```

`200 OK`

```json
{
  "success": true,
  "data": {
    "abha_number": "91-2345-6789-0123",
    "abha_address": "savitri.verma@abdm",
    "kyc_status": "pending",
    "otp_required": true,
    "verification_ref": "vt_7f21"
  },
  "message": "ABHA creation initiated",
  "errors": []
}
```

---

## Errors

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| 400  | Validation failed (`errors[]` lists field messages)                  |
| 401  | Missing/expired/invalid token                                        |
| 403  | Authenticated but not authorised for the resource                    |
| 404  | Resource not found                                                   |
| 409  | Conflict (e.g. duplicate hhid / vaccine dose)                        |
| 422  | Request schema invalid (FastAPI validation)                          |
| 429  | Rate limited (Redis-based)                                           |
| 5xx  | Server error (logged with trace ID; surfaced to Sentry/Grafana)      |
