"""Rule-based analysis of a speech transcript: pace, filler words, variety,
sentence structure, plus plain-language feedback derived from the metrics."""

import re

FILLER_WORDS = [
    "um", "uh", "uhh", "umm", "er", "erm",
    "like", "you know", "i mean", "sort of", "kind of",
    "basically", "actually", "literally", "so yeah", "right",
]


def _words(transcript: str) -> list[str]:
    return re.findall(r"[a-zA-Z']+", transcript.lower())


def _count_fillers(transcript: str) -> dict[str, int]:
    lower = transcript.lower()
    counts = {}
    for filler in FILLER_WORDS:
        pattern = r"\b" + re.escape(filler) + r"\b"
        n = len(re.findall(pattern, lower))
        if n:
            counts[filler] = n
    return counts


def _sentences(transcript: str) -> list[str]:
    parts = re.split(r"[.!?]+", transcript)
    return [p.strip() for p in parts if p.strip()]


def analyze(transcript: str, duration_seconds: float) -> dict:
    """Compute objective metrics for a transcript."""
    words = _words(transcript)
    word_count = len(words)
    unique_words = set(words)
    minutes = duration_seconds / 60 if duration_seconds else 1

    filler_counts = _count_fillers(transcript)
    filler_total = sum(filler_counts.values())

    sentences = _sentences(transcript)
    avg_sentence_length = (word_count / len(sentences)) if sentences else float(word_count)

    return {
        "word_count": word_count,
        "duration_seconds": round(duration_seconds, 1),
        "words_per_minute": round(word_count / minutes, 1) if minutes else 0.0,
        "unique_word_ratio": round(len(unique_words) / word_count, 3) if word_count else 0.0,
        "filler_word_count": filler_total,
        "filler_rate_per_100_words": round((filler_total / word_count) * 100, 1) if word_count else 0.0,
        "filler_breakdown": filler_counts,
        "sentence_count": len(sentences),
        "avg_sentence_length": round(avg_sentence_length, 1),
    }


def generate_feedback(metrics: dict) -> list[str]:
    """Turn metrics into short, actionable feedback notes."""
    notes = []

    wpm = metrics["words_per_minute"]
    if metrics["word_count"] < 15:
        notes.append("Very little was captured — check your mic, or try filling the full minute next time.")
    elif wpm < 110:
        notes.append(f"Pace was slow ({wpm} wpm). Conversational pace is typically 120-160 wpm — try to keep momentum.")
    elif wpm > 170:
        notes.append(f"Pace was fast ({wpm} wpm). Slowing down slightly can improve clarity and let listeners keep up.")
    else:
        notes.append(f"Pace was solid ({wpm} wpm) — right in the natural conversational range.")

    rate = metrics["filler_rate_per_100_words"]
    if rate > 8:
        notes.append(f"Filler words were frequent ({rate} per 100 words). Try pausing silently instead of saying 'um'/'like'.")
    elif rate > 3:
        notes.append(f"Some filler words crept in ({rate} per 100 words) — room to tighten this up.")
    else:
        notes.append("Filler word usage was low — good control.")

    ratio = metrics["unique_word_ratio"]
    if metrics["word_count"] >= 20:
        if ratio < 0.45:
            notes.append(f"Vocabulary was repetitive (unique-word ratio {ratio}). Try varying word choice.")
        elif ratio > 0.75:
            notes.append(f"Vocabulary was varied (unique-word ratio {ratio}) — good range.")

    avg_len = metrics["avg_sentence_length"]
    if metrics["sentence_count"] >= 2:
        if avg_len > 28:
            notes.append(f"Sentences ran long (avg {avg_len} words) — consider breaking ideas into shorter sentences.")
        elif avg_len < 6:
            notes.append(f"Sentences were quite short (avg {avg_len} words) — could sound choppy; try connecting ideas.")

    return notes
