# Speech Feedback Logger

A daily 1-minute speaking challenge: get a random prompt, record yourself,
get objective feedback on pace and filler words, and keep a log of every
session so you can see progress over time.

## How it works

1. **Prompt** — `practice.py` picks a random prompt from `prompts.py`,
   avoiding prompts used in your last 7 sessions.
2. **Record** — records ~60 seconds from your microphone
   (`recorder.py`, via `sounddevice`).
3. **Transcribe** — converts the recording to text locally using
   OpenAI's Whisper model (`transcriber.py`) — no internet or API key
   needed after the model is downloaded once.
4. **Analyze** — `analyzer.py` computes objective metrics from the
   transcript:
   - words per minute (pace)
   - filler word count and rate (um, uh, like, you know, ...)
   - unique-word ratio (vocabulary variety)
   - average sentence length

   and turns those into plain-language feedback notes.
5. **Log** — `session_log.py` appends a JSON record (prompt, transcript,
   metrics, feedback, path to the audio file) to `sessions.jsonl`.
6. **Review** — `history.py` prints your recent sessions and compares
   recent averages to earlier ones so you can see trends.

This only works where you have a real microphone — run it on your own
machine, not in a cloud/headless session.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Whisper needs a model download on first use (defaults to the `base`
model, ~150MB). You can pick a different size with an env var — see
below.

## Usage

Run once a day:

```bash
python practice.py
```

Review your history:

```bash
python history.py        # last 10 sessions
python history.py 30     # last 30 sessions
```

## Configuration (optional, via `.env`)

| Variable          | Default    | Purpose                                   |
|-------------------|------------|--------------------------------------------|
| `RECORD_SECONDS`  | `60`       | Recording length per session               |
| `WHISPER_MODEL`   | `base`     | Whisper model size (`tiny`/`base`/`small`/`medium`) |
| `SAMPLE_RATE`      | `16000`    | Microphone sample rate                     |
| `RECORDINGS_DIR`  | `recordings` | Where `.wav` files are saved             |
| `SESSION_LOG_PATH` | `sessions.jsonl` | Session log location               |

## Data & privacy

Recordings (`recordings/`) and the session log (`sessions.jsonl`)
contain your own speech and transcripts, so they're gitignored and stay
local — they are not committed to this repo.

## Possible next steps

- Add pause/silence detection from the raw audio for a more complete
  pace picture (not just words-per-minute).
- Track streaks (consecutive days practiced).
- Export a weekly summary email (mirroring `weather_email.py`'s pattern).
- Swap in Claude API–generated qualitative feedback alongside the
  rule-based metrics, for more nuanced coaching notes.
