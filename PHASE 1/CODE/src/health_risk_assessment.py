"""
PureBreath-AI: Week 5 - Personalized Health Risk Assessment Engine

Computes an individualized health risk score for each user based on:
  - Predicted AQI (from Week 3 models)
  - Age group vulnerability
  - Asthma severity
  - Pregnancy status
  - Occupation-based outdoor exposure
  - Daily outdoor hours

Outputs a risk score (0–100), risk level, and actionable health advisory
for every user in the user profile dataset.

Author: PureBreath-AI Team
License: MIT
"""

import os
import json
import logging
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)

# ── Risk weight tables (evidence-based, WHO / CPCB guidelines) ─────────────────

# AQI band → base risk score (0–100)
AQI_BASE_RISK: Dict[str, float] = {
    "Good":        10.0,
    "Satisfactory":25.0,
    "Moderate":    45.0,
    "Poor":        62.0,
    "Very Poor":   78.0,
    "Severe":      95.0,
}

# Age group multipliers
def age_multiplier(age: int) -> float:
    if age <= 5:   return 1.8   # infants / toddlers
    if age <= 12:  return 1.5   # children
    if age <= 17:  return 1.2   # adolescents
    if age <= 60:  return 1.0   # healthy adults (baseline)
    if age <= 70:  return 1.3   # older adults
    return 1.6                  # elderly >70

# Occupations with elevated outdoor / pollutant exposure
HIGH_EXPOSURE_OCCUPATIONS = {
    "Traffic Police":       1.5,
    "Construction Worker":  1.4,
    "Factory Worker":       1.4,
    "Delivery Executive":   1.3,
    "Farmer":               1.3,
    "Driver":               1.25,
    "Shopkeeper":           1.1,
}

# Risk level thresholds
def risk_level(score: float) -> str:
    if score < 20:  return "Low"
    if score < 40:  return "Moderate"
    if score < 60:  return "High"
    if score < 80:  return "Very High"
    return "Hazardous"

# ── Advisory messages ──────────────────────────────────────────────────────────

ADVISORIES: Dict[str, str] = {
    "Low": (
        "Air quality is acceptable. Enjoy outdoor activities. "
        "Sensitive individuals should monitor symptoms."
    ),
    "Moderate": (
        "Unusually sensitive people should consider reducing prolonged outdoor exertion. "
        "Keep windows open for ventilation."
    ),
    "High": (
        "Reduce prolonged or heavy outdoor exertion. Take more breaks during outdoor activities. "
        "Wear an N95 mask if outdoors for extended periods."
    ),
    "Very High": (
        "Avoid prolonged outdoor exertion. People with respiratory or heart conditions, "
        "children and elderly should stay indoors. Use air purifiers indoors."
    ),
    "Hazardous": (
        "Stay indoors. Avoid all outdoor physical activity. Keep windows and doors closed. "
        "Use N95/P100 respirator if going outside is unavoidable. Seek medical advice if symptoms appear."
    ),
}

# Additional condition-specific advisories
ASTHMA_ADDON    = " Carry rescue inhaler at all times. Avoid triggers like dust and smoke."
PREGNANCY_ADDON = " Pregnant women should minimise outdoor exposure and consult a physician."
CHILD_ADDON     = " Keep children indoors during peak pollution hours (7–10 AM, 6–9 PM)."
ELDERLY_ADDON   = " Elderly individuals should avoid outdoor exercise entirely today."


# ── Core risk computation ──────────────────────────────────────────────────────

def compute_risk(
    aqi_bucket:     str,
    age:            int,
    asthma:         bool,
    pregnancy:      bool,
    occupation:     str,
    outdoor_hours:  float,
) -> Tuple[float, str, str]:
    """
    Compute personalised risk score, level, and advisory for one user.

    Returns
    -------
    risk_score  : float  (0–100, clipped)
    level       : str
    advisory    : str
    """
    base        = AQI_BASE_RISK.get(aqi_bucket, 50.0)
    age_mult    = age_multiplier(age)
    occ_mult    = HIGH_EXPOSURE_OCCUPATIONS.get(occupation, 1.0)

    # Outdoor hours modifier: each hour above 2 adds 2 % extra risk
    outdoor_mod = 1.0 + max(0.0, outdoor_hours - 2.0) * 0.02

    # Condition multipliers
    asthma_mult    = 1.35 if asthma    else 1.0
    pregnancy_mult = 1.25 if pregnancy else 1.0

    score = base * age_mult * occ_mult * outdoor_mod * asthma_mult * pregnancy_mult
    score = float(np.clip(score, 0.0, 100.0))

    level    = risk_level(score)
    advisory = ADVISORIES[level]

    if asthma:
        advisory += ASTHMA_ADDON
    if pregnancy:
        advisory += PREGNANCY_ADDON
    if age <= 12:
        advisory += CHILD_ADDON
    if age > 70:
        advisory += ELDERLY_ADDON

    return round(score, 2), level, advisory


# ── Batch assessment ───────────────────────────────────────────────────────────

def assess_all_users(
    users_path: str,
    aqi_value:  float,
    aqi_bucket: str,
    city:       str = "Unknown",
    date:       str = "Today",
) -> pd.DataFrame:
    """
    Run risk assessment for every user in the profile CSV.

    Parameters
    ----------
    users_path : path to user_profile_100.csv
    aqi_value  : numeric AQI predicted by Week 3 model
    aqi_bucket : AQI category string
    city       : city name for context
    date       : forecast date string

    Returns
    -------
    DataFrame with one row per user including risk score, level, advisory.
    """
    df = pd.read_csv(users_path)
    results = []

    for _, row in df.iterrows():
        score, level, advisory = compute_risk(
            aqi_bucket    = aqi_bucket,
            age           = int(row["Age"]),
            asthma        = str(row["Asthma"]).strip().lower() == "yes",
            pregnancy     = str(row["Pregnancy"]).strip().lower() == "yes",
            occupation    = str(row["Occupation"]).strip(),
            outdoor_hours = float(row["Outdoor_Hours"]),
        )
        results.append({
            "User_ID":       row["User_ID"],
            "Age":           row["Age"],
            "Gender":        row["Gender"],
            "Asthma":        row["Asthma"],
            "Pregnancy":     row["Pregnancy"],
            "Occupation":    row["Occupation"],
            "Outdoor_Hours": row["Outdoor_Hours"],
            "City":          city,
            "Date":          date,
            "AQI_Value":     aqi_value,
            "AQI_Bucket":    aqi_bucket,
            "Risk_Score":    score,
            "Risk_Level":    level,
            "Advisory":      advisory,
        })

    return pd.DataFrame(results)


# ── AQI bucket from numeric value (CPCB standard) ─────────────────────────────

def aqi_to_bucket(aqi: float) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Satisfactory"
    if aqi <= 200:  return "Moderate"
    if aqi <= 300:  return "Poor"
    if aqi <= 400:  return "Very Poor"
    return "Severe"


# ══════════════════════════════════════════════════════════════════════════════
# AI HEALTH REPORT ENGINE
# Generates a fully dynamic, personalized health report from user + AQI data.
# Designed to be LLM-replaceable: swap generate_health_report() with an LLM
# call and the rest of the pipeline stays unchanged.
# ══════════════════════════════════════════════════════════════════════════════

_BUCKET_ORDER = ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"]

_OUTDOOR_SAFE_HOURS = {
    "Good": 8, "Satisfactory": 6, "Moderate": 4,
    "Poor": 2, "Very Poor": 1, "Severe": 0,
}

_BEST_TIME = {
    "Good":         "Any time of day is suitable.",
    "Satisfactory": "Morning (6–9 AM) or evening (after 7 PM) is preferable.",
    "Moderate":     "Early morning (before 7 AM) when pollution is lowest.",
    "Poor":         "Avoid peak hours (7–10 AM, 5–9 PM). If necessary, go out between 11 AM–2 PM.",
    "Very Poor":    "Minimize all outdoor time. If unavoidable, early morning is least harmful.",
    "Severe":       "Do not go outdoors. All outdoor activity is unsafe.",
}

_HIGH_EXPOSURE_OCCS = {
    "Traffic Police", "Construction Worker", "Factory Worker",
    "Delivery Executive", "Farmer", "Driver",
}


def _bucket_index(bucket: str) -> int:
    try:
        return _BUCKET_ORDER.index(bucket)
    except ValueError:
        return 2


def _age_group(age: int) -> str:
    if age <= 5:   return "infant"
    if age <= 12:  return "child"
    if age <= 17:  return "adolescent"
    if age <= 60:  return "adult"
    if age <= 70:  return "older adult"
    return "elderly"


def _is_sensitive(age: int, asthma: bool, pregnancy: bool) -> bool:
    return asthma or pregnancy or age <= 12 or age > 70


def _health_score(
    aqi: float, risk_score: float, outdoor_hours: float,
    asthma: bool, pregnancy: bool, age: int,
) -> int:
    """Invert risk into a 0-100 health score (100 = best)."""
    base = max(0.0, 100.0 - risk_score)
    # Penalise excess outdoor hours relative to safe limit
    bucket = aqi_to_bucket(aqi)
    safe_h = _OUTDOOR_SAFE_HOURS[bucket]
    excess = max(0.0, outdoor_hours - safe_h)
    penalty = min(excess * 3.0, 20.0)
    score = max(0.0, base - penalty)
    return int(round(score))


def _ai_summary(
    aqi: float, bucket: str, risk_level: str, risk_score: float,
    age: int, gender: str, asthma: bool, pregnancy: bool,
    occupation: str, outdoor_hours: float,
    top_shap: list,
) -> str:
    """Generate a natural-language risk summary from data."""
    age_grp = _age_group(age)
    parts = [
        f"Based on the current AQI of {aqi:.0f} ({bucket}), "
        f"your overall health risk is assessed as {risk_level} "
        f"(score: {risk_score:.0f}/100)."
    ]

    env_drivers = [f["feature"] for f in top_shap[:3]] if top_shap else []
    if env_drivers:
        parts.append(
            f"The primary environmental drivers are {', '.join(env_drivers)}, "
            "which are currently elevated above safe thresholds."
        )

    personal = []
    if asthma:
        personal.append("a pre-existing asthma condition")
    if pregnancy:
        personal.append("pregnancy")
    if age <= 12:
        personal.append(f"your age ({age}) placing you in the high-vulnerability child group")
    elif age > 70:
        personal.append(f"your age ({age}) placing you in the high-vulnerability elderly group")
    if occupation in _HIGH_EXPOSURE_OCCS:
        personal.append(f"your occupation ({occupation}) involving prolonged outdoor pollutant exposure")
    if outdoor_hours > _OUTDOOR_SAFE_HOURS.get(bucket, 4):
        personal.append(
            f"your daily outdoor exposure ({outdoor_hours:.1f} hrs) exceeding the "
            f"recommended safe limit for {bucket} air quality"
        )

    if personal:
        parts.append("Personal risk factors include: " + "; ".join(personal) + ".")
    else:
        parts.append("No major personal risk amplifiers were detected beyond the ambient AQI.")

    return " ".join(parts)


def _health_effects(
    bucket: str, age: int, asthma: bool, pregnancy: bool, outdoor_hours: float,
) -> list:
    """Return only the health effects relevant to this user."""
    idx = _bucket_index(bucket)
    effects = []

    # Universal effects by severity
    if idx >= 2:  # Moderate+
        effects.append({"icon": "😮‍💨", "effect": "Mild respiratory irritation",
                        "term": "Short-term"})
    if idx >= 3:  # Poor+
        effects.append({"icon": "🫁", "effect": "Reduced lung function and breathing difficulty",
                        "term": "Short-term"})
        effects.append({"icon": "😴", "effect": "Fatigue and reduced physical performance",
                        "term": "Short-term"})
    if idx >= 4:  # Very Poor+
        effects.append({"icon": "❤️", "effect": "Cardiovascular stress and elevated heart rate",
                        "term": "Short-term"})
        effects.append({"icon": "👁️", "effect": "Eye and throat irritation",
                        "term": "Short-term"})
    if idx >= 5:  # Severe
        effects.append({"icon": "🚨", "effect": "Acute respiratory distress",
                        "term": "Short-term"})
        effects.append({"icon": "🏥", "effect": "Risk of hospitalization for vulnerable groups",
                        "term": "Short-term"})

    # Condition-specific
    if asthma and idx >= 2:
        effects.append({"icon": "💨", "effect": "Increased risk of asthma attack or exacerbation",
                        "term": "Short-term"})
    if pregnancy and idx >= 2:
        effects.append({"icon": "🤰", "effect": "Potential impact on fetal development and birth weight",
                        "term": "Long-term"})
    if age <= 12 and idx >= 2:
        effects.append({"icon": "🧒", "effect": "Impaired lung development in children",
                        "term": "Long-term"})
    if age > 60 and idx >= 3:
        effects.append({"icon": "👴", "effect": "Aggravation of existing cardiovascular or pulmonary conditions",
                        "term": "Short-term"})

    # Long-term chronic exposure
    if outdoor_hours >= 4 and idx >= 3:
        effects.append({"icon": "📉", "effect": "Chronic lung disease risk from prolonged daily exposure",
                        "term": "Long-term"})

    return effects


def _recommendations(
    aqi: float, bucket: str, age: int, asthma: bool,
    pregnancy: bool, occupation: str, outdoor_hours: float, gender: str,
) -> list:
    """Build a prioritized, non-redundant recommendation list from data."""
    idx = _bucket_index(bucket)
    recs = []

    # Mask
    if idx >= 3:
        recs.append({"priority": "High", "icon": "😷",
                     "text": "Wear an N95 or N99 mask when outdoors."})
    elif idx == 2:
        recs.append({"priority": "Medium", "icon": "😷",
                     "text": "Consider wearing a surgical mask during outdoor activities."})

    # Outdoor duration
    safe_h = _OUTDOOR_SAFE_HOURS[bucket]
    if outdoor_hours > safe_h:
        recs.append({"priority": "High", "icon": "⏱️",
                     "text": f"Reduce outdoor exposure to under {safe_h} hour(s) per day."})
    elif idx >= 2:
        recs.append({"priority": "Medium", "icon": "⏱️",
                     "text": f"Limit outdoor time to {safe_h} hours or less today."})

    # Exercise
    if idx >= 3:
        recs.append({"priority": "High", "icon": "🏃",
                     "text": "Avoid strenuous outdoor exercise. Move workouts indoors."})
    elif idx == 2:
        recs.append({"priority": "Medium", "icon": "🏃",
                     "text": "Reduce intensity of outdoor exercise."})

    # Windows
    if idx >= 3:
        recs.append({"priority": "High", "icon": "🪟",
                     "text": "Keep windows and doors closed during peak pollution hours (7–10 AM, 5–9 PM)."})

    # Air purifier
    if idx >= 3:
        recs.append({"priority": "Medium", "icon": "💨",
                     "text": "Use an indoor HEPA air purifier, especially in bedrooms."})

    # Hydration
    if idx >= 2:
        recs.append({"priority": "Low", "icon": "💧",
                     "text": "Increase water intake to help flush airway irritants."})

    # Asthma-specific
    if asthma:
        recs.append({"priority": "High", "icon": "💊",
                     "text": "Keep your rescue inhaler accessible at all times."})
        if idx >= 2:
            recs.append({"priority": "High", "icon": "📋",
                         "text": "Follow your asthma action plan and monitor peak flow readings."})

    # Pregnancy-specific
    if pregnancy:
        recs.append({"priority": "High", "icon": "🤰",
                     "text": "Minimize outdoor exposure and consult your physician about air quality risks."})

    # Children
    if age <= 12:
        recs.append({"priority": "High", "icon": "🧒",
                     "text": "Keep children indoors during peak pollution hours (7–10 AM, 6–9 PM)."})

    # Elderly
    if age > 70:
        recs.append({"priority": "High", "icon": "👴",
                     "text": "Avoid all outdoor physical activity. Stay in a well-ventilated indoor space."})

    # High-exposure occupation
    if occupation in _HIGH_EXPOSURE_OCCS:
        recs.append({"priority": "High", "icon": "👷",
                     "text": f"As a {occupation}, request PPE (N95 mask) from your employer and take regular indoor breaks."})

    # Symptom monitoring
    if idx >= 2:
        recs.append({"priority": "Low", "icon": "🩺",
                     "text": "Monitor for symptoms: coughing, wheezing, chest tightness, or eye irritation."})

    # Sort: High → Medium → Low
    order = {"High": 0, "Medium": 1, "Low": 2}
    recs.sort(key=lambda r: order.get(r["priority"], 3))
    return recs


def _daily_advice(
    bucket: str, outdoor_hours: float, age: int,
    asthma: bool, occupation: str,
) -> dict:
    """Generate daily outdoor exposure guidance."""
    safe_h = _OUTDOOR_SAFE_HOURS[bucket]
    idx = _bucket_index(bucket)

    avoid = []
    if idx >= 3:
        avoid.append("Running, cycling, or any vigorous outdoor exercise")
        avoid.append("Outdoor activities during rush hours (7–10 AM, 5–9 PM)")
    if idx >= 4:
        avoid.append("Opening windows during daytime")
        avoid.append("Prolonged time in traffic or near construction sites")
    if asthma and idx >= 2:
        avoid.append("Exposure to dust, smoke, or strong odors")
    if age <= 12 and idx >= 2:
        avoid.append("Outdoor sports or recess during school hours")

    exercise_safe = idx <= 1 or (idx == 2 and not asthma and age > 12 and age <= 60)

    return {
        "safe_outdoor_hours": safe_h,
        "best_time":          _BEST_TIME[bucket],
        "activities_to_avoid": avoid if avoid else ["No specific restrictions today."],
        "outdoor_exercise_safe": exercise_safe,
        "exercise_note": (
            "Outdoor exercise is safe today." if exercise_safe
            else "Move exercise indoors or postpone until air quality improves."
        ),
    }


def _high_risk_alerts(
    aqi: float, bucket: str, asthma: bool, pregnancy: bool,
    age: int, occupation: str, outdoor_hours: float,
    forecast: list,
) -> list:
    """Generate contextual high-risk alerts."""
    alerts = []
    idx = _bucket_index(bucket)

    if asthma:
        alerts.append({"level": "warning",
                       "icon": "⚠️",
                       "text": "Sensitive respiratory condition detected. Asthma risk is elevated."})
    if pregnancy:
        alerts.append({"level": "warning",
                       "icon": "⚠️",
                       "text": "Pregnancy detected. Fetal health may be affected by prolonged exposure."})
    if age <= 12:
        alerts.append({"level": "warning",
                       "icon": "⚠️",
                       "text": "Child profile detected. Developing lungs are more vulnerable to pollutants."})
    if age > 70:
        alerts.append({"level": "warning",
                       "icon": "⚠️",
                       "text": "Elderly profile detected. Cardiovascular and pulmonary risks are amplified."})
    if occupation in _HIGH_EXPOSURE_OCCS:
        alerts.append({"level": "info",
                       "icon": "ℹ️",
                       "text": f"Occupation '{occupation}' involves outdoor pollutant exposure. Cumulative dose is higher than average."})
    if outdoor_hours > _OUTDOOR_SAFE_HOURS.get(bucket, 4):
        alerts.append({"level": "warning",
                       "icon": "⚠️",
                       "text": f"Your daily outdoor hours ({outdoor_hours:.1f}) exceed the safe limit for {bucket} air quality."})

    # Forecast-based alerts
    if forecast:
        worst = max(forecast, key=lambda f: f["aqi"])
        worst_idx = _bucket_index(worst["aqi_bucket"])
        if worst_idx >= 4:
            alerts.append({"level": "danger",
                           "icon": "🔴",
                           "text": f"Forecast alert: AQI is predicted to reach {worst['aqi']} ({worst['aqi_bucket']}) on {worst['date']}. Plan indoor activities."})
        elif worst_idx >= 3 and worst_idx > idx:
            alerts.append({"level": "warning",
                           "icon": "🟡",
                           "text": f"AQI is expected to worsen to {worst['aqi']} ({worst['aqi_bucket']}) on {worst['date']}."})

    return alerts


def _seven_day_outlook(
    forecast: list, age: int, asthma: bool, pregnancy: bool,
    outdoor_hours: float,
) -> list:
    """Attach a personalized risk level and one recommendation to each forecast day."""
    outlook = []
    for i, day in enumerate(forecast):
        bucket = day["aqi_bucket"]
        aqi    = day["aqi"]
        score, level, _ = compute_risk(
            aqi_bucket    = bucket,
            age           = age,
            asthma        = asthma,
            pregnancy     = pregnancy,
            occupation    = "Other",
            outdoor_hours = outdoor_hours,
        )
        idx = _bucket_index(bucket)
        if idx <= 1:
            tip = "Good day for outdoor activities."
        elif idx == 2:
            tip = "Limit strenuous outdoor exercise."
        elif idx == 3:
            tip = "Wear a mask and reduce outdoor time."
        elif idx == 4:
            tip = "Stay indoors as much as possible."
        else:
            tip = "Avoid all outdoor exposure. Emergency precautions apply."

        if asthma and idx >= 2:
            tip += " Keep inhaler ready."
        if pregnancy and idx >= 3:
            tip += " Consult physician."

        outlook.append({
            "date":        day["date"],
            "label":       "Today" if i == 0 else f"Day {i + 1}",
            "aqi":         aqi,
            "aqi_bucket":  bucket,
            "risk_level":  level,
            "risk_score":  score,
            "tip":         tip,
        })
    return outlook


def _explainability(
    aqi: float, bucket: str, risk_level: str, risk_score: float,
    age: int, asthma: bool, pregnancy: bool,
    occupation: str, outdoor_hours: float,
    forecast: list,
) -> list:
    """Return bullet-point reasons why the AI reached this risk conclusion."""
    reasons = []
    idx = _bucket_index(bucket)

    reasons.append(f"AQI is {aqi:.0f}, classified as '{bucket}' — "
                   f"base risk score is {AQI_BASE_RISK.get(bucket, 50):.0f}/100.")

    age_mult = age_multiplier(age)
    if age_mult != 1.0:
        reasons.append(f"Age {age} ({_age_group(age)}) applies a {age_mult:.2f}× vulnerability multiplier.")

    if asthma:
        reasons.append("Asthma condition applies a 1.35× risk multiplier.")
    if pregnancy:
        reasons.append("Pregnancy applies a 1.25× risk multiplier.")

    occ_mult = HIGH_EXPOSURE_OCCUPATIONS.get(occupation, 1.0)
    if occ_mult > 1.0:
        reasons.append(f"Occupation '{occupation}' applies a {occ_mult:.2f}× exposure multiplier.")

    safe_h = _OUTDOOR_SAFE_HOURS.get(bucket, 4)
    if outdoor_hours > safe_h:
        reasons.append(
            f"Outdoor hours ({outdoor_hours:.1f}/day) exceed the safe limit ({safe_h} hrs) "
            f"for {bucket} air quality, adding an additional dose penalty."
        )

    if forecast:
        worst = max(forecast, key=lambda f: f["aqi"])
        if _bucket_index(worst["aqi_bucket"]) >= 4:
            reasons.append(
                f"7-day forecast peaks at AQI {worst['aqi']} ({worst['aqi_bucket']}) on {worst['date']}, "
                "indicating sustained high-risk conditions ahead."
            )

    reasons.append(f"Final computed risk score: {risk_score:.0f}/100 → Risk Level: {risk_level}.")
    return reasons


def generate_health_report(
    aqi:           float,
    city:          str,
    age:           int,
    gender:        str,
    asthma:        bool,
    pregnancy:     bool,
    occupation:    str,
    outdoor_hours: float,
    forecast:      list,
    top_shap:      list,
    conditions:    dict,
) -> dict:
    """
    Master function: generate a complete AI health report.
    All sections are derived dynamically from inputs — no hardcoded strings.

    LLM integration point: replace the body of this function with an LLM
    prompt call and parse the structured JSON response back into this schema.
    """
    bucket = aqi_to_bucket(aqi)
    risk_score, level, _ = compute_risk(
        aqi_bucket    = bucket,
        age           = age,
        asthma        = asthma,
        pregnancy     = pregnancy,
        occupation    = occupation,
        outdoor_hours = outdoor_hours,
    )

    is_emergency = (
        _bucket_index(bucket) >= 5
        or (level in ("Very High", "Hazardous") and _is_sensitive(age, asthma, pregnancy))
    )

    return {
        "city":          city,
        "aqi":           round(aqi, 1),
        "aqi_bucket":    bucket,
        "risk_score":    risk_score,
        "risk_level":    level,
        "health_score":  _health_score(aqi, risk_score, outdoor_hours, asthma, pregnancy, age),
        "is_emergency":  is_emergency,
        "ai_summary":    _ai_summary(aqi, bucket, level, risk_score, age, gender,
                                     asthma, pregnancy, occupation, outdoor_hours, top_shap),
        "health_effects": _health_effects(bucket, age, asthma, pregnancy, outdoor_hours),
        "recommendations": _recommendations(aqi, bucket, age, asthma, pregnancy,
                                            occupation, outdoor_hours, gender),
        "daily_advice":  _daily_advice(bucket, outdoor_hours, age, asthma, occupation),
        "alerts":        _high_risk_alerts(aqi, bucket, asthma, pregnancy, age,
                                           occupation, outdoor_hours, forecast),
        "seven_day_outlook": _seven_day_outlook(forecast, age, asthma, pregnancy, outdoor_hours),
        "explainability": _explainability(aqi, bucket, level, risk_score, age,
                                          asthma, pregnancy, occupation, outdoor_hours, forecast),
        "conditions":    conditions,
    }


# ── Demo: run on a representative AQI scenario per city ───────────────────────

DEMO_SCENARIOS = [
    {"city": "Delhi",     "aqi": 320.0, "date": "2024-01-15"},
    {"city": "Mumbai",    "aqi": 145.0, "date": "2024-01-15"},
    {"city": "Bangalore", "aqi": 78.0,  "date": "2024-01-15"},
    {"city": "Kolkata",   "aqi": 210.0, "date": "2024-01-15"},
    {"city": "Chennai",   "aqi": 95.0,  "date": "2024-01-15"},
]


def run_health_risk_assessment(
    users_path:  str = "datasets/user/user_profile_100.csv",
    output_dir:  str = "reports/health_risk",
    summary_path: str = "models/health_risk_summary.json",
):
    logging.info("=== Week 5: Personalized Health Risk Assessment ===")
    os.makedirs(output_dir, exist_ok=True)

    all_frames   = []
    summary_data = {}

    for scenario in DEMO_SCENARIOS:
        city   = scenario["city"]
        aqi    = scenario["aqi"]
        date   = scenario["date"]
        bucket = aqi_to_bucket(aqi)

        logging.info(f"Assessing {city} | AQI={aqi} ({bucket}) | Date={date}")

        df_risk = assess_all_users(
            users_path = users_path,
            aqi_value  = aqi,
            aqi_bucket = bucket,
            city       = city,
            date       = date,
        )

        # Save per-city CSV
        city_path = os.path.join(output_dir, f"risk_{city.lower()}_{date}.csv")
        df_risk.to_csv(city_path, index=False)
        logging.info(f"  Saved → '{city_path}'")

        # Risk level distribution
        dist = df_risk["Risk_Level"].value_counts().to_dict()
        logging.info(f"  Risk distribution: {dist}")

        summary_data[city] = {
            "aqi":              aqi,
            "aqi_bucket":       bucket,
            "mean_risk_score":  round(float(df_risk["Risk_Score"].mean()), 2),
            "max_risk_score":   round(float(df_risk["Risk_Score"].max()),  2),
            "risk_distribution": dist,
        }

        all_frames.append(df_risk)

    # Combined output
    df_all = pd.concat(all_frames, ignore_index=True)
    combined_path = os.path.join(output_dir, "risk_all_cities.csv")
    df_all.to_csv(combined_path, index=False)
    logging.info(f"Combined risk report saved → '{combined_path}' ({len(df_all)} rows)")

    # Save summary JSON
    os.makedirs(os.path.dirname(summary_path), exist_ok=True)
    with open(summary_path, "w") as f:
        json.dump(summary_data, f, indent=4)
    logging.info(f"Summary saved → '{summary_path}'")

    return df_all


if __name__ == "__main__":
    run_health_risk_assessment(
        users_path   = "datasets/user/user_profile_100.csv",
        output_dir   = "reports/health_risk",
        summary_path = "models/health_risk_summary.json",
    )
