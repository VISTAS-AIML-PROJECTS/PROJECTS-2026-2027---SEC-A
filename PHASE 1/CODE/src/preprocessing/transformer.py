import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import (
    OneHotEncoder,
    StandardScaler
)
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from src.preprocessing.dtypes import (
    get_categorical_columns,
    get_numerical_columns
)


def build_preprocessor(
    df,
    feature_columns
):
    """
    Build preprocessing pipeline.

    Sparse one-hot encoding is used so high-cardinality
    categorical features do not immediately create a
    massive dense matrix.
    """

    X = df[
        feature_columns
    ]

    numerical_columns = (
        get_numerical_columns(X)
    )

    categorical_columns = (
        get_categorical_columns(X)
    )

    numerical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median"
                )
            ),
            (
                "scaler",
                StandardScaler()
            )
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent"
                )
            ),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=True
                )
            )
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numerical",
                numerical_pipeline,
                numerical_columns
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_columns
            )
        ],
        remainder="drop",
        sparse_threshold=1.0
    )

    return (
        preprocessor,
        numerical_columns,
        categorical_columns
    )