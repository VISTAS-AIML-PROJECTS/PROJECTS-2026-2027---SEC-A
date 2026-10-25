"""
Action dispatcher for the existing MINE churn project.

This file connects the existing JSON outputs to the
human-action layer.

It does NOT:
- train a model
- make a new prediction
- calculate SHAP
- create a new decision

It only uses the existing evidence and decision outputs.
"""

import csv
import json
from datetime import datetime
from pathlib import Path

from .email_service import (
    build_email_body,
    build_email_subject,
    send_email,
)


# ---------------------------------------------------------
# PROJECT PATHS
# ---------------------------------------------------------

# D:/Mine/data/agents/...
PROJECT_ROOT = Path(__file__).resolve().parents[2]

EVIDENCE_FILE = (
    PROJECT_ROOT
    / "data"
    / "agents"
    / "customer_evidence.json"
)

DECISION_FILE = (
    PROJECT_ROOT
    / "data"
    / "agents"
    / "customer_decisions.json"
)

AUDIT_DIR = (
    PROJECT_ROOT
    / "data"
    / "audit"
)

AUDIT_FILE = (
    AUDIT_DIR
    / "action_log.csv"
)


# ---------------------------------------------------------
# LOAD JSON
# ---------------------------------------------------------

def load_json_file(file_path):
    """Load a JSON file safely."""

    if not file_path.exists():
        raise FileNotFoundError(
            f"File not found: {file_path}"
        )

    with open(
        file_path,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


# ---------------------------------------------------------
# LOAD EXISTING CUSTOMER DATA
# ---------------------------------------------------------

def load_customer_evidence():
    """
    Load the existing customer evidence produced by MINE.
    """

    data = load_json_file(
        EVIDENCE_FILE
    )

    if not isinstance(data, list):
        raise ValueError(
            "customer_evidence.json must contain a list."
        )

    return data


def load_customer_decisions():
    """
    Load the existing customer decisions produced by MINE.

    The current project contains decisions for only
    some row_index values, so we map them by row_index.
    """

    if not DECISION_FILE.exists():

        return {}

    data = load_json_file(
        DECISION_FILE
    )

    if not isinstance(data, list):
        raise ValueError(
            "customer_decisions.json must contain a list."
        )

    decisions = {}

    for item in data:

        row_index = item.get(
            "row_index"
        )

        if row_index is not None:

            decisions[int(row_index)] = item

    return decisions


# ---------------------------------------------------------
# FIND CUSTOMER
# ---------------------------------------------------------

def get_customer_data(row_index):
    """
    Get the existing evidence and decision for one row.
    """

    evidence_list = load_customer_evidence()

    decisions = load_customer_decisions()

    evidence = None

    for item in evidence_list:

        if int(
            item.get("row_index", -1)
        ) == int(row_index):

            evidence = item

            break

    if evidence is None:

        raise ValueError(
            f"No customer evidence found for row_index={row_index}"
        )

    decision_item = decisions.get(
        int(row_index)
    )

    return evidence, decision_item


# ---------------------------------------------------------
# DECISION TYPE
# ---------------------------------------------------------

def get_action_type(evidence, decision_item=None):
    """
    Decide the human-action level from the existing
    model probability in customer_evidence.json.

    This does NOT create a new prediction.
    It only applies the project's action thresholds.
    """

    probability = evidence.get("probability")

    if probability is None:
        return "REVIEW"

    try:
        probability = float(probability)

    except (TypeError, ValueError):
        return "REVIEW"

    # Original project action thresholds
    if probability >= 0.75:
        return "ACTION"

    if probability >= 0.55:
        return "ESCALATE"

    return "ABSTAIN"

    # -----------------------------------------------------
    # FIRST: EXISTING DECISION TEXT
    # -----------------------------------------------------

    if decision_item:

        decision_text = str(
            decision_item.get(
                "decision",
                ""
            )
        ).upper()

        if "PRIORITY" in decision_text:

            if "HIGH" in decision_text:

                return "ACTION"

            if "MEDIUM" in decision_text:

                return "ESCALATE"

            if "LOW" in decision_text:

                return "ABSTAIN"

    # -----------------------------------------------------
    # SECOND: EXISTING RISK LEVEL
    # -----------------------------------------------------

    risk = str(
        evidence.get(
            "risk_level",
            ""
        )
    ).upper()

    if risk == "HIGH":

        return "ACTION"

    if risk == "MEDIUM":

        return "ESCALATE"

    if risk == "LOW":

        return "ABSTAIN"

    return "REVIEW"


# ---------------------------------------------------------
# AUDIT LOG
# ---------------------------------------------------------

def write_audit_log(
    row_index,
    evidence,
    action_type,
    email_status,
    email_recipient
):
    """
    Write one action to the append-only CSV audit log.
    """

    AUDIT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    file_exists = AUDIT_FILE.exists()

    fieldnames = [
        "timestamp",
        "row_index",
        "prediction",
        "probability",
        "risk_level",
        "action_type",
        "email_status",
        "email_recipient",
    ]

    with open(
        AUDIT_FILE,
        "a",
        newline="",
        encoding="utf-8"
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames
        )

        if not file_exists:

            writer.writeheader()

        writer.writerow(
            {
                "timestamp":
                    datetime.now().isoformat(
                        timespec="seconds"
                    ),

                "row_index":
                    row_index,

                "prediction":
                    evidence.get(
                        "prediction"
                    ),

                "probability":
                    evidence.get(
                        "probability"
                    ),

                "risk_level":
                    evidence.get(
                        "risk_level"
                    ),

                "action_type":
                    action_type,

                "email_status":
                    email_status,

                "email_recipient":
                    email_recipient,
            }
        )


# ---------------------------------------------------------
# SEND HUMAN EMAIL
# ---------------------------------------------------------

def process_customer(
    row_index,
    recipient_email,
    dry_run=True
):
    """
    Process one existing customer.

    Returns a dictionary that Gradio can use later.
    """

    evidence, decision_item = get_customer_data(
        row_index
    )

    action_type = get_action_type(
        evidence,
        decision_item
    )

    # -----------------------------------------------------
    # ONLY HIGH-RISK / ACTION CUSTOMERS
    # ARE SENT HUMAN EMAILS.
    # -----------------------------------------------------

    if action_type != "ACTION":

        write_audit_log(
            row_index=row_index,
            evidence=evidence,
            action_type=action_type,
            email_status="NOT_SENT",
            email_recipient=recipient_email,
        )

        return {

            "success": True,

            "action_type": action_type,

            "email_status": "NOT_SENT",

            "message": (
                f"Customer row {row_index} "
                f"is {action_type}. "
                "No human action email was sent."
            )
        }

    # -----------------------------------------------------
    # BUILD EMAIL
    # -----------------------------------------------------

    subject = build_email_subject(
        evidence
    )

    body = build_email_body(
        evidence=evidence,
        decision=(
            decision_item.get(
                "decision"
            )
            if decision_item
            else None
        ),
        explanation=None,
    )

    # -----------------------------------------------------
    # SEND / DRY RUN
    # -----------------------------------------------------

    result = send_email(
        to_address=recipient_email,
        subject=subject,
        body=body,
        dry_run=dry_run,
    )

    # -----------------------------------------------------
    # AUDIT
    # -----------------------------------------------------

    write_audit_log(
        row_index=row_index,
        evidence=evidence,
        action_type=action_type,
        email_status=result.get(
            "status",
            "UNKNOWN"
        ),
        email_recipient=recipient_email,
    )

    return {

        "success": True,

        "action_type": action_type,

        "email_status":
            result.get(
                "status"
            ),

        "subject":
            subject,

        "body":
            body,

        "message":
            (
                f"Customer row {row_index} "
                f"processed as {action_type}."
            ),
    }


# ---------------------------------------------------------
# SIMPLE TEST
# ---------------------------------------------------------

if __name__ == "__main__":

    evidence, decision = get_customer_data(
        0
    )

    print("Customer loaded successfully.")

    print(
        "Row:",
        evidence.get(
            "row_index"
        )
    )

    print(
        "Prediction:",
        evidence.get(
            "prediction"
        )
    )

    print(
        "Probability:",
        evidence.get(
            "probability"
        )
    )

    print(
        "Risk:",
        evidence.get(
            "risk_level"
        )
    )

    print(
        "Action:",
        get_action_type(
            evidence,
            decision
        )
    )