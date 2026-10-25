import re

from src.behavior.evidence_validator import (
    CONTRADICTED,
    SUPPORTED,
    UNSUPPORTED,
    REQUIRES_REVIEW,
    CAUSAL_PATTERNS,
    _as_float,
    _close,
    _load_payload,
    _norm,
)


class ExplanationValidator:
    PROB_TOL = 0.02

    def __init__(self, evidence):
        self.evidence = evidence or {}
        self.prediction = self.evidence.get("prediction")
        self.probability = _as_float(self.evidence.get("probability"))
        self.risk = str(self.evidence.get("risk_level") or "")
        self.features = {
            _norm(name): value
            for name, value in (self.evidence.get("customer_features") or {}).items()
        }
        self.factors = {}
        for factor in self.evidence.get("top_factors") or []:
            self.factors[_norm(factor.get("feature"))] = factor

    def validate(self, explanation):
        payload, text = _load_payload(explanation)
        if payload is None and isinstance(explanation, str):
            text = explanation
        elif isinstance(payload, dict) and payload.get("explanation"):
            text = str(payload.get("explanation"))
            extra = " ".join(
                str(payload.get(key, ""))
                for key in ("prediction", "probability", "risk_level")
            )
            text = extra + "\n" + text

        claims = []
        claims.extend(self._check_prediction(payload, text))
        claims.extend(self._check_probability(payload, text))
        claims.extend(self._check_risk(payload, text))
        claims.extend(self._check_features(payload, text))
        claims.extend(self._check_shap_direction(text))
        claims.extend(self._check_causal(text))

        return self._summarize(claims, text)

    def _check_prediction(self, payload, text):
        claims = []
        generated = None
        if isinstance(payload, dict) and payload.get("prediction") is not None:
            generated = payload.get("prediction")
        else:
            match = re.search(
                r"prediction[:\s]+([A-Za-z0-9_\-]+)",
                text,
                re.I,
            )
            if match:
                generated = match.group(1)

        if generated is None:
            claims.append({
                "verdict": REQUIRES_REVIEW,
                "type": "prediction_consistency",
                "message": "Explanation does not clearly restate the prediction.",
                "entity": "prediction",
            })
            return claims

        if str(generated).strip() != str(self.prediction).strip():
            claims.append({
                "verdict": CONTRADICTED,
                "type": "prediction_consistency",
                "message": (
                    f"Generated prediction '{generated}' contradicts "
                    f"evidence '{self.prediction}'."
                ),
                "entity": "prediction",
                "generated": generated,
                "expected": self.prediction,
            })
        else:
            claims.append({
                "verdict": SUPPORTED,
                "type": "prediction_consistency",
                "message": "Prediction matches evidence.",
                "entity": "prediction",
                "generated": generated,
                "expected": self.prediction,
            })
        return claims

    def _check_probability(self, payload, text):
        claims = []
        generated = None
        if isinstance(payload, dict) and payload.get("probability") is not None:
            generated = _as_float(payload.get("probability"))
            if generated is not None and generated > 1.5:
                generated = generated / 100.0
        else:
            match = re.search(
                r"(?:probability|prob(?:ability)? of (?:churn|the positive class))[^\d]{0,24}(\d+(?:\.\d+)?)",
                text,
                re.I,
            )
            if match:
                generated = _as_float(match.group(1))
                if generated is not None and generated > 1.5:
                    generated = generated / 100.0

        if generated is None or self.probability is None:
            if generated is None:
                claims.append({
                    "verdict": REQUIRES_REVIEW,
                    "type": "incorrect_probability",
                    "message": "Could not verify the stated probability.",
                    "entity": "probability",
                })
            return claims

        if not _close(generated, self.probability, abs_tol=self.PROB_TOL, rel_tol=0.02):
            claims.append({
                "verdict": CONTRADICTED,
                "type": "incorrect_probability",
                "message": (
                    f"Generated probability {generated} contradicts "
                    f"evidence {self.probability}."
                ),
                "entity": "probability",
                "generated": generated,
                "expected": self.probability,
            })
        else:
            claims.append({
                "verdict": SUPPORTED,
                "type": "incorrect_probability",
                "message": "Probability matches evidence.",
                "entity": "probability",
                "generated": generated,
                "expected": self.probability,
            })
        return claims

    def _check_risk(self, payload, text):
        claims = []
        generated = None
        if isinstance(payload, dict) and payload.get("risk_level"):
            generated = str(payload.get("risk_level")).upper()
        else:
            match = re.search(r"\b(HIGH|MEDIUM|LOW)\b", text, re.I)
            if match:
                generated = match.group(1).upper()

        expected = self.risk.upper()
        if generated is None:
            claims.append({
                "verdict": REQUIRES_REVIEW,
                "type": "incorrect_risk",
                "message": "Could not verify the stated risk level.",
                "entity": "risk_level",
            })
            return claims

        if generated != expected:
            claims.append({
                "verdict": CONTRADICTED,
                "type": "incorrect_risk",
                "message": (
                    f"Generated risk '{generated}' contradicts "
                    f"evidence '{expected}'."
                ),
                "entity": "risk_level",
                "generated": generated,
                "expected": expected,
            })
        else:
            claims.append({
                "verdict": SUPPORTED,
                "type": "incorrect_risk",
                "message": "Risk level matches evidence.",
                "entity": "risk_level",
                "generated": generated,
                "expected": expected,
            })
        return claims

    def _check_features(self, payload, text):
        claims = []
        mentioned = []
        if isinstance(payload, dict):
            mentioned.extend(payload.get("mentioned_features") or [])
            for factor in payload.get("top_factors") or []:
                if isinstance(factor, dict) and factor.get("feature"):
                    mentioned.append(factor.get("feature"))

        for name in mentioned:
            if _norm(name) not in self.features and _norm(name) not in self.factors:
                claims.append({
                    "verdict": UNSUPPORTED,
                    "type": "unknown_feature",
                    "message": f"Unknown feature '{name}' is not in the customer evidence.",
                    "entity": name,
                })

        for name in re.findall(r"`([^`]+)`", text or ""):
            if _norm(name) not in self.features and _norm(name) not in self.factors:
                claims.append({
                    "verdict": UNSUPPORTED,
                    "type": "unknown_feature",
                    "message": f"Unknown feature '{name}' is not in the customer evidence.",
                    "entity": name,
                })
        return claims

    def _check_shap_direction(self, text):
        claims = []
        lowered = (text or "").lower()
        for feature_norm, factor in self.factors.items():
            feature = factor.get("feature")
            impact = str(factor.get("impact") or "").lower()
            shap_value = _as_float(factor.get("shap_value"))
            increases = "increases" in impact or (shap_value is not None and shap_value > 0)
            decreases = "decreases" in impact or (shap_value is not None and shap_value < 0)

            if feature_norm not in lowered:
                continue

            if re.search(
                rf"{re.escape(str(feature))}.{{0,80}}(?:increases|pushed (?:the model )?toward higher)",
                lowered,
                re.S,
            ):
                if decreases:
                    claims.append({
                        "verdict": CONTRADICTED,
                        "type": "shap_direction",
                        "message": (
                            f"SHAP for '{feature}' decreases the positive-class "
                            "score, but the explanation claimed an increase."
                        ),
                        "entity": feature,
                    })
                else:
                    claims.append({
                        "verdict": SUPPORTED,
                        "type": "shap_direction",
                        "message": f"SHAP direction for '{feature}' matches evidence.",
                        "entity": feature,
                    })

            if re.search(
                rf"{re.escape(str(feature))}.{{0,80}}(?:decreases|pushed (?:the model )?toward lower)",
                lowered,
                re.S,
            ):
                if increases:
                    claims.append({
                        "verdict": CONTRADICTED,
                        "type": "shap_direction",
                        "message": (
                            f"SHAP for '{feature}' increases the positive-class "
                            "score, but the explanation claimed a decrease."
                        ),
                        "entity": feature,
                    })
        return claims

    def _check_causal(self, text):
        claims = []
        lowered = (text or "").lower()
        for pattern in CAUSAL_PATTERNS:
            if re.search(pattern, lowered):
                claims.append({
                    "verdict": UNSUPPORTED,
                    "type": "causal_language",
                    "message": f"Causal or certainty language is not supported: {pattern}",
                    "entity": None,
                })
        if re.search(r"\bwill (?:definitely )?(?:churn|leave)\b", lowered):
            claims.append({
                "verdict": UNSUPPORTED,
                "type": "causal_language",
                "message": "The explanation claimed certainty about the outcome.",
                "entity": None,
            })
        return claims

    def _summarize(self, claims, text):
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

        errors = [
            {
                "type": item["type"],
                "items": [str(item.get("entity") or "")],
                "message": item["message"],
                "verdict": item["verdict"],
            }
            for item in blocking
        ]
        total_claims = max(len(claims), 1)
        counts = {
            SUPPORTED: sum(1 for c in claims if c["verdict"] == SUPPORTED),
            UNSUPPORTED: sum(1 for c in claims if c["verdict"] == UNSUPPORTED),
            CONTRADICTED: sum(1 for c in claims if c["verdict"] == CONTRADICTED),
            REQUIRES_REVIEW: sum(1 for c in claims if c["verdict"] == REQUIRES_REVIEW),
        }
        numeric_claims = [c for c in claims if c["type"] in {"incorrect_probability"}]
        numeric_supported = sum(1 for c in numeric_claims if c["verdict"] == SUPPORTED)
        category_claims = [c for c in claims if c["type"] in {"unknown_feature", "unknown_category"}]
        category_supported = sum(1 for c in category_claims if c["verdict"] == SUPPORTED)
        causal = sum(1 for c in claims if c["type"] == "causal_language")
        recommendations = sum(1 for c in claims if c["type"] == "unsupported_recommendation")

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
            "errors": errors,
            "summary": counts,
            "metrics": metrics,
        }


def validate_explanation(evidence, explanation):
    return ExplanationValidator(evidence).validate(explanation)
