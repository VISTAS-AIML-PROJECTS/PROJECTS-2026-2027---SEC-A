import pandas as pd

from src.data_integration.data_loader import (
    read_dataset
)


def _cardinality(
    df,
    key
):
    counts = (
        df[key]
        .dropna()
        .value_counts()
    )

    if counts.empty:

        return "unknown"

    if (
        counts > 1
    ).any():

        return "many-per-entity"

    return "one-per-entity"


def _aggregation_plan(
    df,
    key
):
    plan = {}

    for column in df.columns:

        if column == key:
            continue

        series = df[column]

        if pd.api.types.is_numeric_dtype(
            series
        ):

            plan[column] = "mean"

        else:

            plan[column] = "mode"

    return plan


def analyze_relationships(
    datasets,
    column_by_dataset,
    target_column=None,
):
    """
    Analyze dataset cardinality relative to
    the detected entity key.

    Supports CSV/XLSX/XLS.
    """

    per_dataset = {}

    loaded = {}

    for dataset_name, path in datasets.items():

        df = read_dataset(
            path
        )

        key = column_by_dataset.get(
            dataset_name
        )

        if (
            key is None
            or key not in df.columns
        ):

            per_dataset[
                dataset_name
            ] = {

                "key":
                    None,

                "cardinality":
                    "unknown",

                "aggregation_plan":
                    None,
            }

            continue

        loaded[
            dataset_name
        ] = df

        cardinality = _cardinality(
            df,
            key
        )

        if (
            cardinality
            == "many-per-entity"
        ):

            plan = _aggregation_plan(
                df,
                key
            )

        else:

            plan = None

        per_dataset[
            dataset_name
        ] = {

            "key":
                key,

            "cardinality":
                cardinality,

            "aggregation_plan":
                plan,
        }

    # --------------------------------------------------
    # PAIRWISE RELATIONSHIPS
    # --------------------------------------------------

    pairwise = []

    names = list(
        loaded.keys()
    )

    for i in range(
        len(names)
    ):

        for j in range(
            i + 1,
            len(names)
        ):

            left_name = names[i]

            right_name = names[j]

            left = loaded[
                left_name
            ]

            right = loaded[
                right_name
            ]

            left_key = (
                column_by_dataset[
                    left_name
                ]
            )

            right_key = (
                column_by_dataset[
                    right_name
                ]
            )

            left_counts = (
                left[left_key]
                .value_counts()
            )

            right_counts = (
                right[right_key]
                .value_counts()
            )

            common_left = set(
                left_counts.index
                .astype(str)
            )

            common_right = set(
                right_counts.index
                .astype(str)
            )

            common = (
                common_left
                & common_right
            )

            if not common:

                relationship = (
                    "no-overlap"
                )

            elif (
                (
                    left_counts.loc[
                        left_counts.index
                        .astype(str)
                        .isin(common)
                    ] > 1
                ).any()
                and
                (
                    right_counts.loc[
                        right_counts.index
                        .astype(str)
                        .isin(common)
                    ] > 1
                ).any()
            ):

                relationship = (
                    "many-to-many"
                )

            elif (
                (
                    left_counts.loc[
                        left_counts.index
                        .astype(str)
                        .isin(common)
                    ] > 1
                ).any()
            ):

                relationship = (
                    "many-to-one"
                )

            elif (
                (
                    right_counts.loc[
                        right_counts.index
                        .astype(str)
                        .isin(common)
                    ] > 1
                ).any()
            ):

                relationship = (
                    "one-to-many"
                )

            else:

                relationship = (
                    "one-to-one"
                )

            pairwise.append({

                "left_dataset":
                    left_name,

                "right_dataset":
                    right_name,

                "relationship":
                    relationship,

                "common_entities":
                    len(common),
            })

    return {

        "per_dataset":
            per_dataset,

        "pairwise":
            pairwise,
    }