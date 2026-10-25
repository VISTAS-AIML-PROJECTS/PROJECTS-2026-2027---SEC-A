import os
import joblib

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False


def build_models():
    """
    Build candidate classification models.
    """

    models = {
        "logistic_regression": LogisticRegression(
            max_iter=1000,
            random_state=42
        ),

        "random_forest": RandomForestClassifier(
            n_estimators=200,
            random_state=42,
            class_weight="balanced"
        )
    }

    if XGBOOST_AVAILABLE:

        models["xgboost"] = XGBClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            eval_metric="logloss"
        )

    return models


def prepare_target_for_xgboost(y_train):
    """
    Automatically encode a binary target for XGBoost.

    Example:
        No / Yes
        -> 0 / 1

    The mapping is learned from the dataset
    and is not hardcoded.
    """

    classes = sorted(
        y_train.dropna().unique(),
        key=lambda value: str(value)
    )

    if len(classes) != 2:
        raise ValueError(
            "XGBoost currently expects a binary target. "
            f"Found classes: {classes}"
        )

    # Convert NumPy scalar values such as np.int64
    # into normal Python values so the mapping can
    # later be safely written to JSON.
    class_0 = (
        classes[0].item()
        if hasattr(classes[0], "item")
        else classes[0]
    )

    class_1 = (
        classes[1].item()
        if hasattr(classes[1], "item")
        else classes[1]
    )

    target_mapping = {
        class_0: 0,
        class_1: 1
    }

    encoded_target = y_train.map(
        target_mapping
    )

    return encoded_target, target_mapping


def train_models(X_train, y_train):

    models = build_models()

    trained_models = {}

    target_mappings = {}

    print("\nTraining models...")

    for name, model in models.items():

        print(f"\nTraining: {name}")

        # -------------------------------------------------
        # XGBoost requires numeric binary labels.
        # Other models can use the original labels.
        # -------------------------------------------------

        if name == "xgboost":

            y_model, mapping = (
                prepare_target_for_xgboost(
                    y_train
                )
            )

            target_mappings[name] = mapping

        else:

            y_model = y_train

        model.fit(
            X_train,
            y_model
        )

        trained_models[name] = model

        print(
            f"Completed: {name}"
        )

    return trained_models, target_mappings


def save_models(
    trained_models,
    output_dir="models"
):

    os.makedirs(
        output_dir,
        exist_ok=True
    )

    for name, model in trained_models.items():

        path = os.path.join(
            output_dir,
            f"{name}.joblib"
        )

        joblib.dump(
            model,
            path
        )

        print(
            f"Saved model: {path}"
        )