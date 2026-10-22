"""
PureBreath-AI: Week 8 - FastAPI Backend

Endpoints:
  POST /predict          - AQI prediction + SHAP explanation + counterfactual
  POST /health-risk      - Personalised health risk score
  POST /exposure         - 7-day cumulative exposure + weekly alert
  GET  /city-summary     - Pre-computed city stats from saved reports
  GET  /health           - Health check
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import shap
from datetime import date, timedelta
from types import SimpleNamespace

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# ── Path setup ─────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

from health_risk_assessment import compute_risk, aqi_to_bucket, generate_health_report
from cumulative_exposure import (
    compute_cumulative_exposure,
    simulate_aqi_history,
    vulnerability_weight,
)
from xai_explainer import compute_shap_explanations, generate_counterfactual

# ── Load model artifacts once at startup ──────────────────────────────────────
MODEL_PATH    = os.path.join(ROOT, "models", "lightgbm_aqi_model.pkl")
FEATURES_PATH = os.path.join(ROOT, "models", "model_features.json")

model = joblib.load(MODEL_PATH)
with open(FEATURES_PATH) as f:
    FEATURE_NAMES = json.load(f)["features"]

# Pre-load latest pollutant data per city from processed dataset
DATASET_PATH = os.path.join(ROOT, "datasets", "processed", "cleaned_dataset.csv")
_df_clean = pd.read_csv(DATASET_PATH)
CITY_LATEST = (
    _df_clean.groupby("City", as_index=False).last()
    .set_index("City")
    .to_dict(orient="index")
)

# Pre-load city summary data
HEALTH_SUMMARY_PATH = os.path.join(ROOT, "models", "health_risk_summary.json")
EXPOSURE_SUMMARY_PATH = os.path.join(ROOT, "models", "cumulative_exposure_summary.json")
XAI_SUMMARY_PATH = os.path.join(ROOT, "reports", "xai", "xai_summary.json")
SHAP_IMPORTANCE_PATH = os.path.join(ROOT, "reports", "xai", "shap_global_importance.csv")

with open(HEALTH_SUMMARY_PATH) as f:
    HEALTH_SUMMARY = json.load(f)
with open(EXPOSURE_SUMMARY_PATH) as f:
    EXPOSURE_SUMMARY = json.load(f)
with open(XAI_SUMMARY_PATH) as f:
    XAI_SUMMARY = json.load(f)

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PureBreath-AI API",
    description="Personalized AQI forecasting with explainable AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response schemas ─────────────────────────────────────────────────

class PollutantInput(BaseModel):
    PM2_5: float = Field(..., alias="PM2.5", ge=0)
    PM10: float = Field(..., ge=0)
    NO: float = Field(0.0, ge=0)
    NO2: float = Field(0.0, ge=0)
    NOx: float = Field(0.0, ge=0)
    NH3: float = Field(0.0, ge=0)
    CO: float = Field(0.0, ge=0)
    SO2: float = Field(0.0, ge=0)
    O3: float = Field(0.0, ge=0)
    Benzene: float = Field(0.0, ge=0)
    Toluene: float = Field(0.0, ge=0)
    Xylene: float = Field(0.0, ge=0)
    temp_mean_c: float = Field(25.0)
    temp_min_c: float = Field(20.0)
    temp_max_c: float = Field(30.0)
    precipitation_mm: float = Field(0.0, ge=0)
    pressure_hgt: float = Field(1013.0)
    city: str = Field("Delhi")

    model_config = {"populate_by_name": True}


class UserProfile(BaseModel):
    age: int = Field(..., ge=1, le=120)
    asthma: bool = False
    pregnancy: bool = False
    occupation: str = "Other"
    outdoor_hours: float = Field(2.0, ge=0, le=24)


class HealthRiskRequest(BaseModel):
    aqi: float = Field(..., ge=0)
    user: UserProfile


class ExposureRequest(BaseModel):
    city: str
    base_aqi: float = Field(..., ge=0)
    user: UserProfile


class HealthReportRequest(BaseModel):
    city: str = Field("Delhi")
    age: int = Field(..., ge=1, le=120)
    gender: str = Field("Other")
    asthma: bool = False
    pregnancy: bool = False
    occupation: str = "Other"
    outdoor_hours: float = Field(2.0, ge=0, le=24)


# ── Helper: build feature vector from pollutant input ─────────────────────────

def build_feature_vector(inp: PollutantInput) -> pd.DataFrame:
    """
    Construct a single-row DataFrame aligned to FEATURE_NAMES.
    Lag and rolling features default to the current values (no history available).
    """
    city = inp.city.strip().title()
    row = {
        "PM2.5": inp.PM2_5, "PM10": inp.PM10,
        "NO": inp.NO, "NO2": inp.NO2, "NOx": inp.NOx,
        "NH3": inp.NH3, "CO": inp.CO, "SO2": inp.SO2,
        "O3": inp.O3, "Benzene": inp.Benzene,
        "Toluene": inp.Toluene, "Xylene": inp.Xylene,
        "temp_mean_c": inp.temp_mean_c,
        "temp_min_c": inp.temp_min_c,
        "temp_max_c": inp.temp_max_c,
        "precipitation_mm": inp.precipitation_mm,
        "pressure_hgt": inp.pressure_hgt,
        # Temporal defaults (mid-year weekday)
        "Month": 6, "DayOfWeek": 2, "DayOfYear": 180,
        "Quarter": 2, "Is_Weekend": 0,
        "Month_sin": np.sin(2 * np.pi * 6 / 12),
        "Month_cos": np.cos(2 * np.pi * 6 / 12),
        # Lag features default to current values
        "PM2.5_lag1": inp.PM2_5, "PM2.5_lag2": inp.PM2_5, "PM2.5_lag7": inp.PM2_5,
        "PM10_lag1": inp.PM10, "PM10_lag2": inp.PM10, "PM10_lag7": inp.PM10,
        "NO2_lag1": inp.NO2, "NO2_lag2": inp.NO2, "NO2_lag7": inp.NO2,
        "SO2_lag1": inp.SO2, "SO2_lag2": inp.SO2, "SO2_lag7": inp.SO2,
        "CO_lag1": inp.CO, "CO_lag2": inp.CO, "CO_lag7": inp.CO,
        "O3_lag1": inp.O3, "O3_lag2": inp.O3, "O3_lag7": inp.O3,
        "temp_mean_c_lag1": inp.temp_mean_c,
        "temp_mean_c_lag2": inp.temp_mean_c,
        "temp_mean_c_lag7": inp.temp_mean_c,
        # Rolling stats default to current values
        "PM2.5_roll_mean_7d": inp.PM2_5, "PM2.5_roll_std_7d": 0.0,
        "PM10_roll_mean_7d": inp.PM10, "PM10_roll_std_7d": 0.0,
        "temp_range": inp.temp_max_c - inp.temp_min_c,
        # City one-hot
        "City_Bangalore": 1 if city == "Bangalore" else 0,
        "City_Chennai":   1 if city == "Chennai"   else 0,
        "City_Delhi":     1 if city == "Delhi"      else 0,
        "City_Kolkata":   1 if city == "Kolkata"    else 0,
        "City_Mumbai":    1 if city == "Mumbai"     else 0,
    }
    df = pd.DataFrame([row])
    for col in FEATURE_NAMES:
        if col not in df.columns:
            df[col] = 0
    return df[FEATURE_NAMES]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "model": "LightGBM", "features": len(FEATURE_NAMES)}


@app.post("/predict")
def predict_aqi(inp: PollutantInput):
    """
    Predict AQI from pollutant + weather inputs.
    Returns prediction, SHAP top-5 features, and counterfactual recommendation.
    """
    X = build_feature_vector(inp)

    # Prediction
    aqi_pred = float(model.predict(X)[0])
    bucket   = aqi_to_bucket(aqi_pred)

    # SHAP (single sample)
    explainer   = shap.TreeExplainer(model)
    shap_vals   = explainer.shap_values(X)[0]
    shap_series = pd.Series(shap_vals, index=FEATURE_NAMES).sort_values(
        key=abs, ascending=False
    )
    top5_shap = [
        {"feature": feat, "shap_value": round(float(val), 4)}
        for feat, val in shap_series.head(5).items()
    ]

    # Counterfactual
    cf = generate_counterfactual(
        model=model,
        row=X.iloc[0],
        shap_row=shap_vals,
        feature_names=FEATURE_NAMES,
    )

    return {
        "predicted_aqi":      round(aqi_pred, 2),
        "aqi_bucket":         bucket,
        "top5_shap_features": top5_shap,
        "counterfactual": {
            "counterfactual_aqi": cf["counterfactual_aqi"],
            "cf_bucket":          cf["cf_bucket"],
            "aqi_reduction":      cf["aqi_reduction"],
            "recommendations":    cf["recommendations"],
        },
    }


@app.post("/health-risk")
def health_risk(req: HealthRiskRequest):
    """Compute personalised health risk score for a user at a given AQI."""
    bucket = aqi_to_bucket(req.aqi)
    score, level, advisory = compute_risk(
        aqi_bucket    = bucket,
        age           = req.user.age,
        asthma        = req.user.asthma,
        pregnancy     = req.user.pregnancy,
        occupation    = req.user.occupation,
        outdoor_hours = req.user.outdoor_hours,
    )
    return {
        "aqi":        req.aqi,
        "aqi_bucket": bucket,
        "risk_score": score,
        "risk_level": level,
        "advisory":   advisory,
    }


@app.post("/exposure")
def cumulative_exposure(req: ExposureRequest):
    """Compute 7-day cumulative exposure and weekly alert for a user in a city."""
    aqi_history = simulate_aqi_history(req.city, req.base_aqi, days=7)

    user_series = pd.Series({
        "User_ID":       "api_user",
        "Age":           req.user.age,
        "Asthma":        "Yes" if req.user.asthma else "No",
        "Pregnancy":     "Yes" if req.user.pregnancy else "No",
        "Occupation":    req.user.occupation,
        "Outdoor_Hours": req.user.outdoor_hours,
    })

    result = compute_cumulative_exposure(user_series, aqi_history)

    return {
        "city":            req.city,
        "vulnerability_w": result["Vulnerability_W"],
        "weekly_dose":     result["Weekly_Dose"],
        "weekly_alert":    result["Weekly_Alert"],
        "weekly_message":  result["Weekly_Message"],
        "daily_records":   result["Daily_Records"],
    }


@app.get("/auto-predict/{city}")
def auto_predict(city: str):
    """
    Automatically predict AQI for a city using the latest available
    pollutant data from the processed dataset.
    Returns current prediction + 7-day rolling forecast.
    """
    city_title = city.strip().title()
    if city_title not in CITY_LATEST:
        raise HTTPException(status_code=404, detail=f"City '{city_title}' not found.")

    row = CITY_LATEST[city_title]

    inp = SimpleNamespace(
        PM2_5            = float(row.get("PM2.5", 0)),
        PM10             = float(row.get("PM10", 0)),
        NO               = float(row.get("NO", 0)),
        NO2              = float(row.get("NO2", 0)),
        NOx              = float(row.get("NOx", 0)),
        NH3              = float(row.get("NH3", 0)),
        CO               = float(row.get("CO", 0)),
        SO2              = float(row.get("SO2", 0)),
        O3               = float(row.get("O3", 0)),
        Benzene          = float(row.get("Benzene", 0)),
        Toluene          = float(row.get("Toluene", 0)),
        Xylene           = float(row.get("Xylene", 0)),
        temp_mean_c      = float(row.get("temp_mean_c", 25)),
        temp_min_c       = float(row.get("temp_min_c", 20)),
        temp_max_c       = float(row.get("temp_max_c", 30)),
        precipitation_mm = float(row.get("precipitation_mm", 0)),
        pressure_hgt     = float(row.get("pressure_hgt", 1013)),
        city             = city_title,
    )
    X = build_feature_vector(inp)

    # Current prediction
    aqi_pred = float(model.predict(X)[0])
    bucket   = aqi_to_bucket(aqi_pred)

    # SHAP
    explainer  = shap.TreeExplainer(model)
    shap_vals  = explainer.shap_values(X)[0]
    shap_series = pd.Series(shap_vals, index=FEATURE_NAMES).sort_values(
        key=abs, ascending=False
    )
    top5_shap = [
        {"feature": feat, "shap_value": round(float(val), 4)}
        for feat, val in shap_series.head(5).items()
    ]

    # Counterfactual
    cf = generate_counterfactual(
        model=model,
        row=X.iloc[0],
        shap_row=shap_vals,
        feature_names=FEATURE_NAMES,
    )

    # 7-day rolling forecast: apply ±12% daily noise seeded by city
    rng = np.random.default_rng(abs(hash(city_title)) % (2**31))
    today = date.today()
    forecast = []
    for i in range(7):
        noise  = rng.uniform(-0.12, 0.12)
        f_aqi  = round(float(np.clip(aqi_pred * (1 + noise), 10, 500)), 1)
        forecast.append({
            "date":       str(today + timedelta(days=i)),
            "aqi":        f_aqi,
            "aqi_bucket": aqi_to_bucket(f_aqi),
        })

    # Current environmental conditions to display
    conditions = {
        "PM2.5":            inp.PM2_5,
        "PM10":             inp.PM10,
        "NO2":              inp.NO2,
        "SO2":              inp.SO2,
        "CO":               inp.CO,
        "O3":               inp.O3,
        "temp_mean_c":      inp.temp_mean_c,
        "precipitation_mm": inp.precipitation_mm,
    }

    return {
        "city":              city_title,
        "predicted_aqi":     round(aqi_pred, 2),
        "aqi_bucket":        bucket,
        "top5_shap_features": top5_shap,
        "counterfactual": {
            "counterfactual_aqi": cf["counterfactual_aqi"],
            "cf_bucket":          cf["cf_bucket"],
            "aqi_reduction":      cf["aqi_reduction"],
            "recommendations":    cf["recommendations"],
        },
        "forecast":          forecast,
        "conditions":        conditions,
    }


@app.post("/health-report")
def health_report_full(req: HealthReportRequest):
    """
    Generate a complete AI-powered personalized health report.
    Automatically fetches the latest city AQI + forecast from the dataset,
    then runs the AI recommendation engine.
    """
    city = req.city.strip().title()
    if city not in CITY_LATEST:
        raise HTTPException(status_code=404, detail=f"City '{city}' not found.")

    # Reuse auto-predict logic to get AQI, forecast, SHAP, conditions
    row = CITY_LATEST[city]

    inp = SimpleNamespace(
        PM2_5            = float(row.get("PM2.5", 0)),
        PM10             = float(row.get("PM10", 0)),
        NO               = float(row.get("NO", 0)),
        NO2              = float(row.get("NO2", 0)),
        NOx              = float(row.get("NOx", 0)),
        NH3              = float(row.get("NH3", 0)),
        CO               = float(row.get("CO", 0)),
        SO2              = float(row.get("SO2", 0)),
        O3               = float(row.get("O3", 0)),
        Benzene          = float(row.get("Benzene", 0)),
        Toluene          = float(row.get("Toluene", 0)),
        Xylene           = float(row.get("Xylene", 0)),
        temp_mean_c      = float(row.get("temp_mean_c", 25)),
        temp_min_c       = float(row.get("temp_min_c", 20)),
        temp_max_c       = float(row.get("temp_max_c", 30)),
        precipitation_mm = float(row.get("precipitation_mm", 0)),
        pressure_hgt     = float(row.get("pressure_hgt", 1013)),
        city             = city,
    )
    X = build_feature_vector(inp)
    aqi_pred = float(model.predict(X)[0])

    # SHAP
    explainer  = shap.TreeExplainer(model)
    shap_vals  = explainer.shap_values(X)[0]
    shap_series = pd.Series(shap_vals, index=FEATURE_NAMES).sort_values(
        key=abs, ascending=False
    )
    top5_shap = [
        {"feature": feat, "shap_value": round(float(val), 4)}
        for feat, val in shap_series.head(5).items()
    ]

    # 7-day forecast
    rng   = np.random.default_rng(abs(hash(city)) % (2**31))
    today = date.today()
    forecast = []
    for i in range(7):
        noise = rng.uniform(-0.12, 0.12)
        f_aqi = round(float(np.clip(aqi_pred * (1 + noise), 10, 500)), 1)
        forecast.append({
            "date":       str(today + timedelta(days=i)),
            "aqi":        f_aqi,
            "aqi_bucket": aqi_to_bucket(f_aqi),
        })

    conditions = {
        "PM2.5":            inp.PM2_5,
        "PM10":             inp.PM10,
        "NO2":              inp.NO2,
        "SO2":              inp.SO2,
        "CO":               inp.CO,
        "O3":               inp.O3,
        "temp_mean_c":      inp.temp_mean_c,
        "precipitation_mm": inp.precipitation_mm,
    }

    report = generate_health_report(
        aqi           = aqi_pred,
        city          = city,
        age           = req.age,
        gender        = req.gender,
        asthma        = req.asthma,
        pregnancy     = req.pregnancy,
        occupation    = req.occupation,
        outdoor_hours = req.outdoor_hours,
        forecast      = forecast,
        top_shap      = top5_shap,
        conditions    = conditions,
    )
    return report


@app.get("/city-summary")
def city_summary():
    """Return pre-computed health risk + exposure summaries for all 5 cities."""
    cities = ["Delhi", "Mumbai", "Bangalore", "Kolkata", "Chennai"]
    summary = {}
    for city in cities:
        summary[city] = {
            "aqi":             HEALTH_SUMMARY[city]["aqi"],
            "aqi_bucket":      HEALTH_SUMMARY[city]["aqi_bucket"],
            "mean_risk_score": HEALTH_SUMMARY[city]["mean_risk_score"],
            "risk_distribution": HEALTH_SUMMARY[city]["risk_distribution"],
            "mean_weekly_dose": EXPOSURE_SUMMARY[city]["mean_weekly_dose"],
            "weekly_alert_dist": EXPOSURE_SUMMARY[city]["weekly_alert_dist"],
        }
    return {
        "cities": summary,
        "xai_summary": XAI_SUMMARY,
    }
