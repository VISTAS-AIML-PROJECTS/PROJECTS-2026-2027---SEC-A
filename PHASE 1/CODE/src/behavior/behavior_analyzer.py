import pandas as pd
import numpy as np

from src.preprocessing.dtypes import (
    get_categorical_columns,
    get_numerical_columns
)


def validate_target(df, target_column):
    if target_column not in df.columns:
        raise ValueError(
            f"Target column '{target_column}' was not found."
        )

    unique_values = df[target_column].dropna().unique()

    if len(unique_values) != 2:
        raise ValueError(
            "Churn behaviour analysis currently requires "
            "a binary target."
        )


def identify_positive_class(df, target_column):
    values = df[target_column].dropna().unique()

    preferred_positive_labels = {
        "yes",
        "true",
        "1",
        "churn",
        "churned",
        "exited",
        "attrition"
    }

    for value in values:
        if str(value).strip().lower() in preferred_positive_labels:
            return value

    return values[1]


def calculate_overall_churn(
    df,
    target_column,
    positive_class
):
    total = len(df)

    positive_count = (
        df[target_column] == positive_class
    ).sum()

    rate = (
        positive_count / total
        if total > 0
        else 0
    )

    return {
        "total_rows": int(total),
        "positive_count": int(positive_count),
        "negative_count": int(total - positive_count),
        "positive_rate": round(float(rate), 4)
    }


def _rate_difference(
    group_rate,
    overall_rate
):
    return group_rate - overall_rate


def _evidence_strength(
    group_size,
    rate_difference
):
    absolute_difference = abs(rate_difference)

    if group_size < 5:
        return "LOW"

    if group_size < 10:
        if absolute_difference >= 0.30:
            return "MEDIUM"
        return "LOW"

    if absolute_difference >= 0.30:
        return "HIGH"

    if absolute_difference >= 0.15:
        return "MEDIUM"

    return "LOW"


def analyze_categorical_features(
    df,
    target_column,
    positive_class,
    min_group_size=2,
    feature_columns=None
):

    overall_rate = (
        df[target_column] == positive_class
    ).mean()

    categorical_columns = get_categorical_columns(
        df,
        feature_columns
    )

    results = []

    for column in categorical_columns:

        if column == target_column:
            continue

        grouped = (
            df.groupby(
                column,
                dropna=False
            )[target_column]
            .agg(
                group_size="size",
                positive_count=lambda x: (
                    x == positive_class
                ).sum()
            )
            .reset_index()
        )

        for _, row in grouped.iterrows():

            group_size = int(
                row["group_size"]
            )

            if group_size < min_group_size:
                continue

            positive_count = int(
                row["positive_count"]
            )

            group_rate = (
                positive_count / group_size
            )

            rate_difference = _rate_difference(
                group_rate,
                overall_rate
            )

            if rate_difference > 0.05:
                direction = "higher"
            elif rate_difference < -0.05:
                direction = "lower"
            else:
                direction = "similar"

            results.append({
                "feature": column,
                "category": str(row[column]),
                "group_size": group_size,
                "positive_count": positive_count,
                "positive_rate": round(
                    float(group_rate),
                    4
                ),
                "overall_positive_rate": round(
                    float(overall_rate),
                    4
                ),
                "rate_difference": round(
                    float(rate_difference),
                    4
                ),
                "direction": direction,
                "evidence_strength": _evidence_strength(
                    group_size,
                    rate_difference
                )
            })

    return results


def _cohens_d(
    positive_values,
    negative_values
):
    positive_values = pd.Series(
        positive_values
    ).dropna()

    negative_values = pd.Series(
        negative_values
    ).dropna()

    n1 = len(positive_values)
    n2 = len(negative_values)

    if n1 < 2 or n2 < 2:
        return None

    mean1 = positive_values.mean()
    mean2 = negative_values.mean()

    var1 = positive_values.var(
        ddof=1
    )

    var2 = negative_values.var(
        ddof=1
    )

    pooled_variance = (
        ((n1 - 1) * var1)
        +
        ((n2 - 1) * var2)
    ) / (n1 + n2 - 2)

    if pooled_variance <= 0:
        return None

    pooled_std = np.sqrt(
        pooled_variance
    )

    return float(
        (mean1 - mean2) / pooled_std
    )


def _effect_strength(effect_size):

    if effect_size is None:
        return "UNKNOWN"

    absolute_effect = abs(effect_size)

    if absolute_effect >= 0.8:
        return "LARGE"

    if absolute_effect >= 0.5:
        return "MEDIUM"

    if absolute_effect >= 0.2:
        return "SMALL"

    return "NEGLIGIBLE"


def analyze_numerical_features(
    df,
    target_column,
    positive_class,
    feature_columns=None
):

    numerical_columns = get_numerical_columns(
        df,
        feature_columns
    )

    results = []

    positive_mask = (
        df[target_column] == positive_class
    )

    negative_mask = ~positive_mask

    for column in numerical_columns:

        positive_values = df.loc[
            positive_mask,
            column
        ].dropna()

        negative_values = df.loc[
            negative_mask,
            column
        ].dropna()

        if len(positive_values) == 0:
            continue

        if len(negative_values) == 0:
            continue

        positive_mean = (
            positive_values.mean()
        )

        negative_mean = (
            negative_values.mean()
        )

        overall_mean = df[column].mean()

        mean_difference = (
            positive_mean -
            negative_mean
        )

        if abs(overall_mean) > 1e-12:
            relative_difference = (
                abs(mean_difference)
                /
                abs(overall_mean)
            )
        else:
            relative_difference = None

        effect_size = _cohens_d(
            positive_values,
            negative_values
        )

        if mean_difference > 0:
            direction = "higher"
        elif mean_difference < 0:
            direction = "lower"
        else:
            direction = "similar"

        results.append({
            "feature": column,

            "positive_mean": round(
                float(positive_mean),
                4
            ),

            "negative_mean": round(
                float(negative_mean),
                4
            ),

            "overall_mean": round(
                float(overall_mean),
                4
            ),

            "mean_difference": round(
                float(mean_difference),
                4
            ),

            "relative_mean_difference": (
                round(
                    float(relative_difference),
                    4
                )
                if relative_difference is not None
                else None
            ),

            "effect_size_cohens_d": (
                round(
                    float(effect_size),
                    4
                )
                if effect_size is not None
                else None
            ),

            "effect_strength": _effect_strength(
                effect_size
            ),

            "positive_sample_size": int(
                len(positive_values)
            ),

            "negative_sample_size": int(
                len(negative_values)
            ),

            "direction": direction
        })

    return results


def calculate_numerical_ranges(
    df,
    target_column,
    positive_class,
    feature_columns=None
):

    numerical_columns = get_numerical_columns(
        df,
        feature_columns
    )

    results = []

    positive_mask = (
        df[target_column] == positive_class
    )

    negative_mask = ~positive_mask

    for column in numerical_columns:

        positive_values = df.loc[
            positive_mask,
            column
        ].dropna()

        negative_values = df.loc[
            negative_mask,
            column
        ].dropna()

        if len(positive_values) == 0:
            continue

        if len(negative_values) == 0:
            continue

        results.append({
            "feature": column,

            "positive_range": {
                "min": float(
                    positive_values.min()
                ),
                "max": float(
                    positive_values.max()
                )
            },

            "negative_range": {
                "min": float(
                    negative_values.min()
                ),
                "max": float(
                    negative_values.max()
                )
            }
        })

    return results


def identify_top_patterns(
    categorical_analysis,
    numerical_analysis,
    top_n=10
):

    patterns = []

    for item in numerical_analysis:

        effect_size = item[
            "effect_size_cohens_d"
        ]

        ranking_score = (
            abs(effect_size)
            if effect_size is not None
            else 0
        )

        patterns.append({
            "type": "numerical",
            "feature": item["feature"],
            "ranking_score": round(
                float(ranking_score),
                4
            ),
            "evidence_strength": (
                item["effect_strength"]
            ),
            "description": (
                f"'{item['feature']}' has a mean of "
                f"{item['positive_mean']:.2f} in the "
                f"positive class versus "
                f"{item['negative_mean']:.2f} in "
                f"the other class."
            )
        })

    for item in categorical_analysis:

        ranking_score = abs(
            item["rate_difference"]
        )

        patterns.append({
            "type": "categorical",
            "feature": item["feature"],
            "category": item["category"],
            "ranking_score": round(
                float(ranking_score),
                4
            ),
            "evidence_strength": (
                item["evidence_strength"]
            ),
            "description": (
                f"Category '{item['category']}' "
                f"in '{item['feature']}' has a "
                f"{item['positive_rate'] * 100:.1f}% "
                f"positive-class rate "
                f"({item['group_size']} records)."
            )
        })

    patterns.sort(
        key=lambda x: x["ranking_score"],
        reverse=True
    )

    return patterns[:top_n]


def assess_reliability(
    df,
    categorical_analysis
):

    warnings = []

    if len(df) < 100:

        warnings.append({
            "severity": "HIGH",
            "type": "small_sample",
            "message": (
                f"The dataset contains only "
                f"{len(df)} rows. Behavioural "
                f"patterns may be unstable."
            )
        })

    for item in categorical_analysis:

        rate = item["positive_rate"]

        if rate >= 0.95 or rate <= 0.05:

            warnings.append({
                "severity": "HIGH",
                "type": "extreme_category_rate",
                "feature": item["feature"],
                "category": item["category"],
                "message": (
                    f"Category '{item['category']}' "
                    f"in '{item['feature']}' has an "
                    f"extreme positive-class rate of "
                    f"{rate * 100:.1f}%."
                )
            })

    return warnings


def analyze_churn_behavior(
    df,
    target_column,
    positive_class=None,
    feature_columns=None
):

    validate_target(
        df,
        target_column
    )

    if positive_class is None:
        positive_class = identify_positive_class(
            df,
            target_column
        )

    overall = calculate_overall_churn(
        df,
        target_column,
        positive_class
    )

    categorical_analysis = (
        analyze_categorical_features(
            df,
            target_column,
            positive_class,
            feature_columns=feature_columns
        )
    )

    numerical_analysis = (
        analyze_numerical_features(
            df,
            target_column,
            positive_class,
            feature_columns=feature_columns
        )
    )

    numerical_ranges = (
        calculate_numerical_ranges(
            df,
            target_column,
            positive_class,
            feature_columns=feature_columns
        )
    )

    top_patterns = identify_top_patterns(
        categorical_analysis,
        numerical_analysis
    )

    reliability_warnings = assess_reliability(
        df,
        categorical_analysis
    )

    return {
        "target": target_column,
        "positive_class": positive_class,
        "overall": overall,
        "categorical_analysis": categorical_analysis,
        "numerical_analysis": numerical_analysis,
        "numerical_ranges": numerical_ranges,
        "top_patterns": top_patterns,
        "reliability_warnings": reliability_warnings
    }