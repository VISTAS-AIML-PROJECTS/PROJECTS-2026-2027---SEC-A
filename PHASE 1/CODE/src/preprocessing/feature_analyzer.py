import pandas as pd
import numpy as np

from sklearn.feature_selection import (
    mutual_info_classif
)


def _safe_numeric_target(y):
    """
    Convert a binary target into 0/1.
    """

    if pd.api.types.is_numeric_dtype(y):

        unique_values = y.dropna().unique()

        if len(unique_values) == 2:

            mapping = {
                value: index
                for index, value
                in enumerate(unique_values)
            }

            return y.map(mapping)

    values = y.astype(str).str.lower()

    unique_values = values.dropna().unique()

    if len(unique_values) != 2:
        return None

    mapping = {
        unique_values[0]: 0,
        unique_values[1]: 1
    }

    return values.map(mapping)


def _association_score(X, y):
    """
    Estimate nonlinear relationship between a feature
    and a binary target.

    Returns a score between 0 and 1 approximately.
    """

    try:

        target = _safe_numeric_target(y)

        if target is None:
            return 0.0

        valid_mask = (
            target.notna()
        )

        X_valid = X.loc[valid_mask]
        y_valid = target.loc[valid_mask]

        # Numerical feature
        if pd.api.types.is_numeric_dtype(X_valid):

            feature = X_valid.fillna(
                X_valid.median()
            ).to_numpy().reshape(-1, 1)

            score = mutual_info_classif(
                feature,
                y_valid,
                random_state=42
            )[0]

            return float(score)

        # Categorical feature
        encoded = pd.factorize(
            X_valid.astype(str)
        )[0].reshape(-1, 1)

        score = mutual_info_classif(
            encoded,
            y_valid,
            discrete_features=True,
            random_state=42
        )[0]

        return float(score)

    except Exception:
        return 0.0


def analyze_features(
    df,
    target_column,
    feature_columns
):
    """
    Analyze candidate features using multiple
    data-quality and predictive signals.

    This function does NOT blindly delete features.
    It ranks them and explains why.
    """

    results = []

    target = df[target_column]

    for column in feature_columns:

        series = df[column]

        missing_percent = (
            series.isna().mean() * 100
        )

        unique_ratio = (
            series.nunique(dropna=True)
            / max(series.notna().sum(), 1)
        )

        variance = None

        if pd.api.types.is_numeric_dtype(series):

            variance = float(
                series.var()
            )

        association = _association_score(
            series,
            target
        )

        reasons = []
        decision = "KEEP"

        # -----------------------------------
        # Missing data
        # -----------------------------------

        if missing_percent >= 50:

            reasons.append(
                "very high missingness"
            )

            decision = "REVIEW"

        elif missing_percent > 0:

            reasons.append(
                "contains missing values"
            )

        # -----------------------------------
        # Constant / near constant
        # -----------------------------------

        if series.nunique(
            dropna=True
        ) <= 1:

            decision = "DROP"

            reasons.append(
                "constant feature"
            )

        # -----------------------------------
        # Predictive association
        # -----------------------------------

        if association >= 0.20:

            reasons.append(
                "strong target association"
            )

        elif association >= 0.05:

            reasons.append(
                "moderate target association"
            )

        else:

            reasons.append(
                "weak measured target association"
            )

        # -----------------------------------
        # High cardinality
        # -----------------------------------

        if (
            not pd.api.types.is_numeric_dtype(series)
            and unique_ratio > 0.8
        ):

            reasons.append(
                "high-cardinality categorical feature"
            )

            decision = "REVIEW"

        # -----------------------------------
        # Numeric variance
        # -----------------------------------

        if variance is not None:

            if variance == 0:

                decision = "DROP"

                reasons.append(
                    "zero variance"
                )

        results.append(
            {
                "feature": column,
                "data_type": str(series.dtype),
                "missing_percent": round(
                    missing_percent,
                    2
                ),
                "unique_ratio": round(
                    unique_ratio,
                    4
                ),
                "variance": (
                    round(variance, 4)
                    if variance is not None
                    else None
                ),
                "target_association": round(
                    association,
                    4
                ),
                "decision": decision,
                "reasons": reasons
            }
        )

    # Strongest features first.
    results.sort(
        key=lambda x: x[
            "target_association"
        ],
        reverse=True
    )

    return results