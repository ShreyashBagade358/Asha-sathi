# ASHA Sathi - ML Models

Model cards for the machine-learning pipeline that powers clinical screening
and risk prioritisation inside the ASHA mobile app. All models live under
`apps/ml-training` and are served by the `ml-serving` service.

## Overview

The ML pipeline is deterministic, reproducible and auditable. It trains three
model families from synthetic (seeded) datasets, evaluates them against
explicit quality gates, and exports them to **quantized ONNX** for lightweight
CPU inference. The serving service exposes a small FastAPI contract
(`/predict/maternal`, `/predict/child`, `/predict/ncd`) that the backend calls
on demand.

| Model id        | Task                    | Classes / outputs                | Serving name                 |
| --------------- | ----------------------- | -------------------------------- | ---------------------------- |
| `maternal_risk` | 3-class risk triage     | `low`, `medium`, `high`          | `maternal`                   |
| `child_growth`  | Nutrition status        | `normal`, `MAM`, `SAM` + z-scores | `child`                     |
| `ncd_risk`      | 2 binary classifiers    | diabetes + hypertension `yes/no`  | `ncd` (two sessions)        |

Planned (stub directories reserved): `anemia`, `voice` (vernacular voice
assistant intent recognition).

## Training pipeline

Driven by `apps/ml-training/src/training/pipeline.py` and registered in
`dvc.yaml`:

```bash
cd apps/ml-training

# Full run (prepare -> train x3 -> evaluate -> export)
python -m src.training.pipeline --stage all

# Or a single stage
python -m src.training.pipeline --stage prepare_data
python -m src.training.pipeline --stage train_maternal
python -m src.training.pipeline --stage train_ncd
python -m src.training.pipeline --stage evaluate
python -m src.training.pipeline --stage export_onnx
```

Stage flow: `prepare_data` -> `train_maternal` -> `train_child` -> `train_ncd`
-> `evaluate` -> `export_onnx`.

Datasets are generated deterministically (`seed=42`) by
`src/data/loaders.py` (5000 rows per domain) and cached as CSV + Parquet under
`data/`. Feature engineering is handled per-domain by
`src/features/engineering.py`; each preprocessor is a `ColumnTransformer`
(median / most-frequent imputation, `StandardScaler`, `OneHotEncoder`).

### Quality gates

Configured in `src/config.py` and enforced by the `evaluate` stage - the
pipeline fails loudly if any gate is missed:

| Metric  | Minimum |
| ------- | ------- |
| Accuracy | 0.55 |
| ROC-AUC  | 0.60 |
| F1 (macro or weighted) | 0.40 |

Metrics per model are persisted to `artifacts/reports/*_metrics.json` and
consolidated into `artifacts/reports/final_report.json`.

## Model cards

### 1. Maternal ANC risk (`maternal_risk`)

Flags pregnant women at high risk during ANC so the ASHA can prioritise
referrals and home visits.

- **Task:** multiclass classification (`multi:softprob`)
- **Algorithm:** XGBoost (Pipeline: preprocessor -> `XGBClassifier`)
- **Output:** `risk_level` in `{low, medium, high}` + per-class probabilities + confidence
- **Training:** balanced class weights, 80/20 stratified split, early stopping
- **Code:** `src/models/maternal_risk/{train,predict}.py`

Features (from `src/features/engineering.py`):

| Feature | Type | Meaning |
| ------- | ---- | ------- |
| `age` | numeric | maternal age (years) |
| `gravida`, `parity` | numeric | pregnancy / birth history |
| `gestational_weeks` | numeric | current GA at assessment |
| `bp_systolic`, `bp_diastolic` | numeric | blood pressure (mmHg) |
| `hemoglobin` | numeric | Hb (g/dL) |
| `blood_sugar` | numeric | random blood sugar (mg/dL) |
| `bmi` | numeric | body mass index |
| `previous_csection` / `previous_pph` / `previous_preterm` / `previous_stillbirth` | bool | obstetric history |
| `htn`, `diabetes`, `heart_disease`, `kidney_disease` | bool | co-morbidities |
| `anc_visits_attended` | numeric | ANC visits so far |
| `pmsma_attended` | bool | PMSMA scheme attendance |

### 2. Child growth / nutrition (`child_growth`)

Classifies under-5 nutrition status and computes WHO z-scores **offline**
(no network, no external reference library).

- **Task:** multiclass classification (`multi:softprob`)
- **Algorithm:** XGBoost classifier, plus deterministic WHO LMS z-score tables
- **Output:** `nutrition_status` in `{normal, MAM, SAM}` + probabilities +
  `z_scores` (`waz`, `haz`, `whz`, `muac_status`)
- **Notes:** WHO z-scores are *computed, not learned* - the embedded LMS tables
  in `predict.py` keep the ONNX artefact small and auditable. MUAC thresholds:
  `<115 mm` -> SAM, `<125 mm` -> MAM.
- **Code:** `src/models/child_growth/{train,predict}.py`

Features:

| Feature | Type | Meaning |
| ------- | ---- | ------- |
| `age_months` | numeric | age in months (0-60) |
| `sex` | categorical | `M` / `F` (one-hot) |
| `weight_kg`, `height_cm`, `muac_mm` | numeric | anthropometry |
| `birth_weight_kg`, `gestation_weeks` | numeric | birth details |
| `breastfeeding` | categorical | feeding mode |
| `complementary_feeding` | bool | started complementary food |
| `diarrhea_episodes` | numeric | recent episodes |
| `immunization_complete` | bool | on-schedule immunization |

### 3. NCD risk (`ncd_risk`)

Screens adults (30+) during CBAC for diabetes and hypertension risk.

- **Task:** two independent binary classifiers (`binary:logistic`)
- **Algorithm:** XGBoost per target, shared preprocessor
- **Output:** `diabetes_risk` and `hypertension_risk` probability in `[0,1]`
- **Code:** `src/models/ncd_risk/train.py`

Features:

| Feature | Type | Meaning |
| ------- | ---- | ------- |
| `age`, `sex` | numeric / categorical | demographics |
| `bmi`, `waist_cm` | numeric | anthropometry |
| `tobacco_use`, `alcohol_use` | bool | lifestyle |
| `physical_activity` | categorical | activity level |
| `family_history_diabetes`, `family_history_hypertension` | bool | family history |
| `known_diabetes`, `known_hypertension` | bool | known status |
| `bp_systolic`, `bp_diastolic` | numeric | blood pressure (mmHg) |
| `blood_sugar_random` | numeric | random blood sugar (mg/dL) |

## Export & inference

`src/export/onnx_exporter.py` converts each fitted pipeline to a single ONNX
graph (opset 17), then dynamic-quantizes to int8 where possible and
runtime-verifies the result with onnxruntime.

Artifacts:

```
artifacts/
├── maternal/model_v1.joblib + metadata_v1.json
├── child/model_v1.joblib
├── ncd/model_diabetes_v1.joblib, model_hypertension_v1.joblib
├── onnx/
│   ├── maternal_v1.onnx, maternal_v1_quantized.onnx
│   ├── child_v1.onnx, child_v1_quantized.onnx
│   ├── ncd_diabetes_v1.onnx, ncd_diabetes_v1_quantized.onnx
│   ├── ncd_hypertension_v1.onnx, ncd_hypertension_v1_quantized.onnx
│   └── manifest.json
└── reports/*_metrics.json, final_report.json
```

### Serving contract

`src/serving/inference.py` loads every quantized ONNX model at startup into an
onnxruntime session pool (`ModelRegistry`) and exposes:

| Endpoint | Request body | Response highlights |
| -------- | ------------ | ------------------- |
| `GET /health` | - | status + per-model load state |
| `POST /predict/maternal` | `{"data": {maternal features}}` | `risk_level`, `probabilities`, `confidence` |
| `POST /predict/child` | `{"data": {child features}}` | `nutrition_status`, `z_scores`, `probabilities` |
| `POST /predict/ncd` | `{"data": {ncd features}}` | `diabetes_risk`, `hypertension_risk` |

Run locally:

```bash
cd apps/ml-training
pip install -e ".[serving]"
uvicorn src.serving.inference:app --host 0.0.0.0 --port 8080
```

## Model lifecycle

1. **Version** - every run is tagged (`model_version`, default `v1`);
   artefacts never overwrite an existing version.
2. **Gate** - the `evaluate` stage blocks under-performing models.
3. **Deploy** - exported ONNX files are baked into the `ml-serving` image
   (`docker compose`, or the `ml` deployment in the Helm chart) and exposed
   via `ML_MODEL_DIR=/models`.
4. **Rollback** - re-point `global.imageTag` to the previous image / tag.
5. **Retrain** - when real field data replaces the synthetic datasets, bump
   `model_version`, re-run the pipeline, and ship a new image.

Integration points in the backend: maternal risk populates the HRP (high-risk
pregnancy) list, child growth feeds the growth chart / HBNC flow, and NCD
scores drive the CBAC due-list and referral prompts in the ASHA app.
