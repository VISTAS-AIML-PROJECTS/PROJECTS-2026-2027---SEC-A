"""
PureBreath-AI: Week 6 - Cumulative Exposure Engine

Continuously estimates the pollutant dose accumulated by each user over
daily (24-hour) and weekly (7-day) rolling windows using:

    Dose = AQI × Outdoor_Hours × Vulnerability_Weight

Generates personalised health alerts when daily or weekly dose thresholds
are exceeded, directly addressing the abstract's requirement to model
"cumulative effects of prolonged pollutant exposure".

Author: PureBreath-AI Team
License: MIT
"""

import os
import json
import logging
import numpy as np
import pandas as pd
from datetime import date, timedelta
from typing import Dict, List

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)

# ── Vulnerability weights (reused from Week 5 logic) ──────────────────────────

def vulnerability_weight(age: int, asthma: bool, pregnancy: bool) -> float:
    """Composite vulnerability multiplier for dose calculation."""
    if age <= 5:    age_w = 1.8
    elif age <= 12: age_w = 1.5
    elif age <= 17: age_w = 1.2
    elif age <= 60: age_w = 1.0
    elif age <= 70: age_w = 1.3
    else:           age_w = 1.6

    asthma_w    = 1.35 if asthma    else 1.0
    pregnancy_w = 1.25 if pregnancy else 1.0
    return round(age_w * asthma_w * pregnancy_w, 4)


# ── Dose thresholds for alerts ─────────────────────────────────────────────────
# Units: AQI-hours (AQI × hours of outdoor exposure × vulnerability)

DAILY_THRESHOLDS = {
    "Safe":     200,
    "Moderate": 400,
    "High":     700,
    "Critical": float("inf"),
}

WEEKLY_THRESHOLDS = {
    "Safe":     1000,
    "Moderate": 2500,
    "High":     4500,
    "Critical": float("inf"),
}

def dose_alert_level(dose: float, thresholds: Dict[str, float]) -> str:
    for level, limit in thresholds.items():
        if dose < limit:
            return level
    return "Critical"

DAILY_ALERT_MESSAGES = {
    "Safe":     "Daily exposure is within safe limits. No action needed.",
    "Moderate": "Moderate daily dose accumulated. Limit further outdoor activity today.",
    "High":     "High daily pollutant dose. Stay indoors for the rest of the day.",
    "Critical": "Critical daily dose exceeded. Seek medical advice if experiencing symptoms.",
}

WEEKLY_ALERT_MESSAGES = {
    "Safe":     "Weekly cumulative exposure is within safe limits.",
    "Moderate": "Moderate weekly dose. Consider reducing outdoor hours over the next few days.",
    "High":     "High weekly cumulative dose. Consult a physician and minimise outdoor exposure.",
    "Critical": "Critical weekly dose exceeded. Immediate medical consultation recommended.",
}


# ── Simulate 7-day AQI history per city ───────────────────────────────────────

def simulate_aqi_history(city: str, base_aqi: float, days: int = 7) -> List[Dict]:
    """
    Generate a rolling 7-day AQI forecast starting from today with ±15% daily variation.
    Day 0 = today, Day 1 = tomorrow, ..., Day 6 = today + 6 days.
    """
    np.random.seed(abs(hash(city)) % (2**31))
    today = date.today()
    history = []
    for i in range(days):
        forecast_date = today + timedelta(days=i)
        noise = np.random.uniform(-0.15, 0.15)
        aqi   = round(float(np.clip(base_aqi * (1 + noise), 10, 500)), 1)
        history.append({"date": str(forecast_date), "aqi": aqi})
    return history


# ── Core cumulative dose computation ──────────────────────────────────────────

def compute_cumulative_exposure(
    user_row:    pd.Series,
    aqi_history: List[Dict],
) -> Dict:
    """
    Compute daily dose for each day and rolling 7-day cumulative dose.

    Dose_day = AQI_day × Outdoor_Hours × Vulnerability_Weight
    Dose_week = sum(Dose_day) over 7 days
    """
    age        = int(user_row["Age"])
    asthma     = str(user_row["Asthma"]).strip().lower() == "yes"
    pregnancy  = str(user_row["Pregnancy"]).strip().lower() == "yes"
    out_hours  = float(user_row["Outdoor_Hours"])
    vuln_w     = vulnerability_weight(age, asthma, pregnancy)

    daily_records = []
    for entry in aqi_history:
        dose = round(entry["aqi"] * out_hours * vuln_w, 2)
        alert = dose_alert_level(dose, DAILY_THRESHOLDS)
        daily_records.append({
            "date":        entry["date"],
            "aqi":         entry["aqi"],
            "daily_dose":  dose,
            "daily_alert": alert,
            "daily_msg":   DAILY_ALERT_MESSAGES[alert],
        })

    weekly_dose  = round(sum(r["daily_dose"] for r in daily_records), 2)
    weekly_alert = dose_alert_level(weekly_dose, WEEKLY_THRESHOLDS)

    return {
        "User_ID":          user_row["User_ID"],
        "Age":              age,
        "Asthma":           user_row["Asthma"],
        "Pregnancy":        user_row["Pregnancy"],
        "Occupation":       user_row["Occupation"],
        "Outdoor_Hours":    out_hours,
        "Vulnerability_W":  vuln_w,
        "Daily_Records":    daily_records,
        "Weekly_Dose":      weekly_dose,
        "Weekly_Alert":     weekly_alert,
        "Weekly_Message":   WEEKLY_ALERT_MESSAGES[weekly_alert],
    }


# ── Batch processing ───────────────────────────────────────────────────────────

def run_cumulative_exposure(
    users_path:  str,
    city_aqi_map: Dict[str, float],
    output_dir:  str = "reports/cumulative_exposure",
    summary_path: str = "models/cumulative_exposure_summary.json",
):
    logging.info("=== Week 6: Cumulative Exposure Engine ===")
    os.makedirs(output_dir, exist_ok=True)

    df_users = pd.read_csv(users_path)
    all_summary = {}

    for city, base_aqi in city_aqi_map.items():
        logging.info(f"Processing {city} | Base AQI={base_aqi}")
        aqi_history = simulate_aqi_history(city, base_aqi, days=7)

        flat_rows = []
        for _, user in df_users.iterrows():
            result = compute_cumulative_exposure(user, aqi_history)

            # Flatten daily records into one row per user (summary)
            row = {
                "User_ID":         result["User_ID"],
                "Age":             result["Age"],
                "Asthma":          result["Asthma"],
                "Pregnancy":       result["Pregnancy"],
                "Occupation":      result["Occupation"],
                "Outdoor_Hours":   result["Outdoor_Hours"],
                "Vulnerability_W": result["Vulnerability_W"],
                "City":            city,
                "Weekly_Dose":     result["Weekly_Dose"],
                "Weekly_Alert":    result["Weekly_Alert"],
                "Weekly_Message":  result["Weekly_Message"],
            }
            # Add daily dose columns
            for i, rec in enumerate(result["Daily_Records"], 1):
                row[f"Day{i}_Date"]  = rec["date"]
                row[f"Day{i}_AQI"]   = rec["aqi"]
                row[f"Day{i}_Dose"]  = rec["daily_dose"]
                row[f"Day{i}_Alert"] = rec["daily_alert"]
            flat_rows.append(row)

        df_city = pd.DataFrame(flat_rows)
        city_path = os.path.join(output_dir, f"exposure_{city.lower()}.csv")
        df_city.to_csv(city_path, index=False)

        # City-level summary stats
        alert_dist = df_city["Weekly_Alert"].value_counts().to_dict()
        logging.info(f"  Weekly alert distribution: {alert_dist}")
        logging.info(f"  Mean weekly dose: {df_city['Weekly_Dose'].mean():.1f} | "
                     f"Max: {df_city['Weekly_Dose'].max():.1f}")
        logging.info(f"  Saved → '{city_path}'")

        all_summary[city] = {
            "base_aqi":           base_aqi,
            "aqi_history":        aqi_history,
            "mean_weekly_dose":   round(float(df_city["Weekly_Dose"].mean()), 2),
            "max_weekly_dose":    round(float(df_city["Weekly_Dose"].max()),  2),
            "weekly_alert_dist":  alert_dist,
        }

    # Save summary JSON
    os.makedirs(os.path.dirname(summary_path), exist_ok=True)
    with open(summary_path, "w") as f:
        json.dump(all_summary, f, indent=4)
    logging.info(f"Summary saved → '{summary_path}'")

    return all_summary


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    CITY_AQI_MAP = {
        "Delhi":     320.0,
        "Mumbai":    145.0,
        "Bangalore":  78.0,
        "Kolkata":   210.0,
        "Chennai":    95.0,
    }

    run_cumulative_exposure(
        users_path   = "datasets/user/user_profile_100.csv",
        city_aqi_map = CITY_AQI_MAP,
        output_dir   = "reports/cumulative_exposure",
        summary_path = "models/cumulative_exposure_summary.json",
    )
