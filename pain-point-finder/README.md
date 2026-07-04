# Pain Point Finder

Scrapes places people complain in public, uses Claude to classify each snippet
as a genuine monetizable pain point, clusters similar complaints into themes,
scores/ranks them, and builds a digest of the best opportunities.

```
INGEST  -->  FILTER  -->  CLASSIFY (Claude)  -->  CLUSTER  -->  SCORE/RANK  -->  DIGEST
```

## Setup

### 1. Install dependencies

```bash
cd pain-point-finder
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Create a Reddit app (for the `reddit` source)

1. Go to https://www.reddit.com/prefs/apps
2. Click "create app" / "create another app"
3. Choose type **script**
4. Fill in name/description, set redirect uri to `http://localhost:8080`
5. After creating, note the client ID (under the app name) and secret

### 3. Set up Supabase tables

Create a Supabase project (or reuse an existing one), then run the migration:

```bash
psql "$SUPABASE_DB_URL" -f migrations/001_init.sql
```

Or paste `migrations/001_init.sql` into the Supabase SQL editor and run it.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in:
- `ANTHROPIC_API_KEY` — used by classify.py and cluster.py
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` — from step 2
- `X_BEARER_TOKEN` — optional, phase 2 (X API recent-search requires a paid tier)
- `SUPABASE_URL`, `SUPABASE_KEY` — from your Supabase project settings

Sources with missing credentials fail with a clear error rather than crashing
the whole run — e.g. skip `X_BEARER_TOKEN` entirely until you're ready for the
X/Twitter source.

## Usage

```bash
# Pull raw complaints from Reddit
python main.py ingest --source reddit --keywords "gym scheduling software,gym CRM sucks" --subreddits Fitness,personaltraining,SaaS

# Pull 1-2 star Google Play reviews for an app (package name or search term)
python main.py ingest --source google_play --app "gym management software"

# Pull recent tweets (requires X_BEARER_TOKEN / paid X API tier)
python main.py ingest --source twitter --keywords "wish there was an app,gym scheduling"

# Classify unprocessed snippets into structured pain points
python main.py classify

# Group classified pain points into themed clusters
python main.py cluster

# Preview the digest in the terminal
python main.py digest

# Save the digest as a local HTML file instead
python main.py digest --output digest_output.html

# Full pipeline in one shot: ingest -> classify -> cluster (-> digest)
python main.py run --source reddit --keywords "gym scheduling software" --subreddits Fitness --limit 20 --write-digest digest_output.html
```

## Notes

- All external API calls (Reddit, Google Play, X, Anthropic, Supabase)
  retry up to 3 times with exponential backoff on transient failures.
- Snippets are deduplicated on `(source, external_id)` before insert — safe to
  re-run ingestion for the same keywords repeatedly.
- `cluster.py` is idempotent: it only processes pain points that don't have a
  `cluster_id` yet, and matches new themes against existing ones (via Claude
  + a fuzzy-name fallback) before creating a new cluster row.
- A cluster only counts as a confirmed opportunity once
  `distinct_sources_last_7d >= 10` — anything below that threshold is real
  data but won't show up in the digest yet. One loud complainer isn't a market.
- Everything logs to stdout with timestamps, so it wires straight into
  Trigger.dev as a scheduled job (e.g. daily ingest + classify + cluster) the
  same way your existing scripts do.
