import os
from pathlib import Path

from src.inference.predict_new_data import predict_csv
from src.actions.email_service import (
    build_email_subject,
    build_email_body,
    send_email,
)


# ============================================================
# MINE - COMPLETE DEMO
# ML MODEL -> RISK -> HUMAN EMAIL
# ============================================================

INPUT_FILE = Path(
    r"D:\Mine\data\processed\new_company_test.csv"
)

# Put YOUR email here for the review demo
RECIPIENT_EMAIL = "avalight04@gmail.com"

# Demo mode first
DRY_RUN = False


def create_evidence(row, row_index):
    """
    Convert the model prediction into the evidence
    format expected by the existing email system.
    """

    probability = float(
        row["MINE_Churn_Probability"]
    )

    prediction = int(
        row["MINE_Prediction"]
    )

    if probability >= 0.75:
        risk = "HIGH"
    elif probability >= 0.55:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    return {
        "row_index": row_index,
        "prediction": (
            "Yes" if prediction == 1 else "No"
        ),
        "probability": probability,
        "risk_level": risk,
        "customer_features": {},
        "top_factors": [],
    }


def main():

    print()
    print("=" * 70)
    print("MINE CHURN DECISION-SUPPORT DEMO")
    print("=" * 70)

    # --------------------------------------------------------
    # STEP 1 - RUN EXISTING MODEL
    # --------------------------------------------------------

    result = predict_csv(
        str(INPUT_FILE)
    )

    print()
    print("=" * 70)
    print("HUMAN ACTION LAYER")
    print("=" * 70)

    # --------------------------------------------------------
    # STEP 2 - PROCESS EACH CUSTOMER
    # --------------------------------------------------------

    for index, row in result.iterrows():

        evidence = create_evidence(
            row,
            index
        )

        probability = evidence[
            "probability"
        ]

        risk = evidence[
            "risk_level"
        ]

        print()
        print(
            f"Customer Row {index}"
        )

        print(
            f"Prediction: "
            f"{evidence['prediction']}"
        )

        print(
            f"Churn Probability: "
            f"{probability * 100:.2f}%"
        )

        print(
            f"Risk Level: {risk}"
        )

        # ----------------------------------------------------
        # ONLY HIGH-RISK CUSTOMERS GET EMAIL
        # ----------------------------------------------------

        if risk != "HIGH":

            print(
                "Action: NO EMAIL"
            )

            continue

        subject = build_email_subject(
            evidence
        )

        body = build_email_body(
            evidence=evidence,
            decision=None,
            explanation=None,
        )

        print(
            "Action: SEND HUMAN ALERT"
        )

        print(
            f"Subject: {subject}"
        )

        email_result = send_email(
            to_address=RECIPIENT_EMAIL,
            subject=subject,
            body=body,
            dry_run=DRY_RUN,
        )

        print(
            f"Email Status: "
            f"{email_result['status']}"
        )

    print()
    print("=" * 70)
    print("MINE DEMO COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()