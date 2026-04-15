"""AI Triage Nurse — FastAPI server for the medical intake simulator demo."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

# Load .env file if present (for local development)
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import uvicorn
from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.audio import transcribe_audio
from app.foundry_manager import FoundryManager
from app.models import WSMessage
from app.triage_engine import TriageSession

logger = logging.getLogger(__name__)
LOG_LEVEL = os.environ.get("LOG_LEVEL", "info").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Initialize the FoundryManager singleton on startup."""
    logger.info("Starting FoundryManager initialization …")
    FoundryManager.get_instance()  # sync singleton — blocks until models are loaded
    logger.info("FoundryManager initialized — models ready")
    yield
    FoundryManager.get_instance().shutdown()


app = FastAPI(
    title="AI Triage Nurse",
    description="Medical intake simulator powered by Foundry Local",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static files — register GLTF MIME types so 3D models load correctly
# ---------------------------------------------------------------------------
import mimetypes
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
async def index():
    """Serve the front-end SPA."""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health():
    """Simple liveness probe."""
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile):
    """Transcribe an uploaded audio file to text."""
    audio_bytes = await file.read()
    text = await transcribe_audio(audio_bytes)
    return {"text": text}


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session = TriageSession()

    try:
        while True:
            payload = await ws.receive_json()
            msg_type = payload.get("type")

            if msg_type == "reset":
                session = TriageSession()
                await ws.send_json(
                    WSMessage(type="session_reset", data={}).model_dump()
                )

            elif msg_type == "chat":
                text = payload.get("text", "")
                async for msg in session.process_message(text):
                    await ws.send_json(msg.model_dump())

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as exc:
        logger.exception("WebSocket error")
        try:
            await ws.send_json(
                WSMessage(
                    type="error", data={"message": str(exc)}
                ).model_dump()
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("APP_PORT", "8080"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
