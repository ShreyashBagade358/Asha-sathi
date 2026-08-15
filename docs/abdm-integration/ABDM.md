# ABDM Integration Guide

This document describes how ASHA Sathi integrates with the **Ayushman Bharat
Digital Mission (ABDM)** — the national health interoperability framework of
India. We implement the three ABDM phases (M1 / M2 / M3) for ABHA lifecycle
management, consent-based sharing and health-information exchange.

Reference documentation: https://abdm.gov.in · Gateway sandbox: https://dev.abdm.gov.in

---

## 1. Overview

```
 ASHA Sathi (HIP + HIU)                     ABDM Gateway / HPR
─────────────────────────                ────────────────────────
 POST /abdm/abha/create  ───────────────►  v0.5/hip/auth -> auth/confirm
 POST /abdm/abha/verify  ───────────────►  v0.5/hip/patient-id-on-consent
 POST /abdm/consent/request ────────────►  v0.5/users/consent/request
 consent-webhook (callback) ◄───────────  v0.5/consent-requests/on-approve
 POST /abdm/records/push ───────────────►  v0.5/records/hiu/on-request (HIP)
 GET  /abdm/records/pull  ◄─────────────   v0.5/records/fhir/on-request (HIU)
```

ASHA Sathi plays **both** HIP (Health Information Provider - pushes ANC,
immunization records) and HIU (Health Information User - reads records for the
dashboard). ABHA creation uses the **M1 identity** flow.

---

## 2. Phase M1 — ABHA identity

| Endpoint (ABDM)                         | Purpose                        |
| --------------------------------------- | ------------------------------ |
| `POST /v0.5/hip/auth/request`           | initiate session with HPR      |
| `POST /v0.5/hip/auth/confirm`           | confirm OTP, receive token     |
| `POST /v0.5/hip/patient-id-on-consent`  | create/link ABHA from consent  |
| `POST /v0.5/patients/profile/on-create` | profile created callback       |

ASHA Sathi flow (`/api/v1/abdm/abha/create`):

1. ASHA registers a beneficiary and captures name, phone, DOB, gender, consent.
2. Backend calls the ABDM gateway to verify the mobile number.
3. ABDM pushes an OTP to the beneficiary's phone (SMS).
4. The ASHA app collects the OTP → backend confirms → ABHA number is created.
5. Optionally an Aadhaar-based KYC is initiated (beneficiary does it on the
   ABHA app); ASHA Sathi stores `abha_records.kyc_status`.

Stored in `abha_records`: `abha_number`, `abha_address`, `kyc_status`,
`kyc_type`, `kyc_reference_id`, `linked_mobile`, `profile_photo_url`.

---

## 3. Phase M2 — Consent (artefacts)

**Request side (`/api/v1/abdm/consent/request`):**

```json
{
  "beneficiary_id": "f4d2...",
  "purpose_code": "HPA",
  "hi_types": ["OPD"],
  "permission_start": "2026-08-12",
  "permission_end": "2026-11-12"
}
```

1. Backend calls `POST /v0.5/users/consent/request` (HIU role).
2. Beneficiary approves/rejects in the ABHA app or the ASHA Sathi patient app.
3. Gateway calls back `consent-requests/on-approve` (webhook) with the
   **consent artefact** (id, purpose, permission, HIP/HIU ids).
4. ASHA Sathi stores it in `consent_artifacts` with `status=ACTIVE` and notifies
   the beneficiary.

**Grant side (`/api/v1/abdm/consent/on-approve`):** when another HIU wants ASHA
Sathi records, the gateway notifies us (HIP role) with
`POST /v0.5/consent/hip-notify`; we grant consent for the requested period and
send the consent artefact via `POST /v0.5/consent/on-approve`.

**Revocation:** gateway sends `POST /v0.5/consent/on-revoked`; we mark the
artefact `REVOKED` and stop sharing.

---

## 4. Phase M3 — Health records (FHIR)

### 4.1 Push (HIP role)

1. ANC / immunization / delivery records are converted to FHIR resources
   (`Bundle` of `Encounter`, `Observation`, `Immunization`, `Patient`).
2. Backend calls `POST /v0.5/records/hiu/on-request` **only after** an active
   consent artefact covers the beneficiary, period and HI type.
3. On success, store in `health_records` (`document_id`, `checksum`,
   `consent_artifact_id`, `status=created`).
4. Gateway may request the records later via `POST /v0.5/records/hip/request` —
   we respond with `records/hip/request/on-request`.

### 4.2 Pull (HIU role)

The dashboard can pull a beneficiary's health records from other facilities:

1. `POST /v0.5/records/hiu/request` (with consent artefact + HI types).
2. Gateway → source HIP → returns records via `records/hiu/on-request`.
3. Backend stores the FHIR bundle and links it to the beneficiary's ABHA.

---

## 5. Configuration

Set in `.env` / Helm secret:

| Env                          | Description                              | Sandbox default        |
| ---------------------------- | ---------------------------------------- | ---------------------- |
| `ABDM_CLIENT_ID`             | Gateway client ID (from ABDM portal)     | `CHANGE_ME`            |
| `ABDM_CLIENT_SECRET`         | Gateway client secret                    | `CHANGE_ME`            |
| `ABDM_BASE_URL`              | ABDM base API                            | `https://dev.abdm.gov.in` |
| `ABDM_GATEWAY_URL`           | ABDM gateway API                         | `https://dev.gateway.abdm.gov.in` |
| `ABDM_WEBHOOK_BASE_URL`      | Public callback URL for webhooks         | `https://staging.api.asha-sathi.gov.in` |

Required gateway subscriptions (from the ABDM portal):

- `hipauth`
- `consent`
- `consent-notification`
- `records`

Webhook endpoints registered with ABDM (mapped to `/api/v1/abdm/webhooks/*`):

```
POST /v1/consent-requests/on-approve
POST /v1/consent-requests/on-status
POST /v1/consent/hip-notify
POST /v1/consent/on-revoked
POST /v1/patients/profile/on-create
POST /v1/records/hiu/on-request
POST /v1/records/hip/on-request
```

---

## 6. Testing (sandbox)

1. Register on the ABDM **dev** portal to obtain `client_id` / `client_secret`
   and subscribe to the gateway events above.
2. Use the ABDM **sandbox app** (or `dev.abdm.gov.in` UI) to simulate the
   beneficiary approving consents.
3. Use the pre-generated sandbox test phone numbers listed on the ABDM dev
   portal (OTPs are returned in the portal log, not sent as real SMS).
4. Smoke test:

```bash
curl -s http://localhost:8000/api/v1/health
# then create an ABHA for a sandbox phone:
curl -X POST http://localhost:8000/api/v1/abdm/abha/create \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"beneficiary_id":"<id>","full_name":"Test Person","phone":"<sandbox-phone>","date_of_birth":"1990-01-01","gender":"female","consent_for_abha":true}'
```

5. Check `abha_records`, `consent_artifacts`, `health_records` in the DB after
   each step, and monitor the `ABDM` Grafana dashboard for webhook latencies.

---

## 7. Security & compliance notes

- Beneficiary **consent is mandatory** before any ABHA creation or data push.
- Store only `abha_number` + `abha_address`; never store Aadhaar or OTPs.
- All gateway calls are signed per ABDM's auth flow; refresh tokens are cached
  in Redis and rotated.
- Logs to `audit_logs` with `abdm_*` action names for traceability.
- Production requires a **validated HIP/HIU X.509 certificate** per ABDM policy.
