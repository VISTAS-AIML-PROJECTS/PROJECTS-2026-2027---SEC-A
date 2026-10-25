import json
import os
from pathlib import Path

from src.behavior.evidence_validator import (
    validate_behavior_interpretation,
    SUPPORTED,
    UNSUPPORTED,
    CONTRADICTED,
    REQUIRES_REVIEW
)
from src.agents.explanation_validator import validate_explanation
from src.agents.decision_validator import validate_decision


def _aggregate_metrics(validation_list):
    """
    Aggregate metrics across a list of validation result dicts.
    """
    if not validation_list:
        return {
            "evidence_support_rate": None,
            "numeric_accuracy": None,
            "category_accuracy": None,
            "unsupported_claim_rate": None,
            "contradiction_rate": None,
            "causal_violation_rate": None,
            "recommendation_violation_rate": None,
            "validator_pass_rate": None,
            "total_evaluations": 0,
            "total_claims": 0,
        }

    total_evals = len(validation_list)
    passed_evals = sum(1 for v in validation_list if v.get("valid"))

    all_claims = []
    for v in validation_list:
        all_claims.extend(v.get("claims", []))

    total_claims = max(len(all_claims), 1)
    counts = {
        SUPPORTED: sum(1 for c in all_claims if c["verdict"] == SUPPORTED),
        UNSUPPORTED: sum(1 for c in all_claims if c["verdict"] == UNSUPPORTED),
        CONTRADICTED: sum(1 for c in all_claims if c["verdict"] == CONTRADICTED),
        REQUIRES_REVIEW: sum(1 for c in all_claims if c["verdict"] == REQUIRES_REVIEW),
    }

    numeric_claims = [
        c for c in all_claims
        if c.get("type") in {
            "incorrect_count",
            "incorrect_percentage",
            "incorrect_mean",
            "incorrect_target_rate",
            "incorrect_probability",
        }
    ]
    numeric_supported = sum(1 for c in numeric_claims if c["verdict"] == SUPPORTED)

    category_claims = [
        c for c in all_claims
        if c.get("type") in {
            "incorrect_count",
            "incorrect_percentage",
            "unknown_category",
            "unknown_feature",
            "prediction_consistency",
            "incorrect_risk",
        }
    ]
    category_supported = sum(1 for c in category_claims if c["verdict"] == SUPPORTED)

    causal = sum(1 for c in all_claims if c.get("type") == "causal_language")
    recommendations = sum(
        1 for c in all_claims
        if (c.get("type") in {"unsupported_recommendation", "recommendation_support"} and c["verdict"] != SUPPORTED)
        or c.get("type") == "unsupported_recommendation"
    )

    return {
        "evidence_support_rate": round(counts[SUPPORTED] / total_claims, 4),
        "numeric_accuracy": (
            round(numeric_supported / len(numeric_claims), 4)
            if numeric_claims else None
        ),
        "category_accuracy": (
            round(category_supported / len(category_claims), 4)
            if category_claims else None
        ),
        "unsupported_claim_rate": round(counts[UNSUPPORTED] / total_claims, 4),
        "contradiction_rate": round(counts[CONTRADICTED] / total_claims, 4),
        "causal_violation_rate": round(causal / total_claims, 4),
        "recommendation_violation_rate": round(recommendations / total_claims, 4),
        "validator_pass_rate": round(passed_evals / total_evals, 4),
        "total_evaluations": total_evals,
        "total_claims": len(all_claims),
        "passed_evaluations": passed_evals,
    }


def run_ab_evaluation(
    behavior_data,
    behavior_agent_output,
    explanations_output,
    decisions_output,
    output_dir="data/reports"
):
    """
    Run comparative research evaluation:
    Condition A: Python evidence -> Qwen3 -> RAW / UNVALIDATED OUTPUT
    Condition B: Python evidence -> Qwen3 -> VALIDATOR -> VALIDATED / FALLBACK OUTPUT

    Evaluates all 3 agents:
    - Behaviour Intelligence Agent
    - Explanation Agent
    - Decision Agent
    """
    os.makedirs(output_dir, exist_ok=True)
    report_file = os.path.join(output_dir, "ab_evaluation.json")

    # -------------------------------------------------------------
    # 1. BEHAVIOUR AGENT A/B EVALUATION
    # -------------------------------------------------------------
    raw_behavior = behavior_agent_output.get("unvalidated_interpretation")
    validated_behavior = behavior_agent_output.get("interpretation")

    if raw_behavior is not None:
        behavior_cond_a_val = validate_behavior_interpretation(behavior_data, raw_behavior)
        behavior_cond_a = {
            "status": "AVAILABLE",
            "output": raw_behavior,
            "validation": behavior_cond_a_val,
            "metrics": behavior_cond_a_val.get("metrics"),
        }
    else:
        behavior_cond_a = {
            "status": "UNAVAILABLE",
            "reason": "Ollama was unavailable; raw LLM output was not generated to avoid fabrication.",
            "metrics": None,
        }

    stored_validation = behavior_agent_output.get("validation")
    if stored_validation is None:
        stored_validation = validate_behavior_interpretation(behavior_data, validated_behavior)
    behavior_cond_b_val = stored_validation
    behavior_cond_b = {
        "status": "AVAILABLE",
        "source": behavior_agent_output.get("source", "validated"),
        "output": validated_behavior,
        "validation": behavior_cond_b_val,
        "metrics": behavior_cond_b_val.get("metrics"),
    }

    # -------------------------------------------------------------
    # 2. EXPLANATION AGENT A/B EVALUATION
    # -------------------------------------------------------------
    expl_items = explanations_output.get("explanations", [])
    has_raw_expl = any(item.get("unvalidated_explanation") is not None for item in expl_items)

    expl_cond_a_vals = []
    expl_cond_b_vals = []

    for item in expl_items:
        evidence = {
            "row_index": item.get("row_index"),
            "prediction": item.get("prediction"),
            "probability": item.get("probability"),
            "risk_level": item.get("risk_level"),
            "customer_features": item.get("customer_features"),
            "top_factors": item.get("top_factors"),
        }
        # Condition A
        raw_exp = item.get("unvalidated_explanation")
        if raw_exp is not None:
            expl_cond_a_vals.append(validate_explanation(evidence, raw_exp))

        # Condition B
        val_exp = item.get("explanation")
        b_val = item.get("validation") or validate_explanation(evidence, val_exp)
        expl_cond_b_vals.append(b_val)

    if has_raw_expl and expl_cond_a_vals:
        explanation_cond_a = {
            "status": "AVAILABLE",
            "metrics": _aggregate_metrics(expl_cond_a_vals),
            "evaluations_count": len(expl_cond_a_vals),
        }
    else:
        explanation_cond_a = {
            "status": "UNAVAILABLE",
            "reason": "Ollama was unavailable; raw LLM output was not generated to avoid fabrication.",
            "metrics": None,
        }

    explanation_cond_b = {
        "status": "AVAILABLE",
        "metrics": _aggregate_metrics(expl_cond_b_vals),
        "evaluations_count": len(expl_cond_b_vals),
    }

    # -------------------------------------------------------------
    # 3. DECISION AGENT A/B EVALUATION
    # -------------------------------------------------------------
    dec_items = decisions_output.get("decisions", [])
    has_raw_dec = any(item.get("unvalidated_decision") is not None for item in dec_items)

    dec_cond_a_vals = []
    dec_cond_b_vals = []

    for item in dec_items:
        evidence = {
            "row_index": item.get("row_index"),
            "prediction": item.get("prediction"),
            "probability": item.get("probability"),
            "risk_level": item.get("risk_level"),
            "customer_features": item.get("customer_features"),
            "top_factors": item.get("top_factors"),
        }
        # Condition A
        raw_dec = item.get("unvalidated_decision")
        if raw_dec is not None:
            dec_cond_a_vals.append(validate_decision(evidence, raw_dec))

        # Condition B
        val_dec = item.get("decision")
        b_val = item.get("validation") or validate_decision(evidence, val_dec)
        dec_cond_b_vals.append(b_val)

    if has_raw_dec and dec_cond_a_vals:
        decision_cond_a = {
            "status": "AVAILABLE",
            "metrics": _aggregate_metrics(dec_cond_a_vals),
            "evaluations_count": len(dec_cond_a_vals),
        }
    else:
        decision_cond_a = {
            "status": "UNAVAILABLE",
            "reason": "Ollama was unavailable; raw LLM output was not generated to avoid fabrication.",
            "metrics": None,
        }

    decision_cond_b = {
        "status": "AVAILABLE",
        "metrics": _aggregate_metrics(dec_cond_b_vals),
        "evaluations_count": len(dec_cond_b_vals),
    }

    # -------------------------------------------------------------
    # 4. OVERALL / COMBINED A/B COMPARISON
    # -------------------------------------------------------------
    all_cond_a_vals = []
    if behavior_cond_a.get("status") == "AVAILABLE":
        all_cond_a_vals.append(behavior_cond_a["validation"])
    all_cond_a_vals.extend(expl_cond_a_vals)
    all_cond_a_vals.extend(dec_cond_a_vals)

    all_cond_b_vals = []
    if behavior_cond_b.get("status") == "AVAILABLE":
        all_cond_b_vals.append(behavior_cond_b["validation"])
    all_cond_b_vals.extend(expl_cond_b_vals)
    all_cond_b_vals.extend(dec_cond_b_vals)

    overall_cond_a = (
        _aggregate_metrics(all_cond_a_vals)
        if all_cond_a_vals else None
    )
    overall_cond_b = _aggregate_metrics(all_cond_b_vals)

    results = {
        "experiment": "Phase 9 A/B Research Evaluation",
        "description": (
            "Condition A (Raw Qwen Output) vs "
            "Condition B (Validated / Fallback Output) across all three agents."
        ),
        "condition_a": {
            "name": "Condition A (Raw Unvalidated LLM Output)",
            "behavior_agent": behavior_cond_a,
            "explanation_agent": explanation_cond_a,
            "decision_agent": decision_cond_a,
            "overall_metrics": overall_cond_a,
        },
        "condition_b": {
            "name": "Condition B (Programmatically Validated / Fallback Output)",
            "behavior_agent": behavior_cond_b,
            "explanation_agent": explanation_cond_b,
            "decision_agent": decision_cond_b,
            "overall_metrics": overall_cond_b,
        },
    }

    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4, default=str, ensure_ascii=False)

    return results
