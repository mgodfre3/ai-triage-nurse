import tempfile
import os
import subprocess
import shutil

from app.foundry_manager import FoundryManager


async def transcribe_audio(audio_bytes: bytes, filename: str = "recording.webm") -> str:
    """Transcribe audio bytes using Foundry Local Whisper model.

    Browsers typically record as WebM/Opus. We transcode to WAV via
    ffmpeg (installed in the Docker image) so Whisper can handle it.
    """
    manager = FoundryManager.get_instance()
    audio_client = manager.get_audio_client()

    # Infer extension from the original filename
    ext = os.path.splitext(filename)[1] or ".webm"

    # Write the raw upload to a temp file preserving original format
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(audio_bytes)
        src_path = f.name

    wav_path = src_path.replace(ext, ".wav") if ext != ".wav" else src_path

    try:
        # Transcode to WAV if needed (ffmpeg is in the Docker image)
        if ext != ".wav" and shutil.which("ffmpeg"):
            subprocess.run(
                ["ffmpeg", "-y", "-i", src_path, "-ar", "16000", "-ac", "1", wav_path],
                capture_output=True,
                timeout=15,
            )
        elif ext != ".wav":
            # No ffmpeg — try feeding the raw file and hope Whisper handles it
            wav_path = src_path

        transcription = audio_client.transcribe(wav_path)
        return transcription.text.strip()
    finally:
        for p in {src_path, wav_path}:
            try:
                os.unlink(p)
            except OSError:
                pass
