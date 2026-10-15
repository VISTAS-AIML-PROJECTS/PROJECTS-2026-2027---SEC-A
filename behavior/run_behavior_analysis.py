import json
import os

import pandas as pd

from src.preprocessing.detector import (
    detect_identifier_columns,
    detect_features
)

from src.preprocessing.leakage import (
    detect_potential_leakage
)

from src.behavior.behavior_analyzer import (
    analyze_churn_behavior
)


# --------------------------------------------------
# FILE PATHS
# --------------------------------------------------

INPUT_FILE = (
    "data/input/clean_dataset.csv"
)

METADATA_FILE = (
    "data/metadata/feature_metadata.json"
)

OUTPUT_DIR = (
    "data/behavior"
)


# --------------------------------------------------
# TARGET RESOLUTION
# --------------------------------------------------

def resolve_target_column(
    df,
    metadata_target
):
    """
    Resolve the target column against the actual dataframe.

    The metadata may contain the original target name while
    preprocessing/integration may normalize or rename the
    column.

    Resolution order:
        1. Exact match
        2. Case-insensitive match
        3. Whitespace-normalized match
        4. Generic churn-related matching

    This keeps Phase 7 independent of a specific dataset.
    """

    # --------------------------------------------------
    # Basic validation
    # --------------------------------------------------

    if not isinstance(metadata_target, str):
        raise ValueError(
            "Target column in metadata must be a string."
        )

    metadata_target = metadata_target.strip()

    if not metadata_target:
        raise ValueError(
            "Target column from metadata is empty."
        )

    # --------------------------------------------------
    # 1. EXACT MATCH
    # --------------------------------------------------

    if metadata_target in df.columns:

        return metadata_target

    # --------------------------------------------------
    # 2. CASE-INSENSITIVE MATCH
    # --------------------------------------------------

    case_matches = [
        column
        for column in df.columns
        if str(column).strip().lower()
        == metadata_target.lower()
    ]

    if len(case_matches) == 1:

        return case_matches[0]

    if len(case_matches) > 1:

        raise ValueError(
            "Multiple case-insensitive target matches found: "
            f"{case_matches}"
        )

    # --------------------------------------------------
    # 3. WHITESPACE / NORMALIZED MATCH
    # --------------------------------------------------

    def normalize_column_name(name):

        return (
            str(name)
            .strip()
            .lower()
            .replace("_", "")
            .replace("-", "")
            .replace(" ", "")
        )

    normalized_target = (
        normalize_column_name(
            metadata_target
        )
    )

    normalized_matches = [
        column
        for column in df.columns
        if normalize_column_name(column)
        == normalized_target
    ]

    if len(normalized_matches) == 1:

        return normalized_matches[0]

    if len(normalized_matches) > 1:

        raise ValueError(
            "Multiple normalized target matches found: "
            f"{normalized_matches}"
        )

    # --------------------------------------------------
    # 4. GENERIC CHURN TARGET RESOLUTION
    # --------------------------------------------------

    # Only use this fallback when the metadata itself
    # indicates that this is a churn problem.

    target_is_churn = (
        "churn" in metadata_target.lower()
    )

    if target_is_churn:

        churn_columns = [
            column
            for column in df.columns
            if "churn" in str(column).lower()
        ]

        # --------------------------------------------------
        # Remove obvious non-target churn columns where
        # possible.
        #
        # This is deliberately generic. We do not reference
        # IBM-specific column names here.
        # --------------------------------------------------

        outcome_keywords = (
            "reason",
            "category",
            "score",
            "status",
            "prediction",
            "probability",
            "risk"
        )

        preferred_matches = [
            column
            for column in churn_columns
            if not any(
                keyword in str(column).lower()
                for keyword in outcome_keywords
            )
        ]

        # --------------------------------------------------
        # Prefer an exact "churn"-style field if available.
        # --------------------------------------------------

        exact_churn_matches = [
            column
            for column in preferred_matches
            if normalize_column_name(column)
            in {
                "churn",
                "churnlabel",
                "churnflag",
                "churntarget",
                "churned"
            }
        ]

        if len(exact_churn_matches) == 1:

            return exact_churn_matches[0]

        # --------------------------------------------------
        # If only one reasonable churn field exists,
        # use it.
        # --------------------------------------------------

        if len(preferred_matches) == 1:

            return preferred_matches[0]

    # --------------------------------------------------
    # TARGET COULD NOT BE RESOLVED
    # --------------------------------------------------

    churn_related_columns = [
        column
        for column in df.columns
        if "churn" in str(column).lower()
    ]

    raise ValueError(
        "\nTarget column could not be resolved.\n"
        f"Metadata target: '{metadata_target}'\n"
        f"Available columns: {df.columns.tolist()}\n"
        f"Churn-related columns: {churn_related_columns}"
    )


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def run_behavior_analysis():

    os.makedirs(
        OUTPUT_DIR,
        exist_ok=True
    )

    # --------------------------------------------------
    # 1. LOAD DATA
    # --------------------------------------------------

    if not os.path.exists(INPUT_FILE):

        raise FileNotFoundError(
            f"Behavior analysis input file was not found: "
            f"{INPUT_FILE}"
        )

    df = pd.read_csv(
        INPUT_FILE
    )

    if df.empty:

        raise ValueError(
            f"Behavior analysis input file is empty: "
            f"{INPUT_FILE}"
        )

    print()
    print(
        "[PHASE 7] Loaded behavior dataset"
    )

    print(
        f"Rows: {len(df)}"
    )

    print(
        f"Columns: {len(df.columns)}"
    )

    # --------------------------------------------------
    # 2. LOAD METADATA
    # --------------------------------------------------

    if not os.path.exists(METADATA_FILE):

        raise FileNotFoundError(
            f"Feature metadata file was not found: "
            f"{METADATA_FILE}"
        )

    with open(
        METADATA_FILE,
        "r"
    ) as f:

        metadata = json.load(f)

    # --------------------------------------------------
    # 3. READ TARGET FROM METADATA
    # --------------------------------------------------

    try:

        metadata_target = (
            metadata[
                "target"
            ][
                "column"
            ]
        )

    except (
        KeyError,
        TypeError
    ) as exc:

        raise ValueError(
            "Could not read target column from "
            f"{METADATA_FILE}. Expected structure: "
            "{'target': {'column': '...'}}"
        ) from exc

    # --------------------------------------------------
    # 4. RESOLVE ACTUAL TARGET COLUMN
    # --------------------------------------------------

    original_target = metadata_target

    target_column = resolve_target_column(
        df,
        metadata_target
    )

    print()
    print(
        "Target resolution:"
    )

    print(
        f"  Metadata target : {original_target}"
    )

    print(
        f"  Actual dataframe: {target_column}"
    )

    if original_target != target_column:

        print(
            "  Target name was normalized/resolved "
            "to the actual dataframe column."
        )

    # --------------------------------------------------
    # 5. DETECT IDENTIFIERS
    # --------------------------------------------------

    identifier_results = (
        detect_identifier_columns(
            df,
            target_column
        )
    )

    # --------------------------------------------------
    # 6. DETECT FEATURES
    # --------------------------------------------------

    feature_columns = detect_features(
        df,
        target_column,
        identifier_results
    )

    # --------------------------------------------------
    # SAFETY: REMOVE TARGET FROM FEATURES
    # --------------------------------------------------

    feature_columns = [
        feature
        for feature in feature_columns
        if feature != target_column
    ]

    if not feature_columns:

        raise ValueError(
            "No usable feature columns were found "
            f"for behavior analysis. Target: "
            f"'{target_column}'"
        )

    print()
    print(
        f"Behavior features: {len(feature_columns)}"
    )

    # --------------------------------------------------
    # 7. ANALYZE CHURN BEHAVIOUR
    # --------------------------------------------------

    behavior = analyze_churn_behavior(

        df=df,

        feature_columns=feature_columns,

        target_column=target_column
    )

    # --------------------------------------------------
    # 8. SAVE JSON
    # --------------------------------------------------

    output_file = os.path.join(
        OUTPUT_DIR,
        "churn_behavior.json"
    )

    with open(
        output_file,
        "w"
    ) as f:

       json.dump(
           behavior,
           f,
           indent=4,
           default=lambda obj: obj.item() if hasattr(obj, "item") else str(obj)
       )
    # --------------------------------------------------
    # 9. DISPLAY SUMMARY
    # --------------------------------------------------

    print()

    print(
        "PHASE 7 - CHURN BEHAVIOUR ANALYSIS COMPLETED"
    )

    print(
        "----------------------------------------------"
    )

    print(
        f"Target: {target_column}"
    )

    print(
        f"Positive class: "
        f"{behavior['positive_class']}"
    )

    print(
        f"Rows analyzed: "
        f"{behavior['overall']['total_rows']}"
    )

    print(
        f"Positive-class rate: "
        f"{behavior['overall']['positive_rate'] * 100:.2f}%"
    )

    print()

    print(
        "TOP BEHAVIOURAL PATTERNS"
    )

    print(
        "-------------------------"
    )

    for pattern in behavior[
        "top_patterns"
    ]:

        print(
            f"- {pattern['description']}"
        )

    print()

    print(
        "RELIABILITY WARNINGS"
    )

    print(
        "--------------------"
    )

    if behavior[
        "reliability_warnings"
    ]:

        for warning in behavior[
            "reliability_warnings"
        ]:

            print(
                f"[{warning['severity']}] "
                f"{warning['message']}"
            )

    else:

        print(
            "No major reliability warnings."
        )

    print()

    print(
        "Saved:"
    )

    print(
        output_file
    )

    print()

    return behavior


# --------------------------------------------------
# RUN
# --------------------------------------------------

if __name__ == "__main__":

    run_behavior_analysis()