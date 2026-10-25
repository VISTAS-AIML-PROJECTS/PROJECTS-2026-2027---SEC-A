import pandas as pd

from src.preprocessing.dtypes import (
    get_categorical_columns,
    get_numerical_columns
)


def analyze_target_distribution(
    df,
    target_column
):
    """
    Analyze the distribution of the target.
    """

    target = df[target_column]

    counts = target.value_counts(
        dropna=False
    )

    percentages = (
        target.value_counts(
            normalize=True,
            dropna=False
        ) * 100
    )

    result = {
        "target": target_column,
        "classes": {},
        "class_count": int(
            target.nunique(
                dropna=True
            )
        )
    }

    for value in counts.index:

        result["classes"][str(value)] = {
            "count": int(
                counts[value]
            ),
            "percentage": round(
                float(percentages[value]),
                2
            )
        }

    return result


def generate_data_warnings(
    df,
    target_column,
    feature_analysis,
    identifier_columns=None
):
    """
    Generate warnings about suspicious,
    unreliable, or potentially problematic
    patterns in the dataset.

    Identifier columns are explicitly excluded
    from feature-level diagnostics.
    """

    warnings = []

    # -----------------------------------------
    # Identifier protection
    # -----------------------------------------

    if identifier_columns is None:
        identifier_columns = []

    identifier_columns = set(
        identifier_columns
    )

    # -----------------------------------------
    # Dataset size
    # -----------------------------------------

    if len(df) < 100:

        warnings.append({
            "type": "SMALL_DATASET",
            "severity": "HIGH",
            "message": (
                f"The dataset contains only "
                f"{len(df)} rows. "
                "Feature associations and model "
                "performance may be unstable."
            )
        })

    # -----------------------------------------
    # Target balance
    # -----------------------------------------

    target_distribution = (
        df[target_column]
        .value_counts(
            normalize=True
        )
    )

    if len(target_distribution) >= 2:

        smallest_class = (
            target_distribution.min()
        )

        if smallest_class < 0.20:

            warnings.append({
                "type": "CLASS_IMBALANCE",
                "severity": "MEDIUM",
                "message": (
                    "The target classes are "
                    "imbalanced. Accuracy alone "
                    "may be misleading."
                )
            })

    # -----------------------------------------
    # Only inspect actual candidate features
    # -----------------------------------------

    feature_columns = [
        result["feature"]
        for result in feature_analysis
        if result["feature"]
        not in identifier_columns
    ]

    # -----------------------------------------
    # Categorical feature diagnostics
    # -----------------------------------------

    categorical_columns = get_categorical_columns(
        df,
        feature_columns
    )

    for column in categorical_columns:

        if column == target_column:
            continue

        table = pd.crosstab(
            df[column],
            df[target_column],
            normalize="index"
        )

        for category in table.index:

            maximum_rate = table.loc[
                category
            ].max()

            if maximum_rate >= 0.95:

                warnings.append({
                    "type":
                        "STRONG_TARGET_SEPARATION",

                    "severity":
                        "HIGH",

                    "column":
                        column,

                    "category":
                        str(category),

                    "message": (
                        f"Category '{category}' "
                        f"in '{column}' is strongly "
                        "associated with one target "
                        "class. Validate this relationship "
                        "for possible leakage, sampling "
                        "bias, or dataset-specific patterns."
                    )
                })

                break

    # -----------------------------------------
    # Numerical feature diagnostics
    # -----------------------------------------

    numeric_columns = get_numerical_columns(
        df,
        feature_columns
    )

    if df[target_column].nunique(
        dropna=True
    ) == 2:

        for column in numeric_columns:

            if column == target_column:
                continue

            group_means = (
                df.groupby(
                    target_column
                )[column]
                .mean()
            )

            if len(group_means) != 2:
                continue

            mean_1 = group_means.iloc[0]
            mean_2 = group_means.iloc[1]

            overall_mean = df[column].mean()

            if pd.isna(
                overall_mean
            ) or overall_mean == 0:
                continue

            relative_difference = (
                abs(mean_1 - mean_2)
                / abs(overall_mean)
            )

            if relative_difference >= 0.75:

                warnings.append({
                    "type":
                        "STRONG_NUMERIC_SEPARATION",

                    "severity":
                        "MEDIUM",

                    "column":
                        column,

                    "message": (
                        f"'{column}' shows a large "
                        "difference between target "
                        "groups. Validate whether this "
                        "relationship generalizes."
                    )
                })

    return warnings