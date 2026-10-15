import json
from pathlib import Path

from src.behavior.behavior_agent import (
    generate_behavior_analysis
)

from src.behavior.evidence_validator import (
    validate_behavior_interpretation
)


BEHAVIOR_FILE = Path(
    "data/behavior/churn_behavior.json"
)

OUTPUT_FILE = Path(
    "data/behavior/churn_behavior_interpretation.json"
)


def main():

    print()
    print(
        "PHASE 7.1 - BEHAVIOUR INTELLIGENCE AGENT"
    )
    print("-----------------------------------------")

    with open(
        BEHAVIOR_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        behavior_data = json.load(
            file
        )

    print(
        "Generating interpretation with Qwen3..."
    )

    interpretation = generate_behavior_analysis(
        behavior_data
    )

    print()
    print(
        "Validating interpretation..."
    )

    validation = (
        validate_behavior_interpretation(
            behavior_data,
            interpretation
        )
    )

    output = {
        "agent": (
            "Churn Behaviour Intelligence Agent"
        ),
        "model": "qwen3:4b",
        "source": str(BEHAVIOR_FILE),
        "validation": validation,
        "interpretation": interpretation
    }

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            output,
            file,
            indent=4,
            ensure_ascii=False
        )

    print()

    if validation["valid"]:

        print(
            "VALIDATION STATUS: PASS"
        )

    else:

        print(
            "VALIDATION STATUS: FAIL"
        )

        print()
        print(
            "VALIDATION ERRORS"
        )
        print(
            "-----------------"
        )

        for error in validation["errors"]:

            print(
                f"[{error['type']}] "
                f"{error['message']}"
            )

            if error.get("items"):

                print(
                    f"  Items: "
                    f"{', '.join(error['items'])}"
                )

    print()
    print(
        "BEHAVIOUR INTERPRETATION"
    )
    print(
        "------------------------"
    )

    print(
        interpretation
    )

    print()
    print("Saved:")
    print(OUTPUT_FILE)


if __name__ == "__main__":
    main()