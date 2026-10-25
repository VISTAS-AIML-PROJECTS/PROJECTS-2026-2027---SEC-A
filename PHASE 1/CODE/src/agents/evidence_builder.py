def build_customer_evidence(
    row_index,
    original_test_df,
    predictions,
    aggregated_local_shap,
    target_column,
    top_n=5,
    shap_lookup=None
):
    """
    Build structured evidence for one prediction.

    shap_lookup is an optional pre-grouped dictionary:

        row_index -> SHAP rows

    This avoids scanning the entire SHAP dataframe
    for every customer.
    """

    # --------------------------------------------------
    # 1. VALIDATE ROW
    # --------------------------------------------------

    if row_index < 0 or row_index >= len(predictions):

        raise IndexError(
            f"Invalid prediction row index: {row_index}"
        )

    # --------------------------------------------------
    # 2. GET PREDICTION
    # --------------------------------------------------

    prediction_result = predictions[row_index]

    prediction = prediction_result[
        "prediction"
    ]

    probability = prediction_result.get(
        "probability"
    )

    risk_level = prediction_result.get(
        "risk_level"
    )

    # --------------------------------------------------
    # 3. GET ORIGINAL CUSTOMER DATA
    # --------------------------------------------------

    customer_row = original_test_df.iloc[
        row_index
    ]

    customer_features = (
        customer_row
        .drop(
            labels=[target_column],
            errors="ignore"
        )
        .to_dict()
    )

    # --------------------------------------------------
    # 4. GET CUSTOMER SHAP
    # --------------------------------------------------

    if shap_lookup is not None:

        customer_shap = (
            shap_lookup
            .get(
                row_index
            )
        )

        if customer_shap is None:

            customer_shap = (
                aggregated_local_shap.iloc[0:0]
            )

        else:

            customer_shap = (
                customer_shap.copy()
            )

    else:

        customer_shap = (
            aggregated_local_shap[
                aggregated_local_shap[
                    "row_index"
                ] == row_index
            ].copy()
        )

    customer_shap = customer_shap.sort_values(
        "absolute_impact",
        ascending=False
    ).head(top_n)

    # --------------------------------------------------
    # 5. BUILD TOP FACTORS
    # --------------------------------------------------

    top_factors = []

    for _, factor in customer_shap.iterrows():

        feature_name = factor[
            "original_feature"
        ]

        shap_value = float(
            factor["shap_value"]
        )

        absolute_impact = float(
            factor["absolute_impact"]
        )

        factor_data = {

            "feature":
                feature_name,

            "value":
                customer_features.get(
                    feature_name
                ),

            "shap_value":
                shap_value,

            "absolute_impact":
                absolute_impact,

            "impact":
                factor["direction"]
        }

        top_factors.append(
            factor_data
        )

    # --------------------------------------------------
    # 6. BUILD EVIDENCE
    # --------------------------------------------------

    return {

        "row_index":
            int(row_index),

        "prediction":
            prediction,

        "probability":
            (
                float(probability)
                if probability is not None
                else None
            ),

        "risk_level":
            risk_level,

        "customer_features":
            customer_features,

        "top_factors":
            top_factors
    }