"""ml-common: shared feature specs and risk utilities.

Used by the training pipeline (artefact contract), the backend API and any
client that builds feature payloads for ASHA Sathi ML models.

Example:
    >>> from ml_common.feature_spec import MaternalFeatures
    >>> spec = MaternalFeatures(age=28, bp_systolic=142)
    >>> spec.validate()
    []
    >>> spec.to_feature_vector()  # ordered, default-filled
    {...}
"""

from ml_common.feature_spec import (
    ChildFeatures,
    MaternalFeatures,
    NCDFeatures,
)
from ml_common.risk_utils import (
    MATERNAL_RISK_LABELS,
    NUTRITION_LABELS,
    class_index_to_label,
    confidence_from_margin,
    probability_margin,
    top_label,
)

__all__ = [
    "ChildFeatures",
    "MaternalFeatures",
    "NCDFeatures",
    "MATERNAL_RISK_LABELS",
    "NUTRITION_LABELS",
    "class_index_to_label",
    "confidence_from_margin",
    "probability_margin",
    "top_label",
]
