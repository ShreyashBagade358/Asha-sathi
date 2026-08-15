import re

import pytest

PHONE = "9876543210"


@pytest.mark.asyncio
async def test_otp_send_and_verify(client, user_factory):
    user = await user_factory(phone=PHONE)

    resp = await client.post("/api/v1/auth/otp/send", json={"phone": PHONE})
    assert resp.status_code == 200
    assert "OTP sent" in resp.json()["message"]

    match = re.search(r"otp:\s*(\d{6})", resp.json()["message"])
    assert match, "dev OTP should be returned in dev environment"
    otp = match.group(1)

    verify = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "otp": otp})
    assert verify.status_code == 200
    body = verify.json()
    assert "tokens" in body and "user" in body
    assert body["user"]["id"] == user.id
    assert body["user"]["role"] == "asha"
    assert body["tokens"]["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_otp_verify_invalid(client, user_factory):
    await user_factory(phone=PHONE)
    resp = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "otp": "000000"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_otp_send_unknown_phone(client):
    resp = await client.post("/api/v1/auth/otp/send", json={"phone": "9000000000"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_me_endpoint(client, auth_headers):
    headers = await auth_headers(phone=PHONE)
    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["phone"] == PHONE


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_token_refresh(client, user_factory):
    user = await user_factory(phone=PHONE)
    from app.core.security import create_refresh_token

    refresh = create_refresh_token(user.id)
    resp = await client.post("/api/v1/auth/token/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 200
    assert "access_token" in resp.json()
