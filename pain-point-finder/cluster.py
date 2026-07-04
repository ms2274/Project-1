"""Group classified pain points into themed clusters using Claude.

For each unclustered pain point, Claude is given the running list of existing
cluster names + descriptions and asked to either assign it to one of them or
propose a new theme. Idempotent: only unclustered pain points are processed
on each run, and new themes are matched (via Claude + a fuzzy-name safety
net) against existing clusters before a new row is created, so re-running
doesn't fork duplicate clusters for the same theme.
"""
import difflib
import json
import os
import re

from anthropic import Anthropic, APIStatusError

from common import retry, setup_logging
from storage.supabase_client import (
    assign_pain_point_cluster,
    create_cluster,
    get_client,
    get_clusters,
    get_unclustered_pain_points,
    recompute_cluster_stats,
)

logger = setup_logging(__name__)

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")
FUZZY_MATCH_THRESHOLD = 0.85

SYSTEM_PROMPT = """You are organizing user pain points into a small number of recurring themes
for a SaaS-opportunity tracker. Given an existing list of themes and a new pain point,
decide whether it belongs to one of the existing themes or represents a genuinely new theme.

Prefer matching an existing theme whenever the underlying problem is the same, even if the
wording differs. Only propose a new theme when none of the existing ones fit.

Return ONLY valid JSON, no preamble, matching this exact schema:

{
  "action": "assign" | "new",
  "theme_name": string,           // existing theme_name if action=="assign", otherwise a new short theme name
  "theme_description": string     // one sentence describing the theme (always include, even when assigning)
}"""

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
def _call_claude(client: Anthropic, existing_clusters: list[dict], pain_point: dict) -> str:
    cluster_list = "\n".join(
        f"- {c['theme_name']}: {c.get('theme_description') or ''}" for c in existing_clusters
    ) or "(none yet)"
    user_content = (
        f"Existing themes:\n{cluster_list}\n\n"
        f"New pain point:\n"
        f"Summary: {pain_point.get('pain_summary')}\n"
        f"Target user: {pain_point.get('target_user')}\n"
        f"Existing solution mentioned: {pain_point.get('existing_solution_mentioned')}"
    )
    message = client.messages.create(
        model=MODEL,
        max_tokens=300,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    return message.content[0].text


def _find_best_match(theme_name: str, existing_clusters: list[dict]) -> dict | None:
    for cluster in existing_clusters:
        if cluster["theme_name"].strip().lower() == theme_name.strip().lower():
            return cluster
    best_ratio, best_cluster = 0.0, None
    for cluster in existing_clusters:
        ratio = difflib.SequenceMatcher(None, cluster["theme_name"].lower(), theme_name.lower()).ratio()
        if ratio > best_ratio:
            best_ratio, best_cluster = ratio, cluster
    if best_ratio >= FUZZY_MATCH_THRESHOLD:
        return best_cluster
    return None


def assign_cluster(client: Anthropic, supabase, existing_clusters: list[dict], pain_point: dict) -> dict:
    """Decide (and persist) which cluster a pain point belongs to, creating a new one if needed.

    Returns the cluster row used. Mutates `existing_clusters` in place when a new one is created,
    so subsequent calls in the same batch see it.
    """
    raw_text = _call_claude(client, existing_clusters, pain_point)
    decision = _extract_json(raw_text)
    theme_name = decision.get("theme_name", "").strip()
    theme_description = decision.get("theme_description", "").strip()

    matched = _find_best_match(theme_name, existing_clusters)
    if matched:
        return matched

    cluster = create_cluster(supabase, theme_name, theme_description)
    existing_clusters.append(cluster)
    logger.info("Created new cluster: %s", theme_name)
    return cluster


def cluster_pain_points(limit: int = 500) -> int:
    """Assign every unclustered pain point to a cluster. Returns the number assigned."""
    supabase = get_client()
    anthropic_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    existing_clusters = get_clusters(supabase)
    pain_points = get_unclustered_pain_points(supabase, limit=limit)
    logger.info("Found %d unclustered pain points, %d existing clusters", len(pain_points), len(existing_clusters))

    touched_cluster_ids = set()
    assigned = 0
    for pain_point in pain_points:
        try:
            cluster = assign_cluster(anthropic_client, supabase, existing_clusters, pain_point)
        except (ValueError, APIStatusError) as exc:
            logger.error("Skipping pain point %s: %s", pain_point["id"], exc)
            continue

        assign_pain_point_cluster(supabase, pain_point["id"], cluster["id"])
        touched_cluster_ids.add(cluster["id"])
        assigned += 1
        logger.info("Assigned pain point %s -> cluster %r", pain_point["id"], cluster["theme_name"])

    for cluster_id in touched_cluster_ids:
        recompute_cluster_stats(supabase, cluster_id)

    logger.info("Assigned %d pain points across %d clusters", assigned, len(touched_cluster_ids))
    return assigned


if __name__ == "__main__":
    cluster_pain_points()
