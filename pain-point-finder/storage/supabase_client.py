"""Thin wrapper around the Supabase tables: raw_snippets, pain_points, clusters."""
import os
from datetime import datetime, timedelta, timezone

from postgrest.exceptions import APIError
from supabase import Client, create_client

from common import NotConfiguredError, retry, setup_logging

logger = setup_logging(__name__)

VALIDATION_THRESHOLD = 10  # distinct sources in a 7-day window to leave "unconfirmed"


def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise NotConfiguredError(
            "Supabase is not configured — set SUPABASE_URL and SUPABASE_KEY in .env."
        )
    return create_client(url, key)


def _iso(dt) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def insert_raw_snippets(client: Client, snippets: list[dict]) -> list[dict]:
    """Upsert raw_snippets, deduping on (source, external_id). Returns the stored rows."""
    if not snippets:
        return []
    rows = [
        {
            "source": s["source"],
            "source_url": s.get("source_url"),
            "external_id": s.get("external_id"),
            "text_content": s["text_content"],
            "author": s.get("author"),
            "posted_at": _iso(s.get("posted_at")),
        }
        for s in snippets
    ]
    result = (
        client.table("raw_snippets")
        .upsert(rows, on_conflict="source,external_id", ignore_duplicates=True)
        .execute()
    )
    logger.info("Upserted %d raw snippets", len(result.data))
    return result.data


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def get_unclassified_snippets(client: Client, limit: int = 500) -> list[dict]:
    """Snippets in raw_snippets with no corresponding row in pain_points yet."""
    classified = client.table("pain_points").select("snippet_id").execute()
    classified_ids = {row["snippet_id"] for row in classified.data if row["snippet_id"]}

    query = client.table("raw_snippets").select("*").order("ingested_at", desc=True).limit(limit)
    all_snippets = query.execute().data
    return [s for s in all_snippets if s["id"] not in classified_ids]


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def insert_pain_point(client: Client, pain_point: dict) -> dict:
    result = client.table("pain_points").insert(pain_point).execute()
    return result.data[0]


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def get_unclustered_pain_points(client: Client, limit: int = 500) -> list[dict]:
    result = (
        client.table("pain_points")
        .select("*, raw_snippets(source, posted_at)")
        .eq("is_pain_point", True)
        .is_("cluster_id", "null")
        .limit(limit)
        .execute()
    )
    return result.data


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def get_clusters(client: Client) -> list[dict]:
    result = client.table("clusters").select("*").execute()
    return result.data


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def create_cluster(client: Client, theme_name: str, theme_description: str) -> dict:
    result = (
        client.table("clusters")
        .insert({"theme_name": theme_name, "theme_description": theme_description, "snippet_count": 0})
        .execute()
    )
    return result.data[0]


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def assign_pain_point_cluster(client: Client, pain_point_id: str, cluster_id: str) -> None:
    client.table("pain_points").update({"cluster_id": cluster_id}).eq("id", pain_point_id).execute()


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def recompute_cluster_stats(client: Client, cluster_id: str) -> None:
    """Recompute snippet_count, distinct_sources_last_7d, avg_score, first/last_seen for a cluster."""
    members = (
        client.table("pain_points")
        .select("composite_score, created_at, raw_snippets(source, posted_at)")
        .eq("cluster_id", cluster_id)
        .execute()
        .data
    )
    if not members:
        return

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=7)
    scores = [m["composite_score"] for m in members if m["composite_score"] is not None]
    created_ats = [m["created_at"] for m in members if m.get("created_at")]

    distinct_sources_recent = set()
    for m in members:
        snippet = m.get("raw_snippets") or {}
        posted_at = snippet.get("posted_at")
        if not posted_at:
            continue
        try:
            posted_dt = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue
        if posted_dt >= window_start:
            distinct_sources_recent.add((snippet.get("source"), posted_at))

    update = {
        "snippet_count": len(members),
        "avg_score": round(sum(scores) / len(scores), 2) if scores else None,
        "distinct_sources_last_7d": len(distinct_sources_recent),
        "last_seen": now.isoformat(),
    }
    if created_ats:
        update["first_seen"] = min(created_ats)

    client.table("clusters").update(update).eq("id", cluster_id).execute()


@retry(attempts=3, base_delay=2.0, exceptions=(APIError,))
def get_top_pain_points(client: Client, days: int = 7, limit: int = 10, confirmed_only: bool = True) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query = (
        client.table("pain_points")
        .select("*, raw_snippets(source, source_url), clusters(theme_name, distinct_sources_last_7d)")
        .eq("is_pain_point", True)
        .gte("created_at", since)
        .order("composite_score", desc=True)
        .limit(limit * 3 if confirmed_only else limit)
    )
    rows = query.execute().data
    if confirmed_only:
        rows = [
            r for r in rows
            if (r.get("clusters") or {}).get("distinct_sources_last_7d", 0) >= VALIDATION_THRESHOLD
        ]
    return rows[:limit]
