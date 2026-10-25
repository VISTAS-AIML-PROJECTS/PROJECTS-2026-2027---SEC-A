import json
import os

import joblib
import pandas as pd

from src.modeling.predictor import (
    predict_churn,
    classify_risk
)

from src.agents.evidence_builder import (
    build_customer_evidence
)


ORIGINAL_TEST_FILE = (
    "data/processed/original_test.csv"
)

MODELING_RESULTS_FILE = (
    "data/modeling/modeling_results.json"
)

PREPROCESSING_METADATA_FILE = (
    "data/metadata/preprocessing_metadata.json"
)

TEST_FILE = (
    "data/processed/model_ready_test.csv"
)

AGGREGATED_LOCAL_SHAP_FILE = (
    "data/explainability/aggregated_local_shap.csv"
)

MODEL_DIR = "models"

OUTPUT_DIR = "data/agents"

EVIDENCE_OUTPUT_FILE = (
    "data/agents/customer_evidence.json"
)


def _load_json(path):

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


def run_agent():

    os.makedirs(
        OUTPUT_DIR,
        exist_ok=True
    )

    print("\n" + "=" * 60)
    print("PHASE 5: CUSTOMER EVIDENCE")
    print("=" * 60)

    # --------------------------------------------------
    # 1. LOAD MODELING RESULTS
    # --------------------------------------------------

    modeling_results = _load_json(
        MODELING_RESULTS_FILE
    )

    best_model_name = modeling_results[
        "best_model"
    ]

    target_mappings = modeling_results.get(
        "target_mappings",
        {}
    )

    target_mapping = target_mappings.get(
        best_model_name
    )

    # --------------------------------------------------
    # 2. LOAD BEST MODEL
    # --------------------------------------------------

    model_path = os.path.join(
        MODEL_DIR,
        f"{best_model_name}.joblib"
    )

    if not os.path.exists(model_path):

        raise FileNotFoundError(
            f"Best model not found: {model_path}"
        )

    model = joblib.load(
        model_path
    )

    # --------------------------------------------------
    # 3. LOAD PREPROCESSING METADATA
    # --------------------------------------------------

    preprocessing_metadata = _load_json(
        PREPROCESSING_METADATA_FILE
    )

    target_column = (
        preprocessing_metadata[
            "target"
        ]["column"]
    )

    # --------------------------------------------------
    # 4. LOAD MODEL-READY TEST DATA
    # --------------------------------------------------

    test_df = pd.read_csv(
        TEST_FILE
    )

    if target_column not in test_df.columns:

        raise ValueError(
            f"Target column '{target_column}' "
            "not found in model-ready test data."
        )

    X_test = test_df.drop(
        columns=[target_column]
    )

    # --------------------------------------------------
    # 5. LOAD ORIGINAL TEST DATA
    # --------------------------------------------------

    original_test_df = pd.read_csv(
        ORIGINAL_TEST_FILE
    )

    if len(original_test_df) != len(X_test):

        raise ValueError(
            "Original test data and model-ready "
            "test data have different row counts: "
            f"{len(original_test_df)} vs "
            f"{len(X_test)}"
        )

    # --------------------------------------------------
    # 6. GENERATE PREDICTIONS
    # --------------------------------------------------

    print(
        f"Generating predictions for "
        f"{len(X_test)} customers..."
    )

    predictions = predict_churn(
        model,
        X_test,
        target_mapping=target_mapping
    )

    # --------------------------------------------------
    # 7. ADD RISK LEVEL
    # --------------------------------------------------

    for result in predictions:

        result["risk_level"] = classify_risk(
            result.get("probability")
        )

    # --------------------------------------------------
    # 8. LOAD SHAP
    # --------------------------------------------------

    if not os.path.exists(
        AGGREGATED_LOCAL_SHAP_FILE
    ):

        raise FileNotFoundError(
            "Aggregated local SHAP file not found: "
            f"{AGGREGATED_LOCAL_SHAP_FILE}"
        )

    aggregated_local_shap = pd.read_csv(
        AGGREGATED_LOCAL_SHAP_FILE
    )

    required_columns = {
        "row_index",
        "original_feature",
        "shap_value",
        "absolute_impact",
        "direction"
    }

    missing_columns = (
        required_columns
        - set(aggregated_local_shap.columns)
    )

    if missing_columns:

        raise ValueError(
            "Aggregated local SHAP is missing "
            f"columns: {sorted(missing_columns)}"
        )

    # --------------------------------------------------
    # 9. PREPARE FAST SHAP LOOKUP
    # --------------------------------------------------

    shap_by_row = {
        row_index: group
        for row_index, group
        in aggregated_local_shap.groupby(
            "row_index",
            sort=False
        )
    }

    # --------------------------------------------------
    # 10. BUILD CUSTOMER EVIDENCE
    # --------------------------------------------------

    all_evidence = []

    total = len(X_test)

    for row_index in range(total):

        evidence = build_customer_evidence(
            row_index=row_index,
            original_test_df=original_test_df,
            predictions=predictions,
            aggregated_local_shap=aggregated_local_shap,
            target_column=target_column,
            top_n=5,
            shap_lookup=shap_by_row
        )

        all_evidence.append(
            evidence
        )

        if (
            total >= 1000
            and (
                (row_index + 1) % 1000 == 0
                or row_index + 1 == total
            )
        ):

            print(
                f"Evidence processed: "
                f"{row_index + 1:,}/{total:,}"
            )

    # --------------------------------------------------
    # 11. SAVE EVIDENCE
    # --------------------------------------------------

    with open(
        EVIDENCE_OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            all_evidence,
            file,
            indent=4,
            default=str,
            ensure_ascii=False
        )

    # --------------------------------------------------
    # 12. SUMMARY
    # --------------------------------------------------

    print()
    print(
        "PHASE 5 - CUSTOMER EVIDENCE COMPLETED"
    )

    print(
        f"Model: {best_model_name}"
    )

    print(
        f"Customers processed: {len(all_evidence):,}"
    )

    print(
        f"Evidence file: {EVIDENCE_OUTPUT_FILE}"
    )

    print("=" * 60)

    return all_evidence


if __name__ == "__main__":
    run_agent()