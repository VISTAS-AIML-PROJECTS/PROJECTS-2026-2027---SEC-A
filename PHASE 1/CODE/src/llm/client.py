import json
import re


DEFAULT_MODEL = "qwen3:4b"


def check_ollama_status(
    model=DEFAULT_MODEL
):
    """
    Safely determine whether Ollama and the requested
    model are actually available.

    Never raises for unavailable Ollama.
    """

    result = {

        "status":
            "UNAVAILABLE",

        "model":
            model,

        "reason":
            None
    }

    try:

        import ollama

    except ImportError:

        result["reason"] = (
            "The ollama Python package "
            "is not installed."
        )

        return result

    try:

        listing = ollama.list()

    except Exception as error:

        result["reason"] = (
            "Ollama is not reachable. "
            f"Details: {error}"
        )

        return result

    if isinstance(
        listing,
        dict
    ):

        models = listing.get(
            "models"
        )

    else:

        models = getattr(
            listing,
            "models",
            None
        )

    if models is None:

        result["reason"] = (
            "Ollama returned no model list."
        )

        return result

    names = set()

    for item in models:

        if isinstance(
            item,
            dict
        ):

            name = (
                item.get("name")
                or
                item.get("model")
            )

        else:

            name = (
                getattr(
                    item,
                    "model",
                    None
                )
                or
                getattr(
                    item,
                    "name",
                    None
                )
            )

        if name:

            name = str(name)

            names.add(name)

            names.add(
                name.split(":")[0]
            )

    # Ollama is reachable, but there are no models.

    if not names:

        result["reason"] = (
            "Ollama is running but no "
            "models are installed."
        )

        return result

    short_name = (
        model.split(":")[0]
    )

    if (
        model not in names
        and short_name not in names
    ):

        result["reason"] = (
            f"Ollama is running but model "
            f"'{model}' was not found."
        )

        return result

    result["status"] = "AVAILABLE"

    result["reason"] = (
        f"Model '{model}' is available."
    )

    return result


def parse_json_payload(
    text
):
    """
    Extract a JSON object or array from
    model output.
    """

    if text is None:

        raise ValueError(
            "Empty LLM output."
        )

    cleaned = str(
        text
    ).strip()

    if cleaned.startswith(
        "```"
    ):

        cleaned = re.sub(
            r"^```(?:json)?\s*",
            "",
            cleaned,
            flags=re.IGNORECASE
        )

        cleaned = re.sub(
            r"\s*```$",
            "",
            cleaned
        )

    try:

        return json.loads(
            cleaned
        )

    except json.JSONDecodeError:

        pass

    match = re.search(
        r"(\{[\s\S]*\}|\[[\s\S]*\])",
        cleaned
    )

    if not match:

        raise ValueError(
            "Could not parse JSON "
            "from LLM output."
        )

    return json.loads(
        match.group(1)
    )


def chat_text(
    prompt,
    model=DEFAULT_MODEL
):

    import ollama

    response = ollama.chat(
        model=model,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return (
        response[
            "message"
        ][
            "content"
        ]
        .strip()
    )


def chat_json(
    prompt,
    model=DEFAULT_MODEL
):

    import ollama

    try:

        response = ollama.chat(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            format="json"
        )

        content = (
            response[
                "message"
            ][
                "content"
            ]
            .strip()
        )

        return parse_json_payload(
            content
        )

    except Exception:

        content = chat_text(
            prompt,
            model=model
        )

        return parse_json_payload(
            content
        )