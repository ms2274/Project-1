"""X/Twitter ingestion via the X API v2 recent-search endpoint.

Requires a paid API tier for recent-search access. If X_BEARER_TOKEN isn't
set, this raises NotConfiguredError with a clear message so the rest of the
pipeline (reddit, google_play) still runs fine without it — main.py catches
this per-source rather than letting it crash the whole run.

Same output interface as ingest/reddit.py.
"""
import os

import requests
from requests.exceptions import RequestException

from common import NotConfiguredError, retry, setup_logging

logger = setup_logging(__name__)

SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent"


def _get_bearer_token() -> str:
    token = os.environ.get("X_BEARER_TOKEN")
    if not token:
        raise NotConfiguredError(
            "X/Twitter is not configured — set X_BEARER_TOKEN in .env. Note: recent-search "
            "requires a paid X API developer tier; this source is optional (phase 2)."
        )
    return token


@retry(attempts=3, base_delay=2.0, exceptions=(RequestException,))
def _search_recent(query: str, bearer_token: str, max_results: int):
    resp = requests.get(
        SEARCH_URL,
        headers={"Authorization": f"Bearer {bearer_token}"},
        params={
            "query": f"{query} lang:en -is:retweet",
            "max_results": max(10, min(max_results, 100)),
            "tweet.fields": "created_at,author_id",
        },
        timeout=30,
    )
    if resp.status_code == 429:
        raise RequestException(f"rate limited: {resp.text}")
    resp.raise_for_status()
    return resp.json()


def search_twitter(keywords: list[str], max_results: int = 100) -> list[dict]:
    """Search recent tweets for each keyword phrase, returning deduped snippets."""
    bearer_token = _get_bearer_token()
    snippets: dict[str, dict] = {}

    for keyword in keywords:
        logger.info("Searching X for %r (max_results=%d)", keyword, max_results)
        try:
            payload = _search_recent(keyword, bearer_token, max_results)
        except RequestException as exc:
            logger.error("Giving up on X search for %r after retries: %s", keyword, exc)
            continue

        for tweet in payload.get("data", []):
            external_id = tweet["id"]
            if external_id in snippets:
                continue
            snippets[external_id] = {
                "source": "twitter",
                "source_url": f"https://twitter.com/i/web/status/{external_id}",
                "external_id": external_id,
                "text_content": tweet["text"],
                "author": tweet.get("author_id"),
                "posted_at": tweet.get("created_at"),
            }

    logger.info("Collected %d unique X snippets", len(snippets))
    return list(snippets.values())
