"""ASHA Sathi ML training pipeline.

The pipeline trains three model families from Indian public-health data:

* **Maternal risk**  - 3-class (low / medium / high) ANC risk classifier.
* **Child growth**   - 3-class (normal / MAM / SAM) malnutrition classifier
  with WHO z-score computation helpers.
* **NCD risk**       - two binary classifiers (diabetes, hypertension).

Models are trained as scikit-learn pipelines (preprocessor -> XGBoost),
persisted with joblib and exported to ONNX for on-device/edge serving.
"""
