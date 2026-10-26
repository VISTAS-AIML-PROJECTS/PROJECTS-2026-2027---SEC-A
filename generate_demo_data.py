from pathlib import Path
import numpy as np
import pandas as pd

np.random.seed(42)
N = 800

income = np.random.lognormal(mean=8.4, sigma=0.55, size=N).astype(int)
co_income = np.random.lognormal(mean=7.0, sigma=0.8, size=N).astype(int)
loan = np.clip(np.random.normal(140, 55, N), 20, 400).round(0)
term = np.random.choice([120, 180, 240, 300, 360, 480], N)
credit = np.random.choice([0, 1], N, p=[0.18, 0.82])

education = np.random.choice(["Graduate", "Not Graduate"], N, p=[0.78, 0.22])
self_emp = np.random.choice(["Yes", "No"], N, p=[0.15, 0.85])
gender = np.random.choice(["Male", "Female"], N, p=[0.80, 0.20])
married = np.random.choice(["Yes", "No"], N, p=[0.65, 0.35])
dependents = np.random.choice(["0", "1", "2", "3+"], N, p=[0.58, 0.17, 0.16, 0.09])
property_area = np.random.choice(["Urban", "Semiurban", "Rural"], N)

# Synthetic target only for testing the software pipeline.
# It is NOT a real-world approval rule.
score = (
    1.6 * credit
    + 0.00002 * income
    + 0.00001 * co_income
    - 0.0035 * loan
    + 0.25 * (education == "Graduate")
    + 0.10 * (property_area == "Semiurban")
    + np.random.normal(0, 0.7, N)
)
prob = 1 / (1 + np.exp(-score + 2.5))
status = (prob > 0.5).astype(int)

df = pd.DataFrame({
    "Loan_ID": [f"D{100000+i}" for i in range(N)],
    "Gender": gender,
    "Married": married,
    "Dependents": dependents,
    "Education": education,
    "Self_Employed": self_emp,
    "ApplicantIncome": income,
    "CoapplicantIncome": co_income,
    "LoanAmount": loan,
    "Loan_Amount_Term": term,
    "Credit_History": credit,
    "Property_Area": property_area,
    "Loan_Status": np.where(status == 1, "Y", "N")
})

out = Path(__file__).resolve().parent / "data" / "loan_data.csv"
df.to_csv(out, index=False)
print(f"Created demo dataset: {out}")
print(df.head())
