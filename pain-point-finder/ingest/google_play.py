"""Google Play Store review ingestion via google-play-scraper.

Pulls 1-2 star reviews for a given app package name (e.g. "com.myfitnesspal.android")
or a free-text search term (e.g. "gym scheduling") — in the latter case the
top matching app is resolved to its package name first. No API key needed.

Same output interface as ingest/reddit.py.
"""
from datetime import datetime

from google_play_scraper import Sort, reviews, search
from requests.exceptions import RequestException

from common import retry, setup_logging

logger = setup_logging(__name__)

LOW_SCORES = (1, 2)


def _looks_like_package_name(value: str) -> bool:
    return "." in value and " " not in value


@retry(attempts=3, base_delay=2.0, exceptions=(RequestException,))
def _resolve_app_id(search_term: str) -> str | None:
    results = search(search_term, n_hits=1)
    if not results:
        return None
    return results[0]["appId"]


@retry(attempts=3, base_delay=2.0, exceptions=(RequestException,))
def _fetch_reviews_page(app_id: str, score: int, count: int, continuation_token):
    return reviews(
        app_id,
        lang="en",
        country="us",
        sort=Sort.NEWEST,
        count=count,
        filter_score_with=score,
        continuation_token=continuation_token,
    )


def fetch_google_play_reviews(app_id_or_search_term: str, count: int = 100) -> list[dict]:
    """Fetch 1-2 star reviews for an app, given a package name or search term."""
    if _looks_like_package_name(app_id_or_search_term):
        app_id = app_id_or_search_term
    else:
        logger.info("Resolving %r to a Play Store package name", app_id_or_search_term)
        app_id = _resolve_app_id(app_id_or_search_term)
        if not app_id:
            logger.warning("No Play Store app found for %r", app_id_or_search_term)
            return []
        logger.info("Resolved %r -> %s", app_id_or_search_term, app_id)

    snippets = []
    for score in LOW_SCORES:
        logger.info("Fetching %d-star reviews for %s (up to %d)", score, app_id, count)
        try:
            result, _ = _fetch_reviews_page(app_id, score, count, None)
        except RequestException as exc:
            logger.error("Giving up on %s / %d-star reviews after retries: %s", app_id, score, exc)
            continue

        for review in result:
            posted_at = review.get("at")
            if isinstance(posted_at, datetime):
                posted_at = posted_at.replace(tzinfo=posted_at.tzinfo)
            snippets.append({
                "source": "google_play",
                "source_url": f"https://play.google.com/store/apps/details?id={app_id}&reviewId={review['reviewId']}",
                "external_id": review["reviewId"],
                "text_content": review["content"],
                "author": review.get("userName"),
                "posted_at": posted_at,
            })

    logger.info("Collected %d Google Play review snippets for %s", len(snippets), app_id)
    return snippets
