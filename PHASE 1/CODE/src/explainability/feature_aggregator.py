import pandas as pd


def get_original_feature(processed_feature_name):
    """
    Convert a transformed/preprocessed feature name back
    to its original dataset feature name.

    Examples:
        numerical__tenure -> tenure
        categorical__contract_Month-to-month -> contract
        categorical__gender_Male -> gender
    """

    if "__" not in processed_feature_name:
        return processed_feature_name

    _, feature_part = processed_feature_name.split("__", 1)

    # Numerical features keep their original name.
    if processed_feature_name.startswith("numerical__"):
        return feature_part

    # Categorical features have:
    # feature_name_category
    # We need to recover the original feature name.
    #
    # This function alone cannot always know where the
    # feature name ends, so we handle categorical names
    # using the original feature list below.

    return feature_part


def aggregate_shap_features(
    global_shap,
    local_shap,
    original_features
):
    """
    Aggregate SHAP values from transformed features back
    to their original dataset features.

    Parameters
    ----------
    global_shap : DataFrame
        Global SHAP results.

    local_shap : DataFrame
        Local SHAP results.

    original_features : list
        Original feature names before preprocessing.

    Returns
    -------
    aggregated_global : DataFrame
    aggregated_local : DataFrame
    """

    def map_to_original(processed_name):

        # Direct numerical feature
        for feature in original_features:
            if processed_name == f"numerical__{feature}":
                return feature

        # One-hot encoded categorical feature
        for feature in original_features:
            prefix = f"categorical__{feature}_"

            if processed_name.startswith(prefix):
                return feature

        # Fallback
        return get_original_feature(processed_name)

    # -----------------------------
    # GLOBAL SHAP
    # -----------------------------

    aggregated_global = global_shap.copy()

    aggregated_global["original_feature"] = (
        aggregated_global["feature"]
        .apply(map_to_original)
    )

    aggregated_global = (
        aggregated_global
        .groupby("original_feature", as_index=False)
        ["mean_abs_shap"]
        .sum()
    )

    total_importance = aggregated_global["mean_abs_shap"].sum()

    if total_importance > 0:
        aggregated_global["relative_importance"] = (
            aggregated_global["mean_abs_shap"]
            / total_importance
        )
    else:
        aggregated_global["relative_importance"] = 0.0

    aggregated_global = aggregated_global.sort_values(
        "mean_abs_shap",
        ascending=False
    ).reset_index(drop=True)

    # -----------------------------
    # LOCAL SHAP
    # -----------------------------

    if local_shap.empty:

        aggregated_local = pd.DataFrame(
            columns=[
                "row_index",
                "original_feature",
                "shap_value",
                "absolute_impact",
                "direction",
            ]
        )

        return aggregated_global, aggregated_local

    aggregated_local = local_shap.copy()

    aggregated_local["original_feature"] = (
        aggregated_local["feature"]
        .apply(map_to_original)
    )

    # For local SHAP, multiple one-hot columns belonging to
    # the same original feature must be combined.
    aggregated_local = (
        aggregated_local
        .groupby(
            ["row_index", "original_feature"],
            as_index=False
        )
        .agg(
            shap_value=("shap_value", "sum"),
            absolute_impact=("absolute_impact", "sum")
        )
    )

    aggregated_local["direction"] = aggregated_local[
        "shap_value"
    ].apply(
        lambda x:
            "increases_churn"
            if x > 0
            else "decreases_churn"
            if x < 0
            else "neutral"
    )

    aggregated_local = aggregated_local.sort_values(
        ["row_index", "absolute_impact"],
        ascending=[True, False]
    ).reset_index(drop=True)

    return aggregated_global, aggregated_local