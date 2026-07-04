"""Build the "top new pain points" digest as HTML.

No email delivery — this just renders the ranked list. Preview it in the
terminal (default) or save it to a local HTML file with --output.
"""
from common import setup_logging
from storage.supabase_client import get_client, get_top_pain_points

logger = setup_logging(__name__)


def _render_html(pain_points: list[dict]) -> str:
    if not pain_points:
        return "<p>No confirmed pain points in the last 7 days.</p>"

    rows = []
    for pp in pain_points:
        cluster = pp.get("clusters") or {}
        snippet = pp.get("raw_snippets") or {}
        rows.append(f"""
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;"><strong>{pp.get('pain_summary', '')}</strong></td>
          <td style="padding:8px;border-bottom:1px solid #eee;">{cluster.get('theme_name', '—')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">{pp.get('target_user', '—')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">{pp.get('composite_score')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">
            {f'<a href="{snippet.get("source_url")}">source</a>' if snippet.get('source_url') else '—'}
          </td>
        </tr>""")

    return f"""
    <html>
      <body style="font-family:sans-serif;">
        <h2>Top Pain Points — Last 7 Days</h2>
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr style="text-align:left;background:#f5f5f5;">
              <th style="padding:8px;">Pain Point</th>
              <th style="padding:8px;">Theme</th>
              <th style="padding:8px;">Target User</th>
              <th style="padding:8px;">Score</th>
              <th style="padding:8px;">Source</th>
            </tr>
          </thead>
          <tbody>{''.join(rows)}</tbody>
        </table>
      </body>
    </html>
    """


def build_digest(limit: int = 10, days: int = 7) -> tuple[list[dict], str]:
    supabase = get_client()
    pain_points = get_top_pain_points(supabase, days=days, limit=limit, confirmed_only=True)
    html = _render_html(pain_points)
    return pain_points, html


def write_digest_file(output_path: str, limit: int = 10, days: int = 7) -> int:
    """Build the digest and save it as a local HTML file. Returns the pain point count."""
    pain_points, html = build_digest(limit=limit, days=days)
    with open(output_path, "w") as f:
        f.write(html)
    logger.info("Wrote digest (%d pain points) to %s", len(pain_points), output_path)
    return len(pain_points)


if __name__ == "__main__":
    write_digest_file("digest_output.html")
