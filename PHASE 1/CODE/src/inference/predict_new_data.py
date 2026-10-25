import sys
from pathlib import Path

import joblib
import pandas as pd


# ============================================================
# MINE - NEW DATA INFERENCE
# ============================================================

MODEL_PATH = Path("models/xgboost.joblib")
PREPROCESSOR_PATH = Path("models/preprocessor.joblib")
METADATA_PATH = Path(
    "data/metadata/preprocessing_metadata.json"
)


def load_artifacts():
    """Load the existing trained model and fitted preprocessor."""

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    if not PREPROCESSOR_PATH.exists():
        raise FileNotFoundError(
            f"Preprocessor not found: {PREPROCESSOR_PATH}"
        )

    if not METADATA_PATH.exists():
        raise FileNotFoundError(
            f"Metadata not found: {METADATA_PATH}"
        )

    model = joblib.load(MODEL_PATH)

    preprocessor = joblib.load(
        PREPROCESSOR_PATH
    )

    return model, preprocessor


def predict_csv(input_file):
    """
    Predict churn for a new CSV using the
    EXISTING MINE model.

    The model is NOT retrained.
    """

    input_path = Path(input_file)

    if not input_path.exists():
        raise FileNotFoundError(
            f"Input CSV not found: {input_file}"
        )

    df = pd.read_csv(
        input_path
    )

    if df.empty:
        raise ValueError(
            "The uploaded CSV is empty."
        )

    print()
    print("=" * 70)
    print("MINE - NEW DATA PREDICTION")
    print("=" * 70)

    print(
        f"Input file: {input_file}"
    )

    print(
        f"Rows: {len(df)}"
    )

    print(
        f"Columns: {len(df.columns)}"
    )

    # --------------------------------------------------------
    # Load existing ML brain
    # --------------------------------------------------------

    model = joblib.load(
        MODEL_PATH
    )

    preprocessor = joblib.load(
        PREPROCESSOR_PATH
    )

    # --------------------------------------------------------
    # Load feature list used during training
    # --------------------------------------------------------

    import json

    with open(
        METADATA_PATH,
        "r",
        encoding="utf-8",
    ) as file:

        metadata = json.load(file)

    selected_features = metadata[
        "selected_features"
    ]

    target_column = metadata[
        "target"
    ][
        "column"
    ]

    # --------------------------------------------------------
    # Check required features
    # --------------------------------------------------------

    missing_features = [
        feature
        for feature in selected_features
        if feature not in df.columns
    ]

    if missing_features:

        raise ValueError(
            "The uploaded dataset is missing "
            "features required by the current model.\n"
            f"Missing features: {missing_features}"
        )

    # --------------------------------------------------------
    # Target is NOT required for prediction
    # --------------------------------------------------------

    X_new = df[
        selected_features
    ].copy()

    # --------------------------------------------------------
    # Transform using SAME fitted preprocessor
    # --------------------------------------------------------

    X_transformed = (
        preprocessor.transform(
            X_new
        )
    )

    print(
        f"Transformed features: "
        f"{X_transformed.shape}"
    )

    # --------------------------------------------------------
    # Existing XGBoost prediction
    # --------------------------------------------------------

    predictions = model.predict(
        X_transformed
    )

    probabilities = model.predict_proba(
        X_transformed
    )[:, 1]

    # --------------------------------------------------------
    # Create result
    # --------------------------------------------------------

    result = df.copy()

    result[
        "MINE_Prediction"
    ] = predictions

    result[
        "MINE_Churn_Probability"
    ] = probabilities

    result[
        "MINE_Churn_Percentage"
    ] = (
        probabilities * 100
    ).round(2)

    # --------------------------------------------------------
    # Display results
    # --------------------------------------------------------

    print()
    print("Predictions:")
    print()

    for index, row in result.iterrows():

        print(
            f"Row {index}: "
            f"Prediction={row['MINE_Prediction']} | "
            f"Churn Probability="
            f"{row['MINE_Churn_Percentage']}%"
        )

    print()
    print("=" * 70)

    return result


# ============================================================
# DIRECT EXECUTION
# ============================================================

if __name__ == "__main__":

    if len(sys.argv) != 2:

        print(
            "Usage:"
        )

        print(
            "py -m src.inference.predict_new_data "
            "path_to_csv"
        )

        sys.exit(1)

    input_file = sys.argv[1]

    predict_csv(
        input_file
    )