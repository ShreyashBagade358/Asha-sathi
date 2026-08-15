"""Tests: ONNX export + quantisation + runtime verification on a tiny model."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.export.onnx_exporter import (
    export_to_onnx,
    onnx_summary,
    quantize_onnx,
    verify_onnx,
)


def _tiny_pipeline() -> tuple[Pipeline, list[str]]:
    rng = np.random.default_rng(0)
    X = rng.normal(size=(200, 4))
    y = (X[:, 0] + 0.5 * X[:, 1] > 0).astype(int)
    pipeline = Pipeline(
        [("scale", StandardScaler()), ("clf", LogisticRegression(max_iter=1000))]
    )
    pipeline.fit(X, y)
    return pipeline, ["f1", "f2", "f3", "f4"]


def test_export_and_quantize(tmp_path: Path):
    pipeline, feature_names = _tiny_pipeline()
    onnx_path = tmp_path / "tiny.onnx"
    quant_path = tmp_path / "tiny_quantized.onnx"

    export_to_onnx(pipeline, feature_names, onnx_path, model_name="tiny")
    assert onnx_path.exists()

    summary = onnx_summary(onnx_path)
    assert summary["inputs"], "expected at least one graph input"

    quantize_onnx(onnx_path, quant_path)
    assert quant_path.exists()

    # Runtime verification: session runs and returns probabilities.
    sample = np.array([[0.5, -0.5, 1.0, 0.0]], dtype=np.float32)
    outputs = verify_onnx(quant_path, sample)
    assert len(outputs) >= 1
    probs: np.ndarray | None = None
    for output in outputs:
        arr = np.asarray(output)
        if arr.dtype.kind == "O" and arr.size >= 1 and isinstance(arr.ravel()[0], dict):
            probs = np.asarray(list(arr.ravel()[0].values()), dtype=float)
            break
        if arr.dtype.kind in ("f", "i"):
            flat = arr.reshape(-1).astype(float)
            if flat.size == 2:
                probs = flat
                break
    assert probs is not None, f"no probability output found in {outputs}"
    assert abs(float(probs.sum()) - 1.0) < 1e-3


def test_export_rejects_unknown_model(tmp_path: Path):
    class _NotConvertible:
        pass

    with pytest.raises(RuntimeError):
        export_to_onnx(_NotConvertible(), ["a", "b"], tmp_path / "bad.onnx")
