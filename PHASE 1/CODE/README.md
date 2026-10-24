# MIDISense — AI-Powered Piano Learning and Music Production

## Project Overview

MIDISense is a web-based application designed to help users learn piano, practise musical skills, analyse MIDI performance, and create music. It combines interactive lessons, performance feedback, and an AI-powered tutor in one platform.

## Main Features

- **User Authentication:** Supports account registration and login using Firebase Authentication.
- **Personalised Onboarding:** Collects the user's instrument, goals, skill level, and practice preferences.
- **Piano Lessons:** Provides beginner-friendly lessons and tracks learning progress.
- **MIDI Performance Analysis:** Analyses note accuracy, timing, and velocity using MIDI input and analysis logic.
- **AI Music Tutor:** Provides practice guidance using a locally running language model through Ollama.
- **Music Production:** Includes a sequencer and piano-roll interface for creating musical patterns.
- **Progress Tracking:** Uses Firebase services to store relevant user and learning information.

## Technologies Used

- **Frontend:** React, Vite, JavaScript, HTML, CSS
- **Backend:** Python and Flask
- **Music Input:** Web MIDI API
- **AI Tutor:** Ollama with Gemma 3:4b
- **Authentication and Data:** Firebase Authentication and Cloud Firestore
- **Version Control:** Git and GitHub

## Project Structure

```text
CODE/
├── backend/
│   ├── app.py
│   └── ollama_tutor_test.py
├── docs/
│   └── GIT_WORKFLOW.md
├── frontend/
│   ├── analysis-engine.js
│   ├── analysis-engine.test.js
│   ├── midi_test.html
│   ├── practice_view.html
│   └── midisense-app/
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── .env.example
├── .gitignore
└── README.md
```

## Requirements

Install the following before running the application:

- Python 3
- Node.js and npm
- Ollama
- A compatible web browser
- A MIDI keyboard for physical MIDI input (optional for exploring the interface)

## Running the Application

### 1. Start the AI Tutor service

Install Ollama from https://ollama.com/download, then download the required model:

```bash
ollama run gemma3:4b
```

Keep Ollama running when testing the AI Tutor.

### 2. Start the Python backend

Open a terminal in the project `CODE` directory:

```bash
cd backend
python app.py
```

### 3. Start the React frontend

Open another terminal in the project `CODE` directory:

```bash
cd frontend/midisense-app
npm install
npm run dev
```

Open the local URL displayed by Vite, usually `http://localhost:5173`.

### 4. Configure Firebase

Use `frontend/midisense-app/.env.example` as a template for your Firebase configuration. Create a local `.env` file and enter the appropriate configuration values. Never commit `.env` or other files containing private credentials.

## MIDI Analysis Test

To test the analysis engine independently, run:

```bash
cd frontend
node analysis-engine.test.js
```

For physical MIDI input, connect a compatible MIDI keyboard and use a browser that supports the Web MIDI API.

## Project Status

The Phase 1 implementation includes the React application, learning and practice interfaces, MIDI analysis functionality, AI Tutor integration, and music production interface. Hardware-dependent MIDI testing and other future improvements should be documented separately as they are completed.

## Team Submission

This project is submitted under **Team-15**. The source code is maintained in this folder. The final report and presentation should be placed in their respective submission folders.

