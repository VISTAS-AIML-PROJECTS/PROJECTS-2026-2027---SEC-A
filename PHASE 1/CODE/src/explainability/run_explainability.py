import json
import os

import joblib
import numpy as np
import pandas as pd

from src.explainability.shap_engine import (
    calculate_shap_values_chunked
)

from src.explainability.global_explanation import (
    calculate_global_importance
)

from src.explainability.local_explanation import (
    calculate_local_explanation,
    get_top_reasons
)

from src.explainability.feature_aggregator import (
    aggregate_shap_features
)


MODELING_RESULTS_FILE = (
    "data/modeling/modeling_results.json"
)

PREPROCESSING_METADATA_FILE = (
    "data/metadata/preprocessing_metadata.json"
)

TRAIN_FILE = (
    "data/processed/model_ready_train.csv"
)

TEST_FILE = (
    "data/processed/model_ready_test.csv"
)

MODEL_DIR = "models"

OUTPUT_DIR = (
    "data/explainability"
)

DEFAULT_CHUNK_SIZE = 2000


def _append_dataframe_to_csv(
    dataframe,
    path,
    header
):

    dataframe.to_csv(
        path,
        mode="w" if header else "a",
        header=header,
        index=False
    )


def run_explainability(
    chunk_size=DEFAULT_CHUNK_SIZE
):

    os.makedirs(
        OUTPUT_DIR,
        exist_ok=True
    )

    print("\n" + "=" * 60)
    print("PHASE 4: SHAP EXPLAINABILITY")
    print("=" * 60)

    # --------------------------------------------------
    # 1. LOAD MODELING RESULTS
    # --------------------------------------------------

    with open(
        MODELING_RESULTS_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        modeling_results = json.load(
            file
        )

    best_model_name = (
        modeling_results["best_model"]
    )

    model_path = os.path.join(
        MODEL_DIR,
        f"{best_model_name}.joblib"
    )

    model = joblib.load(
        model_path
    )

    # --------------------------------------------------
    # 2. LOAD PREPROCESSING METADATA
    # --------------------------------------------------

    with open(
        PREPROCESSING_METADATA_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        preprocessing_metadata = json.load(
            file
        )

    target_column = (
        preprocessing_metadata[
            "target"
        ]["column"]
    )

    original_features = (
        preprocessing_metadata[
            "selected_features"
        ]
    )

    # --------------------------------------------------
    # 3. LOAD DATA
    # --------------------------------------------------

    train_df = pd.read_csv(
        TRAIN_FILE
    )

    test_df = pd.read_csv(
        TEST_FILE
    )

    X_train = train_df.drop(
        columns=[target_column]
    )

    X_test = test_df.drop(
        columns=[target_column]
    )

    feature_names = X_test.columns.tolist()

    total_rows = len(X_test)

    print(
        f"Model: {best_model_name}"
    )

    print(
        f"Training rows: {len(X_train):,}"
    )

    print(
        f"Test rows: {total_rows:,}"
    )

    print(
        f"Processed features: "
        f"{len(feature_names):,}"
    )

    print(
        f"SHAP chunk size: {chunk_size:,}"
    )

    # --------------------------------------------------
    # 4. CREATE EXPLAINER + CHUNKED SHAP
    # --------------------------------------------------

    explainer, shap_chunks = (
        calculate_shap_values_chunked(
            model,
            X_train,
            X_test,
            chunk_size=chunk_size
        )
    )

    # --------------------------------------------------
    # 5. INITIALIZE OUTPUTS
    # --------------------------------------------------

    global_output = os.path.join(
        OUTPUT_DIR,
        "global_shap.csv"
    )

    local_output = os.path.join(
        OUTPUT_DIR,
        "local_shap.csv"
    )

    aggregated_local_output = os.path.join(
        OUTPUT_DIR,
        "aggregated_local_shap.csv"
    )

    aggregated_global_output = os.path.join(
        OUTPUT_DIR,
        "aggregated_global_shap.csv"
    )

    # Remove stale outputs from previous runs.

    for path in [
        global_output,
        local_output,
        aggregated_local_output,
        aggregated_global_output
    ]:

        if os.path.exists(path):
            os.remove(path)

    # --------------------------------------------------
    # 6. PROCESS EACH SHAP CHUNK
    # --------------------------------------------------

    global_sum_abs = np.zeros(
        len(feature_names),
        dtype=float
    )

    local_frames = []

    local_header = True

    for start, shap_values in shap_chunks:

        end = min(
            start + len(shap_values),
            total_rows
        )

        X_chunk = X_test.iloc[
            start:end
        ]

        # ----------------------------------------------
        # GLOBAL SHAP CONTRIBUTION
        # ----------------------------------------------

        global_sum_abs += np.abs(
            shap_values
        ).sum(axis=0)

        # ----------------------------------------------
        # LOCAL SHAP
        # ----------------------------------------------

        local_chunk = (
            calculate_local_explanation(
                shap_values,
                X_chunk,
                feature_names,
                row_offset=start
            )
        )

        _append_dataframe_to_csv(
            local_chunk,
            local_output,
            header=local_header
        )

        local_header = False

        # Keep only this chunk in memory.

        local_frames.append(
            local_chunk
        )

        # ----------------------------------------------
        # MEMORY CONTROL
        # ----------------------------------------------

        del shap_values
        del local_chunk

    # --------------------------------------------------
    # 7. GLOBAL SHAP
    # --------------------------------------------------

    mean_abs_shap = (
        global_sum_abs
        / max(total_rows, 1)
    )

    global_shap = pd.DataFrame({
        "feature": feature_names,
        "mean_abs_shap": mean_abs_shap
    })

    global_shap = global_shap.sort_values(
        "mean_abs_shap",
        ascending=False
    ).reset_index(
        drop=True
    )

    global_shap["relative_importance"] = (
        global_shap["mean_abs_shap"]
        /
        max(
            global_shap["mean_abs_shap"].sum(),
            1e-12
        )
    )

    global_shap.to_csv(
        global_output,
        index=False
    )

    # --------------------------------------------------
    # 8. AGGREGATE LOCAL SHAP
    # --------------------------------------------------

    # The final local SHAP CSV is read back in chunks
    # rather than keeping all raw SHAP records in RAM.

    aggregated_local_parts = []

    for chunk in pd.read_csv(
        local_output,
        chunksize=100000
    ):

        aggregated_global_part, aggregated_local_part = (
            aggregate_shap_features(
                global_shap,
                chunk,
                original_features
            )
        )

        aggregated_local_parts.append(
            aggregated_local_part
        )

    if aggregated_local_parts:

        aggregated_local = pd.concat(
            aggregated_local_parts,
            ignore_index=True
        )

        # A customer may be split across CSV chunks,
        # so aggregate again after concatenation.

        aggregated_local = (
            aggregated_local
            .groupby(
                [
                    "row_index",
                    "original_feature"
                ],
                as_index=False
            )
            .agg(
                shap_value=(
                    "shap_value",
                    "sum"
                ),
                absolute_impact=(
                    "absolute_impact",
                    "sum"
                )
            )
        )

        aggregated_local["direction"] = (
            aggregated_local[
                "shap_value"
            ].apply(
                lambda value:
                    (
                        "increases_churn"
                        if value > 0
                        else
                        "decreases_churn"
                        if value < 0
                        else
                        "neutral"
                    )
            )
        )

        aggregated_local = (
            aggregated_local
            .sort_values(
                [
                    "row_index",
                    "absolute_impact"
                ],
                ascending=[
                    True,
                    False
                ]
            )
            .reset_index(
                drop=True
            )
        )

    else:

        aggregated_local = pd.DataFrame(
            columns=[
                "row_index",
                "original_feature",
                "shap_value",
                "absolute_impact",
                "direction"
            ]
        )

    # --------------------------------------------------
    # 9. AGGREGATE GLOBAL SHAP
    # --------------------------------------------------

    aggregated_global, _ = (
        aggregate_shap_features(
            global_shap,
            pd.DataFrame(),
            original_features
        )
    )

    # --------------------------------------------------
    # 10. SAVE AGGREGATED OUTPUTS
    # --------------------------------------------------

    aggregated_global.to_csv(
        aggregated_global_output,
        index=False
    )

    aggregated_local.to_csv(
        aggregated_local_output,
        index=False
    )

    # --------------------------------------------------
    # 11. TOP REASONS
    # --------------------------------------------------

    top_reasons = {}

    if not aggregated_local.empty:

        grouped_reasons = (
            aggregated_local
            .groupby(
                "row_index",
                sort=False
            )
        )

        for row_index, customer_data in (
            grouped_reasons
        ):

            customer_data = (
                customer_data
                .sort_values(
                    "absolute_impact",
                    ascending=False
                )
                .head(5)
            )

            top_reasons[str(row_index)] = (
                customer_data.to_dict(
                    orient="records"
                )
            )

    # --------------------------------------------------
    # 12. SAVE SHAP RESULTS
    # --------------------------------------------------

    shap_results = {

        "best_model":
            best_model_name,

        "target":
            target_column,

        "processed_feature_count":
            len(feature_names),

        "original_feature_count":
            len(original_features),

        "prediction_count":
            total_rows,

        "processed_features":
            feature_names,

        "original_features":
            original_features,

        "top_global_features":
            aggregated_global.head(10).to_dict(
                orient="records"
            ),

        "top_reasons":
            top_reasons,

        "chunk_size":
            chunk_size
    }

    results_output = os.path.join(
        OUTPUT_DIR,
        "shap_results.json"
    )

    with open(
        results_output,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            shap_results,
            file,
            indent=4,
            default=str
        )

    # --------------------------------------------------
    # 13. SUMMARY
    # --------------------------------------------------

    print()
    print(
        "PHASE 4 - SHAP COMPLETED"
    )

    print(
        f"Predictions explained: "
        f"{total_rows:,}"
    )

    print(
        f"Processed features: "
        f"{len(feature_names):,}"
    )

    print()
    print(
        "Top business-level SHAP features:"
    )

    print(
        aggregated_global[
            [
                "original_feature",
                "mean_abs_shap",
                "relative_importance"
            ]
        ].head(10).to_string(
            index=False
        )
    )

    print()
    print("Saved:")
    print(global_output)
    print(local_output)
    print(aggregated_global_output)
    print(aggregated_local_output)
    print(results_output)

    return {

        "global_shap":
            global_shap,

        "local_shap":
            pd.read_csv(
                local_output
            ),

        "aggregated_global":
            aggregated_global,

        "aggregated_local":
            aggregated_local,

        "shap_results":
            shap_results
    }


if __name__ == "__main__":
    run_explainability()