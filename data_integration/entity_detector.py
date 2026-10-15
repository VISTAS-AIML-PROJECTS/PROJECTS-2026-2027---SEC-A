import pandas as pd

from src.data_integration.data_loader import (
    read_dataset
)


_IDENTIFIER_NAME_HINTS = (
    "id",
    "identifier",
    "account",
    "customer",
    "client",
    "subscriber",
    "member",
    "user",
)


def normalize_column_name(column):
    """
    Normalize a column name for cross-dataset comparison.

    Examples:
        CustomerID
        Customer ID
        customer_id
        Customer-ID
        CUSTOMER ID

    all become "customerid".
    """

    return (
        str(column)
        .strip()
        .lower()
        .replace("_", "")
        .replace("-", "")
        .replace(" ", "")
    )


def _name_score(
    column
):
    name = (
        str(column)
        .strip()
        .lower()
    )

    score = 0.0

    if (
        name.endswith("_id")
        or name == "id"
    ):

        score += 0.5

    if any(
        token in name
        for token
        in _IDENTIFIER_NAME_HINTS
    ):

        score += 0.2

    return min(
        score,
        1.0
    )


def _uniqueness_score(
    series
):
    non_null = (
        series.dropna()
    )

    if len(non_null) == 0:

        return 0.0

    ratio = (
        non_null.nunique()
        / len(non_null)
    )

    return min(
        max(
            ratio,
            0.0
        ),
        1.0
    )


def _missingness_score(
    series
):
    if len(series) == 0:

        return 0.0

    return (
        1.0
        - float(
            series.isna().mean()
        )
    )


def _value_set(
    path,
    column
):
    df = read_dataset(
        path,
        usecols=[column]
    )

    return set(
        df[column]
        .dropna()
        .astype(str)
        .str.strip()
    )


def detect_entity_key(
    datasets,
    schemas
):
    """
    Detect the most likely common entity key.

    Supports CSV/XLSX/XLS.
    """

    if len(datasets) == 1:

        name, path = (
            next(
                iter(
                    datasets.items()
                )
            )
        )

        columns = (
            schemas[name][
                "column_names"
            ]
        )

        candidates = []

        df = read_dataset(
            path
        )

        for column in columns:

            series = df[column]

            score = (
                0.45
                * _name_score(
                    column
                )
                +
                0.40
                * _uniqueness_score(
                    series
                )
                +
                0.15
                * _missingness_score(
                    series
                )
            )

            candidates.append({

                "dataset":
                    name,

                "column":
                    column,

                "score":
                    float(score),
            })

        candidates.sort(
            key=lambda x:
                x["score"],
            reverse=True
        )

        if not candidates:

            return {

                "key":
                    None,

                "confidence":
                    0.0,

                "column_by_dataset":
                    {},

                "candidates":
                    [],
            }

        best = candidates[0]

        return {

            "key":
                best["column"],

            "confidence":
                best["score"],

            "column_by_dataset":
                {
                    name:
                        best["column"]
                },

            "candidates":
                candidates,
        }

    # --------------------------------------------------
    # MULTI-DATASET MODE
    # --------------------------------------------------

    column_occurrences = {}

    for (
        dataset_name,
        schema
    ) in schemas.items():

        for column in (
            schema[
                "column_names"
            ]
        ):

            normalized = (
                normalize_column_name(
                    column
                )
            )

            column_occurrences.setdefault(
                normalized,
                []
            ).append(
                (
                    dataset_name,
                    column
                )
            )

    candidates = []

    for (
        normalized_name,
        occurrences
    ) in column_occurrences.items():

        if len(
            occurrences
        ) < 2:

            continue

        datasets_present = [
            item[0]
            for item
            in occurrences
        ]

        coverage = (
            len(datasets_present)
            / len(datasets)
        )

        for (
            dataset_name,
            column
        ) in occurrences:

            df = read_dataset(
                datasets[
                    dataset_name
                ],
                usecols=[column]
            )

            series = df[
                column
            ]

            score = (
                0.35
                * coverage
                +
                0.30
                * _name_score(
                    column
                )
                +
                0.25
                * _uniqueness_score(
                    series
                )
                +
                0.10
                * _missingness_score(
                    series
                )
            )

            candidates.append({

                "normalized_name":
                    normalized_name,

                "column":
                    column,

                "dataset":
                    dataset_name,

                "coverage":
                    coverage,

                "score":
                    float(score),
            })

    if not candidates:

        return {

            "key":
                None,

            "confidence":
                0.0,

            "column_by_dataset":
                {},

            "candidates":
                [],
        }

    candidates.sort(
        key=lambda x:
            x["score"],
        reverse=True
    )

    best_normalized = (
        candidates[0][
            "normalized_name"
        ]
    )

    column_by_dataset = {}

    for candidate in candidates:

        if (
            candidate[
                "normalized_name"
            ]
            ==
            best_normalized
        ):

            column_by_dataset[
                candidate[
                    "dataset"
                ]
            ] = candidate[
                "column"
            ]

    confidence = (
        candidates[0][
            "score"
        ]
    )

    return {

        "key":
            candidates[0][
                "column"
            ],

        "confidence":
            float(confidence),

        "column_by_dataset":
            column_by_dataset,

        "candidates":
            candidates,
    }