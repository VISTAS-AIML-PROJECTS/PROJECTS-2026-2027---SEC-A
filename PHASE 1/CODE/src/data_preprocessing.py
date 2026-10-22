"""
PureBreath-AI: Week 2 - Data Preprocessing Module

This module handles reading AQI and Weather datasets, analyzing structure,
handling missing values, deduplicating, type conversions, spatial grid mapping,
merging datasets on Date and City, cleaning, and exporting processed artifacts.

Author: PureBreath-AI Team
License: MIT
"""

import os
import logging
import pandas as pd
import numpy as np
from typing import Dict, Tuple

# Configure logging for production tracing
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)

# Geographic grid coordinate mapping for target Indian cities in ERA5/NCEP weather grid
CITY_GRID_MAPPING: Dict[str, Tuple[int, int]] = {
    "Delhi": (22, 11),
    "Mumbai": (13, 7),
    "Chennai": (7, 14),
    "Kolkata": (16, 22),
    "Bangalore": (7, 12)
}


def load_aqi_data(filepath: str) -> pd.DataFrame:
    """
    Reads the AQI city daily dataset, validates presence of required columns,
    and standardizes date formatting.

    Args:
        filepath (str): Relative path to city_day.csv

    Returns:
        pd.DataFrame: Cleaned AQI DataFrame with normalized Date column.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"AQI dataset not found at path: {filepath}")

    logging.info(f"Loading AQI dataset from '{filepath}'...")
    df_aqi = pd.read_csv(filepath)

    # Standardize column names
    df_aqi.columns = [col.strip() for col in df_aqi.columns]

    # Convert Datetime to standard YYYY-MM-DD Date string
    df_aqi["Date"] = pd.to_datetime(df_aqi["Datetime"]).dt.strftime("%Y-%m-%d")
    
    logging.info(f"Loaded {len(df_aqi)} records for cities: {df_aqi['City'].unique().tolist()}")
    return df_aqi


def load_and_aggregate_weather_data(filepath: str, city_grid_map: Dict[str, Tuple[int, int]]) -> pd.DataFrame:
    """
    Streams the raw 4GB weather dataset, filters spatial grid cells corresponding to target cities,
    converts temperatures from Kelvin to Celsius, and aggregates metrics to daily resolution.

    Args:
        filepath (str): Relative path to weather.csv
        city_grid_map (dict): Mapping of City name to (latitude_idx, longitude_idx)

    Returns:
        pd.DataFrame: Daily aggregated weather data per City and Date.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Weather dataset not found at path: {filepath}")

    logging.info(f"Processing weather dataset from '{filepath}'...")
    
    filtered_chunks = []
    chunksize = 1_000_000

    # Stream in chunks for memory safety
    for chunk_idx, chunk in enumerate(pd.read_csv(filepath, chunksize=chunksize)):
        mask = pd.Series(False, index=chunk.index)
        for (lat_idx, lon_idx) in city_grid_map.values():
            mask |= (chunk["latitude"] == lat_idx) & (chunk["longitude"] == lon_idx)
        
        sub = chunk[mask].copy()
        if not sub.empty:
            filtered_chunks.append(sub)

    df_weather = pd.concat(filtered_chunks, ignore_index=True)

    # Map latitude and longitude grid indices back to City names
    grid_to_city = {coords: name for name, coords in city_grid_map.items()}
    df_weather["City"] = df_weather.apply(
        lambda row: grid_to_city.get((int(row["latitude"]), int(row["longitude"])), "Unknown"),
        axis=1
    )

    # Parse timestamps and derive Date
    df_weather["time"] = pd.to_datetime(df_weather["time"])
    df_weather["Date"] = df_weather["time"].dt.strftime("%Y-%m-%d")

    # Temperature conversion Kelvin -> Celsius
    df_weather["TMP_2m_C"] = df_weather["TMP_2m"] - 273.15

    # Aggregate 6-hourly observations into daily summary features
    logging.info("Aggregating weather readings to daily resolution per city...")
    df_daily_weather = df_weather.groupby(["City", "Date"]).agg(
        temp_mean_c=("TMP_2m_C", "mean"),
        temp_min_c=("TMP_2m_C", "min"),
        temp_max_c=("TMP_2m_C", "max"),
        precipitation_mm=("APCP_sfc", "sum"),
        pressure_hgt=("HGT_prl", "mean")
    ).reset_index()

    logging.info(f"Aggregated daily weather contains {len(df_daily_weather)} records.")
    return df_daily_weather


def handle_missing_values(df: pd.DataFrame) -> pd.DataFrame:
    """
    Imputes missing values using time-series forward/backward fill per city.

    Args:
        df (pd.DataFrame): Raw or merged DataFrame.

    Returns:
        pd.DataFrame: Imputed DataFrame with zero null values.
    """
    logging.info("Handling missing values using time-series linear interpolation & forward/backfill...")
    df = df.copy()

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # Sort by City and Date before time-series fill
    df = df.sort_values(by=["City", "Date"]).reset_index(drop=True)

    for city in df["City"].unique():
        city_mask = df["City"] == city
        # Interpolate numeric features along time dimension
        df.loc[city_mask, numeric_cols] = df.loc[city_mask, numeric_cols].interpolate(method="linear")
        df.loc[city_mask, numeric_cols] = df.loc[city_mask, numeric_cols].bfill().ffill()

    # Fallback for remaining missing categorical values
    if "AQI_Bucket" in df.columns:
        df["AQI_Bucket"] = df["AQI_Bucket"].fillna("Moderate")

    missing_remaining = df.isnull().sum().sum()
    logging.info(f"Missing values handling complete. Remaining nulls: {missing_remaining}")
    return df


def remove_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detects and removes duplicate records based on unique City and Date key.

    Args:
        df (pd.DataFrame): Input DataFrame.

    Returns:
        pd.DataFrame: Deduplicated DataFrame.
    """
    initial_count = len(df)
    df_dedup = df.drop_duplicates(subset=["City", "Date"]).reset_index(drop=True)
    duplicates_removed = initial_count - len(df_dedup)
    logging.info(f"Deduplication complete. Removed {duplicates_removed} duplicate records.")
    return df_dedup


def convert_datatypes(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensures optimal, explicit data types for downstream machine learning pipelines.

    Args:
        df (pd.DataFrame): Input DataFrame.

    Returns:
        pd.DataFrame: DataFrame with standardized numeric, date, and categorical types.
    """
    logging.info("Converting data types to strict production standards...")
    df = df.copy()

    # Convert Date column to datetime format
    df["Date"] = pd.to_datetime(df["Date"])

    # Explicit numeric cast for floating point metrics
    float_columns = [
        "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3", "CO", "SO2", "O3",
        "Benzene", "Toluene", "Xylene", "AQI", "temp_mean_c", "temp_min_c",
        "temp_max_c", "precipitation_mm", "pressure_hgt"
    ]
    for col in float_columns:
        if col in df.columns:
            df[col] = df[col].astype(np.float64)

    # Categorical conversions
    df["City"] = df["City"].astype("category")
    if "AQI_Bucket" in df.columns:
        df["AQI_Bucket"] = df["AQI_Bucket"].astype("category")

    return df


def merge_datasets(aqi_df: pd.DataFrame, weather_df: pd.DataFrame) -> pd.DataFrame:
    """
    Merges AQI and daily weather datasets on matching Date and City.

    Args:
        aqi_df (pd.DataFrame): Processed AQI DataFrame.
        weather_df (pd.DataFrame): Daily aggregated weather DataFrame.

    Returns:
        pd.DataFrame: Inner-joined merged dataset.
    """
    logging.info("Merging AQI and Weather datasets on ['City', 'Date']...")
    
    # Ensure Date format matches string representation for seamless join
    aqi_df["Date_str"] = pd.to_datetime(aqi_df["Date"]).dt.strftime("%Y-%m-%d")
    weather_df["Date_str"] = pd.to_datetime(weather_df["Date"]).dt.strftime("%Y-%m-%d")

    merged_df = pd.merge(
        aqi_df,
        weather_df,
        left_on=["City", "Date_str"],
        right_on=["City", "Date_str"],
        how="inner",
        suffixes=("", "_weather")
    )

    # Clean up auxiliary columns
    if "Date_str" in merged_df.columns:
        merged_df = merged_df.drop(columns=["Date_str"])
    if "Datetime" in merged_df.columns:
        merged_df = merged_df.drop(columns=["Datetime"])

    logging.info(f"Successfully merged datasets. Merged shape: {merged_df.shape}")
    return merged_df


def clean_merged_dataset(merged_df: pd.DataFrame) -> pd.DataFrame:
    """
    Applies domain sanity checks, removes unreasonable physical outliers (e.g. negative pollutant concentrations),
    and formats columns cleanly.

    Args:
        merged_df (pd.DataFrame): Raw merged DataFrame.

    Returns:
        pd.DataFrame: Thoroughly cleaned production dataset.
    """
    logging.info("Performing final sanity checks & cleaning on merged dataset...")
    df_clean = merged_df.copy()

    # Clip physical pollutant values to non-negative range
    pollutant_cols = ["PM2.5", "PM10", "NO", "NO2", "NOx", "NH3", "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene"]
    for col in pollutant_cols:
        if col in df_clean.columns:
            df_clean[col] = df_clean[col].clip(lower=0.0)

    # Clip precipitation to non-negative
    if "precipitation_mm" in df_clean.columns:
        df_clean["precipitation_mm"] = df_clean["precipitation_mm"].clip(lower=0.0)

    # Round floating metrics to 2 decimal places for cleaner reporting
    numeric_cols = df_clean.select_dtypes(include=[np.float64]).columns
    df_clean[numeric_cols] = df_clean[numeric_cols].round(2)

    # Sort deterministically
    df_clean = df_clean.sort_values(by=["City", "Date"]).reset_index(drop=True)
    return df_clean


def save_dataset(df: pd.DataFrame, output_path: str) -> None:
    """
    Saves DataFrame to CSV format after confirming target directory exists.

    Args:
        df (pd.DataFrame): DataFrame to save.
        output_path (str): Output relative file path.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    logging.info(f"Saved dataset successfully to: '{output_path}' (Shape: {df.shape})")


def run_preprocessing_pipeline(
    aqi_path: str = "datasets/air_quality/city_day.csv",
    weather_path: str = "datasets/weather/weather.csv",
    merged_output_path: str = "datasets/processed/merged_dataset.csv",
    cleaned_output_path: str = "datasets/processed/cleaned_dataset.csv"
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Executes the complete end-to-end Week 2 Data Preprocessing Pipeline.

    Returns:
        Tuple[pd.DataFrame, pd.DataFrame]: (merged_df, cleaned_df)
    """
    logging.info("==================================================")
    logging.info("Starting PureBreath-AI Week 2 Preprocessing Pipeline")
    logging.info("==================================================")

    # Step 1 & 3: Load & Analyze AQI Data
    aqi_df = load_aqi_data(aqi_path)

    # Step 2 & 3: Load, Spatial Filter & Aggregate Weather Data
    weather_df = load_and_aggregate_weather_data(weather_path, CITY_GRID_MAPPING)

    # Step 4: Handle Missing Values
    aqi_df = handle_missing_values(aqi_df)
    weather_df = handle_missing_values(weather_df)

    # Step 5: Remove Duplicates
    aqi_df = remove_duplicates(aqi_df)
    weather_df = remove_duplicates(weather_df)

    # Step 6: Convert Data Types
    aqi_df = convert_datatypes(aqi_df)
    weather_df = convert_datatypes(weather_df)

    # Step 7 & 8: Merge Datasets & Save merged_dataset.csv
    merged_df = merge_datasets(aqi_df, weather_df)
    save_dataset(merged_df, merged_output_path)

    # Step 9 & 10: Clean Merged Dataset & Save cleaned_dataset.csv
    cleaned_df = clean_merged_dataset(merged_df)
    save_dataset(cleaned_df, cleaned_output_path)

    logging.info("==================================================")
    logging.info("Week 2 Data Preprocessing Completed Successfully!")
    logging.info("==================================================")
    return merged_df, cleaned_df


if __name__ == "__main__":
    run_preprocessing_pipeline()
