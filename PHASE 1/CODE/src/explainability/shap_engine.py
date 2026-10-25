import numpy as np
import shap


def create_explainer(
    model,
    X_background
):
    """
    Automatically select an appropriate SHAP explainer.
    """

    model_name = type(model).__name__

    tree_models = (
        "RandomForestClassifier",
        "XGBClassifier",
        "RandomForestRegressor",
        "XGBRegressor"
    )

    if model_name in tree_models:

        return shap.TreeExplainer(
            model
        )

    return shap.LinearExplainer(
        model,
        X_background
    )


def _normalize_shap_output(shap_values):
    """
    Normalize SHAP output to a 2D numpy array.

    Handles:
    - ndarray
    - list of arrays
    - newer SHAP output formats
    """

    if isinstance(shap_values, list):

        if len(shap_values) == 2:

            shap_values = shap_values[1]

        elif len(shap_values) == 1:

            shap_values = shap_values[0]

        else:

            raise ValueError(
                "Unexpected multi-class SHAP output."
            )

    if hasattr(
        shap_values,
        "values"
    ):

        shap_values = shap_values.values

    shap_values = np.asarray(
        shap_values
    )

    if shap_values.ndim == 3:

        if shap_values.shape[-1] == 2:

            shap_values = shap_values[:, :, 1]

        elif shap_values.shape[0] == 2:

            shap_values = shap_values[1]

        else:

            raise ValueError(
                "Unsupported 3D SHAP output shape: "
                f"{shap_values.shape}"
            )

    if shap_values.ndim != 2:

        raise ValueError(
            "Expected 2D SHAP output, got "
            f"{shap_values.shape}"
        )

    return shap_values


def calculate_shap_values(
    model,
    X_background,
    X_data
):
    """
    Original full-data SHAP calculation.

    Kept for backward compatibility.
    """

    explainer = create_explainer(
        model,
        X_background
    )

    shap_values = explainer.shap_values(
        X_data
    )

    shap_values = _normalize_shap_output(
        shap_values
    )

    return explainer, shap_values


def calculate_shap_values_chunked(
    model,
    X_background,
    X_data,
    chunk_size=2000
):
    """
    Calculate SHAP values in chunks.

    This prevents the entire test dataset from being
    processed in one huge SHAP operation.

    Returns:
        explainer,
        list of (start_index, shap_array)
    """

    if chunk_size <= 0:

        raise ValueError(
            "chunk_size must be greater than zero."
        )

    explainer = create_explainer(
        model,
        X_background
    )

    results = []

    total_rows = len(X_data)

    for start in range(
        0,
        total_rows,
        chunk_size
    ):

        end = min(
            start + chunk_size,
            total_rows
        )

        chunk = X_data.iloc[
            start:end
        ]

        values = explainer.shap_values(
            chunk
        )

        values = _normalize_shap_output(
            values
        )

        if values.shape[0] != len(chunk):

            raise ValueError(
                "SHAP returned an unexpected "
                "number of rows."
            )

        results.append(
            (
                start,
                values
            )
        )

        print(
            f"SHAP processed: "
            f"{end:,}/{total_rows:,}"
        )

    return explainer, results