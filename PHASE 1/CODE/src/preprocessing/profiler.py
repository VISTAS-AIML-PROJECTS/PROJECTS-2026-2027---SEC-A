import pandas as pd

from src.preprocessing.dtypes import (
    get_categorical_columns,
    get_numerical_columns
)


def profile_dataset(df):
    """
    Create a detailed dataset profile.

    This profile is descriptive only.
    It does not decide which features should be used.
    """

    profile = {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "column_names": df.columns.tolist(),
        "data_types": {},
        "missing_values": {},
        "missing_percent": {},
        "unique_values": {},
        "unique_ratio": {},
        "duplicate_rows": int(df.duplicated().sum()),
        "constant_columns": [],
        "numerical_columns": [],
        "categorical_columns": [],
        "datetime_columns": []
    }

    for column in df.columns:

        series = df[column]

        profile["data_types"][column] = str(
            series.dtype
        )

        missing_count = int(
            series.isna().sum()
        )

        profile["missing_values"][column] = (
            missing_count
        )

        profile["missing_percent"][column] = round(
            (missing_count / len(df)) * 100,
            2
        )

        profile["unique_values"][column] = int(
            series.nunique(dropna=True)
        )

        non_null_count = series.notna().sum()

        if non_null_count > 0:
            ratio = (
                series.nunique(dropna=True)
                / non_null_count
            )
        else:
            ratio = 0

        profile["unique_ratio"][column] = round(
            ratio,
            4
        )

        if series.nunique(dropna=True) <= 1:
            profile["constant_columns"].append(
                column
            )

    profile["numerical_columns"] = get_numerical_columns(df)
    profile["categorical_columns"] = get_categorical_columns(df)

    # Try to identify datetime columns.
    for column in df.columns:

        if pd.api.types.is_datetime64_any_dtype(
            df[column]
        ):
            profile["datetime_columns"].append(
                column
            )

    return profile