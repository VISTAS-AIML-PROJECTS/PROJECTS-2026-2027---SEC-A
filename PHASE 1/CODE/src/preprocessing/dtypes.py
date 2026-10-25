import pandas as pd
import warnings


def _extract_dtype(series_or_dtype):
    if hasattr(series_or_dtype, "dtype"):
        return series_or_dtype.dtype
    return series_or_dtype


def is_categorical_dtype(series_or_dtype):
    """
    Check whether a Series, Index, or dtype is categorical, string, object, or boolean.

    Version-safe for pandas 2.x and 3.x, correctly recognizing:
    - object
    - category (pd.CategoricalDtype)
    - pandas StringDtype (string[python], string[pyarrow], etc.)
    - bool / boolean (boolean dtypes)
    """
    dtype = _extract_dtype(series_or_dtype)

    if pd.api.types.is_object_dtype(dtype):
        return True

    if isinstance(dtype, pd.CategoricalDtype):
        return True

    if isinstance(dtype, pd.StringDtype):
        return True

    if pd.api.types.is_bool_dtype(dtype):
        return True

    try:
        if pd.api.types.is_string_dtype(dtype):
            return True
    except Exception:
        pass

    dtype_str = str(dtype).lower()
    if (
        "string" in dtype_str
        or "category" in dtype_str
        or "bool" in dtype_str
        or "object" in dtype_str
    ):
        return True

    return False


def is_numerical_dtype(series_or_dtype):
    """
    Check whether a Series, Index, or dtype is strictly numerical (not boolean).
    """
    dtype = _extract_dtype(series_or_dtype)
    return pd.api.types.is_numeric_dtype(dtype) and not pd.api.types.is_bool_dtype(dtype)


def get_categorical_columns(df, columns=None):
    """
    Extract categorical/string/boolean columns from a DataFrame or subset of columns.
    """
    if columns is None:
        return [col for col in df.columns if is_categorical_dtype(df[col])]
    return [
        col for col in columns
        if col in df.columns and is_categorical_dtype(df[col])
    ]


def get_numerical_columns(df, columns=None):
    """
    Extract numerical (non-boolean) columns from a DataFrame or subset of columns.
    """
    if columns is None:
        return [col for col in df.columns if is_numerical_dtype(df[col])]
    return [
        col for col in columns
        if col in df.columns and is_numerical_dtype(df[col])
    ]
