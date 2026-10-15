from src.llm.client import DEFAULT_MODEL, chat_json


class BehaviorIntelligenceAgent:
    def __init__(self, model=DEFAULT_MODEL):
        self.name = "Churn Behaviour Intelligence Agent"
        self.model = model

    def build_evidence_text(self, behavior_data):
        lines = []
        overall = behavior_data["overall"]
        lines.append("OVERALL EVIDENCE")
        lines.append(f"Total rows: {overall['total_rows']}")
        lines.append(f"Positive-class count: {overall['positive_count']}")
        lines.append(f"Negative-class count: {overall['negative_count']}")
        lines.append(f"Positive-class rate (fraction 0.0-1.0): {overall['positive_rate']}")
        lines.append("")
        lines.append("CATEGORICAL EVIDENCE")
        for item in behavior_data.get("categorical_analysis") or []:
            lines.append(f"Feature: {item['feature']}")
            lines.append(f"Category: {item['category']}")
            lines.append(f"Group size: {item['group_size']}")
            lines.append(f"Positive count: {item['positive_count']}")
            lines.append(f"Positive rate (fraction 0.0-1.0): {item['positive_rate']}")
            lines.append(f"Rate difference: {item['rate_difference']}")
            lines.append(f"Direction: {item['direction']}")
            lines.append(f"Evidence strength: {item['evidence_strength']}")
            lines.append("")
        lines.append("NUMERICAL EVIDENCE")
        for item in behavior_data.get("numerical_analysis") or []:
            lines.append(f"Feature: {item['feature']}")
            lines.append(f"Positive-class mean: {item['positive_mean']}")
            lines.append(f"Negative-class mean: {item['negative_mean']}")
            lines.append(f"Overall mean: {item['overall_mean']}")
            lines.append(f"Mean difference: {item['mean_difference']}")
            lines.append(f"Cohen's d: {item['effect_size_cohens_d']}")
            lines.append(f"Effect strength: {item['effect_strength']}")
            lines.append(f"Direction: {item['direction']}")
            lines.append("")
        lines.append("RELIABILITY WARNINGS")
        for warning in behavior_data.get("reliability_warnings") or []:
            lines.append(f"[{warning['severity']}] {warning['message']}")
        return "\n".join(lines)

    def build_prompt(self, behavior_data):
        evidence_text = self.build_evidence_text(behavior_data)
        return f"""
You are a Churn Behaviour Intelligence Agent.

Interpret ONLY the evidence below.
Do not invent numbers, features, categories, counts, or thresholds.
Do not provide business recommendations, interventions, discounts, or targeting advice.
Do not claim causation or statistical significance.

0% positive-class rate does NOT mean 0 records.
100% positive-class rate does NOT mean 1 record.
Always preserve the supplied group size.
positive_rate is a fraction in the range 0.0 to 1.0 (NOT a percentage).
The evidence lists "Positive rate" and "Positive-class rate" as the same 0.0 to 1.0 fraction.
Always copy that fraction into the "positive_rate" field.

SOURCE EVIDENCE:
{evidence_text}

Return ONLY valid JSON:
{{
  "overall_summary": "describe overall target distribution using exact numbers",
  "categorical_patterns": [
    {{
      "feature": "exact feature name",
      "category": "exact category name",
      "records": 0,
      "positive_cases": 0,
      "positive_rate": 0.0,
      "interpretation": "one sentence using the exact numbers"
    }}
  ],
  "numerical_patterns": [
    {{
      "feature": "exact feature name",
      "positive_mean": 0.0,
      "negative_mean": 0.0,
      "mean_difference": 0.0,
      "cohens_d": 0.0,
      "interpretation": "one sentence using the exact numbers"
    }}
  ],
  "reliability": ["use only supplied warnings"],
  "limitations": ["small data / no causation / no generalization"]
}}

Copy numbers from the evidence. Do not round counts to a different integer.
"""

    def generate_analysis(self, behavior_data):
        return chat_json(self.build_prompt(behavior_data), model=self.model)


def generate_behavior_analysis(behavior_data):
    return BehaviorIntelligenceAgent().generate_analysis(behavior_data)
