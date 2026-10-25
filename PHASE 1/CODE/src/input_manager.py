"""
MINE - Input Management

Responsibilities
----------------
1. Accept a single CSV/XLSX/XLS dataset.
2. Accept a directory containing multiple datasets.
3. Accept a ZIP containing multiple related datasets.
4. Support Windows / OneDrive paths.
5. Safely extract ZIP files.
6. Avoid reusing/deleting locked extraction directories.
7. Automatically locate the actual dataset directory inside a ZIP.
8. Keep the interface expected by main.py:
       prepare_input(...)
"""

from __future__ import annotations

import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Dict, List, Optional


# ============================================================
# SUPPORTED FILE TYPES
# ============================================================

SUPPORTED_DATASET_EXTENSIONS = {
    ".csv",
    ".xlsx",
    ".xls",
}


# ============================================================
# GENERAL PATH UTILITIES
# ============================================================

def normalize_path(path) -> Path:
    """
    Convert an input path into an absolute Path.

    Handles:
        - strings
        - pathlib.Path
        - Windows paths
        - relative paths
    """
    if path is None:
        raise ValueError("Path cannot be None.")

    return Path(path).expanduser().resolve()


def is_supported_dataset(path) -> bool:
    """
    Return True if the path is a supported dataset file.
    """
    path = Path(path)

    return (
        path.is_file()
        and path.suffix.lower()
        in SUPPORTED_DATASET_EXTENSIONS
    )


# ============================================================
# DATASET DISCOVERY
# ============================================================

def discover_datasets(input_dir) -> List[Path]:
    """
    Recursively discover supported dataset files.

    Supported:
        .csv
        .xlsx
        .xls
    """

    input_dir = normalize_path(input_dir)

    if not input_dir.exists():
        raise FileNotFoundError(
            f"Input directory does not exist: {input_dir}"
        )

    if not input_dir.is_dir():
        raise NotADirectoryError(
            f"Input path is not a directory: {input_dir}"
        )

    datasets = []

    for path in input_dir.rglob("*"):
        if not path.is_file():
            continue

        if path.name.startswith("~$"):
            # Temporary Excel lock file.
            continue

        if path.suffix.lower() in SUPPORTED_DATASET_EXTENSIONS:
            datasets.append(path)

    # Remove duplicates while preserving deterministic ordering.
    datasets = sorted(
        set(datasets),
        key=lambda p: str(p).lower()
    )

    return datasets


# ============================================================
# DATASET ROOT DISCOVERY
# ============================================================

def find_dataset_root(extraction_dir) -> Path:
    """
    Find the directory that contains the extracted datasets.

    ZIP structures can look like:

        archive.zip
            file1.xlsx
            file2.xlsx

    or:

        archive.zip
            company_data/
                file1.xlsx
                file2.xlsx

    or:

        archive.zip
            some_folder/
                nested_folder/
                    file1.xlsx

    This function finds the directory containing the most
    supported dataset files.
    """

    extraction_dir = normalize_path(extraction_dir)

    if not extraction_dir.exists():
        raise FileNotFoundError(
            f"Extraction directory does not exist: "
            f"{extraction_dir}"
        )

    if not extraction_dir.is_dir():
        raise NotADirectoryError(
            f"Extraction path is not a directory: "
            f"{extraction_dir}"
        )

    # --------------------------------------------------------
    # Case 1: datasets directly inside extraction directory
    # --------------------------------------------------------

    direct_files = [
        p
        for p in extraction_dir.iterdir()
        if p.is_file()
        and p.suffix.lower()
        in SUPPORTED_DATASET_EXTENSIONS
        and not p.name.startswith("~$")
    ]

    if direct_files:
        return extraction_dir

    # --------------------------------------------------------
    # Case 2: find directory with most dataset files
    # --------------------------------------------------------

    candidate_dirs = {}

    for dataset in extraction_dir.rglob("*"):
        if not dataset.is_file():
            continue

        if dataset.name.startswith("~$"):
            continue

        if dataset.suffix.lower() not in SUPPORTED_DATASET_EXTENSIONS:
            continue

        parent = dataset.parent

        candidate_dirs.setdefault(
            parent,
            []
        ).append(dataset)

    if not candidate_dirs:
        raise FileNotFoundError(
            "No supported dataset files were found inside "
            f"the extracted ZIP: {extraction_dir}\n"
            f"Supported extensions: "
            f"{', '.join(sorted(SUPPORTED_DATASET_EXTENSIONS))}"
        )

    # Choose directory containing the largest number of datasets.
    best_dir = max(
        candidate_dirs,
        key=lambda p: (
            len(candidate_dirs[p]),
            -len(p.parts)
        )
    )

    return best_dir


# ============================================================
# ZIP SECURITY
# ============================================================

def is_safe_zip_member(member_name: str) -> bool:
    """
    Prevent ZIP path traversal.

    Rejects entries such as:

        ../../evil.txt
        ..\\evil.txt
        C:\\Windows\\...
        /etc/passwd
    """

    if not member_name:
        return False

    # Normalize both slash styles.
    normalized = member_name.replace("\\", "/")

    # Absolute POSIX path.
    if normalized.startswith("/"):
        return False

    # Windows drive path.
    if len(normalized) >= 2:
        if normalized[1] == ":":
            return False

    # Path traversal.
    parts = normalized.split("/")

    if ".." in parts:
        return False

    return True


# ============================================================
# SAFE ZIP EXTRACTION
# ============================================================

def extract_zip(
    zip_path,
    extraction_root
) -> Path:
    """
    Safely extract a ZIP archive.

    Important:
    Extraction is performed manually instead of relying on
    archive.extractall(). This gives us explicit path control
    and works more reliably on Windows.
    """

    zip_path = normalize_path(zip_path)
    extraction_root = normalize_path(extraction_root)

    # --------------------------------------------------------
    # Validate ZIP
    # --------------------------------------------------------

    if not zip_path.exists():
        raise FileNotFoundError(
            f"ZIP file does not exist: {zip_path}"
        )

    if not zip_path.is_file():
        raise FileNotFoundError(
            f"ZIP path is not a file: {zip_path}"
        )

    if not zipfile.is_zipfile(zip_path):
        raise ValueError(
            f"Invalid ZIP archive: {zip_path}"
        )

    # --------------------------------------------------------
    # Create extraction directory
    # --------------------------------------------------------

    extraction_root.mkdir(
        parents=True,
        exist_ok=True
    )

    extraction_root = extraction_root.resolve()

    # --------------------------------------------------------
    # Read ZIP
    # --------------------------------------------------------

    with zipfile.ZipFile(
        zip_path,
        "r"
    ) as archive:

        members = archive.infolist()

        if not members:
            raise ValueError(
                f"ZIP archive is empty: {zip_path}"
            )

        for member in members:

            member_name = member.filename

            # ----------------------------------------------
            # Security validation
            # ----------------------------------------------

            if not is_safe_zip_member(member_name):
                raise ValueError(
                    "Unsafe ZIP entry detected: "
                    f"{member_name}"
                )

            # Ignore empty names.
            if not member_name:
                continue

            # ----------------------------------------------
            # Build destination
            # ----------------------------------------------

            destination = (
                extraction_root
                / Path(
                    member_name.replace(
                        "\\",
                        "/"
                    )
                )
            ).resolve()

            # ----------------------------------------------
            # Final traversal check
            # ----------------------------------------------

            try:
                destination.relative_to(
                    extraction_root
                )
            except ValueError:
                raise ValueError(
                    "ZIP entry escapes extraction directory: "
                    f"{member_name}"
                )

            # ----------------------------------------------
            # Directory
            # ----------------------------------------------

            if member.is_dir():
                destination.mkdir(
                    parents=True,
                    exist_ok=True
                )
                continue

            # ----------------------------------------------
            # File
            # ----------------------------------------------

            destination.parent.mkdir(
                parents=True,
                exist_ok=True
            )

            with archive.open(
                member,
                "r"
            ) as source:

                with open(
                    destination,
                    "wb"
                ) as target:

                    shutil.copyfileobj(
                        source,
                        target,
                        length=1024 * 1024
                    )

    return extraction_root


# ============================================================
# SINGLE FILE INPUT
# ============================================================

def prepare_single_file(input_file) -> Dict:
    """
    Prepare a single dataset file.
    """

    input_file = normalize_path(input_file)

    if not input_file.exists():
        raise FileNotFoundError(
            f"Input dataset does not exist: {input_file}"
        )

    if not input_file.is_file():
        raise FileNotFoundError(
            f"Input dataset is not a file: {input_file}"
        )

    if input_file.suffix.lower() not in (
        SUPPORTED_DATASET_EXTENSIONS
    ):
        raise ValueError(
            f"Unsupported dataset format: "
            f"{input_file.suffix}\n"
            f"Supported formats: "
            f"{', '.join(sorted(SUPPORTED_DATASET_EXTENSIONS))}"
        )

    return {
        "mode": "file",
        "path": input_file,
        "datasets": [input_file],
    }


# ============================================================
# DIRECTORY INPUT
# ============================================================

def prepare_directory_input(input_dir) -> Path:
    """
    Validate a directory containing datasets.
    """

    input_dir = normalize_path(input_dir)

    if not input_dir.exists():
        raise FileNotFoundError(
            f"Input directory does not exist: {input_dir}"
        )

    if not input_dir.is_dir():
        raise NotADirectoryError(
            f"Input path is not a directory: {input_dir}"
        )

    datasets = discover_datasets(input_dir)

    if not datasets:
        raise FileNotFoundError(
            "No supported datasets found in directory:\n"
            f"{input_dir}\n\n"
            "Supported formats:\n"
            "  CSV\n"
            "  XLSX\n"
            "  XLS"
        )

    print(
        f"\n[INPUT] Discovered {len(datasets)} dataset(s):"
    )

    for dataset in datasets:
        print(
            f"  - {dataset.name}"
        )

    return input_dir


# ============================================================
# ZIP INPUT
# ============================================================

def prepare_zip_input(input_zip) -> Path:
    """
    Prepare a ZIP containing one or more datasets.

    IMPORTANT FIX
    --------------
    Do NOT use:

        data/input/_uploaded_zip

    because the project is inside OneDrive and Windows may lock
    that directory.

    Instead, use a unique OS temporary directory.

    Example:

        C:\\Users\\...\\AppData\\Local\\Temp\\
            mine_uploaded_zip_xxxxx\\
                extracted\\
                    dataset1.xlsx
                    dataset2.xlsx
    """

    input_zip = normalize_path(input_zip)

    # --------------------------------------------------------
    # Validate input ZIP
    # --------------------------------------------------------

    if not input_zip.exists():
        raise FileNotFoundError(
            f"ZIP file does not exist: {input_zip}"
        )

    if not input_zip.is_file():
        raise FileNotFoundError(
            f"ZIP path is not a file: {input_zip}"
        )

    if not zipfile.is_zipfile(input_zip):
        raise ValueError(
            f"Invalid ZIP archive: {input_zip}"
        )

    # --------------------------------------------------------
    # Create unique TEMP directory.
    #
    # This is the key Windows/OneDrive fix.
    # --------------------------------------------------------

    work_dir = Path(
        tempfile.mkdtemp(
            prefix="mine_uploaded_zip_"
        )
    )

    extraction_dir = (
        work_dir / "extracted"
    )

    extraction_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    print(
        "\n[INPUT] ZIP extraction directory:"
    )

    print(
        f"  {extraction_dir}"
    )

    # --------------------------------------------------------
    # Extract
    # --------------------------------------------------------

    try:

        extracted = extract_zip(
            input_zip,
            extraction_dir
        )

    except Exception:

        # Best-effort cleanup.
        try:
            shutil.rmtree(
                work_dir,
                ignore_errors=True
            )
        except Exception:
            pass

        raise

    # --------------------------------------------------------
    # Locate datasets
    # --------------------------------------------------------

    dataset_root = find_dataset_root(
        extracted
    )

    datasets = discover_datasets(
        dataset_root
    )

    if not datasets:
        raise FileNotFoundError(
            "ZIP was extracted successfully, but no "
            "supported datasets were found.\n"
            f"Extraction directory: {extracted}\n"
            "Supported formats: CSV, XLSX, XLS"
        )

    # --------------------------------------------------------
    # Print discovered files
    # --------------------------------------------------------

    print(
        f"\n[INPUT] Discovered {len(datasets)} "
        "dataset(s) inside ZIP:"
    )

    for dataset in datasets:
        print(
            f"  - {dataset.name}"
        )

    print(
        f"\n[INPUT] Dataset root:"
    )

    print(
        f"  {dataset_root}"
    )

    # --------------------------------------------------------
    # IMPORTANT
    #
    # We intentionally DO NOT delete work_dir here.
    #
    # The rest of the pipeline still needs to read these files.
    # --------------------------------------------------------

    return dataset_root


# ============================================================
# OPTIONAL INTERACTIVE UPLOAD
# ============================================================

def interactive_upload():
    """
    Interactive ZIP upload helper.

    Designed primarily for environments such as Google Colab.

    On normal Windows execution, users should preferably use:

        --input
        --input-dir
        --input-zip
    """

    try:
        from google.colab import files
    except ImportError:

        raise RuntimeError(
            "Interactive upload is only available in "
            "Google Colab.\n"
            "On Windows, use --input, --input-dir, "
            "or --input-zip."
        )

    uploaded = files.upload()

    if not uploaded:
        raise RuntimeError(
            "No file was uploaded."
        )

    # Take the first uploaded file.
    filename = next(
        iter(uploaded.keys())
    )

    uploaded_path = Path(filename).resolve()

    if not uploaded_path.exists():
        raise FileNotFoundError(
            f"Uploaded file could not be found: "
            f"{uploaded_path}"
        )

    return uploaded_path


# ============================================================
# MAIN INPUT ROUTER
# ============================================================

def prepare_input(
    input_file=None,
    input_dir=None,
    input_zip=None,
    interactive=False
) -> Dict:
    """
    Central input router used by main.py.

    Exactly one input method should be supplied.

    Returns:

        {
            "mode": "...",
            "path": Path(...),
            "datasets": [...]
        }

    Modes:

        file
        directory
        zip
        zip_upload
    """

    supplied = []

    if input_file is not None:
        supplied.append(
            ("file", input_file)
        )

    if input_dir is not None:
        supplied.append(
            ("directory", input_dir)
        )

    if input_zip is not None:
        supplied.append(
            ("zip", input_zip)
        )

    if interactive:
        supplied.append(
            ("upload", True)
        )

    # --------------------------------------------------------
    # No input
    # --------------------------------------------------------

    if len(supplied) == 0:

        raise ValueError(
            "No input dataset was provided.\n\n"
            "Use one of:\n"
            "  --input <file>\n"
            "  --input-dir <directory>\n"
            "  --input-zip <archive.zip>\n"
            "  --upload"
        )

    # --------------------------------------------------------
    # Multiple inputs
    # --------------------------------------------------------

    if len(supplied) > 1:

        names = [
            item[0]
            for item in supplied
        ]

        raise ValueError(
            "Multiple input methods were supplied: "
            f"{', '.join(names)}\n"
            "Please provide only one."
        )

    mode, value = supplied[0]

    # --------------------------------------------------------
    # Single file
    # --------------------------------------------------------

    if mode == "file":

        return prepare_single_file(
            value
        )

    # --------------------------------------------------------
    # Directory
    # --------------------------------------------------------

    if mode == "directory":

        directory = prepare_directory_input(
            value
        )

        datasets = discover_datasets(
            directory
        )

        return {
            "mode": "directory",
            "path": directory,
            "datasets": datasets,
        }

    # --------------------------------------------------------
    # ZIP
    # --------------------------------------------------------

    if mode == "zip":

        dataset_root = prepare_zip_input(
            value
        )

        datasets = discover_datasets(
            dataset_root
        )

        return {
            "mode": "zip",
            "path": dataset_root,
            "datasets": datasets,
        }

    # --------------------------------------------------------
    # Interactive upload
    # --------------------------------------------------------

    if mode == "upload":

        uploaded_path = interactive_upload()

        # Uploaded ZIP
        if uploaded_path.suffix.lower() == ".zip":

            dataset_root = prepare_zip_input(
                uploaded_path
            )

            datasets = discover_datasets(
                dataset_root
            )

            return {
                "mode": "zip_upload",
                "path": dataset_root,
                "datasets": datasets,
            }

        # Uploaded dataset
        if uploaded_path.suffix.lower() in (
            SUPPORTED_DATASET_EXTENSIONS
        ):

            return {
                "mode": "zip_upload",
                "path": uploaded_path,
                "datasets": [
                    uploaded_path
                ],
            }

        raise ValueError(
            f"Unsupported uploaded file: "
            f"{uploaded_path.name}"
        )

    # --------------------------------------------------------
    # Defensive fallback
    # --------------------------------------------------------

    raise RuntimeError(
        f"Unknown input mode: {mode}"
    )


# ============================================================
# COMMAND-LINE SELF TEST
# ============================================================

if __name__ == "__main__":

    import argparse

    parser = argparse.ArgumentParser(
        description="MINE input manager test"
    )

    parser.add_argument(
        "--input",
        default=None
    )

    parser.add_argument(
        "--input-dir",
        default=None
    )

    parser.add_argument(
        "--input-zip",
        default=None
    )

    args = parser.parse_args()

    result = prepare_input(
        input_file=args.input,
        input_dir=args.input_dir,
        input_zip=args.input_zip
    )

    print(
        "\nInput preparation successful."
    )

    print(
        f"Mode: {result['mode']}"
    )

    print(
        f"Path: {result['path']}"
    )

    print(
        "\nDatasets:"
    )

    for dataset in result["datasets"]:
        print(
            f"  {dataset}"
        )