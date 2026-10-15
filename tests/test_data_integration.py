import json
from pathlib import Path

import pandas as pd
import pytest

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
from src.data_integration.integration_pipeline import (
    run_integration,
)
from src.errors import MineError


# ==============================================================
# FIXTURES
# ==============================================================

@pytest.fixture
def one_to_one_dir(tmp_path):

    customers = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
            "C003",
            "C004",
            "C005",
        ],
        "age": [25, 30, 35, 40, 45],
        "gender": [
            "Male",
            "Female",
            "Male",
            "Female",
            "Male",
        ],
        "churn": [
            "Yes",
            "No",
            "Yes",
            "No",
            "Yes",
        ],
    })

    billing = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
            "C003",
            "C004",
            "C005",
        ],
        "monthly_charges": [
            90,
            50,
            85,
            55,
            95,
        ],
        "total_charges": [
            900,
            500,
            850,
            550,
            950,
        ],
    })

    customers.to_csv(
        tmp_path / "customers.csv",
        index=False,
    )

    billing.to_csv(
        tmp_path / "billing.csv",
        index=False,
    )

    return tmp_path


@pytest.fixture
def one_to_many_dir(tmp_path):

    customers = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
            "C003",
            "C004",
            "C005",
        ],
        "age": [
            25,
            30,
            35,
            40,
            45,
        ],
        "churn": [
            "Yes",
            "No",
            "Yes",
            "No",
            "Yes",
        ],
    })

    usage = pd.DataFrame({
        "customer_id": [
            "C001",
            "C001",
            "C002",
            "C002",
            "C003",
            "C003",
            "C004",
            "C005",
        ],
        "usage_hours": [
            10,
            20,
            30,
            40,
            15,
            25,
            50,
            5,
        ],
        "session_type": [
            "web",
            "mobile",
            "web",
            "mobile",
            "web",
            "mobile",
            "web",
            "mobile",
        ],
    })

    customers.to_csv(
        tmp_path / "customers.csv",
        index=False,
    )

    usage.to_csv(
        tmp_path / "usage.csv",
        index=False,
    )

    return tmp_path


@pytest.fixture
def missing_entities_dir(tmp_path):

    customers = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
            "C003",
            "C004",
            "C005",
            "C006",
            "C007",
            "C008",
            "C009",
            "C010",
        ],
        "age": [
            20,
            21,
            22,
            23,
            24,
            25,
            26,
            27,
            28,
            29,
        ],
        "churn": [
            "Yes",
            "No",
            "Yes",
            "No",
            "Yes",
            "No",
            "Yes",
            "No",
            "Yes",
            "No",
        ],
    })

    billing = pd.DataFrame({
        "customer_id": [
            "C005",
            "C006",
            "C007",
            "C008",
            "C009",
            "C010",
            "C011",
            "C012",
        ],
        "monthly_charges": [
            50,
            55,
            60,
            65,
            70,
            75,
            80,
            85,
        ],
    })

    customers.to_csv(
        tmp_path / "customers.csv",
        index=False,
    )

    billing.to_csv(
        tmp_path / "billing.csv",
        index=False,
    )

    return tmp_path


@pytest.fixture
def identical_duplicate_dir(tmp_path):

    customers = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
            "C003",
        ],
        "age": [
            25,
            30,
            35,
        ],
        "churn": [
            "Yes",
            "No",
            "Yes",
        ],
    })

    profile = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
            "C003",
        ],
        "age": [
            25,
            30,
            35,
        ],
        "monthly_charges": [
            80,
            50,
            90,
        ],
    })

    customers.to_csv(
        tmp_path / "customers.csv",
        index=False,
    )

    profile.to_csv(
        tmp_path / "profile.csv",
        index=False,
    )

    return tmp_path


@pytest.fixture
def conflicting_duplicate_dir(tmp_path):

    customers = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
            "C003",
        ],
        "age": [
            25,
            30,
            35,
        ],
        "churn": [
            "Yes",
            "No",
            "Yes",
        ],
    })

    profile = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
            "C003",
        ],
        "age": [
            26,
            31,
            36,
        ],
        "monthly_charges": [
            80,
            50,
            90,
        ],
    })

    customers.to_csv(
        tmp_path / "customers.csv",
        index=False,
    )

    profile.to_csv(
        tmp_path / "profile.csv",
        index=False,
    )

    return tmp_path


# ==============================================================
# DATASET DISCOVERY
# ==============================================================

def test_common_key_detection(one_to_one_dir):

    datasets = discover_datasets(
        one_to_one_dir
    )

    schemas = analyze_schemas(
        datasets
    )

    result = detect_entity_key(
        datasets,
        schemas,
    )

    assert result["key"] == "customer_id"
    assert result["confidence"] > 0


# ==============================================================
# RELATIONSHIP DETECTION
# ==============================================================

def test_one_to_one_relationship(one_to_one_dir):

    datasets = discover_datasets(
        one_to_one_dir
    )

    schemas = analyze_schemas(
        datasets
    )

    detection = detect_entity_key(
        datasets,
        schemas,
    )

    relationships = analyze_relationships(
        datasets,
        detection["column_by_dataset"],
        target_column="churn",
    )

    for dataset_name in datasets:

        assert (
            relationships["per_dataset"]
            [dataset_name]
            ["cardinality"]
            == "one-per-entity"
        )


def test_one_to_many_detection(one_to_many_dir):

    datasets = discover_datasets(
        one_to_many_dir
    )

    schemas = analyze_schemas(
        datasets
    )

    detection = detect_entity_key(
        datasets,
        schemas,
    )

    relationships = analyze_relationships(
        datasets,
        detection["column_by_dataset"],
        target_column="churn",
    )

    assert (
        relationships["per_dataset"]
        ["usage"]
        ["cardinality"]
        == "many-per-entity"
    )


# ==============================================================
# AGGREGATION
# ==============================================================

def test_many_to_one_aggregation(one_to_many_dir):

    usage = pd.read_csv(
        one_to_many_dir / "usage.csv"
    )

    aggregated = _aggregate_to_entity_level(
        usage,
        "customer_id",
        {
            "usage_hours": "mean",
            "session_type": "mode",
        },
    )

    assert len(aggregated) == 5

    assert aggregated[
        "customer_id"
    ].is_unique

    c001 = aggregated.loc[
        aggregated["customer_id"] == "C001",
        "usage_hours",
    ].iloc[0]

    assert c001 == 15


# ==============================================================
# MISSING ENTITIES
# ==============================================================

def test_missing_entities_reported(
    missing_entities_dir,
):

    output_csv = (
        missing_entities_dir
        / "integrated.csv"
    )

    metadata_path = (
        missing_entities_dir
        / "integration_metadata.json"
    )

    run_integration(
        str(missing_entities_dir),
        "churn",
        output_csv=str(output_csv),
        metadata_path=str(metadata_path),
    )

    metadata = json.loads(
        metadata_path.read_text(
            encoding="utf-8"
        )
    )

    operation = metadata[
        "merge"
    ]["operations"][0]

    assert operation[
        "matched_entities"
    ] == 6

    # Merge order can determine which side is called
    # "incoming" and which is called "accumulated".
    # Therefore validate the two counts together.

    unmatched_counts = sorted([
        operation[
            "unmatched_from_incoming_dataset"
        ],
        operation[
            "unmatched_from_accumulated_dataset"
        ],
    ])

    assert unmatched_counts == [
        2,
        4,
    ]

    assert sorted(
        operation[
            "incoming_only_entities"
        ]
        + operation[
            "accumulated_only_entities"
        ]
    ) == [
        "C001",
        "C002",
        "C003",
        "C004",
        "C011",
        "C012",
    ]

    unified = pd.read_csv(
        output_csv
    )

    assert len(unified) == 12

    assert unified[
        "customer_id"
    ].is_unique


# ==============================================================
# IDENTICAL DUPLICATE COLUMNS
# ==============================================================

def test_identical_duplicate_columns_deduped(
    identical_duplicate_dir,
):

    output_csv = (
        identical_duplicate_dir
        / "integrated.csv"
    )

    metadata_path = (
        identical_duplicate_dir
        / "integration_metadata.json"
    )

    run_integration(
        str(identical_duplicate_dir),
        "churn",
        output_csv=str(output_csv),
        metadata_path=str(metadata_path),
    )

    unified = pd.read_csv(
        output_csv
    )

    assert "age" in unified.columns

    age_columns = [
        column
        for column in unified.columns
        if column.startswith("age")
    ]

    assert len(age_columns) == 1

    metadata = json.loads(
        metadata_path.read_text(
            encoding="utf-8"
        )
    )

    assert len(
        metadata[
            "merge"
        ][
            "duplicate_columns_removed"
        ]
    ) == 1


# ==============================================================
# CONFLICTING DUPLICATE COLUMNS
# ==============================================================

def test_conflicting_duplicate_columns_flagged(
    conflicting_duplicate_dir,
):

    output_csv = (
        conflicting_duplicate_dir
        / "integrated.csv"
    )

    metadata_path = (
        conflicting_duplicate_dir
        / "integration_metadata.json"
    )

    run_integration(
        str(conflicting_duplicate_dir),
        "churn",
        output_csv=str(output_csv),
        metadata_path=str(metadata_path),
    )

    unified = pd.read_csv(
        output_csv
    )

    age_columns = [
        column
        for column in unified.columns
        if column.startswith("age")
    ]

    assert len(age_columns) == 2

    metadata = json.loads(
        metadata_path.read_text(
            encoding="utf-8"
        )
    )

    assert len(
        metadata[
            "merge"
        ]["conflicts"]
    ) == 1


# ==============================================================
# SAFE MERGE
# ==============================================================

def test_safe_merging_no_row_multiplication():

    customers = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
        ],
        "age": [
            25,
            30,
        ],
    })

    billing = pd.DataFrame({
        "customer_id": [
            "C001",
            "C002",
        ],
        "monthly_charges": [
            80,
            50,
        ],
    })

    frames = {
        "customers": customers,
        "billing": billing,
    }

    unified, report = safe_merge(
        entity_frames=frames,
        canonical_key="customer_id",
        order=[
            "customers",
            "billing",
        ],
        dataset_relationships={
            "per_dataset": {
                "billing": {
                    "cardinality":
                        "one-per-entity"
                }
            }
        },
    )

    assert len(unified) == 2

    assert unified[
        "customer_id"
    ].is_unique

    assert report[
        "final_row_count"
    ] == 2

    assert report[
        "row_multiplication_detected"
    ] is False


# ==============================================================
# FULL INTEGRATION
# ==============================================================

def test_integrated_dataset_and_metadata_created(
    one_to_one_dir,
):

    output_csv = (
        one_to_one_dir
        / "integrated.csv"
    )

    metadata_path = (
        one_to_one_dir
        / "integration_metadata.json"
    )

    run_integration(
        str(one_to_one_dir),
        "churn",
        output_csv=str(output_csv),
        metadata_path=str(metadata_path),
    )

    assert output_csv.exists()

    assert metadata_path.exists()

    unified = pd.read_csv(
        output_csv
    )

    assert len(unified) == 5

    assert unified[
        "customer_id"
    ].is_unique

    assert "age" in unified.columns

    assert (
        "monthly_charges"
        in unified.columns
    )

    assert "churn" in unified.columns

    metadata = json.loads(
        metadata_path.read_text(
            encoding="utf-8"
        )
    )

    assert metadata[
        "target_column"
    ] == "churn"

    assert metadata[
        "final_row_count"
    ] == 5


# ==============================================================
# TARGET VALIDATION
# ==============================================================

def test_target_not_found_fails_clearly(
    one_to_one_dir,
):

    with pytest.raises(
        MineError
    ):

        run_integration(
            str(one_to_one_dir),
            "does_not_exist",
            output_csv=str(
                one_to_one_dir
                / "integrated.csv"
            ),
            metadata_path=str(
                one_to_one_dir
                / "integration_metadata.json"
            ),
        )


# ==============================================================
# BACKWARD COMPATIBILITY
# ==============================================================

def test_single_csv_still_exists():

    input_file = Path(
        "data/input/clean_dataset.csv"
    )

    assert input_file.exists()


# ==============================================================
# CLI ARGUMENT VALIDATION
# ==============================================================
#
# We deliberately do NOT launch main.py here.
#
# Launching main.py would execute the entire Mine pipeline,
# including modeling, SHAP and LLM stages, making the test
# unnecessarily slow.
#
# The actual CLI will be manually tested after these unit
# tests pass.
# ==============================================================

def test_cli_argument_definitions():

    import main

    parser = main.build_parser()

    actions = {
        action.dest: action
        for action in parser._actions
    }

    assert "input" in actions
    assert "input_dir" in actions
    assert "target" in actions


def test_cli_rejects_both_input_and_input_dir():

    import main

    parser = main.build_parser()

    with pytest.raises(
        SystemExit
    ):

        parser.parse_args([
            "--input",
            "data/input/clean_dataset.csv",
            "--input-dir",
            "data/company_test",
            "--target",
            "churn",
        ])