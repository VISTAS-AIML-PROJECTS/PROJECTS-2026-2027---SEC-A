# Explainable Loan Prediction using Financial Behaviour Consistency Engine (FBCE)

## Project idea

This project combines:

1. Machine learning loan prediction
2. Financial Behaviour Consistency Engine (FBCE)
3. SHAP-based explainability
4. Streamlit dashboard

The FBCE prototype contains five components:

- Income Consistency
- Debt Consistency
- Employment Stability
- Credit Consistency
- Repayment Capacity

The final FBCE score is normalized to a 0–100 style project score.

## Important dataset note

The common Kaggle Loan Approval Prediction dataset does not contain an explicit existing-debt column or employment-duration column.

Therefore:

- Debt Consistency uses requested-loan burden as an academic proxy.
- Employment Stability uses the available Self_Employed field unless employment years are added.

Do not describe these as real banking standards.

## Folder structure

```text
FBCE_Loan_Prediction/
│
├── app.py
├── fbce.py
├── train_model.py
├── generate_demo_data.py
├── requirements.txt
├── README.md
│
├── data/
│   └── loan_data.csv
│
└── models/
    ├── fbce_model.pkl
    └── model_results.csv
```

## Step 1: Install Python

Use Python 3.10 or 3.11 for an easier student setup.

## Step 2: Install libraries

Open CMD inside the project folder:

```bash
pip install -r requirements.txt
```

## Step 3: Add dataset

Download a public Loan Approval Prediction dataset from Kaggle and place the CSV here:

```text
data/loan_data.csv
```

The training script expects a target column named `Loan_Status` (Y/N) or one of the documented alternatives.

## Step 4: Train all models

```bash
python train_model.py
```

The program compares:

- Logistic Regression
- Random Forest
- XGBoost
- LightGBM

It saves the best model based primarily on F1 score and then accuracy.

## Step 5: Start the dashboard

```bash
# If 'streamlit' is recognized in your PATH:
streamlit run app.py

# If you get 'streamlit is not recognized' on Windows:
python -m streamlit run app.py
```

## If you do not have the dataset yet

You can create a synthetic demo dataset:

```bash
python generate_demo_data.py
python train_model.py
streamlit run app.py
```

The synthetic data is only for testing the software pipeline and must not be presented as real banking data or real-world accuracy evidence.

## Outputs

The dashboard shows:

- Loan prediction
- Approval probability
- FBCE score
- Five FBCE component scores
- Consistency warnings
- SHAP feature contributions
- Positive and negative contributors

## Academic disclaimer

This is an academic prototype for explainable decision support. The FBCE score and thresholds are project-defined and are not official banking credit standards.
