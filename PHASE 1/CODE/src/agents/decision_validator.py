import re

from src.behavior.evidence_validator import (
    CONTRADICTED,
    SUPPORTED,
    UNSUPPORTED,
    REQUIRES_REVIEW,
    _as_float,
    _close,
    _load_payload,
)


FORBIDDEN_INTERVENTIONS = [
    r"\bdiscounts?\b",
    r"\brefunds?\b",
    r"\bprice reductions?\b",
    r"\bcompensat(?:e|ion)\b",
    r"\b20%\b",
    r"\boffer(?:ing)?\s+a\s+\d+",
]

ALLOWED_ACTION_HINTS = [
    "review",
    "monitor",
    "monitoring",
    "investigate",
    "investigation",
    "further investigation",
    "standard monitoring",
]


class DecisionValidator:
    def __init__(self, evidence, policy=None):
        self.evidence = evidence or {}
        self.policy = policy or {}
        self.prediction = self.evidence.get("prediction")
        self.probability = _as_float(self.evidence.get("probability"))
        self.risk = str(self.evidence.get("risk_level") or "").upper()
        self.allowed_features = {
            str(name).lower()
            for name in (self.evidence.get("customer_features") or {}).keys()
        }
        for factor in self.evidence.get("top_factors") or []:
            if factor.get("feature"):
                self.allowed_features.add(str(factor["feature"]).lower())

    def validate(self, decision):
        payload, text = _load_payload(decision)
        if isinstance(payload, dict):
            text_parts = [
                str(payload.get("priority") or ""),
                str(payload.get("recommended_action") or payload.get("action") or ""),
                str(payload.get("rationale") or ""),
                str(payload.get("caution") or ""),
                str(payload.get("decision") or ""),
            ]
            text = "\n".join(text_parts)
        elif not text:
            text = str(decision or "")

        claims = []
        claims.extend(self._check_prediction(payload, text))
        claims.extend(self._check_probability(payload, text))
        claims.extend(self._check_risk(payload, text))
        claims.extend(self._check_interventions(text))
        claims.extend(self._check_action_support(payload, text))

        blocking = [
            item for item in claims
            if item["verdict"] in {CONTRADICTED, UNSUPPORTED, REQUIRES_REVIEW}
        ]
        valid = len(blocking) == 0
        if any(item["verdict"] == CONTRADICTED for item in claims):
            status = "FAIL"
        elif any(item["verdict"] == UNSUPPORTED for item in claims):
            status = "FAIL"
        elif any(item["verdict"] == REQUIRES_REVIEW for item in claims):
            status = "REQUIRES_REVIEW"
        else:
            status = "PASS"

        total_claims = max(len(claims), 1)
        counts = {
            SUPPORTED: sum(1 for c in claims if c["verdict"] == SUPPORTED),
            UNSUPPORTED: sum(1 for c in claims if c["verdict"] == UNSUPPORTED),
            CONTRADICTED: sum(1 for c in claims if c["verdict"] == CONTRADICTED),
            REQUIRES_REVIEW: sum(1 for c in claims if c["verdict"] == REQUIRES_REVIEW),
        }
        numeric_claims = [c for c in claims if c["type"] in {"incorrect_probability"}]
        numeric_supported = sum(1 for c in numeric_claims if c["verdict"] == SUPPORTED)
        category_claims = [c for c in claims if c["type"] in {"prediction_consistency", "incorrect_risk"}]
        category_supported = sum(1 for c in category_claims if c["verdict"] == SUPPORTED)
        causal = sum(1 for c in claims if c["type"] == "causal_language")
        recommendations = sum(1 for c in claims if c["type"] in {"unsupported_recommendation", "recommendation_support"} and c["verdict"] != SUPPORTED)

        metrics = {
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
            "validator_pass_rate": 1.0 if valid else 0.0,
        }

        return {
            "valid": valid,
            "status": status,
            "claims": claims,
            "errors": [
                {
                    "type": item["type"],
                    "items": [str(item.get("entity") or "")],
                    "message": item["message"],
                    "verdict": item["verdict"],
                }
                for item in blocking
            ],
            "summary": counts,
            "metrics": metrics,
        }

    def _check_prediction(self, payload, text):
        generated = None
        if isinstance(payload, dict) and payload.get("prediction") is not None:
            generated = payload.get("prediction")
        if generated is None:
            return []
        if str(generated).strip() != str(self.prediction).strip():
            return [{
                "verdict": CONTRADICTED,
                "type": "prediction_consistency",
                "message": "Decision prediction contradicts customer evidence.",
                "entity": "prediction",
                "generated": generated,
                "expected": self.prediction,
            }]
        return [{
            "verdict": SUPPORTED,
            "type": "prediction_consistency",
            "message": "Decision prediction matches evidence.",
            "entity": "prediction",
        }]

    def _check_probability(self, payload, text):
        generated = None
        if isinstance(payload, dict) and payload.get("probability") is not None:
            generated = _as_float(payload.get("probability"))
            if generated is not None and generated > 1.5:
                generated = generated / 100.0
        if generated is None:
            match = re.search(r"probability[^\d]{0,20}(\d+(?:\.\d+)?)", text or "", re.I)
            if match:
                generated = _as_float(match.group(1))
                if generated is not None and generated > 1.5:
                    generated = generated / 100.0
        if generated is None or self.probability is None:
            return []
        if not _close(generated, self.probability, abs_tol=0.02):
            return [{
                "verdict": CONTRADICTED,
                "type": "incorrect_probability",
                "message": "Decision probability contradicts customer evidence.",
                "entity": "probability",
                "generated": generated,
                "expected": self.probability,
            }]
        return [{
            "verdict": SUPPORTED,
            "type": "incorrect_probability",
            "message": "Decision probability matches evidence.",
            "entity": "probability",
        }]

    def _check_risk(self, payload, text):
        generated = None
        if isinstance(payload, dict) and (payload.get("priority") or payload.get("risk_level")):
            generated = str(payload.get("priority") or payload.get("risk_level")).upper()
        if generated is None:
            match = re.search(r"\b(HIGH|MEDIUM|LOW)\b", text or "", re.I)
            if match:
                generated = match.group(1).upper()
        if generated is None:
            return [{
                "verdict": REQUIRES_REVIEW,
                "type": "incorrect_risk",
                "message": "Decision does not state a risk/priority consistent with evidence.",
                "entity": "risk_level",
            }]
        if generated != self.risk:
            return [{
                "verdict": CONTRADICTED,
                "type": "incorrect_risk",
                "message": (
                    f"Decision priority '{generated}' contradicts "
                    f"evidence risk '{self.risk}'."
                ),
                "entity": "risk_level",
            }]
        return [{
            "verdict": SUPPORTED,
            "type": "incorrect_risk",
            "message": "Decision priority matches evidence risk.",
            "entity": "risk_level",
        }]

    def _check_interventions(self, text):
        claims = []
        lowered = (text or "").lower()
        policy_allows_money = bool(self.policy.get("allow_financial_interventions"))
        for pattern in FORBIDDEN_INTERVENTIONS:
            if re.search(pattern, lowered) and not policy_allows_money:
                claims.append({
                    "verdict": UNSUPPORTED,
                    "type": "unsupported_recommendation",
                    "message": (
                        "Financial or invented interventions are not supported "
                        "because no business policy evidence is available."
                    ),
                    "entity": pattern,
                })
        return claims

    def _check_action_support(self, payload, text):
        action = ""
        if isinstance(payload, dict):
            action = str(payload.get("recommended_action") or payload.get("action") or "")
        if not action:
            action = text or ""
        lowered = action.lower()
        if any(hint in lowered for hint in ALLOWED_ACTION_HINTS):
            return [{
                "verdict": SUPPORTED,
                "type": "recommendation_support",
                "message": "Recommended action is limited to review/monitoring/investigation.",
                "entity": "action",
            }]
        if not lowered.strip():
            return [{
                "verdict": REQUIRES_REVIEW,
                "type": "recommendation_support",
                "message": "Decision did not include a recommended action.",
                "entity": "action",
            }]
        return [{
            "verdict": UNSUPPORTED,
            "type": "recommendation_support",
            "message": (
                "Recommended action is not supported by available evidence. "
                "Use review, monitoring, or further investigation."
            ),
            "entity": "action",
        }]


def validate_decision(evidence, decision, policy=None):
    return DecisionValidator(evidence, policy=policy).validate(decision)
