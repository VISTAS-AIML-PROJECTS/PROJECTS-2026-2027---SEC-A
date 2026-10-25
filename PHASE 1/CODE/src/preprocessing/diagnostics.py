import pandas as pd


def analyze_target_distribution(df, target_column):
    """
    Analyze the target distribution.
    """

    target = df[target_column]

    counts = target.value_counts(dropna=False)

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
            target.nunique(dropna=True)
        )
    }

    for value in counts.index:

        result["classes"][str(value)] = {
            "count": int(counts[value]),
            "percentage": round(
                float(percentages[value]),
                2
            )
        }

    return result


def analyze_numeric_relationships(
    df,
    target_column,
    numerical_features
):
    """
    Analyze numeric feature relationships
    with a binary target.
    """

    result = []

    target = df[target_column]

    if target.nunique(dropna=True) != 2:
        return result

    classes = target.dropna().unique()

    for feature in numerical_features:

        if feature == target_column:
            continue

        if not pd.api.types.is_numeric_dtype(
            df[feature]
        ):
            continue

        group_values = {}

        for cls in classes:

            values = df.loc[
                target == cls,
                feature
            ].dropna()

            if len(values) > 0:

                group_values[str(cls)] = {
                    "mean": round(
                        float(values.mean()),
                        4
                    ),
                    "median": round(
                        float(values.median()),
                        4
                    ),
                    "count": int(len(values))
                }

        result.append({
            "feature": feature,
            "groups": group_values
        })

    return result


def analyze_categorical_relationships(
    df,
    target_column,
    categorical_features
):
    """
    Analyze target rate across categories.
    """

    result = []

    target = df[target_column]

    for feature in categorical_features:

        if feature == target_column:
            continue

        table = pd.crosstab(
            df[feature],
            target,
            normalize="index"
        ) * 100

        categories = {}

        for category in table.index:

            categories[str(category)] = {
                str(column): round(
                    float(table.loc[
                        category,
                        column
                    ]),
                    2
                )
                for column in table.columns
            }

        result.append({
            "feature": feature,
            "categories": categories
        })

    return result