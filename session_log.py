"""Append-only JSONL log of speech practice sessions."""

import json
import os
import uuid
from datetime import datetime

LOG_PATH = os.getenv("SESSION_LOG_PATH", "sessions.jsonl")


def log_session(prompt: str, transcript: str, audio_path: str, metrics: dict, feedback: list[str]) -> dict:
    """Append a session record to the log and return it."""
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "prompt": prompt,
        "transcript": transcript,
        "audio_path": audio_path,
        "metrics": metrics,
        "feedback": feedback,
    }
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
    return entry


def load_sessions() -> list[dict]:
    """Read all logged sessions in chronological order."""
    if not os.path.exists(LOG_PATH):
        return []
    sessions = []
    with open(LOG_PATH) as f:
        for line in f:
            line = line.strip()
            if line:
                sessions.append(json.loads(line))
    return sessions


def recent_prompts(n: int = 7) -> list[str]:
    """Prompts used in the last n sessions, so practice.py can avoid repeats."""
    sessions = load_sessions()
    return [s["prompt"] for s in sessions[-n:]]
