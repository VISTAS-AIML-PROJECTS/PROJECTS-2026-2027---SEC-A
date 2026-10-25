"""
Human email service for the MINE churn decision-support project.

This file does NOT run the ML model.
It only converts the existing model evidence/decision
into a human-readable email and can send it through SMTP.
"""

import os
import smtplib
from email.message import EmailMessage


DEFAULT_SUBJECT_PREFIX = "MINE Churn Alert"


def _as_text(value, default="Not available"):
    """Convert a value into clean text for the email."""
    if value is None or value == "":
        return default

    return str(value)


def _format_probability(value):
    """Convert 0.84 into 84.00%."""
    if value is None:
        return "Not available"

    try:
        return f"{float(value) * 100:.2f}%"

    except (TypeError, ValueError):
        return str(value)


def _extract_recommended_action(decision):
    """
    Read the recommended action from the existing
    Decision Agent response.

    It supports both:
    1. Dictionary/JSON decision
    2. Existing text decision
    """

    if isinstance(decision, dict):

        return _as_text(
            decision.get("recommended_action")
        )

    text = _as_text(
        decision,
        default="No decision text available"
    )

    marker = "RECOMMENDED ACTION:"

    if marker in text:

        section = text.split(
            marker,
            1
        )[1]

        section = section.split(
            "RATIONALE:",
            1
        )[0]

        return (
            section.strip()
            or "No recommendation provided"
        )

    return text


def _extract_rationale(decision):
    """
    Read the rationale from the existing
    Decision Agent response.
    """

    if isinstance(decision, dict):

        return _as_text(
            decision.get("rationale")
        )

    text = _as_text(
        decision,
        default="No rationale available"
    )

    marker = "RATIONALE:"

    if marker in text:

        section = text.split(
            marker,
            1
        )[1]

        section = section.split(
            "CAUTION:",
            1
        )[0]

        return (
            section.strip()
            or "No rationale provided"
        )

    return "No rationale provided"


def _customer_reference(evidence):
    """
    Use CustomerID if it exists.

    The current evidence file may not contain CustomerID,
    so the existing row_index is used as a safe fallback.
    """

    customer_features = (
        evidence.get(
            "customer_features"
        )
        or {}
    )

    possible_keys = [
        "CustomerID",
        "Customer Id",
        "customer_id",
        "customerId"
    ]

    for key in possible_keys:

        value = customer_features.get(key)

        if value not in (None, ""):

            return str(value)

    row_index = evidence.get(
        "row_index"
    )

    if row_index is not None:

        return f"Test Row {row_index}"

    return "Customer"


def build_email_subject(evidence):
    """Build the email subject from existing model information."""

    risk = _as_text(
        evidence.get("risk_level"),
        default="REVIEW"
    ).upper()

    customer = _customer_reference(
        evidence
    )

    return (
        f"{DEFAULT_SUBJECT_PREFIX} - "
        f"{risk} - {customer}"
    )


def build_email_body(
    evidence,
    decision=None,
    explanation=None
):
    """
    Create the human-readable email.

    Everything in the email comes from existing
    model evidence, explanation and decision output.
    """

    customer = _customer_reference(
        evidence
    )

    prediction = _as_text(
        evidence.get("prediction")
    )

    probability = _format_probability(
        evidence.get("probability")
    )

    risk = _as_text(
        evidence.get("risk_level"),
        default="UNKNOWN"
    ).upper()

    lines = [

        "Hello,",

        "",

        (
            "The MINE churn decision-support system "
            "has flagged the following account "
            "for human review/action."
        ),

        "",

        f"Customer: {customer}",

        f"Predicted churn label: {prediction}",

        f"Churn probability: {probability}",

        f"Risk level: {risk}",

        "",

        "Top model-supported reasons:",

    ]

    factors = (
        evidence.get(
            "top_factors"
        )
        or []
    )

    if factors:

        # Show only the top 3 SHAP reasons.
        for factor in factors[:3]:

            feature = _as_text(
                factor.get("feature")
            )

            value = _as_text(
                factor.get("value")
            )

            impact = _as_text(
                factor.get("impact")
            )

            shap_value = factor.get(
                "shap_value"
            )

            if isinstance(
                shap_value,
                (int, float)
            ):

                shap_text = (
                    f"{shap_value:.4f}"
                )

            else:

                shap_text = _as_text(
                    shap_value
                )

            lines.append(

                f"- {feature}: "
                f"value={value}; "
                f"impact={impact}; "
                f"SHAP={shap_text}"

            )

    else:

        lines.append(
            "- No SHAP factors were provided."
        )

    # --------------------------------------------------
    # EXISTING EXPLANATION
    # --------------------------------------------------

    if explanation:

        if isinstance(
            explanation,
            dict
        ):

            explanation_text = (
                explanation.get(
                    "explanation"
                )
            )

        else:

            explanation_text = (
                explanation
            )

        if explanation_text:

            lines.extend(
                [
                    "",
                    "Model explanation:",
                    _as_text(
                        explanation_text
                    )
                ]
            )

    # --------------------------------------------------
    # EXISTING DECISION
    # --------------------------------------------------

    if decision is not None:

        lines.extend(
            [
                "",
                "Recommended action:",
                _extract_recommended_action(
                    decision
                ),

                "",

                "Rationale:",
                _extract_rationale(
                    decision
                ),
            ]
        )

    # --------------------------------------------------
    # FINAL NOTE
    # --------------------------------------------------

    lines.extend(
        [
            "",
            (
                "Note: SHAP values describe "
                "model contribution, not causation. "
                "This is decision support for a "
                "human reviewer."
            ),

            "",

            "Regards,",

            "MINE Churn Decision-Support System"
        ]
    )

    return "\n".join(
        lines
    )


def send_email(
    to_address,
    subject,
    body,
    dry_run=True
):
    """
    Send an email using SMTP.

    dry_run=True:
        Does NOT send an email.
        Used while testing.

    dry_run=False:
        Sends the real email.

    Required environment variables for real sending:

        MINE_SMTP_HOST
        MINE_SMTP_PORT
        MINE_SMTP_USERNAME
        MINE_SMTP_PASSWORD
        MINE_EMAIL_FROM
    """

    # --------------------------------------------------
    # CHECK RECIPIENT
    # --------------------------------------------------

    if (
        not to_address
        or "@" not in to_address
    ):

        raise ValueError(
            "A valid recipient email address is required."
        )

    # --------------------------------------------------
    # FIND SENDER
    # --------------------------------------------------

    sender = (
        os.getenv(
            "MINE_EMAIL_FROM"
        )
        or os.getenv(
            "MINE_SMTP_USERNAME"
        )
    )

    # --------------------------------------------------
    # TEST MODE
    # --------------------------------------------------

    if dry_run:

        return {

            "status": "DRY_RUN",

            "sent": False,

            "to": to_address,

            "subject": subject,

            "body": body
        }

    # --------------------------------------------------
    # SMTP SETTINGS
    # --------------------------------------------------

    host = os.getenv(
        "MINE_SMTP_HOST"
    )

    port_text = os.getenv(
        "MINE_SMTP_PORT",
        "587"
    )

    username = os.getenv(
        "MINE_SMTP_USERNAME"
    )

    password = os.getenv(
        "MINE_SMTP_PASSWORD"
    )

    # --------------------------------------------------
    # CONFIGURATION CHECK
    # --------------------------------------------------

    if (
        not host
        or not username
        or not password
        or not sender
    ):

        raise RuntimeError(

            "SMTP is not configured. "
            "Set MINE_SMTP_HOST, "
            "MINE_SMTP_PORT, "
            "MINE_SMTP_USERNAME, "
            "MINE_SMTP_PASSWORD, "
            "and MINE_EMAIL_FROM."

        )

    # --------------------------------------------------
    # PORT
    # --------------------------------------------------

    try:

        port = int(
            port_text
        )

    except ValueError as exc:

        raise ValueError(
            "MINE_SMTP_PORT must be a number."
        ) from exc

    # --------------------------------------------------
    # CREATE EMAIL
    # --------------------------------------------------

    message = EmailMessage()

    message["From"] = sender

    message["To"] = to_address

    message["Subject"] = subject

    message.set_content(
        body
    )

    # --------------------------------------------------
    # SEND
    # --------------------------------------------------

    with smtplib.SMTP(
        host,
        port,
        timeout=20
    ) as server:

        server.starttls()

        server.login(
            username,
            password
        )

        server.send_message(
            message
        )

    return {

        "status": "SENT",

        "sent": True,

        "to": to_address,

        "subject": subject
    }