import math

def clamp(value, low=0.0, high=100.0):
    return max(low, min(high, float(value)))

def normalize_loan_amount(loan_amount):
    """Accepts loan amount either in real currency (e.g. 100000 for 1 Lakh) or in thousands (e.g. 100)."""
    val = float(loan_amount)
    return val * 1000.0 if val < 1000 else val

def income_consistency(total_income, loan_amount):
    if total_income <= 0:
        return 0.0
    actual_loan = normalize_loan_amount(loan_amount)
    annual_income = total_income * 12.0
    ratio = actual_loan / annual_income if annual_income > 0 else 999.0
    # A loan-to-annual-income ratio below 4x is healthy
    return clamp(100 * (1 - min(ratio / 5.0, 1.0)))

def debt_consistency(total_income, loan_amount):
    if total_income <= 0:
        return 0.0
    actual_loan = normalize_loan_amount(loan_amount)
    burden = actual_loan / total_income
    # Burden vs monthly income
    return clamp(100 * (1 - min(burden / 40.0, 1.0)))

def employment_stability(self_employed, employment_years=None):
    if employment_years is not None:
        return clamp(30 + min(float(employment_years), 10) * 7)

    value = str(self_employed).strip().lower()
    if value in ("no", "not self employed", "salaried"):
        return 75.0
    if value in ("yes", "self employed"):
        return 65.0
    return 55.0

def credit_consistency(credit_history):
    try:
        value = float(credit_history)
    except Exception:
        value = 0.0
    return 90.0 if value >= 1 else 30.0

def repayment_capacity(total_income, loan_amount, loan_term_months, annual_interest_rate=10.0):
    if total_income <= 0 or loan_amount <= 0 or loan_term_months <= 0:
        return 0.0

    actual_loan = normalize_loan_amount(loan_amount)
    r = (annual_interest_rate / 100.0) / 12.0
    n = float(loan_term_months)

    if r == 0:
        emi = actual_loan / max(n, 1.0)
    else:
        emi = actual_loan * r * ((1 + r) ** n) / (((1 + r) ** n) - 1)

    emi_ratio = emi / total_income
    # Sustainable EMI is typically under 40-50% of income
    return clamp(100 * (1 - min(emi_ratio / 0.50, 1.0)))

def calculate_fbce(
    applicant_income,
    coapplicant_income,
    loan_amount,
    loan_term_months,
    credit_history,
    self_employed,
    annual_interest_rate=10.0,
    employment_years=None
):
    total_income = float(applicant_income) + float(coapplicant_income)
    actual_loan = normalize_loan_amount(loan_amount)
    annual_income = total_income * 12.0
    term_months = float(loan_term_months) if float(loan_term_months) > 0 else 360.0

    r = (annual_interest_rate / 100.0) / 12.0
    if r == 0:
        monthly_emi = actual_loan / max(term_months, 1.0)
    else:
        monthly_emi = actual_loan * r * ((1 + r) ** term_months) / (((1 + r) ** term_months) - 1)

    emi_ratio = (monthly_emi / total_income) if total_income > 0 else 1.0
    emi_ratio_pct = emi_ratio * 100.0
    loan_to_annual_income = (actual_loan / annual_income) if annual_income > 0 else 0.0

    scores = {
        "Income Consistency": income_consistency(total_income, loan_amount),
        "Debt Consistency": debt_consistency(total_income, loan_amount),
        "Employment Stability": employment_stability(self_employed, employment_years),
        "Credit Consistency": credit_consistency(credit_history),
        "Repayment Capacity": repayment_capacity(
            total_income, loan_amount, loan_term_months, annual_interest_rate
        ),
    }

    fbce_score = sum(scores.values()) / len(scores)

    if fbce_score >= 80:
        risk = "High Consistency"
    elif fbce_score >= 60:
        risk = "Moderate Consistency"
    elif fbce_score >= 40:
        risk = "Low Consistency"
    else:
        risk = "Very Low Consistency"

    contradictions = []
    if total_income <= 0:
        contradictions.append("Reported total income is zero or unavailable.")
    elif emi_ratio > 0.50:
        contradictions.append(
            f"High Debt Stress: Estimated EMI of ₹{monthly_emi:,.0f}/mo consumes {emi_ratio_pct:.1f}% of total monthly income (recommended: < 40%)."
        )
    elif loan_to_annual_income > 5.0:
        contradictions.append(
            f"High Leverage: Requested loan of ₹{actual_loan:,.0f} is {loan_to_annual_income:.1f}x the annual income."
        )

    if float(credit_history) < 1:
        contradictions.append(
            "Credit History Deficit: Credit history is marked weak or unavailable (high historical default risk)."
        )

    # Detailed Financial Behaviour Profile
    behaviour_analysis = {
        "cash_flow": {
            "title": "Monthly Cash Flow & Debt Obligation (FOIR)",
            "metric": f"₹{monthly_emi:,.0f} / month ({emi_ratio_pct:.1f}% of income)",
            "status": "Healthy" if emi_ratio <= 0.35 else ("Moderate" if emi_ratio <= 0.50 else "High Stress"),
            "description": (
                f"Applicant requires an estimated monthly EMI of ₹{monthly_emi:,.0f}, which consumes {emi_ratio_pct:.1f}% of "
                f"total monthly income (₹{total_income:,.0f}). Standard banking benchmarks recommend debt obligations stay under 40%."
            )
        },
        "leverage": {
            "title": "Debt Exposure vs Annual Earnings",
            "metric": f"{loan_to_annual_income:.1f}x Annual Income",
            "status": "Conservative" if loan_to_annual_income <= 3.0 else ("Moderate" if loan_to_annual_income <= 5.0 else "Aggressive"),
            "description": (
                f"The requested loan of ₹{actual_loan:,.0f} represents {loan_to_annual_income:.1f} times the household's "
                f"annual earnings of ₹{annual_income:,.0f}."
            )
        },
        "credit_discipline": {
            "title": "Credit Discipline & Past Reliability",
            "metric": "Good / Verified (1.0)" if float(credit_history) >= 1 else "Adverse / Missing (0.0)",
            "status": "Positive" if float(credit_history) >= 1 else "Critical Risk",
            "description": (
                "The applicant demonstrates a proven track record of timely credit repayment with zero reported institutional defaults."
                if float(credit_history) >= 1 else
                "Past credit history indicates prior loan defaults, irregular payments, or absence of credit bureau records. This is the primary driver of automated loan rejection."
            )
        },
        "employment_stability": {
            "title": "Income & Career Stability",
            "metric": "Salaried Professional" if str(self_employed).strip().lower() in ("no", "salaried", "not self employed") else "Self-Employed / Business",
            "status": "Stable" if str(self_employed).strip().lower() in ("no", "salaried", "not self employed") else "Variable Income",
            "description": (
                "Salaried employment provides consistent, predictable monthly cash inflows to service scheduled obligations."
                if str(self_employed).strip().lower() in ("no", "salaried", "not self employed") else
                "Self-employed individuals face higher revenue variability; lenders evaluate business vintage and demand wider repayment margins."
            )
        }
    }

    # Reasons for Rejection (Why the loan is rejected)
    rejection_reasons = []
    if float(credit_history) < 1:
        rejection_reasons.append(
            "🔴 **Adverse or Missing Credit History (Primary Driver):** The applicant lacks a clean past repayment record. In banking algorithms, credit history is the single strongest predictor of future default."
        )
    if emi_ratio > 0.45:
        rejection_reasons.append(
            f"🔴 **Excessive EMI-to-Income Ratio ({emi_ratio_pct:.1f}%):** Monthly EMI of ₹{monthly_emi:,.0f} absorbs {emi_ratio_pct:.1f}% of monthly income. Sustainable banking limit is typically 40% to 50%."
        )
    if loan_to_annual_income > 5.0:
        rejection_reasons.append(
            f"🔴 **Disproportionate Loan-to-Income Exposure ({loan_to_annual_income:.1f}x):** Requested loan of ₹{actual_loan:,.0f} is more than 5 times the annual income of ₹{annual_income:,.0f}."
        )
    if total_income < 10000:
        rejection_reasons.append(
            f"🔴 **Low Total Household Income (₹{total_income:,.0f}):** Inadequate baseline income leaves insufficient margin to absorb unexpected expenses while repaying debt."
        )
    if str(self_employed).strip().lower() in ("yes", "self employed") and emi_ratio > 0.30:
        rejection_reasons.append(
            "🔴 **Self-Employment Cash Flow Risk:** Business income volatility paired with substantial loan commitments elevates repayment risk."
        )

    # Reasons for Approval (Why the loan is approved)
    approval_factors = []
    if float(credit_history) >= 1:
        approval_factors.append(
            "🟢 **Excellent Credit History (Primary Driver):** Documented history of timely repayments provides high statistical confidence that the applicant will honor future obligations."
        )
    if emi_ratio <= 0.35:
        approval_factors.append(
            f"🟢 **Comfortable Debt-to-Income Margin ({emi_ratio_pct:.1f}% FOIR):** Monthly EMI of ₹{monthly_emi:,.0f} leaves {100 - emi_ratio_pct:.1f}% of monthly income for household expenses and discretionary savings."
        )
    if loan_to_annual_income <= 3.5:
        approval_factors.append(
            f"🟢 **Prudent Borrowing Level ({loan_to_annual_income:.1f}x Annual Income):** Requested loan size (₹{actual_loan:,.0f}) is conservative and easily serviceable over {int(term_months)} months."
        )
    if total_income >= 25000:
        approval_factors.append(
            f"🟢 **Robust Household Cash Flow (₹{total_income:,.0f}/mo):** Sufficient earning cushion to withstand economic fluctuations."
        )
    if str(self_employed).strip().lower() in ("no", "salaried", "not self employed"):
        approval_factors.append(
            "🟢 **Stable Salaried Income Stream:** Predictable periodic salary minimizes repayment disruption risk."
        )

    # Actionable Recommendations for Applicant
    recommendations = []
    if float(credit_history) < 1:
        recommendations.append(
            "💡 **Rebuild Credit Score:** Settle any outstanding debts or delinquent accounts. Maintain timely utility/card payments for at least 6–12 months or consider a fixed-deposit backed credit card."
        )
    if emi_ratio > 0.35:
        recommendations.append(
            "💡 **Add an Earning Co-applicant:** Adding a working spouse, parent, or family member combines income streams and significantly lowers the debt-to-income ratio."
        )
        recommendations.append(
            "💡 **Extend Repayment Tenure:** Selecting a longer loan term (e.g., 240 or 360 months) lowers monthly EMI obligations into a safer percentage range."
        )
    if loan_to_annual_income > 4.0:
        target_loan = annual_income * 3.0
        recommendations.append(
            f"💡 **Reduce Loan Amount:** Lower the requested principal to approximately ₹{target_loan:,.0f} to match institutional affordability norms."
        )
    if str(self_employed).strip().lower() in ("yes", "self employed"):
        recommendations.append(
            "💡 **Provide Supplementary Financial Proofs:** Provide audited ITR filings, bank statements showing steady business cash flow, or liquid collateral to strengthen approval likelihood."
        )

    return {
        "scores": scores,
        "fbce_score": round(fbce_score, 2),
        "risk_level": risk,
        "total_income": round(total_income, 2),
        "contradictions": contradictions,
        "actual_loan_amount": actual_loan,
        "monthly_emi": round(monthly_emi, 2),
        "emi_ratio_pct": round(emi_ratio_pct, 2),
        "loan_to_annual_income": round(loan_to_annual_income, 2),
        "financial_behaviour": behaviour_analysis,
        "rejection_reasons": rejection_reasons,
        "approval_factors": approval_factors,
        "recommendations": recommendations,
    }
