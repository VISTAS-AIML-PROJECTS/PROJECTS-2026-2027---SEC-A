import json
import os

from src.agents.decision_agent import (
    generate_decision
)


# --------------------------------------------------
# FILE PATHS
# --------------------------------------------------

EVIDENCE_FILE = (
    "data/agents/customer_evidence.json"
)

OUTPUT_DIR = (
    "data/agents"
)


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def run_decision_agent():

    os.makedirs(
        OUTPUT_DIR,
        exist_ok=True
    )


    # --------------------------------------------------
    # 1. LOAD CUSTOMER EVIDENCE
    # --------------------------------------------------

    with open(
        EVIDENCE_FILE,
        "r"
    ) as f:

        all_evidence = json.load(f)


    # --------------------------------------------------
    # 2. GENERATE DECISIONS
    # --------------------------------------------------

    all_decisions = []


    for evidence in all_evidence:

        print(
            f"Generating decision for row "
            f"{evidence['row_index']}..."
        )


        decision = generate_decision(
            evidence
        )


        result = {

            "row_index": evidence[
                "row_index"
            ],

            "prediction": evidence[
                "prediction"
            ],

            "probability": evidence[
                "probability"
            ],

            "risk_level": evidence[
                "risk_level"
            ],

            "decision": decision
        }


        all_decisions.append(
            result
        )


    # --------------------------------------------------
    # 3. SAVE DECISIONS
    # --------------------------------------------------

    output_file = os.path.join(
        OUTPUT_DIR,
        "customer_decisions.json"
    )


    with open(
        output_file,
        "w"
    ) as f:

        json.dump(
            all_decisions,
            f,
            indent=4
        )


    # --------------------------------------------------
    # 4. DISPLAY
    # --------------------------------------------------

    print()

    print(
        "PHASE 6 - DECISION AGENT COMPLETED"
    )

    print(
        "-----------------------------------"
    )

    print(
        f"Customers processed: "
        f"{len(all_decisions)}"
    )

    print()


    for result in all_decisions:

        print(
            f"Customer/Test Row: "
            f"{result['row_index']}"
        )

        print(
            f"Prediction: "
            f"{result['prediction']}"
        )

        print(
            f"Probability: "
            f"{result['probability']:.4f}"
            if result["probability"] is not None
            else "Probability: N/A"
        )

        print(
            f"Risk: "
            f"{result['risk_level']}"
        )

        print()

        print(
            result["decision"]
        )

        print()

        print(
            "-" * 60
        )


    print()

    print("Saved:")

    print(
        output_file
    )


    return all_decisions


# --------------------------------------------------
# RUN
# --------------------------------------------------

if __name__ == "__main__":

    run_decision_agent()