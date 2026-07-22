"""Speech-to-text transcription using a local Whisper model."""

import os

import numpy as np

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")

_model = None


def _get_model():
    global _model
    if _model is None:
        import whisper

        print(f"Loading Whisper model '{WHISPER_MODEL}' (first run downloads it)...")
        _model = whisper.load_model(WHISPER_MODEL)
    return _model


def transcribe(audio: np.ndarray) -> str:
    """Transcribe a mono float32 audio array to text."""
    model = _get_model()
    result = model.transcribe(audio, fp16=False)
    return result["text"].strip()
