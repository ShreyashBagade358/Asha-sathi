# ASHA Sathi - ML Training Pipeline

Train and serve three public-health ML models:

| Model | Task | Output |
|---|---|---|
| Maternal risk | 3-class ANC risk | `low` / `medium` / `high` |
| Child growth | 3-class nutrition status | `normal` / `MAM` / `SAM` |
| NCD risk | two binary classifiers | diabetes risk, hypertension risk |

Models are trained as scikit-learn pipelines (impute → standardize/one-hot →
XGBoost) with class balancing, evaluated, and exported to **ONNX** for
on-device / edge serving.

## Setup

```bash
cd apps/ml-training
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Optional extras
pip install -e '.[dev,serving]'   # pytest, dvc, jupyter, fastapi
```

## Run the pipeline

```bash
# Everything in one go
python -m src.training.pipeline --stage all

# Individual stages (also used by DVC)
python -m src.training.pipeline --stage prepare_data
python -m src.training.pipeline --stage train_maternal
python -m src.training.pipeline --stage train_child
python -m src.training.pipeline --stage train_ncd
python -m src.training.pipeline --stage evaluate
python -m src.training.pipeline --stage export_onnx

# With DVC (reproduces only stale stages)
dvc repro
```

Artifacts land in `artifacts/`:

```
artifacts/
  maternal/  model_v1.joblib, metadata_v1.json
  child/     model_v1.joblib, metadata_v1.json
  ncd/       model_diabetes_v1.joblib, model_hypertension_v1.joblib
  reports/   maternal_metrics.json, child_metrics.json, ... final_report.json
  onnx/      maternal_v1.onnx, *_quantized.onnx, manifest.json
```

## Data

`prepare_data` generates realistic synthetic datasets into `data/processed/`
(also written to `data/raw/` as CSV). To train on real data, drop
`maternal.parquet`, `child.parquet` and `ncd.parquet` (columns defined in
`src/features/engineering.py`) into `data/processed/` - the rest of the
pipeline is unchanged.

## Tests

```bash
pytest            # unit tests + coverage report
pytest -m "not slow"
```

## Serving

```bash
# Local
uvicorn src.serving.inference:app --reload --port 8000
```

Endpoints (OpenAPI at `/docs`):

* `POST /predict/maternal` `{"data": {<19 maternal features>}}`
* `POST /predict/child`   `{"data": {<11 child features>}}`
* `POST /predict/ncd`     `{"data": {<14 ncd features>}}`
* `GET  /health`

### Docker

```bash
# Build from the repository root (ml-common lives outside this app)
docker build -f apps/ml-training/Dockerfile -t asha-sathi-ml .
docker run -p 8000:8000 asha-sathi-ml
```

## ONNX export notes

* `export_to_onnx` uses `skl2onnx.convert_sklearn` on the full pipeline
  (preprocessor included) with an `onnxmltools` fallback for XGBoost.
* `quantize_onnx` applies int8 dynamic quantisation
  (`QuantizeLinear` operators via `onnxruntime.quantization`).
* `verify_onnx` runs the artefact through `onnxruntime.InferenceSession` with
  a sample input so every exported model is proven runnable.
* Feature spec / risk utilities shared with the backend live in
  `packages/ml-common`.
