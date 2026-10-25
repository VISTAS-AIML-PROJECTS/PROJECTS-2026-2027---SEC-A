import os

import pandas as pd

from sklearn.model_selection import (
    StratifiedKFold,
    cross_val_score
)


def _cv_jobs_for_model(name):
    """
    Prevent excessive CPU oversubscription.

    XGBoost/RandomForest can already use multiple CPU
    threads internally, so blindly setting n_jobs=-1
    everywhere can actually make the machine slower.
    """

    cpu_count = os.cpu_count() or 2

    if name == "logistic_regression":
        return min(4, cpu_count)

    return 1


def cross_validate_models(
    trained_models,
    X_train,
    y_train,
    target_mappings=None
):

    results = {}

    print("\n" + "=" * 60)
    print("CROSS-VALIDATION")
    print("=" * 60)

    class_counts = (
        y_train.value_counts()
    )

    if class_counts.empty:

        print(
            "No target classes available."
        )

        return results

    minimum_class_count = (
        class_counts.min()
    )

    n_splits = min(
        5,
        int(minimum_class_count)
    )

    if n_splits < 2:

        print(
            "Not enough samples for "
            "cross-validation."
        )

        return results

    cv = StratifiedKFold(
        n_splits=n_splits,
        shuffle=True,
        random_state=42
    )

    for name, model in trained_models.items():

        print(
            f"\nCross-validating: {name}"
        )

        try:

            if (
                target_mappings is not None
                and name in target_mappings
            ):

                mapping = (
                    target_mappings[name]
                )

                y_model = y_train.map(
                    mapping
                )

                print(
                    f"Using encoded target "
                    f"for {name}: {mapping}"
                )

            else:

                y_model = y_train

            scores = cross_val_score(
                model,
                X_train,
                y_model,
                cv=cv,
                scoring="roc_auc",
                error_score="raise",
                n_jobs=_cv_jobs_for_model(
                    name
                )
            )

            results[name] = {

                "mean_roc_auc":
                    float(scores.mean()),

                "std_roc_auc":
                    float(scores.std()),

                "fold_scores": [
                    float(score)
                    for score in scores
                ]
            }

            print(
                f"Mean ROC-AUC: "
                f"{scores.mean():.4f}"
            )

            print(
                f"Std ROC-AUC : "
                f"{scores.std():.4f}"
            )

        except Exception as error:

            print(
                f"Cross-validation failed: "
                f"{error}"
            )

            results[name] = {

                "mean_roc_auc":
                    None,

                "std_roc_auc":
                    None,

                "fold_scores":
                    [],

                "error":
                    str(error)
            }

    return results


def select_best_model(
    trained_models,
    evaluation_results,
    cv_results,
    primary_model="xgboost"
):

    if not trained_models:

        raise ValueError(
            "No trained models available."
        )

    if primary_model in trained_models:

        return (
            primary_model,
            trained_models[
                primary_model
            ]
        )

    valid_cv_models = {

        name: result

        for name, result
        in cv_results.items()

        if (
            result.get(
                "mean_roc_auc"
            ) is not None

            and name in trained_models
        )
    }

    if valid_cv_models:

        best_name = max(
            valid_cv_models,

            key=lambda name:
                valid_cv_models[
                    name
                ]["mean_roc_auc"]
        )

        return (
            best_name,
            trained_models[
                best_name
            ]
        )

    valid_test_models = {

        name: result

        for name, result
        in evaluation_results.items()

        if (
            result.get(
                "roc_auc"
            ) is not None

            and name in trained_models
        )
    }

    if valid_test_models:

        best_name = max(
            valid_test_models,

            key=lambda name:
                valid_test_models[
                    name
                ]["roc_auc"]
        )

        return (
            best_name,
            trained_models[
                best_name
            ]
        )

    best_name = max(
        evaluation_results,

        key=lambda name:
            evaluation_results[
                name
            ]["f1"]
    )

    return (
        best_name,
        trained_models[
            best_name
        ]
    )


def create_model_comparison(
    evaluation_results,
    cv_results
):

    rows = []

    for name, evaluation in (
        evaluation_results.items()
    ):

        cv = cv_results.get(
            name,
            {}
        )

        rows.append({

            "model":
                name,

            "accuracy":
                evaluation.get(
                    "accuracy"
                ),

            "precision":
                evaluation.get(
                    "precision"
                ),

            "recall":
                evaluation.get(
                    "recall"
                ),

            "f1":
                evaluation.get(
                    "f1"
                ),

            "roc_auc":
                evaluation.get(
                    "roc_auc"
                ),

            "pr_auc":
                evaluation.get(
                    "pr_auc"
                ),

            "cv_mean_roc_auc":
                cv.get(
                    "mean_roc_auc"
                ),

            "cv_std_roc_auc":
                cv.get(
                    "std_roc_auc"
                )
        })

    return pd.DataFrame(
        rows
    )