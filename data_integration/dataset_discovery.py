from pathlib import Path

from src.errors import pipeline_error


SUPPORTED_DATASET_EXTENSIONS = {
    ".csv",
    ".xlsx",
    ".xls",
}


def discover_datasets(
    input_dir
):
    """
    Discover CSV and Excel datasets recursively.

    Returns:

        {
            dataset_name: file_path
        }
    """

    directory = Path(
        input_dir
    )

    if not directory.exists():

        pipeline_error(
            "Input directory does not exist.",
            f"Directory: {input_dir}",
            "Provide a valid directory containing "
            "CSV/XLSX/XLS files.",
        )

    if not directory.is_dir():

        pipeline_error(
            "Input path is not a directory.",
            f"Path: {input_dir}",
            "Use --input-dir with a directory.",
        )

    # --------------------------------------------------
    # RECURSIVE DATASET DISCOVERY
    # --------------------------------------------------

    dataset_files = sorted(
        path
        for path in directory.rglob("*")
        if (
            path.is_file()
            and path.suffix.lower()
            in SUPPORTED_DATASET_EXTENSIONS
            and not path.name.startswith(".")
        )
    )

    if not dataset_files:

        pipeline_error(
            "No supported datasets were found.",
            f"Directory: {input_dir}",
            (
                "Place one or more CSV, XLSX or XLS "
                "files in the directory."
            ),
        )

    datasets = {}

    for path in dataset_files:

        dataset_name = path.stem

        if dataset_name in datasets:

            pipeline_error(
                "Duplicate dataset name detected.",
                (
                    f"Dataset name: "
                    f"{dataset_name}"
                ),
                (
                    "Two dataset files have the same "
                    "filename. Rename one of them."
                ),
            )

        datasets[
            dataset_name
        ] = str(
            path.resolve()
        )

    print(
        f"\n[DISCOVERY] Found "
        f"{len(datasets)} dataset(s):"
    )

    for name, path in datasets.items():

        suffix = Path(
            path
        ).suffix.lower()

        print(
            f"  - {name} "
            f"[{suffix.upper().replace('.', '')}]: "
            f"{path}"
        )

    return datasets