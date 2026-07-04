"""CLI entrypoint for pain-point-finder.

Examples:
    python main.py ingest --source reddit --keywords "gym scheduling,fitness crm" --subreddits Fitness,personaltraining
    python main.py ingest --source google_play --app "com.myfitnesspal.android"
    python main.py ingest --source twitter --keywords "wish there was an app,gym scheduling"
    python main.py classify --unprocessed-only
    python main.py cluster
    python main.py digest --output digest_output.html
    python main.py run --source reddit --keywords "gym scheduling" --subreddits Fitness --limit 20
"""
import click
from dotenv import load_dotenv

load_dotenv()

from cluster import cluster_pain_points
from common import NotConfiguredError, setup_logging
from digest import build_digest, write_digest_file
from storage.supabase_client import get_client, insert_raw_snippets

logger = setup_logging(__name__)


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


def _run_ingest(source: str, keywords: str, subreddits: str, app: str, limit: int) -> int:
    keyword_list = _split_csv(keywords)

    try:
        if source == "reddit":
            from ingest.reddit import search_reddit
            subreddit_list = _split_csv(subreddits)
            if not keyword_list or not subreddit_list:
                raise click.UsageError("reddit ingest requires --keywords and --subreddits")
            snippets = search_reddit(keyword_list, subreddit_list, limit=limit)
        elif source == "google_play":
            from ingest.google_play import fetch_google_play_reviews
            if not app:
                raise click.UsageError("google_play ingest requires --app <package name or search term>")
            snippets = fetch_google_play_reviews(app, count=limit)
        elif source == "twitter":
            from ingest.twitter import search_twitter
            if not keyword_list:
                raise click.UsageError("twitter ingest requires --keywords")
            snippets = search_twitter(keyword_list, max_results=limit)
        else:
            raise click.UsageError(f"Unknown source: {source}")
    except NotConfiguredError as exc:
        logger.warning("Skipping source %r: %s", source, exc)
        return 0

    if not snippets:
        logger.info("No snippets collected from %s", source)
        return 0

    supabase = get_client()
    stored = insert_raw_snippets(supabase, snippets)
    logger.info("Stored %d/%d snippets from %s", len(stored), len(snippets), source)
    return len(stored)


@click.group()
def cli():
    """Pain Point Finder — mine public complaints for SaaS opportunities."""


@cli.command()
@click.option("--source", required=True, type=click.Choice(["reddit", "google_play", "twitter"]))
@click.option("--keywords", default=None, help="Comma-separated keywords/phrases to search for.")
@click.option("--subreddits", default=None, help="Comma-separated subreddit names (reddit only).")
@click.option("--app", default=None, help="Play Store package name or search term (google_play only).")
@click.option("--limit", default=100, help="Max items to pull per keyword/source.")
def ingest(source, keywords, subreddits, app, limit):
    """Pull raw snippets from a single source into raw_snippets."""
    _run_ingest(source, keywords, subreddits, app, limit)


@cli.command()
@click.option("--unprocessed-only", is_flag=True, default=True, help="Only classify snippets without a pain_points row (default behavior).")
@click.option("--limit", default=500, help="Max snippets to classify in this run.")
def classify(unprocessed_only, limit):
    """Classify unprocessed raw_snippets into pain_points via Claude."""
    from classify import classify_unprocessed
    count = classify_unprocessed(limit=limit)
    logger.info("Done. Classified %d snippets.", count)


@cli.command()
@click.option("--limit", default=500, help="Max pain points to cluster in this run.")
def cluster(limit):
    """Assign unclustered pain_points to themed clusters."""
    count = cluster_pain_points(limit=limit)
    logger.info("Done. Assigned %d pain points to clusters.", count)


@cli.command()
@click.option("--output", default=None, help="Save the digest as an HTML file at this path (otherwise just prints a preview).")
@click.option("--limit", default=10, help="Max pain points to include.")
@click.option("--days", default=7, help="Lookback window in days.")
def digest(output, limit, days):
    """Build the weekly top-pain-points digest, printing a preview or saving it as HTML."""
    if output:
        write_digest_file(output, limit=limit, days=days)
    else:
        pain_points, html = build_digest(limit=limit, days=days)
        logger.info("Digest preview (%d pain points):", len(pain_points))
        for pp in pain_points:
            logger.info("  [%s] %s", pp.get("composite_score"), pp.get("pain_summary"))


@cli.command()
@click.option("--source", required=True, type=click.Choice(["reddit", "google_play", "twitter"]))
@click.option("--keywords", default=None, help="Comma-separated keywords/phrases to search for.")
@click.option("--subreddits", default=None, help="Comma-separated subreddit names (reddit only).")
@click.option("--app", default=None, help="Play Store package name or search term (google_play only).")
@click.option("--limit", default=100, help="Max items to pull per keyword/source.")
@click.option("--write-digest", "digest_output", default=None, help="Also save the digest as an HTML file at this path.")
def run(source, keywords, subreddits, app, limit, digest_output):
    """Run the full pipeline end to end: ingest -> classify -> cluster (-> digest)."""
    stored = _run_ingest(source, keywords, subreddits, app, limit)
    logger.info("Ingest stage stored %d new snippets", stored)

    from classify import classify_unprocessed
    classified = classify_unprocessed()
    logger.info("Classify stage processed %d snippets", classified)

    clustered = cluster_pain_points()
    logger.info("Cluster stage assigned %d pain points", clustered)

    if digest_output:
        write_digest_file(digest_output)


if __name__ == "__main__":
    cli()
