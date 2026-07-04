"""Classify raw_snippets into structured pain points using Claude.

Sends each unprocessed snippet through the classification prompt, parses the
JSON response (with retries for malformed output), computes a weighted
composite score, and writes the result to pain_points.
"""
import json
import os
import re

from anthropic import Anthropic, APIStatusError

from common import retry, setup_logging
from storage.supabase_client import get_client, get_unclassified_snippets, insert_pain_point

logger = setup_logging(__name__)

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

DEFAULT_WEIGHTS = {
    "intensity_score": 0.25,
    "frequency_signal": 0.25,
    "wtp_signal": 0.25,
    "gap_score": 0.25,
}

SYSTEM_PROMPT = """You are a market research analyst screening user-generated text for genuine,
monetizable pain points. Return ONLY valid JSON, no preamble, matching this
exact schema:

{
  "is_pain_point": boolean,
  "pain_summary": string,          // one sentence, plain language
  "intensity_score": integer 1-5,
  "frequency_signal": integer 1-5,
  "wtp_signal": integer 1-5,
  "gap_score": integer 1-5,
  "target_user": string,           // who has this problem
  "existing_solution_mentioned": string | null
}

If the text is not a genuine pain point (e.g. it's a joke, unrelated, or too
vague to act on), set is_pain_point to false and leave other fields at 0/null."""

REQUIRED_FIELDS = {
    "is_pain_point", "pain_summary", "intensity_score", "frequency_signal",
    "wtp_signal", "gap_score", "target_user", "existing_solution_mentioned",
}

JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(raw_text: str) -> dict:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = re.sub(r"^json\s*", "", text, flags=re.IGNORECASE)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = JSON_BLOCK_RE.search(raw_text)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"Could not parse JSON from model response: {raw_text[:200]!r}")


@retry(attempts=3, base_delay=2.0, exceptions=(APIStatusError,))
def _call_claude(client: Anthropic, source: str, snippet_text: str) -> str:
    message = client.messages.create(
        model=MODEL,
        max_tokens=500,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f'Source: {source}\nText: "{snippet_text}"',
            }
        ],
    )
    return message.content[0].text


def classify_snippet(client: Anthropic, source: str, snippet_text: str) -> dict:
    """Classify one snippet, retrying on malformed JSON (separately from API-level retries)."""
    last_error = None
    for attempt in range(1, 4):
        raw_text = _call_claude(client, source, snippet_text)
        try:
            parsed = _extract_json(raw_text)
        except (ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            logger.warning("Malformed JSON on attempt %d/3: %s", attempt, exc)
            continue

        missing = REQUIRED_FIELDS - parsed.keys()
        if missing:
            last_error = ValueError(f"Response missing fields: {missing}")
            logger.warning("Incomplete JSON on attempt %d/3: missing %s", attempt, missing)
            continue

        return parsed

    raise ValueError(f"Failed to get valid classification JSON after 3 attempts: {last_error}")


def compute_composite_score(parsed: dict, weights: dict = None) -> float:
    weights = weights or DEFAULT_WEIGHTS
    total = sum(parsed[field] * weight for field, weight in weights.items())
    return round(total, 2)


def classify_unprocessed(limit: int = 500, weights: dict = None) -> int:
    """Batch classify unprocessed raw_snippets, writing results to pain_points.

    Returns the number of snippets successfully classified.
    """
    supabase = get_client()
    anthropic_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    snippets = get_unclassified_snippets(supabase, limit=limit)
    logger.info("Found %d unclassified snippets", len(snippets))

    processed = 0
    for snippet in snippets:
        try:
            parsed = classify_snippet(anthropic_client, snippet["source"], snippet["text_content"])
        except ValueError as exc:
            logger.error("Skipping snippet %s after repeated parse failures: %s", snippet["id"], exc)
            continue
        except APIStatusError as exc:
            logger.error("Skipping snippet %s after repeated API failures: %s", snippet["id"], exc)
            continue

        is_pain_point = bool(parsed.get("is_pain_point"))
        composite = compute_composite_score(parsed, weights) if is_pain_point else 0.0

        insert_pain_point(supabase, {
            "snippet_id": snippet["id"],
            "pain_summary": parsed.get("pain_summary"),
            "intensity_score": parsed.get("intensity_score") or 0,
            "frequency_signal": parsed.get("frequency_signal") or 0,
            "wtp_signal": parsed.get("wtp_signal") or 0,
            "gap_score": parsed.get("gap_score") or 0,
            "composite_score": composite,
            "target_user": parsed.get("target_user"),
            "existing_solution_mentioned": parsed.get("existing_solution_mentioned"),
            "is_pain_point": is_pain_point,
        })
        processed += 1
        logger.info(
            "Classified snippet %s: is_pain_point=%s composite=%s",
            snippet["id"], is_pain_point, composite,
        )

    logger.info("Classified %d/%d snippets", processed, len(snippets))
    return processed


if __name__ == "__main__":
    classify_unprocessed()
