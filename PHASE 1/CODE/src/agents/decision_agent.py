from src.llm.client import DEFAULT_MODEL, chat_json


class DecisionAgent:
    def __init__(self, model=DEFAULT_MODEL):
        self.name = "Decision Agent"
        self.model = model

    def build_prompt(self, evidence, explanation=None):
        prediction = evidence.get("prediction")
        probability = evidence.get("probability")
        risk_level = evidence.get("risk_level")
        top_factors = evidence.get("top_factors") or []

        factor_lines = []
        for factor in top_factors:
            factor_lines.append(
                f"- {factor['feature']}: value={factor['value']}, "
                f"SHAP={factor['shap_value']}, impact={factor['impact']}"
            )
        factors_text = "\n".join(factor_lines)
        explanation_text = ""
        if explanation:
            if isinstance(explanation, dict):
                explanation_text = explanation.get("explanation") or str(explanation)
            else:
                explanation_text = str(explanation)

        return f"""
You are a Decision Support Agent.

Use ONLY the evidence below.
Do not invent discounts, refunds, credits, compensation,
price reductions, company policies, or guaranteed outcomes.

If evidence is insufficient for a specific intervention,
recommend review, monitoring, or further investigation.

EVIDENCE
Prediction: {prediction}
Probability: {probability}
Risk level: {risk_level}

Top factors:
{factors_text}

Validated explanation:
{explanation_text}

Return ONLY valid JSON:
{{
  "prediction": "{prediction}",
  "probability": {probability},
  "priority": "{risk_level}",
  "recommended_action": "review, monitoring, or investigation only",
  "rationale": "tie the action to the supplied features and SHAP contributions",
  "caution": "no causation, no guaranteed retention"
}}

Copy prediction, probability, and priority/risk exactly.
"""

    def generate_decision(self, evidence, explanation=None):
        return chat_json(
            self.build_prompt(evidence, explanation=explanation),
            model=self.model,
        )


def generate_decision(evidence, explanation=None):
    return DecisionAgent().generate_decision(evidence, explanation=explanation)
