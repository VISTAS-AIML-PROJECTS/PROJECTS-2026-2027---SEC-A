from dotenv import load_dotenv

load_dotenv()

import gradio as gr
import pandas as pd

from src.inference.predict_new_data import predict_csv
from src.actions.email_service import (
    build_email_subject,
    build_email_body,
    send_email,
)

from src.agents.evidence_builder import build_customer_evidence

# SHAP explainability
SHAP_FILE = r"D:\Mine\data\explainability\aggregated_local_shap.csv"

SHAP_DF = pd.read_csv(SHAP_FILE)

# Fast lookup: row_index -> SHAP rows
SHAP_BY_ROW = {
    int(row_index): group.copy()
    for row_index, group in SHAP_DF.groupby("row_index")
}


# ============================================================
# MINE - GRADIO CHURN INTELLIGENCE SYSTEM
# ============================================================

DEFAULT_INPUT = r"D:\Mine\data\processed\new_company_test.csv"


# ============================================================
# RUN MODEL
# ============================================================

def run_prediction(csv_file):

    if csv_file is None:
        return (
            "❌ Please upload a CSV file.",
            pd.DataFrame(),
            ""
        )

    try:

        # Gradio may give us a filepath
        if hasattr(csv_file, "name"):
            input_path = csv_file.name
        else:
            input_path = str(csv_file)

        # Existing MINE model
        result = predict_csv(input_path)

        # ----------------------------------------------------
        # CREATE SIMPLE RESULT TABLE
        # ----------------------------------------------------

        display = pd.DataFrame({
            "Customer Row": result.index,
            "Prediction": result["MINE_Prediction"].map(
                lambda x: "CHURN" if int(x) == 1 else "NO CHURN"
            ),
            "Churn Probability (%)":
                result["MINE_Churn_Percentage"],
        })

        display["Risk Level"] = display[
            "Churn Probability (%)"
        ].apply(
            lambda x:
                "HIGH" if x >= 75
                else "MEDIUM" if x >= 55
                else "LOW"
        )

        # ----------------------------------------------------
        # SUMMARY
        # ----------------------------------------------------

        high = int(
            (display["Risk Level"] == "HIGH").sum()
        )

        medium = int(
            (display["Risk Level"] == "MEDIUM").sum()
        )

        low = int(
            (display["Risk Level"] == "LOW").sum()
        )

        summary = f"""
## Prediction Complete

**Total Customers:** {len(display)}

🔴 **HIGH Risk:** {high}

🟠 **MEDIUM Risk:** {medium}

🟢 **LOW Risk:** {low}

The existing trained MINE model was used.
**No retraining was performed.**
"""

        # Store result globally for email action
        global LATEST_RESULT
        LATEST_RESULT = result

        return (
            summary,
            display,
            "Prediction completed successfully."
        )

    except Exception as exc:

        return (
            f"❌ **Prediction failed**\n\n`{exc}`",
            pd.DataFrame(),
            "Prediction failed."
        )


# ============================================================
# EMAIL PREVIEW
# ============================================================

def preview_email(row_index, recipient):

    if row_index is None:
        return "Select a customer first."

    if not recipient or "@" not in recipient:
        return "Enter a valid recipient email address."

    try:

        row_index = int(row_index)

        result = LATEST_RESULT

        if result is None:
            return "Run prediction first."

        row = result.loc[row_index]

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
        shap_rows = SHAP_BY_ROW.get(row_index)

        if shap_rows is None:
            shap_rows = SHAP_DF.iloc[0:0]

        evidence = {
            "row_index": row_index,

            "prediction":
                "Yes" if prediction == 1 else "No",

            "probability": probability,

            "risk_level": risk,

            "customer_features":
                row.to_dict(),

            "top_factors": [],
        }

        customer_shap = (
            shap_rows
            .sort_values(
                "absolute_impact",
                ascending=False
            )
            .head(5)
        )

        for _, factor in customer_shap.iterrows():

            evidence["top_factors"].append({

                "feature":
                    factor["original_feature"],

                "value":
                    row.get(
                        factor["original_feature"]
                    ),

                "shap_value":
                    float(
                        factor["shap_value"]
                    ),

                "absolute_impact":
                    float(
                        factor["absolute_impact"]
                    ),

                "impact":
                    factor["direction"]
            })

        if risk != "HIGH":

            return (
                f"## No Human Alert\n\n"
                f"Customer Row **{row_index}** is "
                f"**{risk} risk**.\n\n"
                f"No human alert will be sent."
            )

        subject = build_email_subject(
            evidence
        )

        body = build_email_body(
            evidence=evidence,
            decision=None,
            explanation=None,
        )

        return (
            "## Email Preview\n\n"
            f"**To:** {recipient}\n\n"
            f"**Subject:** {subject}\n\n"
            "```text\n"
            f"{body}"
            "\n```"
        )

    except Exception as exc:

        return f"❌ Error: `{exc}`"


# ============================================================
# SEND HUMAN ALERT
# ============================================================

def send_human_alert(row_index, recipient, test_mode):

    if row_index is None:
        return "❌ Select a customer first."

    if not recipient or "@" not in recipient:
        return "❌ Enter a valid recipient email."

    try:

        result = LATEST_RESULT

        if result is None:
            return "❌ Run prediction first."

        row_index = int(row_index)

        row = result.loc[row_index]

        probability = float(
            row["MINE_Churn_Probability"]
        )

        prediction = int(
            row["MINE_Prediction"]
        )

        # ----------------------------------------------------
        # RISK
        # ----------------------------------------------------

        if probability >= 0.75:
            risk = "HIGH"

        elif probability >= 0.55:
            risk = "MEDIUM"

        else:
            risk = "LOW"

        # ----------------------------------------------------
        # ONLY HIGH-RISK CUSTOMERS
        # ----------------------------------------------------

        if risk != "HIGH":

            return (
                f"### No Email Sent\n\n"
                f"Customer Row **{row_index}**\n\n"
                f"Risk: **{risk}**\n\n"
                f"The MINE policy sends human alerts "
                f"only for HIGH-risk customers."
            )
        # ========================================================
        # GET SHAP EXPLANATION FOR THIS CUSTOMER
        # ========================================================

        customer_shap = SHAP_BY_ROW.get(row_index)

        top_factors = []

        if customer_shap is not None and not customer_shap.empty:

            customer_shap = customer_shap.sort_values(
                "absolute_impact",
                ascending=False
            )

            # Get the actual customer row
            customer_row = LATEST_RESULT.loc[row_index]

            for _, factor in customer_shap.head(3).iterrows():

                feature_name = str(
                    factor["original_feature"]
                )

                # Try exact column name first
                customer_value = customer_row.get(
                    feature_name
                )

                # If the SHAP name is not an exact CSV
                # column name, find the corresponding
                # accumulated / service column.
                if customer_value is None:

                    matching_columns = [
                        column
                        for column in customer_row.index
                        if column.startswith(
                            feature_name + "__"
                        )
                    ]

                    if matching_columns:

                        customer_value = customer_row[
                            matching_columns[0]
                        ]

                if pd.isna(customer_value):

                    customer_value = "Not available"

                top_factors.append({

                    "feature":
                        feature_name,

                    "value":
                        customer_value,

                    "shap_value":
                        float(
                            factor["shap_value"]
                        ),

                    "absolute_impact":
                        float(
                            factor["absolute_impact"]
                        ),

                    "impact":
                        str(
                            factor["direction"]
                        ),
                })

        evidence = {
            "row_index": row_index,

            "prediction":
                "Yes" if prediction == 1 else "No",

            "probability": probability,

            "risk_level": risk,

            "customer_features": {},

            "top_factors": top_factors,
        }

        subject = build_email_subject(
            evidence
        )

        body = build_email_body(
            evidence=evidence,
            decision=None,
            explanation=None,
        )

        # ----------------------------------------------------
        # SEND EMAIL
        # ----------------------------------------------------

        email_result = send_email(
            to_address=recipient,

            subject=subject,

            body=body,

            dry_run=test_mode,
        )

        status = email_result.get(
            "status",
            "UNKNOWN"
        )

        if status == "SENT":

            return (
                "## ✅ HUMAN ALERT SENT\n\n"
                f"**Customer:** Test Row {row_index}\n\n"
                f"**Churn Probability:** "
                f"{probability * 100:.2f}%\n\n"
                f"**Risk:** 🔴 HIGH\n\n"
                f"**Recipient:** {recipient}\n\n"
                f"**Email Status:** SENT\n\n"
                "The human reviewer can now take action."
            )

        if status == "DRY_RUN":

            return (
                "## 🧪 TEST MODE\n\n"
                "The email was generated successfully, "
                "but **no real email was sent**."
            )

        return f"Email status: `{status}`"

    except Exception as exc:

        return (
            "## ❌ Email Failed\n\n"
            f"`{exc}`"
        )


# ============================================================
# CUSTOMER SELECTION
# ============================================================

def get_customer_choices():

    if LATEST_RESULT is None:
        return []

    choices = []

    for index, row in LATEST_RESULT.iterrows():

        probability = float(
            row["MINE_Churn_Percentage"]
        )

        if probability >= 75:
            risk = "HIGH"

        elif probability >= 55:
            risk = "MEDIUM"

        else:
            risk = "LOW"

        choices.append(
            (
                f"Row {index} | "
                f"{risk} | "
                f"{probability:.2f}%",
                index
            )
        )

    return choices


def refresh_customer_dropdown():

    return gr.update(
        choices=get_customer_choices(),
        value=None
    )


# ============================================================
# GLOBAL RESULT
# ============================================================

LATEST_RESULT = None


# ============================================================
# GRADIO UI
# ============================================================

with gr.Blocks(
    title="MINE Churn Intelligence System"
) as app:

    gr.Markdown(
        """
# 🧠 MINE — Churn Intelligence System

### ML Prediction → Risk Detection → Human Alert

Upload customer data and use the **existing trained MINE model**
to identify customers at risk of churn.

**The model is not retrained during prediction.**
"""
    )

    # --------------------------------------------------------
    # DATA INPUT
    # --------------------------------------------------------

    gr.Markdown("## 1. Customer Data")

    csv_file = gr.File(
        label="Upload Customer CSV",
        file_types=[".csv"],
        type="filepath"
    )

    run_button = gr.Button(
        "🔍 Run Churn Prediction",
        variant="primary"
    )

    prediction_status = gr.Markdown()

    # --------------------------------------------------------
    # RESULTS
    # --------------------------------------------------------

    gr.Markdown("## 2. Prediction Results")

    results_table = gr.Dataframe(
        headers=[
            "Customer Row",
            "Prediction",
            "Churn Probability (%)",
            "Risk Level"
        ],
        interactive=False
    )

    # --------------------------------------------------------
    # CUSTOMER SUMMARY
    # --------------------------------------------------------

    summary = gr.Markdown()

    # --------------------------------------------------------
    # HUMAN ACTION
    # --------------------------------------------------------

    gr.Markdown("---")

    gr.Markdown(
        """
## 3. Human Action

Only **HIGH-risk customers** can trigger a human alert.
"""
    )

    customer_dropdown = gr.Dropdown(
        label="Select Customer",
        choices=[],
        value=None
    )

    recipient = gr.Textbox(
        label="Human Reviewer Email",
        value=""
    )

    test_mode = gr.Checkbox(
        label="Test Mode",
        value=False
    )

    with gr.Row():

        preview_button = gr.Button(
            "📄 Preview Email"
        )

        send_button = gr.Button(
            "📧 Send Human Alert",
            variant="primary"
        )

    email_preview = gr.Markdown()

    email_status = gr.Markdown()

    # --------------------------------------------------------
    # EVENTS
    # --------------------------------------------------------

    run_button.click(
        fn=run_prediction,

        inputs=csv_file,

        outputs=[
            summary,
            results_table,
            prediction_status
        ]
    ).then(
        fn=refresh_customer_dropdown,

        inputs=None,

        outputs=customer_dropdown
    )

    preview_button.click(
        fn=preview_email,

        inputs=[
            customer_dropdown,
            recipient
        ],

        outputs=email_preview
    )

    send_button.click(
        fn=send_human_alert,

        inputs=[
            customer_dropdown,
            recipient,
            test_mode
        ],

        outputs=email_status
    )


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    app.launch()