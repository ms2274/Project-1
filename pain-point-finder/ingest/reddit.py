"""Reddit ingestion via PRAW.

Searches a set of subreddits for a set of keywords and returns a flat list of
snippet dicts. Output shape matches every other ingest module so classify.py
doesn't need to know which source a snippet came from:

    {
        "source": "reddit",
        "source_url": str,
        "external_id": str,   # unique per source, used for dedup
        "text_content": str,
        "author": str | None,
        "posted_at": datetime | None,
    }
"""
import os
from datetime import datetime, timezone

import praw
from prawcore.exceptions import PrawcoreException

from common import NotConfiguredError, retry, setup_logging

logger = setup_logging(__name__)


def _get_reddit_client() -> praw.Reddit:
    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    user_agent = os.environ.get("REDDIT_USER_AGENT")
    if not client_id or not client_secret or not user_agent:
        raise NotConfiguredError(
            "Reddit is not configured — set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET "
            "and REDDIT_USER_AGENT in .env (see README for how to create a Reddit app)."
        )
    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )


@retry(attempts=3, base_delay=2.0, exceptions=(PrawcoreException,))
def _search_subreddit(reddit: praw.Reddit, subreddit_name: str, keyword: str, limit: int):
    subreddit = reddit.subreddit(subreddit_name)
    return list(subreddit.search(keyword, limit=limit, sort="relevance"))


def search_reddit(keywords: list[str], subreddits: list[str], limit: int = 100) -> list[dict]:
    """Search each subreddit for each keyword, returning deduped snippets.

    Each matching submission becomes one snippet (title + selftext combined).
    """
    reddit = _get_reddit_client()
    snippets: dict[str, dict] = {}

    for subreddit_name in subreddits:
        for keyword in keywords:
            logger.info("Searching r/%s for %r (limit=%d)", subreddit_name, keyword, limit)
            try:
                submissions = _search_subreddit(reddit, subreddit_name, keyword, limit)
            except PrawcoreException as exc:
                logger.error("Giving up on r/%s / %r after retries: %s", subreddit_name, keyword, exc)
                continue

            for submission in submissions:
                external_id = submission.id
                if external_id in snippets:
                    continue
                text = submission.title
                if submission.selftext:
                    text = f"{submission.title}\n\n{submission.selftext}"
                posted_at = datetime.fromtimestamp(submission.created_utc, tz=timezone.utc)
                snippets[external_id] = {
                    "source": "reddit",
                    "source_url": f"https://www.reddit.com{submission.permalink}",
                    "external_id": external_id,
                    "text_content": text,
                    "author": str(submission.author) if submission.author else None,
                    "posted_at": posted_at,
                }

    logger.info("Collected %d unique Reddit snippets", len(snippets))
    return list(snippets.values())
