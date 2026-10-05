"""Model family packages: maternal_risk, child_growth, ncd_risk."""

from __future__ import annotations

from sklearn.base import BaseEstimator
from sklearn.pipeline import Pipeline


def class_pipeline_model(model) -> BaseEstimator:
    """Return the final estimator of a (possibly wrapped) sklearn model.

    Works whether ``model`` is a bare estimator or a ``Pipeline`` (including
    our standard ``Pipeline([preprocessor, classifier])`` artefacts).
    """
    if isinstance(model, Pipeline):
        return model.steps[-1][1]
    return model
