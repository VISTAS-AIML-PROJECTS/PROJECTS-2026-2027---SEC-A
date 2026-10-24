from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma3:4b"


def ask_tutor(session_data, user_question):
    prompt = (
        "You are a friendly, concise music theory tutor "
        "inside a practice app called MIDISense.\n\n"

        "The student's current practice information is:\n"
        f"Notes played: {session_data.get('notesPlayed', 0)}\n"
        f"Accuracy: {session_data.get('accuracy', 0)}%\n"
        f"Session time: {session_data.get('sessionTime', 0)} seconds\n\n"

        f"The student asks: \"{user_question}\"\n\n"

        "Answer in 2-4 short sentences. "
        "Use plain language. "
        "Refer to the student's practice information when useful. "
        "Do not give a generic textbook answer."
    )

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
        },
        timeout=60,
    )

    response.raise_for_status()

    return response.json()["response"]


@app.get("/health")
def health():
    return jsonify({
        "status": "ok"
    })


@app.post("/ask")
def ask():
    data = request.get_json() or {}

    session_data = data.get(
        "session_data",
        {}
    )

    question = data.get(
        "question",
        ""
    ).strip()

    if not question:
        return jsonify({
            "error": "Question is required"
        }), 400

    try:
        answer = ask_tutor(
            session_data,
            question
        )

        return jsonify({
            "answer": answer
        })

    except requests.RequestException as error:
        return jsonify({
            "error": f"Ollama unavailable: {error}"
        }), 503

    except Exception as error:
        return jsonify({
            "error": str(error)
        }), 500


@app.post("/realtime")
def realtime():
    data = request.get_json() or {}

    analysis = data.get(
        "analysis",
        {}
    )

    prompt = (
        "You are an AI piano practice tutor.\n"
        "Give exactly ONE short coaching instruction "
        "based on the student's performance.\n\n"
        f"Performance analysis:\n{analysis}\n\n"
        "Maximum 12 words. "
        "Be specific and encouraging."
    )

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
            },
            timeout=30,
        )

        response.raise_for_status()

        return jsonify({
            "feedback":
                response.json()["response"]
        })

    except requests.RequestException as error:
        return jsonify({
            "error": f"Ollama unavailable: {error}"
        }), 503

    except Exception as error:
        return jsonify({
            "error": str(error)
        }), 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=8000,
        debug=True
    )