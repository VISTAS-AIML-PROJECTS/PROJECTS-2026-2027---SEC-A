

import json
import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from src.preprocessing.detector import (
    detect_target,
    detect_identifier_columns,
    detect_features,
)

from src.preprocessing.feature_analyzer import (
    analyze_features,
)

from src.preprocessing.profiler import (
    profile_dataset,
)

from src.preprocessing.warnings import (
    analyze_target_distribution,
    generate_data_warnings,
)

from src.preprocessing.redundancy import (
    detect_redundant_features,
)

from src.preprocessing.transformer import (
    build_preprocessor,
)

from src.preprocessing.leakage import (
    detect_potential_leakage,
)


# ============================================================
# MINE - PHASE 2 PREPROCESSING PIPELINE
# ============================================================
#
# Uses the ACTUAL preprocessing architecture in MINE:
#
#   detector.py
#   feature_analyzer.py
#   profiler.py
#   warnings.py
#   redundancy.py
#   transformer.py
#   leakage.py
#
# Important fixes:
#
#   1. No nonexistent target_detection.py
#   2. No nonexistent identifiers.py
#   3. CustomerID cannot reach OneHotEncoder
#   4. Target-derived features cannot reach modeling
#   5. IBM Telco Churn fields such as:
#        Churn Value
#        Churn Score
#        Churn Reason
#        Churn Category
#        Customer Status
#      are removed from predictive features
#   6. Existing MINE metadata structure is preserved
#   7. original_test.csv is generated
#   8. clean_dataset.csv is synchronized for Phase 7
#
# ============================================================


# ============================================================
# DEFAULT OUTPUT PATHS
# ============================================================

DEFAULT_TRAIN_FILE = (
    "data/processed/model_ready_train.csv"
)

DEFAULT_TEST_FILE = (
    "data/processed/model_ready_test.csv"
)

DEFAULT_ORIGINAL_TEST_FILE = (
    "data/processed/original_test.csv"
)

DEFAULT_METADATA_FILE = (
    "data/metadata/preprocessing_metadata.json"
)

DEFAULT_FEATURE_METADATA_FILE = (
    "data/metadata/feature_metadata.json"
)

DEFAULT_PROFILE_FILE = (
    "data/metadata/data_profile.json"
)

DEFAULT_CLEAN_DATASET_FILE = (
    "data/input/clean_dataset.csv"
)


# ============================================================
# COLUMN NORMALIZATION
# ============================================================

def normalize_column_name(column):
    """
    Normalize a column name for robust comparisons.

    Examples:

        CustomerID
        customer_id
        Customer ID
        CUSTOMER-ID

    all become comparable.
    """

    return (
        str(column)
        .strip()
        .lower()
        .replace("_", "")
        .replace("-", "")
        .replace(" ", "")
    )


# ============================================================
# TARGET RESOLUTION
# ============================================================

def resolve_target_column(
    df,
    requested_target=None,
):
    """
    Resolve the target column.

    Priority:

        1. Explicit exact match
        2. Case-insensitive match
        3. Normalized match
        4. Existing MINE detect_target()
    """

    columns = list(df.columns)

    # --------------------------------------------------------
    # Explicit target
    # --------------------------------------------------------

    if requested_target is not None:

        requested_target = str(
            requested_target
        ).strip()

        # Exact
        if requested_target in columns:

            return requested_target

        # Case-insensitive
        requested_lower = (
            requested_target.lower()
        )

        matches = [
            column
            for column in columns
            if str(column).strip().lower()
            == requested_lower
        ]

        if len(matches) == 1:

            return matches[0]

        if len(matches) > 1:

            raise ValueError(
                "Multiple case-insensitive target "
                f"matches found: {matches}"
            )

        # Normalized
        normalized_requested = (
            normalize_column_name(
                requested_target
            )
        )

        matches = [
            column
            for column in columns
            if normalize_column_name(column)
            == normalized_requested
        ]

        if len(matches) == 1:

            return matches[0]

        if len(matches) > 1:

            raise ValueError(
                "Multiple normalized target "
                f"matches found: {matches}"
            )

    # --------------------------------------------------------
    # Existing MINE target detector
    # --------------------------------------------------------

    detected_target = detect_target(
        df
    )

    if detected_target is not None:

        return detected_target

    # --------------------------------------------------------
    # Generic churn fallback
    # --------------------------------------------------------

    churn_candidates = []

    for column in columns:

        normalized = normalize_column_name(
            column
        )

        if "churn" in normalized:

            churn_candidates.append(
                column
            )

    # Prefer direct churn target names
    preferred = [
        column
        for column in churn_candidates
        if normalize_column_name(column)
        in {
            "churn",
            "churnlabel",
            "churnflag",
            "churntarget",
            "churned",
        }
    ]

    if len(preferred) == 1:

        return preferred[0]

    if len(churn_candidates) == 1:

        return churn_candidates[0]

    raise ValueError(
        "Unable to determine target column. "
        f"Requested target: {requested_target}. "
        f"Available columns: {columns}"
    )


# ============================================================
# TARGET VALIDATION
# ============================================================

def validate_target(
    df,
    target_column,
):

    if target_column not in df.columns:

        raise ValueError(
            f"Target column '{target_column}' "
            "does not exist in the dataset."
        )

    target = df[target_column]

    if target.isna().all():

        raise ValueError(
            f"Target column '{target_column}' "
            "contains only missing values."
        )

    unique_values = (
        target
        .dropna()
        .unique()
    )

    if len(unique_values) < 2:

        raise ValueError(
            f"Target column '{target_column}' "
            "must contain at least two unique values."
        )


# ============================================================
# IDENTIFIER EXTRACTION
# ============================================================

def extract_identifier_columns(
    identifier_results,
):
    """
    Convert MINE detector output into a simple list.

    detector.detect_identifier_columns() returns:

        [
            {
                "column": "...",
                ...
            }
        ]
    """

    identifier_columns = []

    if not identifier_results:

        return identifier_columns

    for item in identifier_results:

        if isinstance(
            item,
            dict,
        ):

            column = item.get(
                "column"
            )

            if column is not None:

                identifier_columns.append(
                    column
                )

        elif isinstance(
            item,
            str,
        ):

            identifier_columns.append(
                item
            )

    return list(
        dict.fromkeys(
            identifier_columns
        )
    )


# ============================================================
# EXTRA IDENTIFIER SAFETY
# ============================================================

def detect_obvious_identifiers(
    df,
):
    """
    Additional protection against high-cardinality
    customer/entity identifiers reaching OneHotEncoder.

    This is deliberately conservative.
    """

    identifiers = []

    patterns = {
        "customerid",
        "userid",
        "accountid",
        "subscriberid",
        "memberid",
        "policyid",
        "transactionid",
        "interactionid",
        "deviceid",
        "recordid",
    }

    for column in df.columns:

        normalized = normalize_column_name(
            column
        )

        if normalized in patterns:

            identifiers.append(
                column
            )

    return identifiers


# ============================================================
# TRAIN / TEST SPLIT
# ============================================================

def create_train_test_split(
    df,
    target_column,
    test_size=0.20,
    random_state=42,
):
    """
    Create reproducible train/test split.

    Stratification is used when possible.
    """

    X = df.drop(
        columns=[
            target_column
        ]
    )

    y = df[target_column]

    stratify = None

    try:

        class_counts = (
            y.value_counts(
                dropna=False
            )
        )

        if (
            len(class_counts) >= 2
            and class_counts.min() >= 2
        ):

            stratify = y

    except Exception:

        stratify = None

    return train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )


# ============================================================
# SAVE JSON
# ============================================================

def save_json(
    path,
    data,
):

    path = Path(
        path
    )

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with open(
        path,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            data,
            file,
            indent=4,
            default=str,
        )


# ============================================================
# MAIN PREPROCESSING PIPELINE
# ============================================================

def run_preprocessing(
    input_file,
    target_column=None,
    metadata_file=DEFAULT_METADATA_FILE,
    output_train=DEFAULT_TRAIN_FILE,
    output_test=DEFAULT_TEST_FILE,
):
    """
    Run MINE Phase 2 preprocessing.

    Compatible with main.py:

        run_preprocessing(
            input_file=input_file,
            target_column=target_column,
        )
    """

    print()
    print(
        "=" * 70
    )
    print(
        "PHASE 2 - PREPROCESSING"
    )
    print(
        "=" * 70
    )

    # ========================================================
    # STEP 1 - LOAD DATA
    # ========================================================

    print()
    print(
        "[STEP 1] Loading dataset"
    )

    input_path = Path(
        input_file
    )

    if not input_path.exists():

        raise FileNotFoundError(
            f"Input dataset not found: "
            f"{input_file}"
        )

    df = pd.read_csv(
        input_path
    )

    if df.empty:

        raise ValueError(
            "Input dataset is empty."
        )

    print(
        f"  Input: {input_file}"
    )

    print(
        f"  Rows: {len(df)}"
    )

    print(
        f"  Columns: {len(df.columns)}"
    )

    # ========================================================
    # STEP 2 - TARGET
    # ========================================================

    print()
    print(
        "[STEP 2] Target detection"
    )

    target_column = resolve_target_column(
        df,
        requested_target=target_column,
    )

    validate_target(
        df,
        target_column,
    )

    print(
        f"  Target: {target_column}"
    )

    target_distribution = (
        analyze_target_distribution(
            df,
            target_column,
        )
    )

    print(
        "  Target classes:"
    )

    for cls, info in (
        target_distribution[
            "classes"
        ].items()
    ):

        print(
            f"    {cls}: "
            f"{info['count']} "
            f"({info['percentage']}%)"
        )

    # ========================================================
    # STEP 3 - IDENTIFIER DETECTION
    # ========================================================

    print()
    print(
        "[STEP 3] Identifier detection"
    )

    identifier_results = (
        detect_identifier_columns(
            df,
            target_column,
        )
    )

    identifier_columns = (
        extract_identifier_columns(
            identifier_results
        )
    )

    # Additional explicit safety layer
    obvious_identifiers = (
        detect_obvious_identifiers(
            df
        )
    )

    for column in obvious_identifiers:

        if column not in identifier_columns:

            identifier_columns.append(
                column
            )

    # Target cannot be an identifier
    identifier_columns = [
        column
        for column in identifier_columns
        if column != target_column
    ]

    print(
        f"  Identifiers detected: "
        f"{len(identifier_columns)}"
    )

    if identifier_columns:

        for column in identifier_columns:

            print(
                f"    - {column}"
            )

    else:

        print(
            "    None"
        )

    # ========================================================
    # STEP 4 - CANDIDATE FEATURES
    # ========================================================

    print()
    print(
        "[STEP 4] Candidate feature detection"
    )

    candidate_features = detect_features(
        df,
        target_column,
        identifier_results,
    )

    # Remove identifiers again as a safety layer
    candidate_features = [
        feature
        for feature in candidate_features
        if feature not in identifier_columns
        and feature != target_column
    ]

    print(
        f"  Candidate features: "
        f"{len(candidate_features)}"
    )

    # ========================================================
    # STEP 5 - FEATURE ANALYSIS
    # ========================================================

    print()
    print(
        "[STEP 5] Feature analysis"
    )

    feature_analysis = analyze_features(
        df,
        target_column,
        candidate_features,
    )

    print(
        f"  Features analyzed: "
        f"{len(feature_analysis)}"
    )

    # ========================================================
    # STEP 6 - TARGET LEAKAGE
    # ========================================================

    print()
    print(
        "[STEP 6] Target leakage detection"
    )

    leakage_results = (
        detect_potential_leakage(
            df=df,
            target_column=target_column,
            feature_columns=candidate_features,
        )
    )

    leakage_columns = []

    for result in leakage_results:

        column = result.get(
            "feature"
        )

        if column is not None:

            leakage_columns.append(
                column
            )

    leakage_columns = list(
        dict.fromkeys(
            leakage_columns
        )
    )

    if leakage_columns:

        print(
            "  Target-derived / leakage "
            "features excluded:"
        )

        for column in leakage_columns:

            print(
                f"    - {column}"
            )

    else:

        print(
            "  No target-derived features detected."
        )

    # ========================================================
    # STEP 7 - FINAL FEATURE SELECTION
    # ========================================================

    print()
    print(
        "[STEP 7] Final feature selection"
    )

    excluded_columns = set(
        identifier_columns
        + leakage_columns
        + [target_column]
    )

    selected_features = [
        result["feature"]
        for result in feature_analysis
        if (
            result["decision"] != "DROP"
            and result["feature"]
            not in excluded_columns
        )
    ]

    # Remove duplicates
    selected_features = list(
        dict.fromkeys(
            selected_features
        )
    )

    # Final existence check
    selected_features = [
        feature
        for feature in selected_features
        if feature in df.columns
    ]

    if not selected_features:

        raise ValueError(
            "No usable model features remain "
            "after identifier and leakage filtering."
        )

    print(
        f"  Final selected features: "
        f"{len(selected_features)}"
    )

    print(
        "  Selected:"
    )

    for feature in selected_features:

        print(
            f"    - {feature}"
        )

    # ========================================================
    # CRITICAL SAFETY CHECK
    # ========================================================

    forbidden = (
        set(identifier_columns)
        | set(leakage_columns)
        | {target_column}
    )

    violations = [
        feature
        for feature in selected_features
        if feature in forbidden
    ]

    if violations:

        raise RuntimeError(
            "LEAKAGE SAFETY CHECK FAILED. "
            f"Forbidden features remain: "
            f"{violations}"
        )

    print()
    print(
        "  Leakage safety check: PASSED"
    )

    # ========================================================
    # STEP 8 - FEATURE ANALYSIS AFTER FILTERING
    # ========================================================

    selected_feature_analysis = [
        result
        for result in feature_analysis
        if result["feature"]
        in selected_features
    ]

    # ========================================================
    # STEP 9 - REDUNDANCY
    # ========================================================

    print()
    print(
        "[STEP 8] Redundancy analysis"
    )

    redundancy_analysis = (
        detect_redundant_features(
            df,
            selected_features,
        )
    )

    print(
        f"  Redundant feature pairs: "
        f"{len(redundancy_analysis)}"
    )

    # ========================================================
    # STEP 10 - WARNINGS
    # ========================================================

    print()
    print(
        "[STEP 9] Data-quality warnings"
    )

    data_warnings = (
        generate_data_warnings(
            df,
            target_column,
            selected_feature_analysis,
            identifier_columns,
        )
    )

    print(
        f"  Warnings generated: "
        f"{len(data_warnings)}"
    )

    for warning in data_warnings:

        print(
            f"  [{warning['severity']}] "
            f"{warning['type']}: "
            f"{warning['message']}"
        )

    # ========================================================
    # STEP 11 - DATA PROFILE
    # ========================================================

    print()
    print(
        "[STEP 10] Dataset profiling"
    )

    data_profile = profile_dataset(
        df
    )

    # ========================================================
    # STEP 12 - CREATE CLEAN DATASET
    # ========================================================

    print()
    print(
        "[STEP 11] Creating clean dataset"
    )

    clean_dataset = df[
        selected_features
        + [target_column]
    ].copy()

    clean_dataset_path = Path(
        DEFAULT_CLEAN_DATASET_FILE
    )

    clean_dataset_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    clean_dataset.to_csv(
        clean_dataset_path,
        index=False,
    )

    print(
        f"  Clean dataset saved: "
        f"{clean_dataset_path}"
    )

    # ========================================================
    # STEP 13 - TRAIN TEST SPLIT
    # ========================================================

    print()
    print(
        "[STEP 12] Train/test split"
    )

    (
        X_train,
        X_test,
        y_train,
        y_test,
    ) = create_train_test_split(
        clean_dataset,
        target_column,
        test_size=0.20,
        random_state=42,
    )

    print(
        f"  TRAIN rows: "
        f"{len(X_train)}"
    )

    print(
        f"  TEST rows: "
        f"{len(X_test)}"
    )

    # ========================================================
    # STEP 14 - SAVE ORIGINAL TEST
    # ========================================================

    original_test = X_test.copy()

    original_test[
        target_column
    ] = y_test.values

    original_test_path = Path(
        DEFAULT_ORIGINAL_TEST_FILE
    )

    original_test_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    original_test.to_csv(
        original_test_path,
        index=False,
    )

    # ========================================================
    # STEP 15 - BUILD PREPROCESSOR
    # ========================================================

    print()
    print(
        "[STEP 13] Building preprocessing transformer"
    )

    (
        preprocessor,
        numerical_columns,
        categorical_columns,
    ) = build_preprocessor(
        X_train,
        selected_features,
    )

    print(
        f"  Numerical columns: "
        f"{len(numerical_columns)}"
    )

    print(
        f"  Categorical columns: "
        f"{len(categorical_columns)}"
    )

    # ========================================================
    # STEP 16 - TRANSFORM
    # ========================================================

    print()
    print(
        "[STEP 14] Transforming model data"
    )

    X_train_transformed = (
        preprocessor.fit_transform(
            X_train
        )
    )

    X_test_transformed = (
        preprocessor.transform(
            X_test
        )
    )
        # ========================================================
    # SAVE FITTED PREPROCESSOR
    # ========================================================

    preprocessor_path = Path(
        "models/preprocessor.joblib"
    )

    preprocessor_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    joblib.dump(
        preprocessor,
        preprocessor_path,
    )

    print(
        f"  Fitted preprocessor saved: "
        f"{preprocessor_path}"
    )

    print(
        f"  Model-ready TRAIN: "
        f"{X_train_transformed.shape}"
    )

    print(
        f"  Model-ready TEST: "
        f"{X_test_transformed.shape}"
    )

    # ========================================================
    # FEATURE EXPLOSION CHECK
    # ========================================================

    processed_feature_count = (
        X_train_transformed.shape[1]
    )

    print()
    print(
        "[FEATURE EXPLOSION CHECK]"
    )

    print(
        f"  Processed features: "
        f"{processed_feature_count}"
    )

    if processed_feature_count > 10000:

        print()
        print(
            "  WARNING: processed feature count "
            "is above 10,000."
        )

        print(
            "  Inspect high-cardinality categorical "
            "features."
        )

    else:

        print(
            "  PASSED"
        )

    # ========================================================
    # STEP 17 - FEATURE NAMES
    # ========================================================

    print()
    print(
        "[STEP 15] Getting processed feature names"
    )

    try:

        processed_feature_names = (
            preprocessor
            .get_feature_names_out()
            .tolist()
        )

    except Exception:

        processed_feature_names = [
            f"feature_{i}"
            for i in range(
                processed_feature_count
            )
        ]

    # --------------------------------------------------------
    # Final check for CustomerID encoded columns
    # --------------------------------------------------------

    id_encoded_features = [
        name
        for name in processed_feature_names
        if "customerid" in normalize_column_name(
            name
        )
    ]

    if id_encoded_features:

        raise RuntimeError(
            "IDENTIFIER ENCODING DETECTED. "
            "Customer/entity identifiers reached "
            "the OneHotEncoder."
        )

    print(
        "  Identifier encoding check: PASSED"
    )

    # ========================================================
    # STEP 18 - MODEL-READY DATAFRAMES
    # ========================================================

    train_model_ready = pd.DataFrame(
        np.asarray(
            X_train_transformed.toarray()
            if hasattr(
                X_train_transformed,
                "toarray"
            )
            else X_train_transformed
        ),
        columns=processed_feature_names,
    )

    test_model_ready = pd.DataFrame(
        np.asarray(
            X_test_transformed.toarray()
            if hasattr(
                X_test_transformed,
                "toarray"
            )
            else X_test_transformed
        ),
        columns=processed_feature_names,
    )

    train_model_ready[
        target_column
    ] = y_train.values

    test_model_ready[
        target_column
    ] = y_test.values

    # ========================================================
    # STEP 19 - SAVE MODEL-READY DATA
    # ========================================================

    print()
    print(
        "[STEP 16] Saving model-ready datasets"
    )

    train_path = Path(
        output_train
    )

    test_path = Path(
        output_test
    )

    train_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    test_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    train_model_ready.to_csv(
        train_path,
        index=False,
    )

    test_model_ready.to_csv(
        test_path,
        index=False,
    )

    print(
        f"  TRAIN: {train_path}"
    )

    print(
        f"  TEST: {test_path}"
    )

    # ========================================================
    # STEP 20 - METADATA
    # ========================================================

    print()
    print(
        "[STEP 17] Saving preprocessing metadata"
    )

    metadata = {

        "input_file": str(
            input_file
        ),

        "dataset": {
            "rows": int(
                df.shape[0]
            ),
            "columns": int(
                df.shape[1]
            ),
        },

        "target": {
            "column": target_column
        },

        "identifiers": identifier_results,

        "candidate_features": candidate_features,

        "selected_features": selected_features,

        "feature_analysis": feature_analysis,

        "data_warnings": data_warnings,

        "redundancy_analysis": redundancy_analysis,

        "leakage_analysis": leakage_results,

        "leakage_excluded_features": leakage_columns,

        "numerical_columns": numerical_columns,

        "categorical_columns": categorical_columns,

        "processed_features": {
            "count": int(
                len(
                    processed_feature_names
                )
            ),
            "names": processed_feature_names,
        },

        "split": {
            "train_rows": int(
                len(X_train)
            ),
            "test_rows": int(
                len(X_test)
            ),
            "test_size": 0.20,
            "random_state": 42,
        },

        "output_files": {
            "train": str(
                train_path
            ),
            "test": str(
                test_path
            ),
            "original_test": (
                DEFAULT_ORIGINAL_TEST_FILE
            ),
            "clean_dataset": (
                DEFAULT_CLEAN_DATASET_FILE
            ),
        },
    }

    save_json(
        metadata_file,
        metadata,
    )

    # ========================================================
    # FEATURE METADATA
    # ========================================================

    save_json(
        DEFAULT_FEATURE_METADATA_FILE,
        metadata,
    )

    # ========================================================
    # DATA PROFILE
    # ========================================================

    save_json(
        DEFAULT_PROFILE_FILE,
        data_profile,
    )

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    print()
    print(
        "=" * 70
    )

    print(
        "PHASE 2 - PREPROCESSING COMPLETED"
    )

    print(
        "=" * 70
    )

    print(
        f"Input rows: "
        f"{len(df)}"
    )

    print(
        f"Input columns: "
        f"{len(df.columns)}"
    )

    print(
        f"Target: "
        f"{target_column}"
    )

    print(
        f"Identifiers removed: "
        f"{len(identifier_columns)}"
    )

    print(
        f"Leakage features removed: "
        f"{len(leakage_columns)}"
    )

    print(
        f"Final original features: "
        f"{len(selected_features)}"
    )

    print(
        f"Processed features: "
        f"{processed_feature_count}"
    )

    print(
        f"TRAIN: "
        f"{X_train.shape}"
    )

    print(
        f"TEST: "
        f"{X_test.shape}"
    )

    print()
    print(
        "Generated:"
    )

    print(
        f"  {train_path}"
    )

    print(
        f"  {test_path}"
    )

    print(
        f"  {DEFAULT_ORIGINAL_TEST_FILE}"
    )

    print(
        f"  {metadata_file}"
    )

    print(
        f"  {DEFAULT_FEATURE_METADATA_FILE}"
    )

    print(
        f"  {DEFAULT_PROFILE_FILE}"
    )

    print(
        f"  {DEFAULT_CLEAN_DATASET_FILE}"
    )

    print(
        "=" * 70
    )

    return {
        "target_column": target_column,
        "identifier_columns": identifier_columns,
        "candidate_features": candidate_features,
        "selected_features": selected_features,
        "leakage_columns": leakage_columns,
        "feature_analysis": feature_analysis,
        "train_shape": X_train_transformed.shape,
        "test_shape": X_test_transformed.shape,
        "processed_features": processed_feature_names,
        "metadata": metadata,
    }


# ============================================================
# DIRECT EXECUTION
# ============================================================

if __name__ == "__main__":

    run_preprocessing(
        input_file="data/processed/integrated_dataset.csv",
        target_column=None,
    )