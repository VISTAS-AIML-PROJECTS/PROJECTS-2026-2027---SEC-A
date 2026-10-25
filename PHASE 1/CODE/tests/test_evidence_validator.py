import json
from pathlib import Path

import pytest

from src.behavior.evidence_validator import (
    CONTRADICTED,
    SUPPORTED,
    UNSUPPORTED,
    validate_behavior_interpretation,
)


@pytest.fixture
def behavior_data():
    path = Path("data/behavior/churn_behavior.json")
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _verdicts(result, claim_type=None):
    claims = result["claims"]
    if claim_type:
        claims = [item for item in claims if item["type"] == claim_type]
    return {item["verdict"] for item in claims}


def test_correct_count_supported(behavior_data):
    result = validate_behavior_interpretation(
        behavior_data,
        "One year has 8 records.",
    )
    assert CONTRADICTED not in _verdicts(result, "incorrect_count")
    assert SUPPORTED in _verdicts(result, "incorrect_count")


def test_incorrect_count_contradicted(behavior_data):
    result = validate_behavior_interpretation(
        behavior_data,
        "One year has 5 records.",
    )
    assert CONTRADICTED in _verdicts(result, "incorrect_count")
    assert result["valid"] is False


def test_incorrect_percentage_contradicted(behavior_data):
    result = validate_behavior_interpretation(
        behavior_data,
        "Female customers have a 100% churn rate.",
    )
    assert CONTRADICTED in _verdicts(result, "incorrect_percentage")


def test_correct_percentage_supported(behavior_data):
    result = validate_behavior_interpretation(
        behavior_data,
        "Female customers have a 0% positive-class rate.",
    )
    assert CONTRADICTED not in _verdicts(result, "incorrect_percentage")
    assert SUPPORTED in _verdicts(result, "incorrect_percentage")


def test_numerical_direction_contradicted(behavior_data):
    result = validate_behavior_interpretation(
        behavior_data,
        "usage_hours is higher among churned customers.",
    )
    assert CONTRADICTED in _verdicts(result, "unsupported_numerical_claim")


def test_unknown_feature(behavior_data):
    result = validate_behavior_interpretation(
        behavior_data,
        "The feature `loyalty_points` appears important.",
    )
    assert UNSUPPORTED in _verdicts(result, "unknown_feature")


def test_unknown_category_structured(behavior_data):
    payload = {
        "categorical_patterns": [
            {
                "feature": "contract",
                "category": "Lifetime",
                "records": 3,
                "positive_rate": 0.2,
            }
        ]
    }
    result = validate_behavior_interpretation(behavior_data, payload)
    assert UNSUPPORTED in _verdicts(result, "unknown_category")


def test_causal_claim(behavior_data):
    result = validate_behavior_interpretation(
        behavior_data,
        "Month-to-month contracts cause churn.",
    )
    assert any(item["type"] == "causal_language" for item in result["claims"])
    assert result["valid"] is False


def test_unsupported_recommendation(behavior_data):
    result = validate_behavior_interpretation(
        behavior_data,
        "We recommend offering a discount to month-to-month customers.",
    )
    assert any(item["type"] == "unsupported_recommendation" for item in result["claims"])


def test_structured_correct_values_pass_numeric(behavior_data):
    payload = {
        "overall_summary": "The dataset contains 30 rows with a 50% positive-class rate.",
        "categorical_patterns": [
            {
                "feature": "contract",
                "category": "One year",
                "records": 8,
                "positive_cases": 0,
                "positive_rate": 0.0,
                "interpretation": "One year has 8 records and a 0% positive-class rate.",
            }
        ],
        "numerical_patterns": [
            {
                "feature": "usage_hours",
                "positive_mean": 15.0267,
                "negative_mean": 40.46,
                "interpretation": "usage_hours is lower among churned customers.",
            }
        ],
        "reliability": ["The dataset contains only 30 rows."],
        "limitations": ["Associations do not establish causation."],
    }
    result = validate_behavior_interpretation(behavior_data, payload)
    assert CONTRADICTED not in {item["verdict"] for item in result["claims"]}


def test_two_year_and_bank_transfer_hallucination(behavior_data):
    text = (
        "One year = 5 records. Two year = 10 records. "
        "Bank transfer = 5 records. Electronic check = 10 records."
    )
    result = validate_behavior_interpretation(behavior_data, text)
    contradicted = [
        item for item in result["claims"]
        if item["verdict"] == CONTRADICTED and item["type"] == "incorrect_count"
    ]
    assert len(contradicted) >= 3
