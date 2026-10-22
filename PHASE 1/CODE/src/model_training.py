"""
PureBreath-AI: Week 3 - AQI Prediction Model Training Module

This module builds, trains, evaluates, and persists XGBoost and LightGBM models
for Air Quality Index (AQI) forecasting and health risk estimation using environmental 
and meteorological features, adhering to CPCB (Central Pollution Control Board) standards.

Author: PureBreath-AI Team
License: MIT
"""

import os
import json
import logging
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Tuple, Any

from xgboost import XGBRegressor
from lightgbm import LGBMRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Configure logging for production tracing
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)


def calculate_cpcb_pm25_subindex(pm25: float) -> float:
    """Calculates CPCB sub-index for PM2.5 based on Indian NAQI standards."""
    if pm25 <= 30:
        return pm25 * 50.0 / 30.0
    elif pm25 <= 60:
        return 50.0 + (pm25 - 30.0) * 50.0 / 30.0
    elif pm25 <= 90:
        return 100.0 + (pm25 - 60.0) * 100.0 / 30.0
    elif pm25 <= 120:
        return 200.0 + (pm25 - 90.0) * 100.0 / 30.0
    elif pm25 <= 250:
        return 300.0 + (pm25 - 120.0) * 100.0 / 130.0
    else:
        return 400.0 + (pm25 - 250.0) * 100.0 / 150.0


def calculate_cpcb_pm10_subindex(pm10: float) -> float:
    """Calculates CPCB sub-index for PM10 based on Indian NAQI standards."""
    if pm10 <= 50:
        return pm10
    elif pm10 <= 100:
        return pm10
    elif pm10 <= 250:
        return 100.0 + (pm10 - 100.0) * 100.0 / 150.0
    elif pm10 <= 350:
        return 200.0 + (pm10 - 250.0) * 100.0 / 100.0
    elif pm10 <= 430:
        return 300.0 + (pm10 - 350.0) * 100.0 / 80.0
    else:
        return 400.0 + (pm10 - 430.0) * 100.0 / 70.0


def load_and_engineer_model_features(filepath: str) -> pd.DataFrame:
    """
    Loads cleaned dataset and constructs time-series lag, rolling, and CPCB AQI features.

    Args:
        filepath (str): Relative path to cleaned_dataset.csv

    Returns:
        pd.DataFrame: Feature-engineered dataset ready for training.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Cleaned dataset not found at path: {filepath}")

    logging.info(f"Loading cleaned dataset from '{filepath}' for feature construction...")
    df = pd.read_csv(filepath)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values(by=["City", "Date"]).reset_index(drop=True)

    # Calculate CPCB NAQI Standard Target
    df["PM2.5_sub"] = df["PM2.5"].apply(calculate_cpcb_pm25_subindex)
    df["PM10_sub"] = df["PM10"].apply(calculate_cpcb_pm10_subindex)
    df["AQI_CPCB"] = df[["PM2.5_sub", "PM10_sub"]].max(axis=1)

    # 1. Temporal & Calendar Features
    df["Month"] = df["Date"].dt.month
    df["DayOfWeek"] = df["Date"].dt.dayofweek
    df["DayOfYear"] = df["Date"].dt.dayofyear
    df["Quarter"] = df["Date"].dt.quarter
    df["Is_Weekend"] = df["DayOfWeek"].isin([5, 6]).astype(int)

    # Cyclical harmonic encodings
    df["Month_sin"] = np.sin(2 * np.pi * df["Month"] / 12.0)
    df["Month_cos"] = np.cos(2 * np.pi * df["Month"] / 12.0)

    # 2. Time-Series Lag Features per City
    lag_columns = ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3", "temp_mean_c"]
    for col in lag_columns:
        if col in df.columns:
            for lag in [1, 2, 7]:
                df[f"{col}_lag{lag}"] = df.groupby("City")[col].shift(lag)

    # 3. Rolling Window Statistics per City (7-day window)
    for col in ["PM2.5", "PM10"]:
        if col in df.columns:
            df[f"{col}_roll_mean_7d"] = df.groupby("City")[col].transform(lambda x: x.shift(1).rolling(7).mean())
            df[f"{col}_roll_std_7d"] = df.groupby("City")[col].transform(lambda x: x.shift(1).rolling(7).std())

    # 4. Temperature Range interaction feature
    df["temp_range"] = df["temp_max_c"] - df["temp_min_c"]

    # Drop NaNs introduced by lag/rolling operations
    initial_rows = len(df)
    df = df.dropna().reset_index(drop=True)
    logging.info(f"Feature engineering complete. Dataset shape: {df.shape} (Dropped {initial_rows - len(df)} boundary lag rows)")

    return df


def prepare_train_test_split(
    df: pd.DataFrame, 
    test_size: float = 0.20,
    random_state: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, list]:
    """
    Performs stratified random train-test split for model training and evaluation.

    Args:
        df (pd.DataFrame): Feature-engineered DataFrame.
        test_size (float): Proportion of dataset to hold out for testing.
        random_state (int): Seed for reproducibility.

    Returns:
        Tuple: (X_train, X_test, y_train, y_test, feature_names)
    """
    logging.info(f"Preparing Train/Test split ({int((1-test_size)*100)}% Train / {int(test_size*100)}% Test)...")

    target_col = "AQI_CPCB"
    drop_cols = ["City", "Date", "AQI_Bucket", "Date_weather", "AQI", "AQI_CPCB", "PM2.5_sub", "PM10_sub"]
    
    # One-hot encode City feature
    df_encoded = pd.get_dummies(df, columns=["City"], drop_first=False)
    feature_cols = [col for col in df_encoded.columns if col not in drop_cols]

    X = df_encoded[feature_cols]
    y = df_encoded[target_col]

    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, shuffle=True
    )

    logging.info(f"Train set: {X_train.shape[0]} samples | Test set: {X_test.shape[0]} samples | Features: {len(feature_cols)}")
    return X_train, X_test, y_train, y_test, feature_cols


def train_xgboost_model(X_train: pd.DataFrame, y_train: pd.Series) -> XGBRegressor:
    """
    Initializes and fits an optimized XGBoost Regressor model.
    """
    logging.info("Training XGBoost Regressor model...")
    xgb_model = XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        n_jobs=-1
    )
    xgb_model.fit(X_train, y_train)
    logging.info("XGBoost training completed successfully.")
    return xgb_model


def train_lightgbm_model(X_train: pd.DataFrame, y_train: pd.Series) -> LGBMRegressor:
    """
    Initializes and fits an optimized LightGBM Regressor model.
    """
    logging.info("Training LightGBM Regressor model...")
    lgb_model = LGBMRegressor(
        n_estimators=300,
        max_depth=6,
        num_leaves=31,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        n_jobs=-1,
        verbose=-1
    )
    lgb_model.fit(X_train, y_train)
    logging.info("LightGBM training completed successfully.")
    return lgb_model


def evaluate_models(
    models: Dict[str, Any],
    X_test: pd.DataFrame,
    y_test: pd.Series
) -> Dict[str, Dict[str, float]]:
    """
    Computes evaluation metrics (MAE, RMSE, R2 Score, MAPE) for each trained model.
    """
    logging.info("Evaluating models on holdout Test set...")
    metrics_summary = {}

    for name, model in models.items():
        y_pred = model.predict(X_test)
        
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)
        mape = np.mean(np.abs((y_test - y_pred) / np.clip(y_test, a_min=1.0, a_max=None))) * 100

        metrics_summary[name] = {
            "MAE": round(float(mae), 4),
            "RMSE": round(float(rmse), 4),
            "R2_Score": round(float(r2), 4),
            "MAPE_percent": round(float(mape), 2)
        }
        
        logging.info(f"[{name}] MAE: {mae:.2f} | RMSE: {rmse:.2f} | R² Score: {r2:.4f} | MAPE: {mape:.2f}%")

    return metrics_summary


def save_model_artifacts(
    models: Dict[str, Any],
    feature_names: list,
    metrics: Dict[str, Dict[str, float]],
    models_dir: str = "models"
) -> None:
    """
    Saves trained model objects, feature metadata, and evaluation results to models/.
    """
    os.makedirs(models_dir, exist_ok=True)

    # 1. Save model binaries
    for name, model in models.items():
        filepath = os.path.join(models_dir, f"{name.lower()}_aqi_model.pkl")
        joblib.dump(model, filepath)
        logging.info(f"Saved {name} model binary to '{filepath}'")

    # 2. Save feature list metadata
    feature_path = os.path.join(models_dir, "model_features.json")
    with open(feature_path, "w") as f:
        json.dump({"features": feature_names}, f, indent=4)
    logging.info(f"Saved feature list to '{feature_path}'")

    # 3. Save evaluation metrics JSON report
    metrics_path = os.path.join(models_dir, "model_evaluation_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=4)
    logging.info(f"Saved evaluation metrics report to '{metrics_path}'")


def run_model_training_pipeline(
    dataset_path: str = "datasets/processed/cleaned_dataset.csv"
) -> Dict[str, Dict[str, float]]:
    """
    Executes the end-to-end Week 3 Model Training Pipeline.
    """
    logging.info("==================================================")
    logging.info("Starting PureBreath-AI Week 3 ML Model Training")
    logging.info("==================================================")

    # 1. Load and construct features
    df = load_and_engineer_model_features(dataset_path)

    # 2. Prepare train/test splits
    X_train, X_test, y_train, y_test, feature_names = prepare_train_test_split(df)

    # 3. Train XGBoost model
    xgb_model = train_xgboost_model(X_train, y_train)

    # 4. Train LightGBM model
    lgb_model = train_lightgbm_model(X_train, y_train)

    # 5. Train Baseline Random Forest model
    logging.info("Training Random Forest baseline model...")
    rf_model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)

    trained_models = {
        "XGBoost": xgb_model,
        "LightGBM": lgb_model,
        "RandomForest": rf_model
    }

    # 6. Evaluate all models
    metrics = evaluate_models(trained_models, X_test, y_test)

    # 7. Save model artifacts
    save_model_artifacts(trained_models, feature_names, metrics)

    logging.info("==================================================")
    logging.info("Week 3 Model Training Pipeline Completed Successfully!")
    logging.info("==================================================")

    return metrics


if __name__ == "__main__":
    run_model_training_pipeline()
