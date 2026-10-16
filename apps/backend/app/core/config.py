from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ASHA Sathi API"
    app_env: str = "dev"  # dev | staging | prod
    dev_otp_code: str = "1234"  # dev-only fixed OTP that always verifies
    # Dev-only OTP bypass: phone -> role. These phones log in with dev_otp_code
    # without a real OTP being generated or delivered (bypasses the OTP flow).
    # Each phone is role-locked, so it must match the account's real role.
    # Override with DEV_BYPASS_USERS as a JSON object, e.g.
    #   DEV_BYPASS_USERS={"9876500001":"asha"}
    dev_bypass_users: dict[str, str] = Field(
        default_factory=lambda: {
            "9876543210": "asha",  # ASHA test login
            "9876543215": "admin",  # Admin test login (all admin areas)
            "9876543216": "patient",  # Patient portal test login
        }
    )
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    database_url: str

    # Neon S3-compatible object storage (photo uploads).
    aws_endpoint_url_s3: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str | None = None
    # Bucket used for beneficiary/growth photos; created on first upload when
    # missing. Override the public URL base if a CDN fronts the bucket.
    aws_s3_bucket: str = "asha-sathi"
    s3_public_base_url: str | None = None

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    otp_expire_minutes: int = 5

    redis_url: str = "redis://localhost:6379"

    # NoDecode: accept CORS_ORIGINS as a JSON list ("[\"https://a\"]"), a
    # comma-separated string, or a bare URL — Render/env UIs mangle JSON quotes.
    cors_origins: Annotated[list[str], NoDecode] = Field(default=["http://localhost:3000", "http://localhost:5173"])

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: object) -> object:
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return ["http://localhost:3000", "http://localhost:5173"]
            if s.startswith("["):
                import json

                try:
                    return json.loads(s)
                except ValueError:
                    # Malformed JSON (smart quotes, trailing comma) — strip brackets
                    # and treat the remainder as comma-separated.
                    s = s.strip("[]")
            return [o.strip().strip('"').strip("'") for o in s.split(",") if o.strip()]
        return v

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None

    fcm_server_key: str | None = None

    twilio_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None

    abdm_client_id: str | None = None
    abdm_client_secret: str | None = None
    abdm_base_url: str = "https://dev.abdm.gov.in"
    abdm_gateway_url: str = "https://dev.gateway.abdm.gov.in"

    model_registry_path: str | None = None
    model_versions: dict = {"maternal_risk": "1.0.0", "child_growth": "1.0.0", "ncd_risk": "1.0.0"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
