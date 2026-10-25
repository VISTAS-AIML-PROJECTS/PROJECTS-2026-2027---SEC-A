from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix
)


def evaluate_model(
    model,
    X_test,
    y_test,
    target_mapping=None
):
    """
    Evaluate a trained model.

    If the model uses encoded target labels
    (for example XGBoost: 0/1), predictions are
    converted back to the original target labels
    before calculating classification metrics.
    """

    predictions = model.predict(X_test)

    # ---------------------------------------------------------
    # Convert model predictions back to original labels
    # ---------------------------------------------------------
    if target_mapping is not None:

        reverse_mapping = {
            encoded: original
            for original, encoded
            in target_mapping.items()
        }

        predictions = [
            reverse_mapping.get(
                prediction,
                prediction
            )
            for prediction in predictions
        ]

    # ---------------------------------------------------------
    # Detect positive class automatically
    # ---------------------------------------------------------
    if target_mapping is not None:

        # The encoded class 1 is treated as
        # the positive class.
        positive_class = next(
            (
                original
                for original, encoded
                in target_mapping.items()
                if encoded == 1
            ),
            None
        )

    else:

        positive_class = model.classes_[1]

    # ---------------------------------------------------------
    # Probability
    # ---------------------------------------------------------
    probabilities = None

    if hasattr(model, "predict_proba"):

        probability_matrix = model.predict_proba(
            X_test
        )

        if probability_matrix.shape[1] == 2:

            probabilities = probability_matrix[:, 1]

    # ---------------------------------------------------------
    # Classification metrics
    # ---------------------------------------------------------
    results = {

        "accuracy": float(
            accuracy_score(
                y_test,
                predictions
            )
        ),

        "precision": float(
            precision_score(
                y_test,
                predictions,
                pos_label=positive_class,
                zero_division=0
            )
        ),

        "recall": float(
            recall_score(
                y_test,
                predictions,
                pos_label=positive_class,
                zero_division=0
            )
        ),

        "f1": float(
            f1_score(
                y_test,
                predictions,
                pos_label=positive_class,
                zero_division=0
            )
        )
    }

    # ---------------------------------------------------------
    # ROC-AUC & PR-AUC
    # ---------------------------------------------------------
    if probabilities is not None:

        try:

            y_test_binary = (
                y_test == positive_class
            ).astype(int)

            results["roc_auc"] = float(
                roc_auc_score(
                    y_test_binary,
                    probabilities
                )
            )

            results["pr_auc"] = float(
                average_precision_score(
                    y_test_binary,
                    probabilities
                )
            )

        except ValueError:

            results["roc_auc"] = None
            results["pr_auc"] = None

    else:

        results["roc_auc"] = None
        results["pr_auc"] = None

    # ---------------------------------------------------------
    # Confusion matrix
    # ---------------------------------------------------------
    if target_mapping is not None:

        original_classes = list(
            target_mapping.keys()
        )

    else:

        original_classes = list(
            model.classes_
        )

    cm = confusion_matrix(
        y_test,
        predictions,
        labels=original_classes
    )

    results["confusion_matrix"] = cm.tolist()

    results["positive_class"] = str(
        positive_class
    )

    return results


def evaluate_models(
    trained_models,
    X_test,
    y_test,
    target_mappings=None
):

    all_results = {}

    print("\n" + "=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    for name, model in trained_models.items():

        print(f"\nEvaluating: {name}")

        # Get target mapping only for models
        # that required encoded targets.
        target_mapping = None

        if target_mappings is not None:

            target_mapping = target_mappings.get(
                name
            )

        results = evaluate_model(
            model,
            X_test,
            y_test,
            target_mapping
        )

        all_results[name] = results

        print(
            f"Accuracy : "
            f"{results['accuracy']:.4f}"
        )

        print(
            f"Precision: "
            f"{results['precision']:.4f}"
        )

        print(
            f"Recall   : "
            f"{results['recall']:.4f}"
        )

        print(
            f"F1       : "
            f"{results['f1']:.4f}"
        )

        if results["roc_auc"] is not None:

            print(
                f"ROC-AUC  : "
                f"{results['roc_auc']:.4f}"
            )

        if results.get("pr_auc") is not None:

            print(
                f"PR-AUC   : "
                f"{results['pr_auc']:.4f}"
            )

        print(
            f"Positive class: "
            f"{results['positive_class']}"
        )

    return all_results