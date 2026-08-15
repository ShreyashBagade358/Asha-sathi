"""Export trained scikit-learn pipelines to (quantized) ONNX.

The artefact is a ``Pipeline([preprocessor, XGBClassifier])`` where the
preprocessor is a numeric pipeline (SimpleImputer + StandardScaler). Because
skl2onnx cannot convert XGBoost directly, the graph is built in three steps:

1. convert the numeric preprocessor with skl2onnx,
2. convert the bare XGBoost estimator with onnxmltools,
3. merge the two graphs with ``onnx.compose.merge_models``.

The result keeps a single float32 tensor input, which matches the serving
contract (see ``src/serving/inference.py``). The merged model is then
dynamically quantized (int8) and runtime-verified with onnxruntime.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional, Sequence

import numpy as np
import onnx
import onnxruntime
from sklearn.pipeline import Pipeline
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

_DEFAULT_TARGET_OPSET = 17

_QUANTIZABLE_OP_TYPES = ["MatMul", "Gemm", "Conv", "Add", "Relu"]


def _is_tree_pipeline(model: object) -> bool:
    """True when ``model`` is a Pipeline whose final step is XGBoost/LGBM."""
    if not isinstance(model, Pipeline):
        return False
    last = model.steps[-1][1]
    try:
        from lightgbm import LGBMClassifier, LGBMRegressor
        from xgboost import XGBClassifier, XGBRegressor
    except ImportError:  # pragma: no cover - optional dependency
        return False
    return isinstance(last, (XGBClassifier, XGBRegressor, LGBMClassifier, LGBMRegressor))


def _export_tree_pipeline(
    model: Pipeline,
    feature_names: Sequence[str],
    output_path: Path,
    model_name: str,
    target_opset: int,
) -> Path:
    """Export a Pipeline([numeric preprocessor, XGBoost/LGBM]) to ONNX."""
    preprocess = model.named_steps["preprocess"]
    clf = model.steps[-1][1]

    # onnxmltools caps its converter opset below skl2onnx's; use the smaller.
    tree_opset = min(target_opset, 15)

    pre_model = convert_sklearn(
        preprocess,
        name=f"{model_name}_preprocess",
        initial_types=[("input", FloatTensorType([None, len(feature_names)]))],
        target_opset=tree_opset,
    )

    probe = np.zeros((1, len(feature_names)), dtype=np.float32)
    n_features = int(preprocess.transform(probe).shape[1])

    from onnxmltools import convert_lightgbm, convert_xgboost
    from onnxmltools.convert.common.data_types import (
        FloatTensorType as OnnxmlFloatTensorType,
    )

    clf_input_types = [("transformed", OnnxmlFloatTensorType([None, n_features]))]
    try:
        clf_model = convert_xgboost(
            clf,
            name=f"{model_name}_model",
            initial_types=clf_input_types,
            target_opset=tree_opset,
        )
    except Exception as exc:  # pragma: no cover - fallback path
        if type(clf).__name__.lower().startswith("lgbm"):
            raise
        try:
            clf_model = convert_lightgbm(
                clf,
                name=f"{model_name}_model",
                initial_types=clf_input_types,
                target_opset=tree_opset,
            )
        except Exception:  # pragma: no cover
            raise RuntimeError(
                f"onnxmltools conversion failed for {model_name}: {exc}"
            ) from exc

    merged = onnx.compose.merge_models(
        pre_model,
        clf_model,
        io_map=[(pre_model.graph.output[0].name, "transformed")],
    )
    onnx.checker.check_model(merged)
    onnx.save_model(merged, str(output_path))
    return output_path


def export_to_onnx(
    model,
    feature_names: Sequence[str],
    output_path: str | Path,
    model_name: str = "model",
    target_opset: int = _DEFAULT_TARGET_OPSET,
) -> Path:
    """Convert a sklearn Pipeline/estimator to ONNX.

    Args:
        model: trained estimator (preferably a Pipeline incl. preprocessor).
        feature_names: raw input feature names, in order.
        output_path: destination ``.onnx`` file.
        model_name: name used for the ONNX graph / opset.
        target_opset: ONNX opset version.

    Raises:
        RuntimeError: if conversion is unsupported (e.g. unknown estimator).
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if _is_tree_pipeline(model):
        return _export_tree_pipeline(
            model, list(feature_names), output_path, model_name, target_opset
        )

    initial_types = [("input", FloatTensorType([None, len(feature_names)]))]

    try:
        onnx_model = convert_sklearn(
            model,
            name=model_name,
            initial_types=initial_types,
            target_opset=target_opset,
        )
    except Exception as exc:  # pragma: no cover - fallback path
        try:
            from onnxmltools import convert_xgboost

            onnx_model = convert_xgboost(
                model,
                name=model_name,
                initial_types=initial_types,
                target_opset=target_opset,
            )
        except Exception as fallback_exc:  # pragma: no cover
            raise RuntimeError(
                f"skl2onnx conversion failed for {model_name}: {exc} "
                f"(onnxmltools fallback also failed: {fallback_exc})"
            ) from exc

    onnx.checker.check_model(onnx_model)
    onnx.save_model(onnx_model, str(output_path))
    return output_path


def quantize_onnx(
    model_path: str | Path,
    out_path: str | Path,
    target_opset: Optional[int] = None,
) -> Path:
    """Dynamically quantize an ONNX model to int8 (QuantizeLinear operators).

    Falls back to a plain copy when the graph contains operators that cannot
    be quantized (e.g. tree ensembles) so downstream consumers always receive
    a valid model.
    """
    model_path = Path(model_path)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        from onnxruntime.quantization import QuantType, quantize_dynamic

        quantize_dynamic(
            str(model_path),
            str(out_path),
            weight_type=QuantType.QInt8,
            op_types_to_quantize=list(_QUANTIZABLE_OP_TYPES),
        )
    except Exception as exc:  # pragma: no cover - environment dependent
        print(f"[quantize] dynamic quantisation unavailable ({exc}); copying model")
        shutil.copyfile(model_path, out_path)
    return out_path


def verify_onnx(
    model_path: str | Path,
    sample_input: np.ndarray,
    session_options: Optional[onnxruntime.SessionOptions] = None,
) -> list[np.ndarray]:
    """Run the ONNX model on a sample input and return its outputs."""
    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"ONNX model not found: {model_path}")

    session = onnxruntime.InferenceSession(
        str(model_path), sess_options=session_options or onnxruntime.SessionOptions()
    )
    input_name = session.get_inputs()[0].name
    input_data = np.asarray(sample_input, dtype=np.float32)
    if input_data.ndim == 1:
        input_data = input_data.reshape(1, -1)
    return session.run(None, {input_name: input_data})


def onnx_summary(model_path: str | Path) -> dict:
    """Return input/output metadata for a saved ONNX model."""
    model = onnx.load(str(Path(model_path)))
    return {
        "inputs": [i.name for i in model.graph.input],
        "outputs": [o.name for o in model.graph.output],
        "opset": model.opset_import[0].version if model.opset_import else None,
    }
