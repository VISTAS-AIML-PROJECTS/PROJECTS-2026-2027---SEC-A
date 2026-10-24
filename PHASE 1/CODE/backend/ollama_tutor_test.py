"""
MIDISense — LLM Tutor: Ollama Integration Starter (Phase 1)

Purpose: confirm a free, open-source LLM is running locally via Ollama and can
respond to a grounded prompt built from sample MIDI session data, before wiring
this into the real feedback/analysis pipeline.

Setup (do this once):
    1. Install Ollama: https://ollama.com/download
    2. Pull a small model:
           ollama run gemma3:4b
       (or: ollama run qwen3:4b)
    3. Leave Ollama running in the background (it serves a local API at
       http://localhost:11434 automatically).

Then run this script:
    python ollama_tutor_test.py
"""

import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma3:4b"   # swap to "qwen3:4b" if you pulled that instead


def ask_tutor(session_data: str, user_question: str) -> str:
    """
    Sends a grounded prompt to the local Ollama model.

    session_data: a plain-language summary of what the user just played
                  (this will later come from the real performance analysis engine)
    user_question: whatever the user typed into the tutor chat
    """
    prompt = (
        "You are a friendly, concise music theory tutor inside a practice app called MIDISense.\n"
        "The student just played the following on their MIDI keyboard:\n"
        f"{session_data}\n\n"
        f"The student asks: \"{user_question}\"\n\n"
        "Answer in 2-4 sentences, in plain language, referring directly to what they just played. "
        "Do not give a generic textbook answer — ground your explanation in their specific playing."
    )

    response = requests.post(
        OLLAMA_URL,
        json={"model": MODEL_NAME, "prompt": prompt, "stream": False},
        timeout=60,
    )
    response.raise_for_status()
    return response.json()["response"]


if __name__ == "__main__":
    # Sample placeholder data — replace with real analysis engine output once
    # Person A's Phase 1 work is ready.
    sample_session = (
        "Played a chord progression: C major, then G major, then A minor, then F major. "
        "The G major chord landed roughly 60ms behind the beat. Overall timing accuracy: 82%."
    )
    sample_question = "Why does this progression feel unresolved at the end?"

    print("Sending grounded prompt to local Ollama model...\n")
    answer = ask_tutor(sample_session, sample_question)
    print("Tutor response:\n")
    print(answer)
