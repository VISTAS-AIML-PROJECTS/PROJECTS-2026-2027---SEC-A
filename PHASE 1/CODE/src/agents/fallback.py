def fallback_behavior_interpretation(behavior_data):
    overall = behavior_data.get("overall") or {}
    patterns = []
    for item in behavior_data.get("categorical_analysis") or []:
        patterns.append(
            {
                "feature": item["feature"],
                "category": item["category"],
                "records": item["group_size"],
                "positive_cases": item["positive_count"],
                "positive_rate": item["positive_rate"],
                "interpretation": (
                    f"{item['category']} in {item['feature']} has "
                    f"{item['group_size']} records, "
                    f"{item['positive_count']} positive cases, and a "
                    f"{item['positive_rate'] * 100:.1f}% positive-class rate."
                ),
            }
        )

    numerical = []
    for item in behavior_data.get("numerical_analysis") or []:
        numerical.append(
            {
                "feature": item["feature"],
                "positive_mean": item["positive_mean"],
                "negative_mean": item["negative_mean"],
                "mean_difference": item["mean_difference"],
                "cohens_d": item["effect_size_cohens_d"],
                "interpretation": (
                    f"{item['feature']} has a positive-class mean of "
                    f"{item['positive_mean']} versus {item['negative_mean']} "
                    f"in the other class (Cohen's d={item['effect_size_cohens_d']}). "
                    "This is an observed association in the dataset, not a causal effect."
                ),
            }
        )

    reliability = [
        item.get("message")
        for item in behavior_data.get("reliability_warnings") or []
    ]
    limitations = [
        "The development dataset may be small and is used primarily for pipeline validation.",
        "Associations do not establish causation.",
        "Findings should not be treated as generalizable without larger data.",
    ]

    overall_summary = (
        f"The dataset contains {overall.get('total_rows')} rows. "
        f"The positive-class rate for {behavior_data.get('target')} "
        f"({behavior_data.get('positive_class')}) is "
        f"{(overall.get('positive_rate') or 0) * 100:.1f}%."
    )

    return {
        "overall_summary": overall_summary,
        "categorical_patterns": patterns,
        "numerical_patterns": numerical,
        "reliability": reliability,
        "limitations": limitations,
        "source": "deterministic_fallback",
    }


def fallback_explanation(evidence):
    factors = evidence.get("top_factors") or []
    lines = []
    for factor in factors:
        lines.append(
            f"{factor.get('feature')} (value={factor.get('value')}) has SHAP "
            f"{factor.get('shap_value')}, which {factor.get('impact')} "
            "the model's predicted positive-class score."
        )
    explanation = (
        f"The model predicts '{evidence.get('prediction')}' with a predicted "
        f"probability of {evidence.get('probability')} and risk level "
        f"{evidence.get('risk_level')}. "
        "SHAP indicates the following features contributed to the model prediction. "
        "This does not mean they cause the outcome. "
        + " ".join(lines)
        + " The development dataset may be small, so this explanation is for "
        "pipeline validation rather than generalization."
    )
    return {
        "prediction": evidence.get("prediction"),
        "probability": evidence.get("probability"),
        "risk_level": evidence.get("risk_level"),
        "explanation": explanation,
        "mentioned_features": [item.get("feature") for item in factors],
        "source": "deterministic_fallback",
    }


def fallback_decision(evidence):
    risk = str(evidence.get("risk_level") or "UNKNOWN").upper()
    if risk == "HIGH":
        action = (
            "Review recent support interactions and satisfaction indicators."
        )
    elif risk == "MEDIUM":
        action = "Continue review and further investigation of the top contributing features."
    else:
        action = "Continue standard monitoring."

    return {
        "prediction": evidence.get("prediction"),
        "probability": evidence.get("probability"),
        "priority": risk if risk in {"HIGH", "MEDIUM", "LOW"} else "REVIEW",
        "recommended_action": action,
        "rationale": (
            "The action is limited to review, monitoring, or investigation "
            "because the available evidence does not include business policies "
            "for discounts, refunds, or other interventions."
        ),
        "caution": (
            "This is decision support, not an automatic action. "
            "SHAP values describe model contributions, not causal relationships. "
            "Outcomes are not guaranteed."
        ),
        "source": "deterministic_fallback",
    }
