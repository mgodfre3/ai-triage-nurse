import logging
import os
import threading

from openai import OpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Foundry Local exposes an OpenAI-compatible API at a local endpoint.
# In containerized deployments the Foundry Local service runs on the host
# (or as a DaemonSet) and the app connects via FOUNDRY_API_BASE.
#
# For local development with the Foundry Local CLI running, the default
# endpoint is http://localhost:5273/v1.
# ---------------------------------------------------------------------------

_DEFAULT_API_BASE = "http://localhost:5273/v1"


class FoundryManager:
    """Singleton manager wrapping an OpenAI-compatible client for Foundry Local."""

    _instance: "FoundryManager | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        raise RuntimeError("Use FoundryManager.get_instance() instead")

    @classmethod
    def get_instance(cls) -> "FoundryManager":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    obj = object.__new__(cls)
                    obj._initialized = False
                    obj._chat_client = None
                    obj._audio_client = None
                    obj._chat_model = None
                    obj._audio_model = None
                    obj._initialize()
                    cls._instance = obj
        return cls._instance

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------
    def _initialize(self) -> None:
        api_base = os.environ.get("FOUNDRY_API_BASE", _DEFAULT_API_BASE)
        api_key = os.environ.get("FOUNDRY_API_KEY", "foundry-local")  # placeholder key

        logger.info("Connecting to Foundry Local at %s", api_base)

        self._chat_model = os.environ.get("FOUNDRY_MODEL_CHAT", "phi-4-mini")
        self._audio_model = os.environ.get("FOUNDRY_MODEL_AUDIO", "whisper-tiny")

        self._chat_client = OpenAI(base_url=api_base, api_key=api_key)
        self._audio_client = OpenAI(base_url=api_base, api_key=api_key)

        self._initialized = True
        logger.info("FoundryManager ready — chat: %s, audio: %s",
                     self._chat_model, self._audio_model)

    # ------------------------------------------------------------------
    # Public accessors
    # ------------------------------------------------------------------
    def get_chat_client(self) -> OpenAI:
        """Return the OpenAI client for chat completions."""
        if self._chat_client is None:
            raise RuntimeError("Chat client not initialized")
        return self._chat_client

    def get_chat_model(self) -> str:
        """Return the chat model name to use in API calls."""
        return self._chat_model

    def get_audio_client(self) -> OpenAI:
        """Return the OpenAI client for audio transcription."""
        if self._audio_client is None:
            raise RuntimeError("Audio client not initialized")
        return self._audio_client

    def get_audio_model(self) -> str:
        """Return the audio model name to use in API calls."""
        return self._audio_model

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------
    def shutdown(self) -> None:
        """Reset the singleton."""
        logger.info("Shutting down FoundryManager …")
        self._chat_client = None
        self._audio_client = None
        self._initialized = False
        FoundryManager._instance = None
        logger.info("FoundryManager shutdown complete.")

