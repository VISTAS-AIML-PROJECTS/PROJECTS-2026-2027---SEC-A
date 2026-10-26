from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import joblib
import pandas as pd
import numpy as np
import streamlit as st
import shap
import matplotlib.pyplot as plt

import importlib
import fbce
importlib.reload(fbce)
from fbce import calculate_fbce

BASE = Path(__file__).resolve().parent
MODEL_PATH = BASE / "models" / "fbce_model.pkl"
RESULT_PATH = BASE / "models" / "model_results.csv"

st.set_page_config(
    page_title="FBCE - Explainable Loan Prediction",
    page_icon="🏦",
    layout="wide"
)

st.title("Explainable Loan Prediction using FBCE")
st.caption("Financial Behaviour Consistency Engine — academic prototype")

@st.cache_resource
def load_model():
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)

bundle = load_model()

st.sidebar.header("Project")
st.sidebar.write("FBCE combines machine-learning prediction, financial consistency checks and SHAP explanations.")
st.sidebar.info(
    "The FBCE score is a project-defined consistency indicator. "
    "It is not a banking credit score."
)

if bundle is None:
    st.warning("Model is not trained yet.")
    st.code("python train_model.py", language="bash")
    st.stop()

model = bundle["model"]
model_name = bundle["model_name"]

st.sidebar.success(f"Loaded model: {model_name}")

with st.form("loan_form"):
    st.subheader("Applicant Financial Details")

    c1, c2, c3 = st.columns(3)

    with c1:
        applicant_income = st.number_input(
            "Applicant Income", min_value=0.0, value=30000.0, step=1000.0,
            help="Monthly income (e.g. 30,000 for 30k)."
        )
        coapplicant_income = st.number_input(
            "Co-applicant Income", min_value=0.0, value=0.0, step=500.0
        )
        loan_amount = st.number_input(
            "Loan Amount (₹)", min_value=0.0, value=100000.0, step=10000.0,
            help="Enter the actual loan amount in ₹ (e.g., 100,000 for 1 Lakh, 500,000 for 5 Lakhs)."
        )

    with c2:
        loan_term = st.number_input(
            "Loan Term (months)", min_value=1, value=360, step=12
        )
        credit_history = st.selectbox(
            "Credit History", [1.0, 0.0],
            format_func=lambda x: "Good / Available" if x == 1.0 else "Weak / Unavailable"
        )
        gender = st.selectbox("Gender", ["Male", "Female"])
        married = st.selectbox("Married", ["Yes", "No"])

    with c3:
        dependents = st.selectbox("Dependents", ["0", "1", "2", "3+"])
        education = st.selectbox("Education", ["Graduate", "Not Graduate"])
        self_employed = st.selectbox("Self Employed", ["Yes", "No"])
        property_area = st.selectbox("Property Area", ["Urban", "Semiurban", "Rural"])

    submitted = st.form_submit_button("Predict Loan")

if submitted:
    # Machine learning model was trained on Kaggle data where LoanAmount is in thousands (e.g., 100 for ₹100,000)
    model_loan_amount = (loan_amount / 1000.0) if loan_amount >= 1000 else loan_amount

    # These columns match the common Kaggle Loan Approval dataset.
    input_df = pd.DataFrame([{
        "Gender": gender,
        "Married": married,
        "Dependents": dependents,
        "Education": education,
        "Self_Employed": self_employed,
        "ApplicantIncome": applicant_income,
        "CoapplicantIncome": coapplicant_income,
        "LoanAmount": model_loan_amount,
        "Loan_Amount_Term": loan_term,
        "Credit_History": credit_history,
        "Property_Area": property_area
    }])

    try:
        prediction = int(model.predict(input_df)[0])
        probability = float(model.predict_proba(input_df)[0][1])

        fbce = calculate_fbce(
            applicant_income=applicant_income,
            coapplicant_income=coapplicant_income,
            loan_amount=loan_amount,
            loan_term_months=loan_term,
            credit_history=credit_history,
            self_employed=self_employed
        )

        st.divider()
        st.subheader("Prediction Result & Key Financial Indicators")

        # Defensive safe extraction with automatic fallbacks
        actual_loan = fbce.get("actual_loan_amount")
        if actual_loan is None:
            actual_loan = float(loan_amount) * 1000.0 if float(loan_amount) < 1000 else float(loan_amount)

        tot_income = fbce.get("total_income", float(applicant_income) + float(coapplicant_income))

        monthly_emi = fbce.get("monthly_emi")
        if monthly_emi is None:
            r = (10.0 / 100.0) / 12.0
            n = float(loan_term) if loan_term > 0 else 360.0
            if r == 0:
                monthly_emi = actual_loan / max(n, 1.0)
            else:
                monthly_emi = actual_loan * r * ((1 + r) ** n) / (((1 + r) ** n) - 1)

        emi_ratio_pct = fbce.get("emi_ratio_pct")
        if emi_ratio_pct is None:
            emi_ratio_pct = (monthly_emi / tot_income * 100.0) if tot_income > 0 else 0.0

        loan_to_annual_income = fbce.get("loan_to_annual_income")
        if loan_to_annual_income is None:
            loan_to_annual_income = (actual_loan / (tot_income * 12.0)) if tot_income > 0 else 0.0

        fbce_score_val = fbce.get("fbce_score", 50.0)
        risk_level_val = fbce.get("risk_level", "Moderate Consistency")
        rejection_reasons = fbce.get("rejection_reasons", [])
        approval_factors = fbce.get("approval_factors", [])
        recommendations = fbce.get("recommendations", [])
        behaviour = fbce.get("financial_behaviour")

        if not behaviour:
            behaviour = {
                "cash_flow": {
                    "title": "Monthly Cash Flow & Debt Obligation (FOIR)",
                    "metric": f"₹{monthly_emi:,.0f} / month ({emi_ratio_pct:.1f}% of income)",
                    "status": "Healthy" if emi_ratio_pct <= 35 else ("Moderate" if emi_ratio_pct <= 50 else "High Stress"),
                    "description": f"Estimated monthly EMI of ₹{monthly_emi:,.0f} absorbs {emi_ratio_pct:.1f}% of monthly income."
                },
                "leverage": {
                    "title": "Debt Exposure vs Annual Earnings",
                    "metric": f"{loan_to_annual_income:.1f}x Annual Income",
                    "status": "Conservative" if loan_to_annual_income <= 3.0 else ("Moderate" if loan_to_annual_income <= 5.0 else "Aggressive"),
                    "description": f"Requested loan of ₹{actual_loan:,.0f} is {loan_to_annual_income:.1f}x annual income."
                },
                "credit_discipline": {
                    "title": "Credit Discipline & Past Reliability",
                    "metric": "Good / Verified (1.0)" if float(credit_history) >= 1 else "Adverse / Missing (0.0)",
                    "status": "Positive" if float(credit_history) >= 1 else "Critical Risk",
                    "description": "Proven past credit record." if float(credit_history) >= 1 else "Past default or lack of credit history is the primary driver of rejection."
                },
                "employment_stability": {
                    "title": "Income & Career Stability",
                    "metric": "Salaried Professional" if str(self_employed).strip().lower() in ("no", "salaried") else "Self-Employed / Business",
                    "status": "Stable" if str(self_employed).strip().lower() in ("no", "salaried") else "Variable Income",
                    "description": "Salaried profile provides predictable periodic income."
                }
            }

        m1, m2, m3, m4, m5 = st.columns(5)
        with m1:
            st.metric("Loan Prediction", "APPROVED" if prediction == 1 else "REJECTED")
        with m2:
            st.metric("Approval Probability", f"{probability * 100:.1f}%")
        with m3:
            st.metric("FBCE Score", f"{fbce_score_val:.1f}/100")
        with m4:
            st.metric("Est. Monthly EMI", f"₹{monthly_emi:,.0f}")
        with m5:
            st.metric("Debt-to-Income (FOIR)", f"{emi_ratio_pct:.1f}%")

        st.caption(f"**Consistency Level:** {risk_level_val} | **Total Household Income:** ₹{tot_income:,.0f}/month | **Requested Loan:** ₹{actual_loan:,.0f}")

        # --- EXPLAIN WHY THE LOAN WAS REJECTED OR APPROVED ---
        st.divider()
        if prediction == 0:
            st.error("### ❌ Loan Rejection Diagnostic — Why Was This Loan Rejected?")
            st.write(
                "The system identified specific financial risk factors and machine-learning signals "
                "indicating a high probability of repayment strain or default:"
            )
            if rejection_reasons:
                for reason in rejection_reasons:
                    st.markdown(f"- {reason}")
            else:
                if float(credit_history) < 1:
                    st.markdown("- 🔴 **Adverse Credit History (Primary Driver):** Missing or poor credit track record is the single largest risk factor.")
                if emi_ratio_pct > 40:
                    st.markdown(f"- 🔴 **High Debt Burden:** Monthly EMI of ₹{monthly_emi:,.0f} exceeds 40% of household income.")
                st.markdown("- 🔴 **Model Probability Threshold:** Overall risk profile fell below the approval confidence threshold.")

            st.info("### 💡 Recommended Next Steps to Qualify for Approval")
            st.write("To improve the likelihood of approval in a future application, consider the following adjustments:")
            if recommendations:
                for rec in recommendations:
                    st.markdown(f"- {rec}")
            else:
                st.markdown("- 💡 **Rebuild Credit Score:** Settle any overdue debts and maintain 6-12 months of clean payment history.")
                st.markdown("- 💡 **Add a Co-applicant:** Introduce a family member with steady income to lower the debt-to-income ratio.")
                st.markdown("- 💡 **Adjust Loan Terms:** Consider requesting a lower loan principal or a longer repayment tenure.")
        else:
            st.success("### ✅ Loan Approval Diagnostic — Key Strengths Leading to Approval")
            st.write(
                "The application meets institutional creditworthiness criteria with strong financial consistency indicators:"
            )
            if approval_factors:
                for factor in approval_factors:
                    st.markdown(f"- {factor}")
            else:
                st.markdown("- 🟢 **Clean Credit History:** Reliable past repayment track record.")
                st.markdown(f"- 🟢 **Affordable Monthly EMI:** Monthly obligation of ₹{monthly_emi:,.0f} is easily manageable ({emi_ratio_pct:.1f}% of income).")
                st.markdown("- 🟢 **Adequate Earning Base:** Household cash flow provides solid debt service capacity.")

            st.info("### 💡 Ongoing Financial Health Advisory")
            st.markdown(
                f"- **Automated Payments:** Set up auto-debit for your monthly EMI (₹{monthly_emi:,.0f}) to safeguard your flawless credit track record.\n"
                f"- **Emergency Reserve:** Maintain a 3- to 6-month buffer (approx. ₹{monthly_emi * 3:,.0f}) in liquid savings to absorb unexpected cash-flow shocks."
            )

        # --- FINANCIAL BEHAVIOUR ASSESSMENT ---
        st.divider()
        st.subheader("📊 Financial Behaviour Analysis Profile")
        st.write("An in-depth evaluation of how the applicant manages debt, cash flow, and credit obligations:")

        fb_col1, fb_col2 = st.columns(2)

        with fb_col1:
            with st.container():
                st.markdown(f"#### 💳 {behaviour['cash_flow']['title']}")
                st.write(f"**Indicator:** `{behaviour['cash_flow']['metric']}` | **Status:** `{behaviour['cash_flow']['status']}`")
                st.caption(behaviour['cash_flow']['description'])

            st.write("")
            with st.container():
                st.markdown(f"#### 📋 {behaviour['credit_discipline']['title']}")
                st.write(f"**Indicator:** `{behaviour['credit_discipline']['metric']}` | **Status:** `{behaviour['credit_discipline']['status']}`")
                st.caption(behaviour['credit_discipline']['description'])

        with fb_col2:
            with st.container():
                st.markdown(f"#### ⚖️ {behaviour['leverage']['title']}")
                st.write(f"**Indicator:** `{behaviour['leverage']['metric']}` | **Status:** `{behaviour['leverage']['status']}`")
                st.caption(behaviour['leverage']['description'])

            st.write("")
            with st.container():
                st.markdown(f"#### 💼 {behaviour['employment_stability']['title']}")
                st.write(f"**Indicator:** `{behaviour['employment_stability']['metric']}` | **Status:** `{behaviour['employment_stability']['status']}`")
                st.caption(behaviour['employment_stability']['description'])

        # --- FBCE SCORE COMPONENTS & CHECKS ---
        st.divider()
        left, right = st.columns(2)

        with left:
            st.subheader("FBCE Consistency Components")
            scores_dict = fbce.get("scores", {})
            if scores_dict:
                score_df = pd.DataFrame(
                    list(scores_dict.items()),
                    columns=["Component", "Score"]
                )
                st.dataframe(score_df, use_container_width=True, hide_index=True)
                st.bar_chart(score_df.set_index("Component"))

        with right:
            st.subheader("Financial Consistency Checks")
            contradictions = fbce.get("contradictions", [])
            if contradictions:
                for item in contradictions:
                    st.warning(item)
            else:
                st.success("No major project-defined financial consistency contradiction detected.")

            st.write(f"**Debt Obligation (FOIR):** {emi_ratio_pct:.2f}% of monthly income")
            st.write(f"**Leverage Ratio:** {loan_to_annual_income:.2f}x annual income")

        st.divider()
        st.subheader("SHAP Explainability (Feature Impact)")

        try:
            preprocessor = model.named_steps["preprocessor"]
            estimator = model.named_steps["model"]
            transformed = preprocessor.transform(input_df)

            feature_names = preprocessor.get_feature_names_out()

            if model_name in ["Random Forest", "XGBoost", "LightGBM"]:
                explainer = shap.TreeExplainer(estimator)
                shap_values = explainer.shap_values(transformed)

                if isinstance(shap_values, list):
                    values = shap_values[1][0]
                else:
                    values = np.asarray(shap_values)
                    if values.ndim == 3:
                        values = values[0, :, 1]
                    elif values.ndim == 2:
                        values = values[0]

                explanation_df = pd.DataFrame({
                    "Feature": feature_names,
                    "SHAP Value": values
                })
            else:
                # Linear-model explanation.
                background = np.zeros((1, transformed.shape[1]))
                explainer = shap.LinearExplainer(estimator, background)
                shap_values = explainer.shap_values(transformed)
                values = np.asarray(shap_values)
                if values.ndim == 2:
                    values = values[0]

                explanation_df = pd.DataFrame({
                    "Feature": feature_names,
                    "SHAP Value": values
                })

            explanation_df["Absolute"] = explanation_df["SHAP Value"].abs()
            explanation_df = explanation_df.sort_values("Absolute", ascending=False).head(10)

            st.dataframe(
                explanation_df[["Feature", "SHAP Value"]],
                use_container_width=True,
                hide_index=True
            )

            fig, ax = plt.subplots(figsize=(9, 5))
            plot_df = explanation_df.sort_values("SHAP Value")
            ax.barh(plot_df["Feature"], plot_df["SHAP Value"])
            ax.axvline(0, linewidth=1)
            ax.set_xlabel("SHAP contribution")
            ax.set_title("Top SHAP Feature Contributions")
            fig.tight_layout()
            st.pyplot(fig)

            positive = explanation_df[explanation_df["SHAP Value"] > 0]
            negative = explanation_df[explanation_df["SHAP Value"] < 0]

            p1, p2 = st.columns(2)
            with p1:
                st.write("**Positive contributors (Helped Approval)**")
                if len(positive):
                    for _, row in positive.iterrows():
                        st.write(f"• {row['Feature']}: +{row['SHAP Value']:.4f}")
                else:
                    st.write("No positive contributors in the displayed top features.")

            with p2:
                st.write("**Negative contributors (Risk Factors / Caused Rejection)**")
                if len(negative):
                    for _, row in negative.iterrows():
                        st.write(f"• {row['Feature']}: {row['SHAP Value']:.4f}")
                else:
                    st.write("No negative contributors in the displayed top features.")

        except Exception as e:
            st.error("SHAP explanation could not be generated for this model/input.")
            st.code(str(e))

        st.caption(
            "For academic demonstration only. This prototype does not provide an official banking credit decision."
        )

    except Exception as e:
        st.error("Prediction failed.")
        st.code(str(e))
        st.info(
            "Make sure your dataset uses the same feature names as the common "
            "Loan Approval Prediction dataset."
        )
