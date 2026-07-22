"""Daily 1-minute speech practice: random prompt -> record -> transcribe ->
analyze -> log. Run this once a day: python practice.py"""

import os

from dotenv import load_dotenv

load_dotenv()

from analyzer import analyze, generate_feedback
from prompts import get_random_prompt
from recorder import record_audio, save_recording
from session_log import load_sessions, log_session, recent_prompts
from transcriber import transcribe

RECORD_SECONDS = int(os.getenv("RECORD_SECONDS", "60"))


def main():
    prompt = get_random_prompt(exclude=recent_prompts())

    print("=" * 60)
    print("Today's prompt:")
    print(f"  {prompt}")
    print("=" * 60)
    input("Press Enter when you're ready to start recording...")

    audio = record_audio(RECORD_SECONDS)
    audio_path = save_recording(audio)

    print("Transcribing...")
    transcript = transcribe(audio)
    print("\nTranscript:")
    print(f"  {transcript}\n")

    metrics = analyze(transcript, RECORD_SECONDS)
    feedback = generate_feedback(metrics)

    print("Metrics:")
    for key, value in metrics.items():
        print(f"  {key}: {value}")

    print("\nFeedback:")
    for note in feedback:
        print(f"  - {note}")

    log_session(prompt, transcript, audio_path, metrics, feedback)
    print(f"\nSession logged. ({len(load_sessions())} total sessions)")


if __name__ == "__main__":
    main()
