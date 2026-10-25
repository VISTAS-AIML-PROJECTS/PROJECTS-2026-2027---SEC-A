import json
import os

import pandas as pd

from .trainer import train_models, save_models
from .evaluator import evaluate_models
from .model_selector import (
    cross_validate_models,
    select_best_model,
    create_model_comparison
)
from .predictor import (
    predict_churn,
    classify_risk
)


def run_modeling(
    train_file="data/processed/model_ready_train.csv",
    test_file="data/processed/model_ready_test.csv"
):

    print("\n")
    print("=" * 60)
    print("PHASE 3: MODELING")
    print("=" * 60)

    # ---------------------------------------------------------
    # 1. LOAD MODEL-READY DATA
    # ---------------------------------------------------------

    print("\n[1] Loading model-ready datasets...")

    train_df = pd.read_csv(train_file)
    test_df = pd.read_csv(test_file)

    metadata_path = "data/metadata/preprocessing_metadata.json"

    with open(
    metadata_path,
    "r",
    encoding="utf-8"
    ) as file:
        preprocessing_metadata = json.load(file)

    target_column = preprocessing_metadata["target"]["column"]

    if target_column not in train_df.columns:

        raise ValueError(
            f"Target column '{target_column}' "
            "not found in training dataset."
        )

    feature_columns = [
        column
        for column in train_df.columns
        if column != target_column
    ]

    X_train = train_df[feature_columns]
    y_train = train_df[target_column]

    X_test = test_df[feature_columns]
    y_test = test_df[target_column]

    print(
        f"Training rows: {len(X_train)}"
    )

    print(
        f"Testing rows: {len(X_test)}"
    )

    print(
        f"Features: {len(feature_columns)}"
    )

    # ---------------------------------------------------------
    # 2. TRAIN MODELS
    # ---------------------------------------------------------

    print("\n[2] Training candidate models...")

    trained_models, target_mappings = train_models(
    X_train,
    y_train
)

    # ---------------------------------------------------------
    # 3. EVALUATE MODELS
    # ---------------------------------------------------------

    print("\n[3] Evaluating models...")

    evaluation_results = evaluate_models(
        trained_models,
        X_test,
        y_test,
        target_mappings
    )

    # ---------------------------------------------------------
    # 4. CROSS VALIDATION
    # ---------------------------------------------------------

    print("\n[4] Running cross-validation...")

    cv_results = cross_validate_models(
        trained_models,
        X_train,
        y_train,
        target_mappings

    )

    # ---------------------------------------------------------
    # 5. SELECT BEST MODEL
    # ---------------------------------------------------------

    print("\n[5] Selecting best model...")

    best_name, best_model = select_best_model(
        trained_models,
        evaluation_results,
        cv_results,
        primary_model="xgboost"
    )

    print(
        f"\nProduction model: {best_name}"
    )

    # ---------------------------------------------------------
    # 6. MODEL COMPARISON
    # ---------------------------------------------------------

    print("\n[6] Creating model comparison...")

    comparison = create_model_comparison(
        evaluation_results,
        cv_results
    )

    print("\nModel comparison:")

    print(
        comparison.to_string(
            index=False
        )
    )

    # ---------------------------------------------------------
    # 7. GENERATE PREDICTIONS
    # ---------------------------------------------------------

    print("\n[7] Generating predictions...")

    predictions = predict_churn(
        best_model,
        X_test,
        target_mapping=target_mappings.get(best_name) if target_mappings else None
    )

    prediction_output = test_df.copy()

    prediction_output["prediction"] = [
        result["prediction"]
        for result in predictions
    ]

    if predictions and "probability" in predictions[0]:

        prediction_output[
            "churn_probability"
        ] = [
            result["probability"]
            for result in predictions
        ]

        prediction_output[
            "risk_level"
        ] = [
            classify_risk(
                result["probability"]
            )
            for result in predictions
        ]

    # ---------------------------------------------------------
    # 8. SAVE RESULTS
    # ---------------------------------------------------------

    print("\n[8] Saving modeling results...")

    os.makedirs(
        "data/modeling",
        exist_ok=True
    )

    os.makedirs(
        "models",
        exist_ok=True
    )

    comparison_path = (
        "data/modeling/model_comparison.csv"
    )

    prediction_path = (
        "data/modeling/test_predictions.csv"
    )

    results_path = (
        "data/modeling/modeling_results.json"
    )

    comparison.to_csv(
        comparison_path,
        index=False
    )

    prediction_output.to_csv(
        prediction_path,
        index=False
    )

    save_models(
        trained_models,
        "models"
    )

    modeling_metadata = {

        "target": target_column,

        "feature_count": len(
            feature_columns
        ),

        "feature_columns": feature_columns,

        "models_trained": list(
            trained_models.keys()
        ),

        "evaluation_results":
            evaluation_results,

        "cross_validation":
            cv_results,

        "best_model":
            best_name,

        "production_model":
            best_name,

        "primary_model_policy":
            "XGBoost is the production path when available. Other models are baselines.",

        "target_mappings":
            target_mappings,

        "prediction_file":
            prediction_path
    }

    with open(
        results_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            modeling_metadata,
            file,
            indent=4,
            default=str
        )

    print(
        f"Saved: {comparison_path}"
    )

    print(
        f"Saved: {prediction_path}"
    )

    print(
        f"Saved: {results_path}"
    )

    # ---------------------------------------------------------
    # 9. FINAL SUMMARY
    # ---------------------------------------------------------

    print("\n" + "=" * 60)
    print("PHASE 3 COMPLETED")
    print("=" * 60)

    print(
        f"Models trained: "
        f"{len(trained_models)}"
    )

    print(
        f"Best model: "
        f"{best_name}"
    )

    print(
        f"Predictions generated: "
        f"{len(predictions)}"
    )

    print("=" * 60)

    return {

        "trained_models":
            trained_models,

        "evaluation_results":
            evaluation_results,

        "cv_results":
            cv_results,

        "best_model_name":
            best_name,

        "best_model":
            best_model,

        "predictions":
            predictions,

        "comparison":
            comparison
    }