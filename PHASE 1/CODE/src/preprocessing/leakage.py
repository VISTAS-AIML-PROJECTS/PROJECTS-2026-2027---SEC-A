

import re


# ============================================================
# TARGET-DERIVED / POST-OUTCOME FEATURE DETECTION
# ============================================================

TARGET_DERIVED_PATTERNS = [
    # Direct target representations
    r"^churn$",
    r"^churn[_\s-]?label$",
    r"^churn[_\s-]?value$",
    r"^churn[_\s-]?flag$",
    r"^churn[_\s-]?target$",
    r"^churned$",

    # Post-outcome information
    r"^churn[_\s-]?reason$",
    r"^churn[_\s-]?category$",
    r"^customer[_\s-]?status$",

    # Existing / external prediction scores
    r"^churn[_\s-]?score$",
    r"^churn[_\s-]?risk$",
    r"^churn[_\s-]?probability$",
    r"^churn[_\s-]?prediction$",
]


def normalize_column_name(column):
    """
    Normalize a column name for robust comparison.
    """

    return (
        str(column)
        .strip()
        .lower()
        .replace("_", "")
        .replace("-", "")
        .replace(" ", "")
    )


def is_target_derived_feature(
    column,
    target_column
):
    """
    Determine whether a feature is directly derived from,
    represents, or occurs after the target outcome.

    This is intentionally based on semantic column names
    rather than dataset-specific hardcoding.
    """

    normalized_column = normalize_column_name(
        column
    )

    normalized_target = normalize_column_name(
        target_column
    )

    # --------------------------------------------------------
    # Never treat the actual target as a feature
    # --------------------------------------------------------

    if normalized_column == normalized_target:

        return True

    # --------------------------------------------------------
    # Generic normalized target match
    # --------------------------------------------------------

    if normalized_target == "churn":

        if normalized_column in {
            "churn",
            "churnlabel",
            "churnvalue",
            "churnflag",
            "churntarget",
            "churned",
            "customerstatus",
            "churnreason",
            "churncategory",
            "churnscore",
            "churnrisk",
            "churnprobability",
            "churnprediction",
        }:

            return True

    # --------------------------------------------------------
    # Generic churn-derived fields
    # --------------------------------------------------------

    if normalized_column.startswith("churn"):

        derived_terms = (
            "reason",
            "category",
            "score",
            "risk",
            "probability",
            "prediction",
            "label",
            "value",
            "flag",
            "target",
        )

        if any(
            term in normalized_column
            for term in derived_terms
        ):

            return True

    # --------------------------------------------------------
    # Customer status is commonly post-outcome
    # --------------------------------------------------------

    if normalized_column in {
        "customerstatus",
        "customerchurnstatus",
    }:

        return True

    return False


# ============================================================
# PUBLIC API
# ============================================================

def detect_potential_leakage(
    df,
    target_column,
    feature_columns=None
):
    """
    Detect potential target leakage.

    Returns a list of dictionaries describing suspicious
    columns.
    """

    if feature_columns is None:

        feature_columns = list(
            df.columns
        )

    leakage_results = []

    for column in feature_columns:

        if column not in df.columns:

            continue

        if is_target_derived_feature(
            column,
            target_column
        ):

            leakage_results.append(
                {
                    "feature": column,
                    "reason": (
                        "Feature appears to represent "
                        "the target, a target-derived "
                        "outcome, or an externally "
                        "generated churn prediction."
                    ),
                    "severity": "HIGH",
                    "decision": "DROP",
                }
            )

    return leakage_results