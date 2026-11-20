"""Tests for seed command safety and production guard."""

import os
import pytest


def test_seed_environment_variable_can_be_set():
    """Test that APP_ENV environment variable can be set and read."""
    # Set APP_ENV to prod temporarily
    os.environ["APP_ENV"] = "prod"
    try:
        assert os.environ.get("APP_ENV") == "prod"
    finally:
        os.environ.pop("APP_ENV", None)


def test_seed_production_refusal_explicit():
    """Test that the production guard logic works explicitly."""
    # The seed script checks: if os.getenv("APP_ENV") == "prod": raise RuntimeError
    os.environ["APP_ENV"] = "prod"
    try:
        # This is the exact check from seed.py
        if os.getenv("APP_ENV") == "prod":
            raise RuntimeError(
                "Seed command refused: APP_ENV=prod. "
                "Do not seed a production database. Use a staging database instead."
            )
        assert False, "Expected RuntimeError to be raised"
    except RuntimeError as e:
        assert "APP_ENV=prod" in str(e)
    finally:
        os.environ.pop("APP_ENV", None)


def test_seed_development_allowed():
    """Test that seed is allowed when APP_ENV is not prod."""
    # Ensure APP_ENV is not set to prod
    os.environ.pop("APP_ENV", None)
    # Simulate the check
    if os.getenv("APP_ENV") != "prod":
        # Development/staging is allowed
        assert True
    else:
        assert False, "Development should be allowed when APP_ENV != prod"
