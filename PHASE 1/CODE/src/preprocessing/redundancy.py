import pandas as pd
import numpy as np


def detect_redundant_features(
    df,
    feature_columns,
    threshold=0.90
):
    """
    Detect highly correlated numerical features.

    A high correlation does NOT automatically mean that
    one feature should be deleted.

    The system flags the pair for review.
    """

    numerical_features = [
        column
        for column in feature_columns
        if pd.api.types.is_numeric_dtype(
            df[column]
        )
    ]

    if len(numerical_features) < 2:
        return []

    correlation_matrix = (
        df[numerical_features]
        .corr()
        .abs()
    )

    redundant_pairs = []

    for i in range(
        len(numerical_features)
    ):

        for j in range(
            i + 1,
            len(numerical_features)
        ):

            feature_a = numerical_features[i]
            feature_b = numerical_features[j]

            correlation = correlation_matrix.loc[
                feature_a,
                feature_b
            ]

            if pd.isna(correlation):
                continue

            if correlation >= threshold:

                redundant_pairs.append({
                    "feature_a": feature_a,
                    "feature_b": feature_b,
                    "correlation": round(
                        float(correlation),
                        4
                    ),
                    "severity": (
                        "HIGH"
                        if correlation >= 0.95
                        else "MEDIUM"
                    ),
                    "recommendation": (
                        "Review these features for "
                        "redundant information."
                    )
                })

    return redundant_pairs