import numpy as np


def _decode_label(prediction, target_mapping=None):
    """
    Convert an encoded model prediction back to the
    original target label.

    Example:
        {"No": 0, "Yes": 1}
        1 -> "Yes"
    """

    if hasattr(prediction, "item"):
        prediction = prediction.item()

    if target_mapping is None:
        return prediction

    reverse_mapping = {
        encoded: original
        for original, encoded in target_mapping.items()
    }

    return reverse_mapping.get(
        prediction,
        prediction
    )


def predict_churn(
    model,
    X,
    target_mapping=None
):
    """
    Generate predictions and probabilities.

    IMPORTANT:
    target_mapping must be supplied for models whose
    training target was encoded.
    """

    predictions = model.predict(X)

    probabilities = None

    if hasattr(model, "predict_proba"):

        probabilities = model.predict_proba(X)

        if probabilities.ndim == 2:

            if probabilities.shape[1] == 2:
                probabilities = probabilities[:, 1]

            elif probabilities.shape[1] == 1:
                probabilities = probabilities[:, 0]

            else:
                probabilities = None

    results = []

    for index, prediction in enumerate(predictions):

        result = {
            "prediction": _decode_label(
                prediction,
                target_mapping
            )
        }

        if probabilities is not None:

            result["probability"] = float(
                probabilities[index]
            )

        else:

            result["probability"] = None

        results.append(result)

    return results


def classify_risk(probability):

    if probability is None:
        return "UNKNOWN"

    probability = float(probability)

    if probability >= 0.75:
        return "HIGH"

    if probability >= 0.50:
        return "MEDIUM"

    return "LOW"