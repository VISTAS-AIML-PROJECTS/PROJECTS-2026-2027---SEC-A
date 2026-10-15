import argparse
import json
import os
from pathlib import Path


from src.preprocessing.pipeline import (
    run_preprocessing
)

from src.modeling.run_modeling import (
    run_modeling
)

from src.explainability.run_explainability import (
    run_explainability
)

from src.agents.run_agent import (
    run_agent
)

from src.behavior.run_behavior_analysis import (
    run_behavior_analysis
)

from src.agents.orchestrate_llm import (
    run_behavior_agent_validated,
    run_explanations_validated,
    run_decisions_validated,
    save_json,
)

from src.behavior.consistency import (
    behaviour_shap_consistency
)

from src.input_manager import (
    prepare_input
)


# ============================================================
# CONSTANTS
# ============================================================

REPORT_DIR = Path(
    "data/reports"
)

BEHAVIOR_DIR = Path(
    "data/behavior"
)

AGENT_DIR = Path(
    "data/agents"
)

EXPLAINABILITY_DIR = Path(
    "data/explainability"
)

METADATA_DIR = Path(
    "data/metadata"
)

MODELING_DIR = Path(
    "data/modeling"
)


# ============================================================
# JSON HELPERS
# ============================================================

def load_json(path):
    """
    Load JSON file safely.
    """

    path = Path(path)

    if not path.exists():

        raise FileNotFoundError(
            f"Required JSON file not found: {path}"
        )

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


# ============================================================
# CLI
# ============================================================

def build_parser():

    parser = argparse.ArgumentParser(
        description=(
            "MINE - Explainable AI Customer "
            "Churn and Decision-Support System"
        )
    )

    input_group = (
        parser.add_mutually_exclusive_group()
    )

    # --------------------------------------------------------
    # SINGLE DATASET
    # --------------------------------------------------------

    input_group.add_argument(
        "--input",
        default=None,
        help=(
            "Single input dataset. "
            "Supported formats: CSV, XLSX, XLS."
        )
    )

    # --------------------------------------------------------
    # DIRECTORY
    # --------------------------------------------------------

    input_group.add_argument(
        "--input-dir",
        default=None,
        help=(
            "Directory containing one or more "
            "related company datasets. "
            "Supported formats: CSV, XLSX, XLS."
        )
    )

    # --------------------------------------------------------
    # ZIP
    # --------------------------------------------------------

    input_group.add_argument(
        "--input-zip",
        default=None,
        help=(
            "ZIP archive containing one or more "
            "related company datasets. "
            "Supported formats: CSV, XLSX, XLS."
        )
    )

    # --------------------------------------------------------
    # TARGET
    # --------------------------------------------------------

    parser.add_argument(
        "--target",
        default=None,
        help=(
            "Target column. If omitted, MINE will "
            "attempt automatic target detection."
        )
    )

    # --------------------------------------------------------
    # COLAB UPLOAD
    # --------------------------------------------------------

    parser.add_argument(
        "--upload",
        action="store_true",
        help=(
            "Open an interactive Google Colab "
            "ZIP upload dialog."
        )
    )

    return parser


# ============================================================
# OUTPUT DIRECTORY SETUP
# ============================================================

def prepare_output_directories():

    directories = [

        METADATA_DIR,

        MODELING_DIR,

        EXPLAINABILITY_DIR,

        BEHAVIOR_DIR,

        AGENT_DIR,

        REPORT_DIR,
    ]

    for directory in directories:

        directory.mkdir(
            parents=True,
            exist_ok=True
        )


# ============================================================
# PIPELINE
# ============================================================

def run_pipeline(
    input_file,
    target_column
):

    print(
        "\n" + "=" * 70
    )

    print(
        "MINE - COMPLETE EXPLAINABLE "
        "CHURN PIPELINE"
    )

    print(
        "=" * 70
    )

    print(
        f"\n[INPUT] Dataset: {input_file}"
    )

    if target_column:

        print(
            f"[INPUT] Target: {target_column}"
        )

    else:

        print(
            "[INPUT] Target: "
            "Automatic detection"
        )

    # ========================================================
    # PHASE 2
    # ========================================================

    print(
        "\n[PHASE 2] "
        "Data preprocessing and quality analysis"
    )

    run_preprocessing(
        input_file=input_file,
        target_column=target_column,
    )

    print(
        "\n[PHASE 2] "
        "Preprocessing completed"
    )

    # ========================================================
    # PHASE 3
    # ========================================================

    print(
        "\n[PHASE 3] "
        "Model training and evaluation"
    )

    modeling_result = run_modeling()

    print(
        "\n[PHASE 3] "
        "Modeling completed"
    )

    # ========================================================
    # PHASE 4
    # ========================================================

    print(
        "\n[PHASE 4] "
        "SHAP explainability"
    )

    shap_result = run_explainability()

    print(
        "\n[PHASE 4] "
        "SHAP explainability completed"
    )

    # ========================================================
    # PHASE 5
    # ========================================================

    print(
        "\n[PHASE 5] "
        "Customer evidence generation"
    )

    evidence_result = run_agent()

    print(
        "\n[PHASE 5] "
        "Customer evidence completed"
    )

    # ========================================================
    # PHASE 6
    # ========================================================

    print(
        "\n[PHASE 6] "
        "Churn behaviour analysis"
    )

    behavior_data = (
        run_behavior_analysis()
    )

    print(
        "\n[PHASE 6] "
        "Churn behaviour analysis completed"
    )

    # ========================================================
    # PHASE 7
    # ========================================================

    print(
        "\n[PHASE 7] "
        "Behaviour Intelligence Agent"
    )

    behavior_agent_result = (
        run_behavior_agent_validated(
            behavior_data
        )
    )

    behavior_interpretation_file = (
        BEHAVIOR_DIR
        / "churn_behavior_interpretation.json"
    )

    save_json(
        str(
            behavior_interpretation_file
        ),
        behavior_agent_result,
    )

    print(
        "\n[PHASE 7] "
        "Behaviour Intelligence Agent completed"
    )

    # ========================================================
    # PHASE 8
    # ========================================================

    print(
        "\n[PHASE 8] "
        "Validated customer explanations"
    )

    evidence_file = (
        AGENT_DIR
        / "customer_evidence.json"
    )

    explanations_file = (
        AGENT_DIR
        / "customer_explanations.json"
    )

    decisions_file = (
        AGENT_DIR
        / "customer_decisions.json"
    )

    # --------------------------------------------------------
    # LOAD EVIDENCE
    # --------------------------------------------------------

    if not evidence_file.exists():

        raise FileNotFoundError(
            "Customer evidence was not generated: "
            f"{evidence_file}"
        )

    evidence = load_json(
        evidence_file
    )

    # --------------------------------------------------------
    # EXPLANATIONS
    # --------------------------------------------------------

    explanation_results = (
        run_explanations_validated(
            evidence
        )
    )

    save_json(
        str(
            explanations_file
        ),
        explanation_results,
    )

    print(
        "[PHASE 8] "
        "Validated explanations completed"
    )

    # --------------------------------------------------------
    # DECISIONS
    # --------------------------------------------------------

    explanations = (
        explanation_results.get(
            "explanations",
            []
        )
    )

    decision_results = (
        run_decisions_validated(
            explanations
        )
    )

    save_json(
        str(
            decisions_file
        ),
        decision_results,
    )

    print(
        "[PHASE 8] "
        "Validated decisions completed"
    )

    # ========================================================
    # PHASE 9
    # ========================================================

    print(
        "\n[PHASE 9] "
        "Behaviour-SHAP consistency"
    )

    shap_file = (
        EXPLAINABILITY_DIR
        / "aggregated_global_shap.csv"
    )

    try:

        import pandas as pd

        if not shap_file.exists():

            raise FileNotFoundError(
                f"SHAP file not found: {shap_file}"
            )

        aggregated_global_shap = (
            pd.read_csv(
                shap_file
            )
        )

        consistency_result = (
            behaviour_shap_consistency(
                behavior_data,
                aggregated_global_shap,
                k=5,
            )
        )

    except Exception as exc:

        print(
            "Warning: Behaviour-SHAP consistency "
            f"could not be calculated: {exc}"
        )

        consistency_result = {

            "status":
                "ERROR",

            "error":
                str(exc),
        }

    consistency_file = (
        REPORT_DIR
        / "behavior_shap_consistency.json"
    )

    save_json(
        str(
            consistency_file
        ),
        consistency_result,
    )

    print(
        "[PHASE 9] "
        "Behaviour-SHAP consistency completed"
    )

    # ========================================================
    # PHASE 10
    # ========================================================

    print(
        "\n[PHASE 10] "
        "LLM A/B evaluation"
    )

    from src.evaluation.ab_evaluation import (
        run_ab_evaluation
    )

    ab_result = run_ab_evaluation(
        behavior_data,
        behavior_agent_result,
        explanation_results,
        decision_results,
        output_dir=str(
            REPORT_DIR
        ),
    )

    ab_file = (
        REPORT_DIR
        / "ab_evaluation.json"
    )

    save_json(
        str(
            ab_file
        ),
        ab_result,
    )

    print(
        "[PHASE 10] "
        "LLM A/B evaluation completed"
    )

    # ========================================================
    # COMPLETION
    # ========================================================

    print(
        "\n" + "=" * 70
    )

    print(
        "MINE PIPELINE COMPLETED"
    )

    print(
        "=" * 70
    )

    print(
        "\nGenerated core outputs:"
    )

    outputs = [

        METADATA_DIR
        / "data_profile.json",

        METADATA_DIR
        / "feature_metadata.json",

        MODELING_DIR
        / "modeling_results.json",

        MODELING_DIR
        / "model_comparison.csv",

        MODELING_DIR
        / "test_predictions.csv",

        EXPLAINABILITY_DIR
        / "global_shap.csv",

        EXPLAINABILITY_DIR
        / "local_shap.csv",

        EXPLAINABILITY_DIR
        / "aggregated_global_shap.csv",

        EXPLAINABILITY_DIR
        / "aggregated_local_shap.csv",

        EXPLAINABILITY_DIR
        / "shap_results.json",

        BEHAVIOR_DIR
        / "churn_behavior.json",

        BEHAVIOR_DIR
        / "churn_behavior_interpretation.json",

        AGENT_DIR
        / "customer_evidence.json",

        AGENT_DIR
        / "customer_explanations.json",

        AGENT_DIR
        / "customer_decisions.json",

        REPORT_DIR
        / "behavior_shap_consistency.json",

        REPORT_DIR
        / "ab_evaluation.json",
    ]

    existing = 0

    for output in outputs:

        if output.exists():

            print(
                f"  [OK] {output}"
            )

            existing += 1

        else:

            print(
                f"  [MISSING] {output}"
            )

    print(
        f"\nOutput summary: "
        f"{existing}/{len(outputs)} "
        "expected files present."
    )

    return {

        "status":
            "COMPLETED",

        "modeling":
            modeling_result,

        "shap":
            shap_result,

        "evidence":
            evidence_result,

        "behavior":
            behavior_data,

        "behavior_agent":
            behavior_agent_result,

        "explanations":
            explanation_results,

        "decisions":
            decision_results,

        "consistency":
            consistency_result,

        "ab_evaluation":
            ab_result,
    }


# ============================================================
# MAIN
# ============================================================

def main():

    parser = build_parser()

    args = parser.parse_args()

    # --------------------------------------------------------
    # OUTPUT DIRECTORIES
    # --------------------------------------------------------

    prepare_output_directories()

    # --------------------------------------------------------
    # INPUT MANAGEMENT
    # --------------------------------------------------------

    input_info = prepare_input(
        input_file=args.input,
        input_dir=args.input_dir,
        input_zip=args.input_zip,
        interactive=args.upload,
    )

    input_mode = input_info[
        "mode"
    ]

    input_path = input_info[
        "path"
    ]

    print(
        "\n[INPUT] Mode: "
        f"{input_mode}"
    )

    print(
        "[INPUT] Path: "
        f"{input_path}"
    )

    # ========================================================
    # PHASE 1
    # MULTI-DATASET INTEGRATION
    # ========================================================

    if input_mode in {
        "directory",
        "zip",
        "zip_upload",
    }:

        from src.data_integration.integration_pipeline import (
            run_integration
        )

        print(
            "\n" + "=" * 70
        )

        print(
            "MINE - MULTI-DATASET INTEGRATION"
        )

        print(
            "=" * 70
        )

        print(
            "\n[PHASE 1] "
            "Company dataset discovery "
            "and integration"
        )

        # ----------------------------------------------------
        # TARGET HINT
        # ----------------------------------------------------

        integration_target = (
            args.target
            if args.target
            else "churn"
        )

        # ----------------------------------------------------
        # INTEGRATE
        # ----------------------------------------------------

        input_file = run_integration(
            input_dir=input_path,
            target_column=integration_target,
            output_csv=(
                "data/processed/"
                "integrated_dataset.csv"
            ),
            metadata_path=(
                "data/metadata/"
                "integration_metadata.json"
            ),
        )

        print(
            "\n[PHASE 1] "
            "Integration completed"
        )

        print(
            "[OK] Integrated dataset: "
            f"{input_file}"
        )

        print(
            "[OK] Integration metadata: "
            "data/metadata/"
            "integration_metadata.json"
        )

    else:

        input_file = input_path

    # ========================================================
    # TARGET
    # ========================================================

    target_column = (
        args.target
        if args.target
        else None
    )

    # ========================================================
    # RUN PIPELINE
    # ========================================================

    try:

        result = run_pipeline(
            input_file=input_file,
            target_column=target_column,
        )

        return result

    except KeyboardInterrupt:

        print(
            "\n\n[MINE] Pipeline interrupted "
            "by user."
        )

        return {

            "status":
                "INTERRUPTED"
        }

    except Exception as exc:

        print(
            "\n\n" + "=" * 70
        )

        print(
            "MINE PIPELINE FAILED"
        )

        print(
            "=" * 70
        )

        print(
            f"\nError: {exc}"
        )

        print(
            "\nThe pipeline stopped to prevent "
            "invalid downstream results."
        )

        raise


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()