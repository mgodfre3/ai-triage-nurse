# 🏥 AI Triage Nurse — Medical Intake Simulator

> **⚠️ SIMULATION ONLY — NOT MEDICAL ADVICE**
>
> This application is a **technology demonstration** of on-device AI with
> [Foundry Local](https://github.com/microsoft/Foundry). It is **not** a medical
> device, does **not** provide real diagnoses, and must **never** be used for
> actual clinical decisions. Always consult a qualified healthcare professional.

---

## What Is This?

AI Triage Nurse is an interactive demo that simulates a hospital intake
conversation. A locally-running SLM (Phi-4-mini via Foundry Local) plays the
role of a triage nurse — gathering symptoms, asking follow-up questions, and
producing a structured summary — all without sending a single byte to the cloud.

Voice input is supported through the Whisper-tiny model, also running locally.

<!-- ![Screenshot](docs/screenshot.png) -->

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10 + |
| Foundry Local CLI | Latest (`winget install Microsoft.FoundryLocal`) |
| OS | Windows 10/11, Linux, or macOS |

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/<org>/ai-triage-nurse.git
cd ai-triage-nurse

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Pull the required models (first run only)
foundry model run phi-4-mini
foundry model run whisper-tiny

# 4. Start the server
python -m app.main
```

Open **http://localhost:8080** in your browser and start chatting.

---

## Architecture

```
┌──────────────┐  HTTP / WS   ┌──────────────────────────────────────────┐
│              │◄─────────────►│  FastAPI Server  (app/main.py)          │
│   Browser    │               │                                         │
│  (static/)   │               │  ┌──────────────┐  ┌────────────────┐  │
│              │               │  │TriageEngine  │  │ Audio Pipeline │  │
└──────────────┘               │  │  (Phi-4-mini)│  │ (Whisper-tiny) │  │
                               │  └──────┬───────┘  └───────┬────────┘  │
                               │         │                   │           │
                               │         ▼                   ▼           │
                               │  ┌──────────────────────────────────┐  │
                               │  │       Foundry Local Runtime      │  │
                               │  │     (on-device, no cloud call)   │  │
                               │  └──────────────────────────────────┘  │
                               └──────────────────────────────────────────┘
```

**Key modules:**

| Module | Purpose |
|---|---|
| `app/main.py` | FastAPI server, WebSocket handling, static file serving |
| `app/foundry_manager.py` | Singleton wrapper around the Foundry Local SDK |
| `app/triage_engine.py` | Conversation state machine & prompt management |
| `app/audio.py` | Whisper-based speech-to-text transcription |
| `app/models.py` | Pydantic data models (`WSMessage`, etc.) |
| `static/` | Front-end SPA (HTML, CSS, JS) |

---

## How to Use

### Text Chat

1. Type your symptoms into the chat box and press **Send**.
2. The AI nurse will ask clarifying questions (pain level, duration, etc.).
3. After enough information is collected it produces a **triage summary**.

### Voice Input

1. Click the **🎤 microphone** button and speak.
2. Audio is sent to the `/transcribe` endpoint (Whisper-tiny, fully local).
3. The transcribed text is automatically submitted to the chat.

---

## Demo Tips

- **Start vague** — say *"I don't feel well"* and watch the nurse probe for
  details.
- **Try urgent scenarios** — *"I'm having chest pain and trouble breathing"*
  triggers higher-urgency triage.
- **Reset anytime** — click the reset button to start a fresh session without
  reloading the page.
- **Show the network tab** — demonstrate that zero requests leave localhost.

---

## Deployment

For production-style deployments (e.g., at a conference kiosk), Kubernetes
manifests are provided under `k8s/`.

```bash
# Apply with Flux or plain kubectl
kubectl apply -k k8s/flux/
```

See [`k8s/README.md`](k8s/README.md) for details on the Flux GitOps setup.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for
details.
