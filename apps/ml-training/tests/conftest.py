"""Shared pytest fixtures for the ML training pipeline."""

from __future__ import annotations

import pytest
from pathlib import Path

from src.data.loaders import (
    generate_synthetic_child,
    generate_synthetic_maternal,
    generate_synthetic_ncd,
)
from src.features.engineering import (
    feature_engineering_child,
    feature_engineering_maternal,
    feature_engineering_ncd,
)


@pytest.fixture(scope="session")
def maternal_df() -> object:
    """Synthetic maternal ANC dataset."""
    return generate_synthetic_maternal(n=600, seed=7)


@pytest.fixture(scope="session")
def child_df() -> object:
    """Synthetic child growth dataset."""
    return generate_synthetic_child(n=600, seed=7)


@pytest.fixture(scope="session")
def ncd_df() -> object:
    """Synthetic NCD screening dataset."""
    return generate_synthetic_ncd(n=600, seed=7)


@pytest.fixture(scope="session")
def maternal_feature_set(maternal_df):
    return feature_engineering_maternal(maternal_df)


@pytest.fixture(scope="session")
def child_feature_set(child_df):
    return feature_engineering_child(child_df)


@pytest.fixture(scope="session")
def ncd_feature_set(ncd_df):
    return feature_engineering_ncd(ncd_df)


@pytest.fixture()
def tmp_config(tmp_path: Path):
    """ModelConfig rooted in a temp directory so training never touches repo."""
    from src.config import ModelConfig

    return ModelConfig(
        project_root=tmp_path,
        processed_data_dir=tmp_path / "data" / "processed",
        artifacts_dir=tmp_path / "artifacts",
        reports_dir=tmp_path / "artifacts" / "reports",
        onnx_dir=tmp_path / "artifacts" / "onnx",
    )
