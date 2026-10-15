from src.data_integration.data_loader import (
    read_dataset
)


def analyze_schemas(
    datasets
):
    """
    Profile every discovered dataset.

    Supports:
        CSV
        XLSX
        XLS
    """

    result = {}

    for name, path in datasets.items():

        df = read_dataset(
            path
        )

        columns = {}

        for column in df.columns:

            series = df[column]

            columns[column] = {

                "dtype":
                    str(series.dtype),

                "row_count":
                    int(len(series)),

                "missing_count":
                    int(
                        series.isna().sum()
                    ),

                "missing_percentage":
                    float(
                        series.isna().mean()
                        * 100
                    ),

                "unique_count":
                    int(
                        series.nunique(
                            dropna=True
                        )
                    ),

                "unique_ratio":
                    (
                        float(
                            series.nunique(
                                dropna=True
                            )
                            / len(series)
                        )
                        if len(series)
                        else 0.0
                    ),
            }

        result[name] = {

            "path":
                path,

            "rows":
                int(
                    df.shape[0]
                ),

            "columns":
                int(
                    df.shape[1]
                ),

            "column_names":
                list(
                    df.columns
                ),

            "columns_detail":
                columns,
        }

    return result