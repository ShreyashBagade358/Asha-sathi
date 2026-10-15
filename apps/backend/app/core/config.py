from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
            "9876543210": "asha",    # ASHA test login
            "9876543215": "admin",   # Admin test login (all admin areas)
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

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

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
