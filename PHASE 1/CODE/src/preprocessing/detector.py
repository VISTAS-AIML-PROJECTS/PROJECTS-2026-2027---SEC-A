import re
import pandas as pd


TARGET_NAMES = [
    "target",
    "churn",
    "churned",
    "churn_status",
    "is_churn",
    "customer_churn",
    "exited",
    "attrition",
    "default",
    "fraud",
    "label",
    "outcome",
    "response"
]


ID_NAME_PATTERNS = [
    r"(^|_)id($|_)",
    r"identifier",
    r"customer[_ ]?number",
    r"account[_ ]?number",
    r"transaction[_ ]?number",
    r"record[_ ]?number"
]


def normalize_column_name(column):
    return (
        str(column)
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
    )


def detect_target(df):
    """
    Detect the most likely target column.

    Priority:
    1. Strong target-like column names.
    2. Binary columns if exactly one strong candidate exists.

    Returns:
        target_column or None
    """

    # ---------------------------------------
    # 1. Name-based target detection
    # ---------------------------------------

    for column in df.columns:

        normalized = normalize_column_name(column)

        for target_name in TARGET_NAMES:

            if (
                normalized == target_name
                or normalized.endswith("_" + target_name)
                or normalized.startswith(target_name + "_")
            ):
                return column

    # ---------------------------------------
    # 2. Binary-column fallback
    # ---------------------------------------

    binary_candidates = []

    for column in df.columns:

        unique_values = df[column].dropna().unique()

        if len(unique_values) == 2:
            binary_candidates.append(column)

    if len(binary_candidates) == 1:
        return binary_candidates[0]

    return None


def _is_id_like_name(column):
    """
    Detect whether the column name resembles an identifier.

    This is only ONE signal.
    It is never enough by itself to remove a feature.
    """

    normalized = normalize_column_name(column)

    for pattern in ID_NAME_PATTERNS:

        if re.search(pattern, normalized):
            return True

    return False


def _looks_like_sequential_identifier(series):
    """
    Detect values that behave like row/record identifiers.

    Example:
        1,2,3,4,5...
        C001,C002,C003...
    """

    values = series.dropna()

    if len(values) < 3:
        return False

    # Numeric sequential pattern
    if pd.api.types.is_numeric_dtype(values):

        numeric = values.astype(float)

        differences = numeric.diff().dropna()

        if len(differences) > 0:

            if (
                differences.nunique() == 1
                and differences.iloc[0] != 0
            ):
                return True

    # String sequential pattern
    strings = values.astype(str)

    extracted_numbers = []

    for value in strings:

        match = re.search(r"(\d+)$", value)

        if not match:
            return False

        extracted_numbers.append(int(match.group(1)))

    if len(extracted_numbers) >= 3:

        differences = pd.Series(
            extracted_numbers
        ).diff().dropna()

        if (
            differences.nunique() == 1
            and differences.iloc[0] != 0
        ):
            return True

    return False


def _has_identifier_format(series):
    """
    Detect common identifier formats such as:

        C001
        C002
        C003

    This is a supporting signal, not a standalone rule.
    """

    values = series.dropna().astype(str)

    if len(values) == 0:
        return False

    pattern_matches = values.str.match(
        r"^[A-Za-z]{1,5}[-_]?\d{2,}$"
    )

    return pattern_matches.mean() >= 0.8


def detect_identifier_columns(df, target_column=None):
    """
    Identify identifier-like columns using multiple signals.

    IMPORTANT:
    High uniqueness alone does NOT make a column an identifier.

    Returns:
        list of dictionaries containing evidence.
    """

    results = []

    for column in df.columns:

        if column == target_column:
            continue

        series = df[column]

        non_null = series.dropna()

        if len(non_null) == 0:
            continue

        uniqueness_ratio = (
            non_null.nunique() / len(non_null)
        )

        name_signal = _is_id_like_name(column)

        sequential_signal = (
            _looks_like_sequential_identifier(series)
        )

        format_signal = (
            _has_identifier_format(series)
        )

        score = 0
        reasons = []

        # Strong uniqueness
        if uniqueness_ratio >= 0.98:
            score += 1
            reasons.append(
                "very high uniqueness"
            )

        # ID-like column name
        if name_signal:
            score += 2
            reasons.append(
                "identifier-like column name"
            )

        # Sequential behavior
        if sequential_signal:
            score += 2
            reasons.append(
                "sequential identifier pattern"
            )

        # Identifier string format
        if format_signal:
            score += 2
            reasons.append(
                "identifier-like value format"
            )

        # Only classify when multiple pieces
        # of evidence support the decision.
        is_identifier = score >= 3

        if is_identifier:

            results.append(
                {
                    "column": column,
                    "uniqueness_ratio": round(
                        uniqueness_ratio, 4
                    ),
                    "score": score,
                    "reasons": reasons
                }
            )

    return results


def detect_features(
    df,
    target_column,
    identifier_results
):
    """
    Return columns that are eligible for feature analysis.

    The target and high-confidence identifiers are excluded.
    Other columns remain candidates.
    """

    identifiers = {
        item["column"]
        for item in identifier_results
    }

    excluded = identifiers.copy()

    if target_column:
        excluded.add(target_column)

    features = [
        column
        for column in df.columns
        if column not in excluded
    ]

    return features