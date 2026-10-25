MAX_VALIDATION_RETRIES = 2


def run_with_validation(
    generate_fn,
    validate_fn,
    fallback_fn,
    max_retries=MAX_VALIDATION_RETRIES,
):
    """
    Generate -> validate -> retry -> deterministic fallback.

    generate_fn() returns the candidate output.
    validate_fn(candidate) returns a validation dict with 'valid'.
    fallback_fn() returns a deterministic substitute.
    """

    attempts = []
    last_output = None
    last_validation = None

    for attempt in range(max_retries + 1):
        try:
            last_output = generate_fn(attempt)
        except Exception as error:
            last_validation = {
                "valid": False,
                "status": "FAIL",
                "errors": [{
                    "type": "generation_error",
                    "items": [],
                    "message": str(error),
                    "verdict": "UNSUPPORTED",
                }],
                "claims": [],
            }
            attempts.append({
                "attempt": attempt,
                "output": None,
                "validation": last_validation,
                "error": str(error),
            })
            continue

        last_validation = validate_fn(last_output)
        attempts.append({
            "attempt": attempt,
            "output": last_output,
            "validation": last_validation,
        })
        if last_validation.get("valid"):
            return {
                "output": last_output,
                "validation": last_validation,
                "source": "llm",
                "rejected": False,
                "attempts": attempts,
            }

    fallback = fallback_fn()
    return {
        "output": fallback,
        "validation": {
            "valid": True,
            "status": "PASS",
            "errors": [],
            "claims": [],
            "note": (
                "LLM output was rejected. A deterministic evidence-based "
                "fallback was used instead. The validator checks whether "
                "generated claims are supported by structured evidence; "
                "it does not guarantee that an explanation is true."
            ),
        },
        "source": "deterministic_fallback",
        "rejected": True,
        "rejected_llm_output": last_output,
        "rejected_validation": last_validation,
        "attempts": attempts,
    }
