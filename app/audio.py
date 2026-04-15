import tempfile
import os

from app.foundry_manager import FoundryManager


async def transcribe_audio(audio_bytes: bytes, filename: str = "recording.wav") -> str:
    """Transcribe audio bytes using Foundry Local Whisper model."""
    manager = FoundryManager.get_instance()
    audio_client = manager.get_audio_client()

    # Write to temp file (Whisper needs a file path)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        temp_path = f.name

    try:
        transcription = audio_client.transcribe(temp_path)
        return transcription.text.strip()
    finally:
        os.unlink(temp_path)
