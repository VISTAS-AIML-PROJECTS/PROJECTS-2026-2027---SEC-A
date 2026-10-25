"""
End-to-end multi-CSV company data integration.

This layer runs BEFORE Mine's existing Phase 2 preprocessing.
"""

import json
from pathlib import Path

from src.data_integration.data_loader import (
    read_dataset
)

from src.data_integration.dataset_discovery import (
    discover_datasets,
)
from src.data_integration.schema_analyzer import (
    analyze_schemas,
)
from src.data_integration.entity_detector import (
    detect_entity_key,
)
from src.data_integration.relationship_analyzer import (
    analyze_relationships,
)
from src.data_integration.merger import (
    _aggregate_to_entity_level,
    safe_merge,
)
from src.errors import pipeline_error


def normalize_target_name(name):
    """
    Normalize a column name for target matching.

    Examples:
        Churn Label -> churn_label
        ChurnLabel  -> churnlabel
        churn       -> churn
    """

    return (
        str(name)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def resolve_target_name(
    datasets,
    schemas,
    target_column,
):
    """
    Resolve the actual target column name across datasets.

    Resolution order:
        1. Exact match
        2. Case-insensitive match
        3. Normalized match
        4. Target-like candidate (e.g. 'churn' -> 'Churn Label')

    Returns the resolved column name or None.
    """

    if target_column is None:
        return None

    requested = str(target_column).strip()

    # All known column names across datasets.
    all_columns = []

    for dataset_name in schemas:
        all_columns.extend(
            schemas[dataset_name][
                "column_names"
            ]
        )

    # 1. Exact
    if requested in all_columns:
        return requested

    # 2. Case-insensitive
    requested_lower = requested.lower()

    case_matches = [
        column
        for column in all_columns
        if str(column).strip().lower() == requested_lower
    ]

    if len(case_matches) == 1:
        return case_matches[0]

    if len(case_matches) > 1:
        pipeline_error(
            "Multiple case-insensitive target matches found.",
            f"Target: {requested}; matches: {case_matches}",
            "Specify the exact target column name.",
        )

    # 3. Normalized
    normalized_requested = (
        normalize_target_name(requested)
    )

    normalized_matches = [
        column
        for column in all_columns
        if normalize_target_name(column)
        == normalized_requested
    ]

    if len(normalized_matches) == 1:
        return normalized_matches[0]

    if len(normalized_matches) > 1:
        pipeline_error(
            "Multiple normalized target matches found.",
            f"Target: {requested}; matches: {normalized_matches}",
            "Specify the exact target column name.",
        )

    # 4. Target-like candidates.
    #
    # A requested name such as "churn" should resolve to the
    # actual label column (e.g. "Churn Label") when the raw
    # name does not exist as a column.
    candidate_matches = [
        column
        for column in all_columns
        if (
            normalized_requested
            and (
                normalize_target_name(column)
                == normalized_requested
                or normalize_target_name(column).startswith(
                    normalized_requested + "_"
                )
            )
        )
    ]

    if candidate_matches:

        # Prefer exact suffixed label columns.
        preferred = [
            column
            for column in candidate_matches
            if (
                "label" in normalize_target_name(column)
                or "flag" in normalize_target_name(column)
                or "target" in normalize_target_name(column)
            )
        ]

        if len(preferred) == 1:
            return preferred[0]

        return candidate_matches[0]

    return None


def run_integration(
    input_dir,
    target_column,
    output_csv="data/processed/integrated_dataset.csv",
    metadata_path="data/metadata/integration_metadata.json",
):
    """
    Discover, analyze, relate, aggregate and safely merge
    multiple company CSV datasets.

    Returns:
        str: path to integrated CSV
    """

    # --------------------------------------------------------------
    # 1. Discover datasets
    # --------------------------------------------------------------

    datasets = discover_datasets(input_dir)

    if not datasets:
        pipeline_error(
            "No datasets were discovered.",
            f"Input directory: {input_dir}",
            "Provide a directory containing CSV files.",
        )

    # --------------------------------------------------------------
    # 2. Analyze schemas
    # --------------------------------------------------------------

    schemas = analyze_schemas(
        datasets
    )

    # --------------------------------------------------------------
    # 3. Detect entity key
    # --------------------------------------------------------------

    detection = detect_entity_key(
        datasets,
        schemas,
    )

    canonical_key = detection.get(
        "key"
    )

    if not canonical_key:
        pipeline_error(
            "Unable to detect a common entity key.",
            "No sufficiently strong common identifier was found.",
            "Ensure the company datasets share an entity identifier.",
        )

    column_by_dataset = detection.get(
        "column_by_dataset",
        {},
    )

    # --------------------------------------------------------------
    # 3b. Skip datasets that cannot join on the entity key.
    #
    # A dataset without a usable entity key (for example a
    # zip-code lookup table such as a population reference) is
    # skipped with a warning rather than aborting the pipeline.
    # --------------------------------------------------------------

    missing_key_datasets = [
        name
        for name in datasets
        if name not in column_by_dataset
    ]

    joinable_datasets = {
        name: path
        for name, path in datasets.items()
        if name in column_by_dataset
    }

    skipped_datasets = []

    for name in missing_key_datasets:
        print(
            f"[INTEGRATION] Skipping non-joinable dataset "
            f"'{name}' (no entity key match)."
        )

        skipped_datasets.append({
            "dataset": name,
            "reason": "no_entity_key",
            "available_columns": schemas[name][
                "column_names"
            ],
        })

    if not joinable_datasets:
        pipeline_error(
            "No dataset could be joined on the entity key.",
            (
                "All datasets are missing the detected key: "
                + ", ".join(datasets.keys())
            ),
            "Check the common entity identifier across CSV files.",
        )

    # --------------------------------------------------------------
    # 4. Analyze relationships
    # --------------------------------------------------------------

    relationships = analyze_relationships(
        joinable_datasets,
        column_by_dataset,
        target_column=target_column,
    )

    # --------------------------------------------------------------
    # 5. Load and normalize entity-level frames
    # --------------------------------------------------------------

    entity_frames = {}

    aggregation_operations = []

    source_row_counts = {}

    for dataset_name, path in joinable_datasets.items():

        df = read_dataset(path)

        source_row_counts[
            dataset_name
        ] = int(len(df))

        source_key = column_by_dataset[
            dataset_name
        ]

        if source_key not in df.columns:
            pipeline_error(
                "Detected entity key is missing.",
                (
                    f"Dataset: {dataset_name}; "
                    f"key: {source_key}"
                ),
                "Check the source dataset.",
            )

        cardinality = (
            relationships
            .get("per_dataset", {})
            .get(dataset_name, {})
            .get("cardinality")
        )

        aggregation_plan = (
            relationships
            .get("per_dataset", {})
            .get(dataset_name, {})
            .get("aggregation_plan")
        )

        # ----------------------------------------------------------
        # Aggregate one-to-many data
        # ----------------------------------------------------------

        if cardinality == "many-per-entity":

            df = _aggregate_to_entity_level(
                df,
                source_key,
                aggregation_plan or {},
            )

            aggregation_operations.append({
                "dataset": dataset_name,
                "key": source_key,
                "original_rows": source_row_counts[
                    dataset_name
                ],
                "aggregated_rows": int(
                    len(df)
                ),
                "strategy": aggregation_plan or {},
            })

        else:

            # Remove exact duplicate rows but never collapse
            # genuinely different entity records silently.
            df = df.drop_duplicates()

            if not df[source_key].is_unique:
                pipeline_error(
                    "Dataset has duplicate entities but was not classified as one-to-many.",
                    (
                        f"Dataset: {dataset_name}; "
                        f"key: {source_key}"
                    ),
                    "Review entity relationships.",
                )

        # ----------------------------------------------------------
        # Normalize entity key name
        # ----------------------------------------------------------

        if source_key != canonical_key:
            df = df.rename(
                columns={
                    source_key: canonical_key
                }
            )

        entity_frames[
            dataset_name
        ] = df

    # --------------------------------------------------------------
    # 6. Validate target existence in source datasets
    # --------------------------------------------------------------

    resolved_target = resolve_target_name(
        joinable_datasets,
        schemas,
        target_column,
    )

    if not resolved_target:
        pipeline_error(
            "Target column was not found.",
            f"Target: {target_column}",
            "Specify the target column using --target.",
        )

    target_locations = []

    for dataset_name, path in joinable_datasets.items():

        columns = schemas[
            dataset_name
        ]["column_names"]

        if resolved_target in columns:
            target_locations.append(
                dataset_name
            )

    if not target_locations:
        pipeline_error(
            "Target column was not found in any source dataset.",
            f"Target: {resolved_target}",
            "Specify the target column using --target.",
        )

    # --------------------------------------------------------------
    # 7. Safe merge
    # --------------------------------------------------------------

    merge_order = list(
        joinable_datasets.keys()
    )

    unified_df, merge_report = safe_merge(
        entity_frames=entity_frames,
        canonical_key=canonical_key,
        order=merge_order,
        dataset_relationships=relationships,
    )

    # --------------------------------------------------------------
    # 8. Validate final target
    # --------------------------------------------------------------

    if resolved_target not in unified_df.columns:

        # A target conflict should never be silently resolved.
        possible_targets = [
            column
            for column in unified_df.columns
            if (
                column.startswith(
                    f"{resolved_target}__"
                )
            )
        ]

        if possible_targets:
            pipeline_error(
                "Target column has conflicting duplicates.",
                (
                    f"Target: {resolved_target}; "
                    f"preserved columns: "
                    + ", ".join(possible_targets)
                ),
                (
                    "Resolve the target conflict before "
                    "running the ML pipeline."
                ),
            )

        pipeline_error(
            "Target column disappeared during integration.",
            f"Target: {resolved_target}",
            "Review the integration metadata.",
        )

    # --------------------------------------------------------------
    # 9. Coverage summary
    # --------------------------------------------------------------

    final_entities = set(
        unified_df[canonical_key]
        .dropna()
        .astype(str)
        .str.strip()
    )

    coverage = {}

    for dataset_name, df in entity_frames.items():

        entities = set(
            df[canonical_key]
            .dropna()
            .astype(str)
            .str.strip()
        )

        matched = (
            entities
            & final_entities
        )

        coverage[
            dataset_name
        ] = {
            "source_entities": len(
                entities
            ),
            "final_entities": len(
                final_entities
            ),
            "matched_to_final": len(
                matched
            ),
            "coverage_percentage": (
                float(
                    len(matched)
                    / len(entities)
                    * 100
                )
                if entities
                else 0.0
            ),
        }

    # --------------------------------------------------------------
    # 10. Warnings
    # --------------------------------------------------------------

    warnings = []

    if merge_report["conflicts"]:

        warnings.append({
            "type": "conflicting_duplicate_columns",
            "count": len(
                merge_report["conflicts"]
            ),
            "message": (
                "Conflicting columns were preserved "
                "rather than silently selected."
            ),
        })

    for operation in merge_report[
        "operations"
    ]:

        if (
            operation[
                "unmatched_from_incoming_dataset"
            ]
            > 0
        ):

            warnings.append({
                "type": "unmatched_incoming_entities",
                "dataset": operation[
                    "dataset"
                ],
                "count": operation[
                    "unmatched_from_incoming_dataset"
                ],
            })

        if (
            operation[
                "unmatched_from_accumulated_dataset"
            ]
            > 0
        ):

            warnings.append({
                "type": "unmatched_accumulated_entities",
                "dataset": operation[
                    "dataset"
                ],
                "count": operation[
                    "unmatched_from_accumulated_dataset"
                ],
            })

    # --------------------------------------------------------------
    # 11. Save outputs
    # --------------------------------------------------------------

    output_path = Path(
        output_csv
    )

    metadata_file = Path(
        metadata_path
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    metadata_file.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    unified_df.to_csv(
        output_path,
        index=False,
    )

    # --------------------------------------------------------------
    # 12. Integration metadata
    # --------------------------------------------------------------

    metadata = {
        "input_directory": str(
            input_dir
        ),
        "input_datasets": datasets,
        "joinable_datasets": list(
            joinable_datasets.keys()
        ),
        "skipped_datasets": skipped_datasets,
        "source_row_counts": source_row_counts,
        "schemas": schemas,
        "entity_key_detection": detection,
        "canonical_entity_key": canonical_key,
        "relationships": relationships,
        "aggregation_operations": (
            aggregation_operations
        ),
        "merge": merge_report,
        "coverage": coverage,
        "warnings": warnings,
        "requested_target_column": target_column,
        "target_column": resolved_target,
        "target_found_in": target_locations,
        "final_row_count": int(
            unified_df.shape[0]
        ),
        "final_column_count": int(
            unified_df.shape[1]
        ),
        "output_csv": str(
            output_path
        ),
    }

    metadata_file.write_text(
        json.dumps(
            metadata,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )

    return str(
        output_path
    )