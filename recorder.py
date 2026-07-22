"""Microphone recording for daily speech practice sessions."""

import os
from datetime import datetime

import numpy as np
import sounddevice as sd
import soundfile as sf

SAMPLE_RATE = int(os.getenv("SAMPLE_RATE", "16000"))
RECORDINGS_DIR = os.getenv("RECORDINGS_DIR", "recordings")


def record_audio(duration_seconds: int) -> np.ndarray:
    """Record mono audio from the default microphone and return it as a 1D
    float32 array at SAMPLE_RATE, suitable for feeding straight into Whisper."""
    print(f"Recording for {duration_seconds} seconds... speak now.")
    audio = sd.rec(
        int(duration_seconds * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
    )
    sd.wait()
    print("Recording finished.")
    return audio.squeeze()


def save_recording(audio: np.ndarray, date_str: str | None = None) -> str:
    """Write the recorded audio to a .wav file and return its path."""
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    date_str = date_str or datetime.now().strftime("%Y-%m-%d_%H%M%S")
    path = os.path.join(RECORDINGS_DIR, f"{date_str}.wav")
    sf.write(path, audio, SAMPLE_RATE)
    return path
