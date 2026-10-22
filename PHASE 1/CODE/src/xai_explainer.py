"""
PureBreath-AI: Week 7 - SHAP + Counterfactual Explainable AI Module

Implements two complementary XAI components described in the abstract:

1. SHAP Feature Attribution
   - Computes SHAP values for LightGBM predictions on a sample of test rows
   - Identifies top driving features for each prediction
   - Saves global feature importance + per-sample local explanations

2. Counterfactual What-If Recommendations
   - For each high-AQI prediction, generates actionable counterfactuals:
     "If PM2.5 dropped by X%, AQI would fall from Y to Z (Severe → Moderate)"
   - Targets the top-3 most impactful SHAP features per sample
   - Translates feature deltas into plain-language recommendations

Author: PureBreath-AI Team
License: MIT
"""

import os
import json
import logging
import joblib
import shap
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)

# ── AQI bucket helper ──────────────────────────────────────────────────────────

def aqi_to_bucket(aqi: float) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Satisfactory"
    if aqi <= 200:  return "Moderate"
    if aqi <= 300:  return "Poor"
    if aqi <= 400:  return "Very Poor"
    return "Severe"


# ── Plain-language counterfactual templates ────────────────────────────────────

REDUCTION_TEMPLATES = {
    "PM2.5":            "Reduce PM2.5 by {pct:.0f}% (e.g. avoid biomass burning, use cleaner fuels).",
    "PM10":             "Reduce PM10 by {pct:.0f}% (e.g. water roads, control construction dust).",
    "NO2":              "Reduce NO2 by {pct:.0f}% (e.g. reduce vehicle traffic, promote EVs).",
    "SO2":              "Reduce SO2 by {pct:.0f}% (e.g. switch to low-sulphur fuels in industry).",
    "CO":               "Reduce CO by {pct:.0f}% (e.g. improve combustion efficiency, reduce idling).",
    "O3":               "Reduce O3 precursors by {pct:.0f}% (e.g. limit VOC and NOx emissions).",
    "NH3":              "Reduce NH3 by {pct:.0f}% (e.g. better agricultural waste management).",
    "NOx":              "Reduce NOx by {pct:.0f}% (e.g. catalytic converters, cleaner engines).",
    "Benzene":          "Reduce Benzene by {pct:.0f}% (e.g. stricter fuel quality standards).",
    "temp_mean_c":      "A {pct:.0f}% drop in temperature would reduce AQI — monitor heat-island effects.",
    "precipitation_mm": "Increased precipitation by {pct:.0f}% would wash out pollutants.",
    "PM2.5_lag1":       "Sustained PM2.5 reduction yesterday by {pct:.0f}% would lower today's AQI.",
    "PM10_lag1":        "Sustained PM10 reduction yesterday by {pct:.0f}% would lower today's AQI.",
    "PM2.5_roll_mean_7d": "A {pct:.0f}% reduction in 7-day average PM2.5 would significantly lower AQI.",
    "PM10_roll_mean_7d":  "A {pct:.0f}% reduction in 7-day average PM10 would significantly lower AQI.",
}

DEFAULT_TEMPLATE = "Reduce {feat} by {pct:.0f}% to lower AQI contribution."

TARGET_REDUCTION_PCT = 20.0   # % reduction applied to each top feature in counterfactual


# ── SHAP explanation ───────────────────────────────────────────────────────────

def compute_shap_explanations(
    model,
    X_sample: pd.DataFrame,
    model_name: str,
) -> Tuple[np.ndarray, pd.Series]:
    """
    Compute SHAP values for X_sample using TreeExplainer.
    Returns (shap_values array, global_importance Series).
    """
    logging.info(f"Computing SHAP values for {model_name} on {len(X_sample)} samples...")
    explainer   = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    global_importance = pd.Series(
        np.abs(shap_values).mean(axis=0),
        index=X_sample.columns,
    ).sort_values(ascending=False)

    logging.info(f"Top-5 global features [{model_name}]: "
                 f"{list(global_importance.head(5).index)}")
    return shap_values, global_importance


# ── Counterfactual generation ──────────────────────────────────────────────────

def generate_counterfactual(
    model,
    row: pd.Series,
    shap_row: np.ndarray,
    feature_names: List[str],
    top_k: int = 3,
    reduction_pct: float = TARGET_REDUCTION_PCT,
) -> Dict:
    """
    For a single prediction row, generate a counterfactual by reducing
    the top-k positive SHAP features by reduction_pct and re-predicting.
    """
    original_aqi    = float(model.predict(row.values.reshape(1, -1))[0])
    original_bucket = aqi_to_bucket(original_aqi)

    # Only target features with positive SHAP (they push AQI up)
    shap_series = pd.Series(shap_row, index=feature_names)
    top_features = shap_series[shap_series > 0].nlargest(top_k).index.tolist()

    if not top_features:
        top_features = shap_series.abs().nlargest(top_k).index.tolist()

    # Apply reduction
    cf_row = row.copy()
    for feat in top_features:
        if cf_row[feat] > 0:
            cf_row[feat] = cf_row[feat] * (1 - reduction_pct / 100.0)

    cf_aqi    = float(model.predict(cf_row.values.reshape(1, -1))[0])
    cf_bucket = aqi_to_bucket(cf_aqi)
    aqi_drop  = round(original_aqi - cf_aqi, 2)

    # Build plain-language recommendations
    recommendations = []
    for feat in top_features:
        tmpl = REDUCTION_TEMPLATES.get(feat, DEFAULT_TEMPLATE)
        recommendations.append(tmpl.format(feat=feat, pct=reduction_pct))

    return {
        "original_aqi":      round(original_aqi, 2),
        "original_bucket":   original_bucket,
        "counterfactual_aqi": round(cf_aqi, 2),
        "cf_bucket":         cf_bucket,
        "aqi_reduction":     aqi_drop,
        "top_features":      top_features,
        "recommendations":   recommendations,
    }


# ── Main XAI pipeline ──────────────────────────────────────────────────────────

def run_xai_pipeline(
    model_path:    str = "models/lightgbm_aqi_model.pkl",
    features_path: str = "models/model_features.json",
    data_path:     str = "datasets/processed/cleaned_dataset.csv",
    output_dir:    str = "reports/xai",
    n_samples:     int = 200,
):
    logging.info("=== Week 7: SHAP + Counterfactual Explainable AI ===")
    os.makedirs(output_dir, exist_ok=True)

    # 1. Load model and features
    model = joblib.load(model_path)
    with open(features_path) as f:
        feature_names = json.load(f)["features"]
    logging.info(f"Loaded model from '{model_path}' | {len(feature_names)} features")

    # 2. Load and prepare data (same pipeline as model_training.py)
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from model_training import load_and_engineer_model_features
    df = load_and_engineer_model_features(data_path)
    df_encoded = pd.get_dummies(df, columns=["City"], drop_first=False)

    # Align columns to trained feature set
    for col in feature_names:
        if col not in df_encoded.columns:
            df_encoded[col] = 0
    X = df_encoded[feature_names]

    # Sample rows — focus on high-AQI cases for meaningful counterfactuals
    high_aqi_mask = df["AQI_CPCB"] >= 200
    X_high  = X[high_aqi_mask].head(n_samples // 2)
    X_other = X[~high_aqi_mask].head(n_samples // 2)
    X_sample = pd.concat([X_high, X_other]).reset_index(drop=True)
    logging.info(f"Sample: {len(X_sample)} rows ({len(X_high)} high-AQI + {len(X_other)} other)")

    # 3. SHAP explanations
    shap_values, global_importance = compute_shap_explanations(
        model, X_sample, model_name="LightGBM"
    )

    # Save global feature importance
    gi_path = os.path.join(output_dir, "shap_global_importance.csv")
    global_importance.reset_index().rename(
        columns={"index": "Feature", 0: "Mean_SHAP"}
    ).to_csv(gi_path, index=False)
    logging.info(f"Global SHAP importance saved → '{gi_path}'")

    # Save per-sample SHAP values
    shap_df = pd.DataFrame(shap_values, columns=feature_names)
    shap_df.to_csv(os.path.join(output_dir, "shap_values_sample.csv"), index=False)

    # 4. Counterfactual explanations
    logging.info("Generating counterfactual explanations...")
    cf_records = []
    for i in range(len(X_sample)):
        cf = generate_counterfactual(
            model        = model,
            row          = X_sample.iloc[i],
            shap_row     = shap_values[i],
            feature_names= feature_names,
        )
        cf["sample_idx"] = i
        cf_records.append(cf)

    # Flatten for CSV (recommendations as semicolon-joined string)
    cf_flat = []
    for r in cf_records:
        cf_flat.append({
            "sample_idx":         r["sample_idx"],
            "original_aqi":       r["original_aqi"],
            "original_bucket":    r["original_bucket"],
            "counterfactual_aqi": r["counterfactual_aqi"],
            "cf_bucket":          r["cf_bucket"],
            "aqi_reduction":      r["aqi_reduction"],
            "top_features":       ", ".join(r["top_features"]),
            "recommendations":    " | ".join(r["recommendations"]),
        })

    cf_df = pd.DataFrame(cf_flat)
    cf_path = os.path.join(output_dir, "counterfactual_explanations.csv")
    cf_df.to_csv(cf_path, index=False)
    logging.info(f"Counterfactual explanations saved → '{cf_path}'")

    # 5. Summary stats
    improved = (cf_df["aqi_reduction"] > 0).sum()
    bucket_changes = (cf_df["original_bucket"] != cf_df["cf_bucket"]).sum()
    mean_drop = cf_df["aqi_reduction"].mean()

    logging.info(f"Counterfactual summary:")
    logging.info(f"  Samples improved:       {improved}/{len(cf_df)}")
    logging.info(f"  Bucket category change: {bucket_changes}/{len(cf_df)}")
    logging.info(f"  Mean AQI reduction:     {mean_drop:.2f}")

    # Save summary JSON
    summary = {
        "model":                  "LightGBM",
        "n_samples":              len(X_sample),
        "top5_global_features":   list(global_importance.head(5).index),
        "cf_samples_improved":    int(improved),
        "cf_bucket_changes":      int(bucket_changes),
        "cf_mean_aqi_reduction":  round(float(mean_drop), 2),
        "reduction_pct_applied":  TARGET_REDUCTION_PCT,
    }
    summary_path = os.path.join(output_dir, "xai_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=4)
    logging.info(f"XAI summary saved → '{summary_path}'")

    return summary


if __name__ == "__main__":
    run_xai_pipeline(
        model_path    = "models/lightgbm_aqi_model.pkl",
        features_path = "models/model_features.json",
        data_path     = "datasets/processed/cleaned_dataset.csv",
        output_dir    = "reports/xai",
        n_samples     = 200,
    )
