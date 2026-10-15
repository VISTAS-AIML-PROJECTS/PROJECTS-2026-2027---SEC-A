"""
MINE Dataset Loader

Supports:
- CSV
- XLSX
- XLS
"""

from pathlib import Path

import pandas as pd


SUPPORTED_EXTENSIONS = {
    ".csv",
    ".xlsx",
    ".xls",
}


def is_supported_dataset(path):
    """
    Return True when the file is a supported dataset.
    """

    path = Path(path)

    return (
        path.is_file()
        and path.suffix.lower()
        in SUPPORTED_EXTENSIONS
        and not path.name.startswith(".")
    )


def read_dataset(
    path,
    usecols=None,
):
    """
    Read a dataset based on its file extension.

    CSV  -> pd.read_csv
    XLSX -> pd.read_excel
    XLS  -> pd.read_excel

    Args:
        path:
            Dataset file path.

        usecols:
            Optional columns to load.

    Returns:
        pandas.DataFrame
    """

    path = Path(path)

    if not path.exists():

        raise FileNotFoundError(
            f"Dataset does not exist: {path}"
        )

    extension = path.suffix.lower()

    if extension == ".csv":

        return pd.read_csv(
            path,
            usecols=usecols,
        )

    if extension in {
        ".xlsx",
        ".xls",
    }:

        return pd.read_excel(
            path,
            usecols=usecols,
        )

    raise ValueError(
        "Unsupported dataset format: "
        f"{extension}. "
        "Supported formats are CSV, XLSX and XLS."
    )