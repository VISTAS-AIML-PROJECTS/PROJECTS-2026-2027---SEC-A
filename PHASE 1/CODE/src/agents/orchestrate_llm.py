import json
from pathlib import Path

from src.agents.decision_agent import generate_decision
from src.agents.decision_validator import validate_decision
from src.agents.explainable_agent import generate_agent_explanation
from src.agents.explanation_validator import validate_explanation
from src.agents.fallback import (
    fallback_behavior_interpretation,
    fallback_decision,
    fallback_explanation,
)
from src.agents.retry import MAX_VALIDATION_RETRIES, run_with_validation
from src.behavior.behavior_agent import generate_behavior_analysis
from src.behavior.evidence_validator import validate_behavior_interpretation
from src.llm.client import check_ollama_status


def run_behavior_agent_validated(behavior_data, max_retries=MAX_VALIDATION_RETRIES):
    llm = check_ollama_status()
    if llm["status"] != "AVAILABLE":
        output = fallback_behavior_interpretation(behavior_data)
        validation = validate_behavior_interpretation(behavior_data, output)
        return {
            "agent": "Churn Behaviour Intelligence Agent",
            "llm_status": llm,
            "interpretation": output,
            "validation": validation,
            "source": "deterministic_fallback",
            "rejected": False,
            "unvalidated_interpretation": None,
        }

    unvalidated = None

    def generate(attempt):
        nonlocal unvalidated
        result = generate_behavior_analysis(behavior_data)
        if attempt == 0:
            unvalidated = result
        return result

    result = run_with_validation(
        generate_fn=generate,
        validate_fn=lambda output: validate_behavior_interpretation(
            behavior_data,
            output,
        ),
        fallback_fn=lambda: fallback_behavior_interpretation(behavior_data),
        max_retries=max_retries,
    )
    result["unvalidated_interpretation"] = unvalidated
    result["llm_status"] = llm
    result["agent"] = "Churn Behaviour Intelligence Agent"
    result["interpretation"] = result.pop("output")
    return result


def run_explanations_validated(all_evidence, max_retries=MAX_VALIDATION_RETRIES):
    llm = check_ollama_status()
    results = []
    unvalidated = []

    for evidence in all_evidence:
        if llm["status"] != "AVAILABLE":
            output = fallback_explanation(evidence)
            validation = validate_explanation(evidence, output)
            results.append({
                **evidence,
                "explanation": output,
                "validation": validation,
                "source": "deterministic_fallback",
                "rejected": False,
                "unvalidated_explanation": None,
            })
            continue

        first = {"value": None}

        def generate(attempt, ev=evidence, holder=first):
            result = generate_agent_explanation(ev)
            if attempt == 0:
                holder["value"] = result
            return result

        outcome = run_with_validation(
            generate_fn=generate,
            validate_fn=lambda output, ev=evidence: validate_explanation(ev, output),
            fallback_fn=lambda ev=evidence: fallback_explanation(ev),
            max_retries=max_retries,
        )
        unvalidated.append(first["value"])
        results.append({
            **evidence,
            "explanation": outcome["output"],
            "validation": outcome["validation"],
            "source": outcome["source"],
            "rejected": outcome["rejected"],
            "unvalidated_explanation": first["value"],
        })

    return {
        "llm_status": llm,
        "explanations": results,
        "unvalidated": unvalidated,
    }


def run_decisions_validated(explanations, max_retries=MAX_VALIDATION_RETRIES):
    llm = check_ollama_status()
    results = []
    unvalidated = []

    for item in explanations:
        evidence = {
            "row_index": item.get("row_index"),
            "prediction": item.get("prediction"),
            "probability": item.get("probability"),
            "risk_level": item.get("risk_level"),
            "customer_features": item.get("customer_features"),
            "top_factors": item.get("top_factors"),
        }
        explanation = item.get("explanation")
        explanation_rejected = bool(item.get("rejected"))

        if explanation_rejected:
            explanation_for_decision = None
        else:
            explanation_for_decision = explanation

        if llm["status"] != "AVAILABLE":
            output = fallback_decision(evidence)
            validation = validate_decision(evidence, output)
            results.append({
                "row_index": evidence["row_index"],
                "prediction": evidence["prediction"],
                "probability": evidence["probability"],
                "risk_level": evidence["risk_level"],
                "decision": output,
                "validation": validation,
                "source": "deterministic_fallback",
                "rejected": False,
                "used_validated_explanation": not explanation_rejected,
                "unvalidated_decision": None,
            })
            continue

        first = {"value": None}

        def generate(attempt, ev=evidence, exp=explanation_for_decision, holder=first):
            res = generate_decision(ev, explanation=exp)
            if attempt == 0:
                holder["value"] = res
            return res

        outcome = run_with_validation(
            generate_fn=generate,
            validate_fn=lambda output, ev=evidence: validate_decision(ev, output),
            fallback_fn=lambda ev=evidence: fallback_decision(ev),
            max_retries=max_retries,
        )
        unvalidated.append(first["value"])
        results.append({
            "row_index": evidence["row_index"],
            "prediction": evidence["prediction"],
            "probability": evidence["probability"],
            "risk_level": evidence["risk_level"],
            "decision": outcome["output"],
            "validation": outcome["validation"],
            "source": outcome["source"],
            "rejected": outcome["rejected"],
            "used_validated_explanation": not explanation_rejected,
            "unvalidated_decision": first["value"],
        })

    return {
        "llm_status": llm,
        "decisions": results,
        "unvalidated": unvalidated if llm["status"] == "AVAILABLE" else None,
    }


def save_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=4, default=str, ensure_ascii=False)
    return str(path)
