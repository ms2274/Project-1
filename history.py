"""View past speech practice sessions and trends.
Usage: python history.py [n]   (defaults to last 10 sessions)"""

import sys

from session_log import load_sessions


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    sessions = load_sessions()

    if not sessions:
        print("No sessions logged yet. Run practice.py first.")
        return

    recent = sessions[-n:]
    print(f"Showing {len(recent)} of {len(sessions)} total sessions\n")
    print(f"{'Date':<20}{'WPM':<8}{'Fillers/100w':<14}{'Prompt'}")
    print("-" * 80)
    for s in recent:
        m = s["metrics"]
        date = s["timestamp"][:16].replace("T", " ")
        prompt = s["prompt"][:40] + ("..." if len(s["prompt"]) > 40 else "")
        print(f"{date:<20}{m['words_per_minute']:<8}{m['filler_rate_per_100_words']:<14}{prompt}")

    wpm_trend = [s["metrics"]["words_per_minute"] for s in recent]
    filler_trend = [s["metrics"]["filler_rate_per_100_words"] for s in recent]
    print("\nAverages over shown sessions:")
    print(f"  Words per minute: {_avg(wpm_trend)}")
    print(f"  Filler words per 100 words: {_avg(filler_trend)}")

    if len(sessions) > n:
        earlier = sessions[:-n]
        earlier_wpm = _avg([s["metrics"]["words_per_minute"] for s in earlier])
        earlier_filler = _avg([s["metrics"]["filler_rate_per_100_words"] for s in earlier])
        print(f"\nCompared to earlier sessions (avg wpm {earlier_wpm}, avg filler {earlier_filler}):")
        print(f"  WPM change: {round(_avg(wpm_trend) - earlier_wpm, 1):+}")
        print(f"  Filler rate change: {round(_avg(filler_trend) - earlier_filler, 1):+}")


if __name__ == "__main__":
    main()
