"""Central configuration for the ASHA Sathi ML training pipeline."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"


@dataclass
class ModelConfig:
    """Configuration for a single training run.

    All paths derive from the repository root so the pipeline can be executed
    from any working directory. Fields are frozen in spirit; mutate only via
    :meth:`replace` when you need a variant.
    """

    project_root: Path = field(default_factory=lambda: PROJECT_ROOT)
    raw_data_dir: Path = field(default_factory=lambda: DATA_DIR / "raw")
    processed_data_dir: Path = field(default_factory=lambda: DATA_DIR / "processed")
    artifacts_dir: Path = field(default_factory=lambda: ARTIFACTS_DIR)
    reports_dir: Path = field(default_factory=lambda: ARTIFACTS_DIR / "reports")
    onnx_dir: Path = field(default_factory=lambda: ARTIFACTS_DIR / "onnx")

    random_state: int = 42
    test_size: float = 0.2

    model_version: str = "v1"

    # Minimum acceptable quality thresholds (checked by the `evaluate` stage).
    accuracy_min: float = 0.55
    roc_auc_min: float = 0.60
    f1_min: float = 0.40

    # XGBoost hyper-parameters shared across model families.
    n_estimators: int = 200
    max_depth: int = 5
    learning_rate: float = 0.12
    subsample: float = 0.9
    colsample_bytree: float = 0.9
    early_stopping_rounds: int = 20

    def ensure_dirs(self) -> None:
        """Create all output directories if they do not exist."""
        for directory in (
            self.raw_data_dir,
            self.processed_data_dir,
            self.artifacts_dir,
            self.reports_dir,
            self.onnx_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)

    def to_dict(self) -> dict:
        """Serialise config to JSON-friendly primitives."""
        data = asdict(self)
        for key, value in list(data.items()):
            if isinstance(value, Path):
                data[key] = str(value)
        return data

    def save(self, path: Path | None = None) -> Path:
        """Persist config as JSON next to the training artefacts."""
        target = path or (self.artifacts_dir / "config.json")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(self.to_dict(), indent=2, sort_keys=True), encoding="utf-8"
        )
        return target
