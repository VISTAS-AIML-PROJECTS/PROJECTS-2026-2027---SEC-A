"""
Safe merging for Mine's multi-dataset integration layer.

Responsibilities:
- Keep one row per canonical entity.
- Aggregate many-to-one datasets before merging.
- Prevent row multiplication.
- Detect identical duplicate columns.
- Preserve conflicting duplicate columns.
- Report entity coverage and merge statistics.
"""

import pandas as pd

from src.errors import pipeline_error


def _mode_or_first(series):
    """Return the mode of a series, falling back to the first value."""

    non_null = series.dropna()

    if len(non_null) == 0:
        return None

    modes = non_null.mode()

    if len(modes) > 0:
        return modes.iloc[0]

    return non_null.iloc[0]


def _aggregate_to_entity_level(
    df,
    key_column,
    aggregation_plan,
):
    """
    Aggregate a many-row-per-entity dataset into one row per entity.

    Numeric columns use the supplied aggregation strategy.
    Unknown/non-numeric strategies fall back to mode.
    """

    if key_column not in df.columns:
        pipeline_error(
            "Entity key is missing from dataset.",
            f"Key column: {key_column}",
            "Check the detected entity key.",
        )

    if df.empty:
        return df[[key_column]].drop_duplicates()

    aggregators = {}

    for column, strategy in aggregation_plan.items():

        if column == key_column:
            continue

        if column not in df.columns:
            continue

        if strategy == "mean":
            aggregators[column] = "mean"

        elif strategy == "sum":
            aggregators[column] = "sum"

        elif strategy == "min":
            aggregators[column] = "min"

        elif strategy == "max":
            aggregators[column] = "max"

        elif strategy == "median":
            aggregators[column] = "median"

        elif strategy == "first":
            aggregators[column] = "first"

        elif strategy == "last":
            aggregators[column] = "last"

        else:
            aggregators[column] = _mode_or_first

    if not aggregators:
        return df[[key_column]].drop_duplicates()

    return (
        df.groupby(
            key_column,
            dropna=True,
        )
        .agg(aggregators)
        .reset_index()
    )


def _values_agree(series_a, series_b):
    """
    Determine whether two aligned columns contain identical values.

    NaN/NaN is treated as agreement.
    """

    if len(series_a) != len(series_b):
        return False

    both_null = (
        series_a.isna()
        & series_b.isna()
    )

    equal = (
        series_a.astype("string")
        == series_b.astype("string")
    )

    return bool(
        (
            equal.fillna(False)
            | both_null
        ).all()
    )


def _entity_set(df, key):
    """Return normalized string entity identifiers."""

    if key not in df.columns:
        return set()

    return set(
        df[key]
        .dropna()
        .astype(str)
        .str.strip()
    )


def _unique_column_name(
    existing_columns,
    desired_name,
):
    """Generate a unique column name."""

    if desired_name not in existing_columns:
        return desired_name

    counter = 2

    while f"{desired_name}_{counter}" in existing_columns:
        counter += 1

    return f"{desired_name}_{counter}"


def safe_merge(
    entity_frames,
    canonical_key,
    order,
    dataset_relationships,
):
    """
    Safely merge entity-level datasets.

    All incoming frames must already contain at most one row
    per canonical entity.

    Returns:
        unified_df, merge_report
    """

    if not order:
        pipeline_error(
            "No datasets were provided to the merger.",
            "The merge order is empty.",
            "Provide at least one dataset.",
        )

    first_name = order[0]

    if first_name not in entity_frames:
        pipeline_error(
            "Initial dataset is missing.",
            f"Dataset: {first_name}",
            "Check dataset integration.",
        )

    unified_df = entity_frames[first_name].copy()

    if canonical_key not in unified_df.columns:
        pipeline_error(
            "Canonical entity key is missing.",
            f"Dataset: {first_name}; key: {canonical_key}",
            "Check entity-key detection.",
        )

    if not unified_df[canonical_key].is_unique:
        pipeline_error(
            "Initial dataset contains duplicate entities.",
            f"Dataset: {first_name}",
            "Aggregate the dataset before merging.",
        )

    merge_operations = []
    duplicate_columns_removed = []
    conflicts = []

    accumulated_entities = _entity_set(
        unified_df,
        canonical_key,
    )

    for dataset_name in order[1:]:

        incoming_df = entity_frames[
            dataset_name
        ].copy()

        if canonical_key not in incoming_df.columns:
            pipeline_error(
                "Canonical entity key is missing.",
                f"Dataset: {dataset_name}",
                "Check entity-key normalization.",
            )

        if not incoming_df[canonical_key].is_unique:
            pipeline_error(
                "Incoming dataset contains duplicate entities.",
                f"Dataset: {dataset_name}",
                "Aggregate the dataset before merging.",
            )

        incoming_entities = _entity_set(
            incoming_df,
            canonical_key,
        )

        matched_entities = (
            accumulated_entities
            & incoming_entities
        )

        incoming_only_entities = (
            incoming_entities
            - accumulated_entities
        )

        accumulated_only_entities = (
            accumulated_entities
            - incoming_entities
        )

        common_columns = sorted(
            (
                set(unified_df.columns)
                & set(incoming_df.columns)
            )
            - {canonical_key}
        )

        for column in common_columns:

            comparison = unified_df[
                [canonical_key, column]
            ].merge(
                incoming_df[
                    [canonical_key, column]
                ],
                on=canonical_key,
                how="inner",
                suffixes=(
                    "__left",
                    "__right",
                ),
            )

            if comparison.empty:
                continue

            if _values_agree(
                comparison[f"{column}__left"],
                comparison[f"{column}__right"],
            ):

                incoming_df = incoming_df.drop(
                    columns=[column]
                )

                duplicate_columns_removed.append({
                    "column": column,
                    "kept_from": "accumulated_data",
                    "removed_from": dataset_name,
                    "reason": "identical_values",
                })

            else:

                accumulated_name = _unique_column_name(
                    unified_df.columns,
                    f"{column}__accumulated",
                )

                incoming_name = _unique_column_name(
                    incoming_df.columns,
                    f"{column}__{dataset_name}",
                )

                unified_df = unified_df.rename(
                    columns={
                        column: accumulated_name
                    }
                )

                incoming_df = incoming_df.rename(
                    columns={
                        column: incoming_name
                    }
                )

                conflicts.append({
                    "column": column,
                    "datasets": [
                        first_name,
                        dataset_name,
                    ],
                    "accumulated_column": accumulated_name,
                    "incoming_column": incoming_name,
                    "reason": "conflicting_values",
                    "resolution": (
                        "Both columns preserved; "
                        "no value was silently selected."
                    ),
                })

        rows_before = len(unified_df)

        unified_df = unified_df.merge(
            incoming_df,
            on=canonical_key,
            how="outer",
            validate="one_to_one",
        )

        rows_after = len(unified_df)

        cardinality = (
            dataset_relationships
            .get("per_dataset", {})
            .get(dataset_name, {})
            .get(
                "cardinality",
                "unknown",
            )
        )

        if cardinality == "many-per-entity":
            relationship = (
                "one-to-many "
                "(aggregated to entity level)"
            )

        elif cardinality == "one-per-entity":
            relationship = "one-to-one"

        else:
            relationship = cardinality

        merge_operations.append({
            "dataset": dataset_name,
            "join_key": canonical_key,
            "relationship": relationship,

            "rows_before": rows_before,
            "rows_after": rows_after,

            "matched_entities": len(
                matched_entities
            ),

            "unmatched_from_incoming_dataset": len(
                incoming_only_entities
            ),

            "unmatched_from_accumulated_dataset": len(
                accumulated_only_entities
            ),

            "incoming_only_entities": sorted(
                incoming_only_entities
            ),

            "accumulated_only_entities": sorted(
                accumulated_only_entities
            ),

            "incoming_entity_count": len(
                incoming_entities
            ),

            "accumulated_entity_count_before_merge": len(
                accumulated_entities
            ),
        })

        accumulated_entities = (
            accumulated_entities
            | incoming_entities
        )

    merge_report = {
        "join_key": canonical_key,
        "merge_order": order,
        "operations": merge_operations,
        "duplicate_columns_removed": (
            duplicate_columns_removed
        ),
        "conflicts": conflicts,
        "final_row_count": int(
            len(unified_df)
        ),
        "final_column_count": int(
            len(unified_df.columns)
        ),
        "row_multiplication_detected": False,
    }

    return unified_df, merge_report