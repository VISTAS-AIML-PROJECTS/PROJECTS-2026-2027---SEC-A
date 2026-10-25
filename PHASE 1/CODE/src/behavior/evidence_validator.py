import json
import math
import re


SUPPORTED = "SUPPORTED"
UNSUPPORTED = "UNSUPPORTED"
CONTRADICTED = "CONTRADICTED"
REQUIRES_REVIEW = "REQUIRES_REVIEW"


CAUSAL_PATTERNS = [
    r"\bcauses\b",
    r"\bcause\b",
    r"\bcaused\b",
    r"\bdrives\b",
    r"\bdrive\b",
    r"\bdriven by\b",
    r"\bleads to\b",
    r"\blead to\b",
    r"\bresults in\b",
    r"\bresult in\b",
    r"\bguarantees\b",
    r"\bguarantee\b",
    r"\bproves\b",
    r"\bproven\b",
    r"\bstatistically significant\b",
    r"\bstatistically robust\b",
    r"\bdeterministic predictor\b",
]

RECOMMENDATION_PATTERNS = [
    r"\brecommend(?:ation|ations|ed|ing)?\b",
    r"\bprioritize\b",
    r"\bprioritise\b",
    r"\boffer(?:ing)?\s+(?:a\s+)?(?:discount|refund|credit|retention)",
    r"\bdiscounts?\b",
    r"\brefunds?\b",
    r"\b(?:account|bill(?:ing)?)\s+credits?\b",
    r"\boffer(?:ing)?\s+credits?\b",
    r"\binterventions?\b",
    r"\bretention campaigns?\b",
    r"\bprice reductions?\b",
    r"\bshould\s+(?:offer|target|prioritize|switch|convert|provide)\b",
    r"\btarget(?:ing)?\s+(?:customers?|users?|accounts?|this)\b",
    r"\bconvert(?:ing)?\s+customers\b",
]


def _as_float(value):
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return None
        return float(value)
    text = str(value).strip().replace(",", "")
    if text.endswith("%"):
        try:
            return float(text[:-1]) / 100.0
        except ValueError:
            return None
    try:
        return float(text)
    except ValueError:
        return None


def _close(a, b, abs_tol=0.015, rel_tol=0.02):
    if a is None or b is None:
        return False
    if abs(a - b) <= abs_tol:
        return True
    scale = max(abs(a), abs(b), 1e-12)
    return abs(a - b) / scale <= rel_tol


def _norm(value):
    return str(value).strip().lower()


def _normalize_rate(value):
    numeric = _as_float(value)
    if numeric is None:
        return None
    if abs(numeric) > 1.0:
        return numeric / 100.0
    return numeric


def _load_payload(interpretation):
    if isinstance(interpretation, dict):
        return interpretation, json.dumps(interpretation, ensure_ascii=False)

    if interpretation is None:
        return None, ""

    text = str(interpretation)
    try:
        from src.llm.client import parse_json_payload
        return parse_json_payload(text), text
    except Exception:
        return None, text


class EvidenceIndex:
    def __init__(self, behavior_data):
        self.raw = behavior_data or {}
        self.target = str(self.raw.get("target") or "")
        self.positive_class = str(self.raw.get("positive_class") or "")
        self.overall = self.raw.get("overall") or {}
        self.features = set()
        self.categories = {}
        self.category_names = {}
        self.numerical = {}
        self.known_tokens = set()

        if self.target:
            self.features.add(self.target)
            self.known_tokens.add(_norm(self.target))

        for item in self.raw.get("categorical_analysis", []):
            feature = str(item.get("feature", ""))
            category = str(item.get("category", ""))
            if feature:
                self.features.add(feature)
                self.known_tokens.add(_norm(feature))
            if category:
                self.categories[( _norm(feature), _norm(category) )] = item
                self.category_names.setdefault(_norm(category), []).append(item)
                self.known_tokens.add(_norm(category))

        for item in self.raw.get("numerical_analysis", []):
            feature = str(item.get("feature", ""))
            if feature:
                self.features.add(feature)
                self.numerical[_norm(feature)] = item
                self.known_tokens.add(_norm(feature))

        for item in self.raw.get("top_patterns", []):
            feature = item.get("feature")
            if feature:
                self.features.add(str(feature))
                self.known_tokens.add(_norm(feature))

    def category_record(self, feature, category):
        return self.categories.get((_norm(feature), _norm(category)))

    def category_by_name(self, category):
        return self.category_names.get(_norm(category), [])

    def numerical_record(self, feature):
        return self.numerical.get(_norm(feature))

    def known_feature(self, name):
        return _norm(name) in {_norm(item) for item in self.features}


class EvidenceValidator:
    COUNT_TOL = 0.0
    RATE_ABS_TOL = 0.02
    MEAN_ABS_TOL = 0.05

    def __init__(self, behavior_data):
        self.index = EvidenceIndex(behavior_data)
        self.behavior_data = behavior_data

    def validate(self, interpretation):
        payload, text = _load_payload(interpretation)
        claims = []

        claims.extend(self._language_claims(text))

        if payload is not None:
            claims.extend(self._validate_structured(payload))
            claims.extend(self._validate_free_text(payload.get("overall_summary", "") if isinstance(payload, dict) else ""))
            for group_key in ("categorical_patterns", "numerical_patterns"):
                for item in (payload.get(group_key) or []) if isinstance(payload, dict) else []:
                    claims.extend(self._validate_free_text(str(item.get("interpretation", ""))))
            for item in (payload.get("reliability") or []) if isinstance(payload, dict) else []:
                claims.extend(self._validate_free_text(str(item)))
            for item in (payload.get("limitations") or []) if isinstance(payload, dict) else []:
                claims.extend(self._validate_free_text(str(item)))
        else:
            claims.extend(self._validate_free_text(text))

        claims = self._dedupe_claims(claims)
        return self._summarize(claims, text)

    def _language_claims(self, text):
        claims = []
        lowered = text.lower()

        for pattern in CAUSAL_PATTERNS:
            if re.search(pattern, lowered):
                claims.append(self._claim(
                    CONTRADICTED if "cause" in pattern or "leads to" in pattern or "results in" in pattern or "driven by" in pattern else UNSUPPORTED,
                    "causal_language",
                    f"Causal or certainty language matched pattern: {pattern}",
                    snippet=pattern,
                ))

        for pattern in RECOMMENDATION_PATTERNS:
            if re.search(pattern, lowered):
                claims.append(self._claim(
                    UNSUPPORTED,
                    "unsupported_recommendation",
                    f"Behaviour interpretations must not include recommendations. Matched: {pattern}",
                    snippet=pattern,
                ))

        return claims

    def _validate_structured(self, payload):
        claims = []

        if not isinstance(payload, dict):
            claims.append(self._claim(
                REQUIRES_REVIEW,
                "malformed_output",
                "Structured output was not a JSON object.",
            ))
            return claims

        overall = payload.get("overall_summary")
        if overall:
            claims.extend(self._check_overall_numbers(str(overall)))

        for item in payload.get("categorical_patterns") or []:
            claims.extend(self._validate_categorical_item(item))

        for item in payload.get("numerical_patterns") or []:
            claims.extend(self._validate_numerical_item(item))

        return claims

    def _validate_categorical_item(self, item):
        claims = []
        feature = str(item.get("feature", "")).strip()
        category = str(item.get("category", "")).strip()

        if feature and not self.index.known_feature(feature):
            claims.append(self._claim(
                UNSUPPORTED,
                "unknown_feature",
                f"Unknown feature '{feature}'.",
                entity=feature,
            ))
            return claims

        record = self.index.category_record(feature, category)
        if record is None:
            matches = self.index.category_by_name(category) if category else []
            if len(matches) == 1:
                record = matches[0]
            else:
                claims.append(self._claim(
                    UNSUPPORTED,
                    "unknown_category",
                    f"Unknown category '{category}' for feature '{feature}'.",
                    entity=f"{feature}:{category}",
                ))
                return claims

        mapping = [
            ("records", "group_size", self.COUNT_TOL, "incorrect_count"),
            ("group_size", "group_size", self.COUNT_TOL, "incorrect_count"),
            ("positive_cases", "positive_count", self.COUNT_TOL, "incorrect_count"),
            ("positive_count", "positive_count", self.COUNT_TOL, "incorrect_count"),
            ("positive_rate", "positive_rate", self.RATE_ABS_TOL, "incorrect_percentage"),
            ("churn_rate", "positive_rate", self.RATE_ABS_TOL, "incorrect_percentage"),
        ]

        for generated_key, evidence_key, tol, claim_type in mapping:
            if generated_key not in item:
                continue
            generated = _as_float(item.get(generated_key))
            expected = _as_float(record.get(evidence_key))
            if generated is None:
                continue
            if claim_type == "incorrect_percentage":
                generated = _normalize_rate(generated)
            if not _close(generated, expected, abs_tol=max(tol, 1e-9), rel_tol=0.0 if tol == 0 else 0.02):
                claims.append(self._claim(
                    CONTRADICTED,
                    claim_type,
                    (
                        f"{feature} / {category}: generated {generated_key}={generated} "
                        f"but evidence {evidence_key}={expected}."
                    ),
                    entity=f"{feature}:{category}",
                    generated=generated,
                    expected=expected,
                ))
            else:
                claims.append(self._claim(
                    SUPPORTED,
                    claim_type,
                    f"{feature} / {category}: {generated_key} matches evidence.",
                    entity=f"{feature}:{category}",
                    generated=generated,
                    expected=expected,
                ))

        return claims

    def _validate_numerical_item(self, item):
        claims = []
        feature = str(item.get("feature", "")).strip()

        if not feature:
            return claims

        if not self.index.known_feature(feature):
            claims.append(self._claim(
                UNSUPPORTED,
                "unknown_feature",
                f"Unknown numerical feature '{feature}'.",
                entity=feature,
            ))
            return claims

        record = self.index.numerical_record(feature)
        if record is None:
            claims.append(self._claim(
                UNSUPPORTED,
                "unsupported_numerical_claim",
                f"No numerical evidence exists for '{feature}'.",
                entity=feature,
            ))
            return claims

        mapping = [
            ("positive_mean", "positive_mean", self.MEAN_ABS_TOL, "incorrect_mean"),
            ("negative_mean", "negative_mean", self.MEAN_ABS_TOL, "incorrect_mean"),
            ("mean_difference", "mean_difference", self.MEAN_ABS_TOL, "incorrect_mean"),
            ("cohens_d", "effect_size_cohens_d", 0.05, "incorrect_mean"),
        ]

        for generated_key, evidence_key, tol, claim_type in mapping:
            if generated_key not in item:
                continue
            generated = _as_float(item.get(generated_key))
            expected = _as_float(record.get(evidence_key))
            if generated is None:
                continue
            if not _close(generated, expected, abs_tol=tol):
                claims.append(self._claim(
                    CONTRADICTED,
                    claim_type,
                    (
                        f"{feature}: generated {generated_key}={generated} "
                        f"but evidence {evidence_key}={expected}."
                    ),
                    entity=feature,
                    generated=generated,
                    expected=expected,
                ))
            else:
                claims.append(self._claim(
                    SUPPORTED,
                    claim_type,
                    f"{feature}: {generated_key} matches evidence.",
                    entity=feature,
                    generated=generated,
                    expected=expected,
                ))

        direction_text = " ".join(
            str(item.get(key, ""))
            for key in ("interpretation", "direction")
        ).lower()
        claims.extend(self._check_numerical_direction(feature, record, direction_text))
        return claims

    def _check_overall_numbers(self, text):
        claims = []
        overall = self.index.overall
        total = _as_float(overall.get("total_rows"))
        rate = _as_float(overall.get("positive_rate"))

        row_match = re.search(r"\b(\d+)\s+(?:rows?|records?|customers?)\b", text, re.I)
        if row_match and total is not None:
            generated = float(row_match.group(1))
            if generated != total:
                claims.append(self._claim(
                    CONTRADICTED,
                    "incorrect_count",
                    f"Overall row count {generated} contradicts evidence {total}.",
                    entity="overall",
                    generated=generated,
                    expected=total,
                ))
            else:
                claims.append(self._claim(
                    SUPPORTED,
                    "incorrect_count",
                    "Overall row count matches evidence.",
                    entity="overall",
                    generated=generated,
                    expected=total,
                ))

        rate_match = re.search(
            r"(?:positive(?:-class)? rate|churn rate)[^\d%]{0,24}(\d+(?:\.\d+)?)\s*%",
            text,
            re.I,
        )
        if rate_match and rate is not None:
            generated = float(rate_match.group(1)) / 100.0
            if not _close(generated, rate, abs_tol=self.RATE_ABS_TOL):
                claims.append(self._claim(
                    CONTRADICTED,
                    "incorrect_target_rate",
                    f"Overall rate {generated} contradicts evidence {rate}.",
                    entity="overall",
                    generated=generated,
                    expected=rate,
                ))

        return claims

    def _validate_free_text(self, text):
        if not text:
            return []

        claims = []
        claims.extend(self._extract_category_count_claims(text))
        claims.extend(self._extract_category_rate_claims(text))
        claims.extend(self._extract_numerical_direction_claims(text))
        claims.extend(self._extract_unknown_backticks(text))
        claims.extend(self._extract_invented_attributes(text))
        return claims

    def _sorted_category_names(self):
        names = [str(item.get("category", "")) for item in sum(self.index.category_names.values(), [])]
        unique = sorted(set(names), key=len, reverse=True)
        return [name for name in unique if name and name.lower() not in {"nan", "none"}]

    def _compiled_count_patterns(self):
        if getattr(self, "_count_patterns", None) is None:
            patterns = []
            for category in self._sorted_category_names():
                pattern = re.compile(
                    rf"{self._entity_pattern(category)}(?P<window>.{{0,80}}?)(?P<count>\d+)\s*(?:records?|rows?|customers?|cases?|samples?)",
                    re.I | re.S,
                )
                patterns.append((category, pattern))
            self._count_patterns = patterns
        return self._count_patterns

    def _compiled_rate_patterns(self):
        if getattr(self, "_rate_patterns", None) is None:
            patterns = []
            for category in self._sorted_category_names():
                pattern = re.compile(
                    rf"{self._entity_pattern(category)}(?P<window>.{{0,100}}?)(?P<rate>\d+(?:\.\d+)?)\s*%",
                    re.I | re.S,
                )
                patterns.append((category, pattern))
            self._rate_patterns = patterns
        return self._rate_patterns

    def _entity_pattern(self, name):
        escaped = re.escape(name)
        return rf"(?<![A-Za-z0-9_]){escaped}(?![A-Za-z0-9_])"

    def _extract_category_count_claims(self, text):
        claims = []
        for category, pattern in self._compiled_count_patterns():
            for match in pattern.finditer(text):
                generated = float(match.group("count"))
                records = self.index.category_by_name(category)
                if not records:
                    continue
                expected_sizes = {float(item["group_size"]) for item in records}
                entity = f"{records[0].get('feature')}:{category}"
                if generated in expected_sizes:
                    claims.append(self._claim(
                        SUPPORTED,
                        "incorrect_count",
                        f"{category} record count matches evidence.",
                        entity=entity,
                        generated=generated,
                        expected=generated,
                        snippet=match.group(0),
                    ))
                else:
                    expected = sorted(expected_sizes)[0] if len(expected_sizes) == 1 else None
                    claims.append(self._claim(
                        CONTRADICTED,
                        "incorrect_count",
                        (
                            f"{category} record count {int(generated)} contradicts "
                            f"evidence {sorted(int(v) for v in expected_sizes)}."
                        ),
                        entity=entity,
                        generated=generated,
                        expected=expected,
                        snippet=match.group(0),
                    ))
        return claims

    def _extract_category_rate_claims(self, text):
        claims = []
        for category, pattern in self._compiled_rate_patterns():
            for match in pattern.finditer(text):
                generated_pct = float(match.group("rate"))
                generated = generated_pct / 100.0
                records = self.index.category_by_name(category)
                if not records:
                    continue
                expected_rates = [float(item["positive_rate"]) for item in records]
                entity = f"{records[0].get('feature')}:{category}"
                if any(_close(generated, rate, abs_tol=self.RATE_ABS_TOL) for rate in expected_rates):
                    claims.append(self._claim(
                        SUPPORTED,
                        "incorrect_percentage",
                        f"{category} rate matches evidence.",
                        entity=entity,
                        generated=generated,
                        expected=expected_rates[0],
                        snippet=match.group(0),
                    ))
                else:
                    claims.append(self._claim(
                        CONTRADICTED,
                        "incorrect_percentage",
                        (
                            f"{category} rate {generated_pct}% contradicts "
                            f"evidence {[round(rate * 100, 2) for rate in expected_rates]}%."
                        ),
                        entity=entity,
                        generated=generated,
                        expected=expected_rates[0] if len(expected_rates) == 1 else None,
                        snippet=match.group(0),
                    ))
        return claims

    def _extract_numerical_direction_claims(self, text):
        claims = []
        lowered = text.lower()
        for feature_norm, record in self.index.numerical.items():
            feature = record["feature"]
            if feature_norm not in lowered:
                continue
            claims.extend(self._check_numerical_direction(feature, record, text))
        return claims

    def _check_numerical_direction(self, feature, record, text):
        claims = []
        if not text:
            return claims

        evidence_direction = str(record.get("direction", "")).lower()
        positive_higher = evidence_direction == "higher"
        positive_lower = evidence_direction == "lower"

        feature_pat = self._entity_pattern(feature)
        patterns_higher = [
            rf"{feature_pat}.{{0,80}}higher among (?:churned|positive)",
            rf"{feature_pat}.{{0,80}}(?:is|are|was|were) higher",
            rf"higher {feature_pat}.{{0,40}}(?:churned|positive)",
        ]
        patterns_lower = [
            rf"{feature_pat}.{{0,80}}lower among (?:churned|positive)",
            rf"{feature_pat}.{{0,80}}(?:is|are|was|were) lower",
            rf"lower {feature_pat}.{{0,40}}(?:churned|positive)",
        ]

        for pattern in patterns_higher:
            if re.search(pattern, text, re.I | re.S):
                if positive_lower:
                    claims.append(self._claim(
                        CONTRADICTED,
                        "unsupported_numerical_claim",
                        (
                            f"'{feature}' is lower in the positive class "
                            f"(positive mean={record.get('positive_mean')}, "
                            f"negative mean={record.get('negative_mean')})."
                        ),
                        entity=feature,
                    ))
                elif positive_higher:
                    claims.append(self._claim(
                        SUPPORTED,
                        "unsupported_numerical_claim",
                        f"Direction for '{feature}' matches evidence.",
                        entity=feature,
                    ))

        for pattern in patterns_lower:
            if re.search(pattern, text, re.I | re.S):
                if positive_higher:
                    claims.append(self._claim(
                        CONTRADICTED,
                        "unsupported_numerical_claim",
                        (
                            f"'{feature}' is higher in the positive class "
                            f"(positive mean={record.get('positive_mean')}, "
                            f"negative mean={record.get('negative_mean')})."
                        ),
                        entity=feature,
                    ))
                elif positive_lower:
                    claims.append(self._claim(
                        SUPPORTED,
                        "unsupported_numerical_claim",
                        f"Direction for '{feature}' matches evidence.",
                        entity=feature,
                    ))

        return claims

    def _extract_unknown_backticks(self, text):
        claims = []
        for word in re.findall(r"`([^`]+)`", text):
            token = word.strip()
            if not token:
                continue
            if (
                not self.index.known_feature(token)
                and _norm(token) not in self.index.category_names
                and _norm(token) not in self.index.known_tokens
            ):
                claims.append(self._claim(
                    UNSUPPORTED,
                    "unknown_feature",
                    f"Backticked token '{token}' is not in the evidence.",
                    entity=token,
                ))
        return claims

    def _extract_invented_attributes(self, text):
        claims = []
        invented = [
            r"\blast quarter\b",
            r"\bprevious year\b",
            r"\bindustry average\b",
            r"\bcompany policy\b",
            r"\bthreshold of\b",
        ]
        for pattern in invented:
            if re.search(pattern, text, re.I):
                claims.append(self._claim(
                    UNSUPPORTED,
                    "invented_attribute",
                    f"Invented attribute matched: {pattern}",
                    snippet=pattern,
                ))
        return claims

    def _claim(
        self,
        verdict,
        claim_type,
        message,
        entity=None,
        generated=None,
        expected=None,
        snippet=None,
    ):
        return {
            "verdict": verdict,
            "type": claim_type,
            "message": message,
            "entity": entity,
            "generated": generated,
            "expected": expected,
            "snippet": snippet,
        }

    def _dedupe_claims(self, claims):
        seen = set()
        unique = []
        for claim in claims:
            key = (
                claim["verdict"],
                claim["type"],
                claim.get("entity"),
                claim.get("message"),
            )
            if key in seen:
                continue
            seen.add(key)
            unique.append(claim)
        return unique

    def _summarize(self, claims, text):
        counts = {
            SUPPORTED: 0,
            UNSUPPORTED: 0,
            CONTRADICTED: 0,
            REQUIRES_REVIEW: 0,
        }
        for claim in claims:
            counts[claim["verdict"]] = counts.get(claim["verdict"], 0) + 1

        numeric_types = {
            "incorrect_count",
            "incorrect_percentage",
            "incorrect_mean",
            "incorrect_target_rate",
            "incorrect_probability",
        }
        numeric_claims = [c for c in claims if c["type"] in numeric_types]
        numeric_supported = sum(1 for c in numeric_claims if c["verdict"] == SUPPORTED)
        category_claims = [
            c for c in claims
            if c["type"] in {"incorrect_count", "incorrect_percentage", "unknown_category"}
        ]
        category_supported = sum(1 for c in category_claims if c["verdict"] == SUPPORTED)

        causal = sum(1 for c in claims if c["type"] == "causal_language")
        recommendations = sum(1 for c in claims if c["type"] == "unsupported_recommendation")

        blocking = [
            c for c in claims
            if c["verdict"] in {CONTRADICTED, UNSUPPORTED, REQUIRES_REVIEW}
        ]
        valid = len(blocking) == 0

        if any(c["verdict"] == CONTRADICTED for c in claims):
            status = "FAIL"
        elif any(c["verdict"] == UNSUPPORTED for c in claims):
            status = "FAIL"
        elif any(c["verdict"] == REQUIRES_REVIEW for c in claims):
            status = "REQUIRES_REVIEW"
        else:
            status = "PASS"

        total_claims = max(len(claims), 1)
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

        errors = [
            {
                "type": claim["type"],
                "items": [str(claim.get("entity") or claim.get("snippet") or "")],
                "message": claim["message"],
                "verdict": claim["verdict"],
            }
            for claim in blocking
        ]

        return {
            "valid": valid,
            "status": status,
            "claims": claims,
            "errors": errors,
            "summary": counts,
            "metrics": metrics,
            "source_text_length": len(text or ""),
        }


def validate_behavior_interpretation(behavior_data, interpretation):
    validator = EvidenceValidator(behavior_data)
    return validator.validate(interpretation)
