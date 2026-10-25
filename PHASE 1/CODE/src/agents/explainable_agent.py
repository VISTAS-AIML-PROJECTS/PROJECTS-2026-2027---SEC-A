from src.llm.client import DEFAULT_MODEL, chat_json


class ExplainableAIAgent:
    def __init__(self, model=DEFAULT_MODEL):
        self.name = "Explainable AI Agent"
        self.model = model

    def build_prompt(self, evidence):
        prediction = evidence.get("prediction")
        probability = evidence.get("probability")
        risk_level = evidence.get("risk_level")
        top_factors = evidence.get("top_factors") or []

        factor_lines = []
        for factor in top_factors:
            factor_lines.append(
                f"- Feature: {factor['feature']}\n"
                f"  Value: {factor['value']}\n"
                f"  SHAP value: {factor['shap_value']:.4f}\n"
                f"  Impact: {factor['impact']}"
            )
        factors_text = "\n".join(factor_lines)

        return f"""
You are an Explainable AI Agent.

Interpret ONLY the evidence below.
Do not calculate a new prediction.
Do not invent features, values, or probabilities.
Do not claim that a feature caused the outcome.
Do not say the customer will definitely churn or leave.

MODEL EVIDENCE
Prediction: {prediction}
Churn probability: {probability}
Risk level: {risk_level}

Top SHAP-supported factors:
{factors_text}

Return ONLY valid JSON with this schema:
{{
  "prediction": "{prediction}",
  "probability": {probability},
  "risk_level": "{risk_level}",
  "mentioned_features": ["feature_name"],
  "explanation": "2-4 paragraph explanation using the evidence"
}}

Copy prediction, probability, and risk_level exactly.
Use only features from the evidence.
Interpret SHAP as model contribution, not causation.
"""

    def generate_explanation(self, evidence):
        return chat_json(self.build_prompt(evidence), model=self.model)


def generate_agent_explanation(evidence):
    return ExplainableAIAgent().generate_explanation(evidence)
