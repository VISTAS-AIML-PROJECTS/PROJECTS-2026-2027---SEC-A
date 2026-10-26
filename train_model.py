from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

BASE = Path(__file__).resolve().parent
DATA_PATH = BASE / "data" / "loan_data.csv"
MODEL_PATH = BASE / "models" / "fbce_model.pkl"
RESULT_PATH = BASE / "models" / "model_results.csv"

# Works with the common Kaggle Loan Approval Prediction dataset.
TARGET_CANDIDATES = ["Loan_Status", "loan_status", "LoanStatus", "target"]

def load_data():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_PATH}\n"
            "Download a public loan approval dataset and save it as data/loan_data.csv"
        )

    df = pd.read_csv(DATA_PATH)

    target = next((c for c in TARGET_CANDIDATES if c in df.columns), None)
    if target is None:
        raise ValueError(
            "Target column not found. Expected one of: "
            + ", ".join(TARGET_CANDIDATES)
        )

    # Convert common Y/N target to 1/0.
    y = df[target].astype(str).str.strip().str.upper().map({
        "Y": 1, "YES": 1, "APPROVED": 1, "1": 1,
        "N": 0, "NO": 0, "REJECTED": 0, "0": 0
    })

    valid = y.notna()
    df = df.loc[valid].copy()
    y = y.loc[valid].astype(int)

    # Loan_ID is an identifier, not a useful predictive feature.
    drop_cols = [target]
    if "Loan_ID" in df.columns:
        drop_cols.append("Loan_ID")

    X = df.drop(columns=drop_cols)

    # Remove accidental empty columns.
    X = X.loc[:, ~X.columns.astype(str).str.startswith("Unnamed")]

    return X, y

def build_preprocessor(X):
    categorical = X.select_dtypes(include=["object", "category", "bool"]).columns.tolist()
    numerical = [c for c in X.columns if c not in categorical]

    num_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])

    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    preprocessor = ColumnTransformer([
        ("num", num_pipe, numerical),
        ("cat", cat_pipe, categorical)
    ], remainder="drop")

    return preprocessor

def build_models():
    return {
        "Logistic Regression": LogisticRegression(max_iter=2000, class_weight="balanced"),
        "Random Forest": RandomForestClassifier(
            n_estimators=300,
            random_state=42,
            class_weight="balanced",
            min_samples_leaf=2
        ),
        "XGBoost": XGBClassifier(
            n_estimators=250,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            random_state=42
        ),
        "LightGBM": LGBMClassifier(
            n_estimators=250,
            learning_rate=0.05,
            num_leaves=31,
            random_state=42,
            verbosity=-1
        )
    }

def main():
    X, y = load_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=42,
        stratify=y
    )

    results = []
    trained = {}

    for name, model in build_models().items():
        preprocessor = build_preprocessor(X_train)

        pipe = Pipeline([
            ("preprocessor", preprocessor),
            ("model", model)
        ])

        pipe.fit(X_train, y_train)

        pred = pipe.predict(X_test)
        if hasattr(pipe, "predict_proba"):
            prob = pipe.predict_proba(X_test)[:, 1]
        else:
            prob = None

        row = {
            "Model": name,
            "Accuracy": accuracy_score(y_test, pred),
            "Precision": precision_score(y_test, pred, zero_division=0),
            "Recall": recall_score(y_test, pred, zero_division=0),
            "F1": f1_score(y_test, pred, zero_division=0),
        }

        if prob is not None and len(np.unique(y_test)) == 2:
            row["ROC_AUC"] = roc_auc_score(y_test, prob)
        else:
            row["ROC_AUC"] = np.nan

        results.append(row)
        trained[name] = pipe

    results_df = pd.DataFrame(results).sort_values(
        ["F1", "Accuracy"], ascending=False
    )

    best_name = results_df.iloc[0]["Model"]
    best_model = trained[best_name]

    MODEL_PATH.parent.mkdir(exist_ok=True)
    joblib.dump(
        {
            "model": best_model,
            "model_name": best_name,
            "feature_columns": X.columns.tolist()
        },
        MODEL_PATH
    )

    results_df.to_csv(RESULT_PATH, index=False)

    print("\nMODEL COMPARISON")
    print(results_df.to_string(index=False))
    print(f"\nBest model: {best_name}")
    print(f"Saved model: {MODEL_PATH}")

if __name__ == "__main__":
    main()
