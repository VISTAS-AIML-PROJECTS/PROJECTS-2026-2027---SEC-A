import pandas as pd

from .global_explanation import (
    normalize_shap_values
)


def calculate_local_explanation(
    shap_values,
    X_data,
    feature_names,
    row_offset=0
):
    """
    Convert SHAP values into long-form local explanations.

    row_offset allows chunked SHAP processing to preserve
    the original global row indices.
    """

    shap_values = normalize_shap_values(
        shap_values
    )

    if len(X_data) != len(shap_values):

        raise ValueError(
            "X_data and SHAP values have "
            "different row counts."
        )

    if len(feature_names) != shap_values.shape[1]:

        raise ValueError(
            "Feature count does not match SHAP "
            "output."
        )

    records = []

    for local_row_index in range(
        len(X_data)
    ):

        row_index = (
            row_offset
            + local_row_index
        )

        row_values = X_data.iloc[
            local_row_index
        ]

        row_shap = shap_values[
            local_row_index
        ]

        for feature_index, feature in enumerate(
            feature_names
        ):

            shap_value = float(
                row_shap[feature_index]
            )

            records.append({

                "row_index":
                    row_index,

                "feature":
                    feature,

                "feature_value":
                    str(
                        row_values.iloc[
                            feature_index
                        ]
                    ),

                "shap_value":
                    shap_value,

                "direction":
                    (
                        "increases_churn"
                        if shap_value > 0
                        else
                        "decreases_churn"
                        if shap_value < 0
                        else
                        "neutral"
                    ),

                "absolute_impact":
                    abs(shap_value)
            })

    return pd.DataFrame(
        records,
        columns=[
            "row_index",
            "feature",
            "feature_value",
            "shap_value",
            "direction",
            "absolute_impact"
        ]
    )


def get_top_reasons(
    local_df,
    row_index,
    top_n=5
):

    customer_data = local_df[
        local_df[
            "row_index"
        ] == row_index
    ]

    customer_data = (
        customer_data
        .sort_values(
            "absolute_impact",
            ascending=False
        )
        .head(top_n)
    )

    return customer_data.to_dict(
        orient="records"
    )