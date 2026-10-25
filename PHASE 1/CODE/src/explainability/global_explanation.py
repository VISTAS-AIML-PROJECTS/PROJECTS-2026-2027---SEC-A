import numpy as np
import pandas as pd


def normalize_shap_values(shap_values):

    """
    Convert different SHAP output formats into
    a consistent 2D representation.

    Binary classification can return:
        - 2D array
        - list of arrays
        - 3D array depending on SHAP version/model
    """

    if isinstance(shap_values, list):

        # For binary classification, use the
        # positive class explanation.
        if len(shap_values) == 2:

            shap_values = shap_values[1]

        else:

            shap_values = shap_values[0]

    shap_values = np.asarray(
        shap_values
    )

    if shap_values.ndim == 3:

        # Typical shape:
        # samples × features × classes
        shap_values = shap_values[:, :, 1]

    return shap_values


def calculate_global_importance(
    shap_values,
    feature_names
):

    shap_values = normalize_shap_values(
        shap_values
    )

    mean_absolute_shap = np.mean(
        np.abs(shap_values),
        axis=0
    )

    importance = pd.DataFrame({

        "feature": feature_names,

        "mean_abs_shap":
            mean_absolute_shap
    })

    importance = importance.sort_values(
        "mean_abs_shap",
        ascending=False
    ).reset_index(drop=True)

    # Relative importance
    total = importance[
        "mean_abs_shap"
    ].sum()

    if total > 0:

        importance[
            "relative_importance"
        ] = (
            importance["mean_abs_shap"]
            / total
        )

    else:

        importance[
            "relative_importance"
        ] = 0.0

    return importance