import logging
import os
import threading

from foundry_local_sdk import FoundryLocalManager, Configuration

logger = logging.getLogger(__name__)


class FoundryManager:
    """Singleton manager for Foundry Local chat and audio models."""

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
                    obj._chat_model = None
                    obj._audio_model = None
                    obj._manager = None
                    obj._initialize()
                    cls._instance = obj
        return cls._instance

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------
    def _initialize(self) -> None:
        logger.info("Initializing Foundry Local manager …")
        config = Configuration(app_name="ai_triage_nurse")
        FoundryLocalManager.initialize(config)
        self._manager = FoundryLocalManager.instance

        # Download execution providers (DirectML, CUDA, etc.)
        self._manager.download_and_register_eps()

        # --- Chat model (env override → phi-4-mini → qwen2.5-0.5b) ---
        chat_alias = os.environ.get("FOUNDRY_MODEL_CHAT") or self._resolve_chat_model()
        logger.info("Loading chat model: %s", chat_alias)
        self._chat_model = self._manager.catalog.get_model(chat_alias)
        self._chat_model.download()
        self._chat_model.load()

        # --- Audio model (env override → whisper-tiny) ---
        audio_alias = os.environ.get("FOUNDRY_MODEL_AUDIO", "whisper-tiny")
        logger.info("Loading audio model: %s", audio_alias)
        self._audio_model = self._manager.catalog.get_model(audio_alias)
        self._audio_model.download()
        self._audio_model.load()

        self._initialized = True
        logger.info("Foundry Local models ready.")

    def _resolve_chat_model(self) -> str:
        """Try phi-4-mini first; fall back to qwen2.5-0.5b if unavailable."""
        try:
            self._manager.catalog.get_model("phi-4-mini")
            return "phi-4-mini"
        except Exception:
            logger.warning(
                "phi-4-mini not found in catalog – falling back to qwen2.5-0.5b"
            )
            return "qwen2.5-0.5b"

    # ------------------------------------------------------------------
    # Public accessors
    # ------------------------------------------------------------------
    def get_chat_client(self):
        """Return a chat client from the loaded chat model."""
        if self._chat_model is None:
            raise RuntimeError("Chat model not initialized")
        return self._chat_model.get_chat_client()

    def get_audio_client(self):
        """Return an audio client from the loaded Whisper model."""
        if self._audio_model is None:
            raise RuntimeError("Audio model not initialized")
        return self._audio_model.get_audio_client()

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------
    def shutdown(self) -> None:
        """Unload both models and tear down the manager."""
        logger.info("Shutting down Foundry Local models …")
        if self._chat_model is not None:
            try:
                self._chat_model.unload()
            except Exception as exc:
                logger.warning("Error unloading chat model: %s", exc)
            self._chat_model = None

        if self._audio_model is not None:
            try:
                self._audio_model.unload()
            except Exception as exc:
                logger.warning("Error unloading audio model: %s", exc)
            self._audio_model = None

        self._initialized = False
        FoundryManager._instance = None
        logger.info("Foundry Local shutdown complete.")
