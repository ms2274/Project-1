"""Build and send the weekly "top new pain points" digest email via Resend."""
import os

import resend
from requests.exceptions import RequestException

from common import retry, setup_logging
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


@retry(attempts=3, base_delay=2.0, exceptions=(RequestException,))
def _send_email(html: str) -> dict:
    resend.api_key = os.environ.get("RESEND_API_KEY")
    from_email = os.environ.get("DIGEST_FROM_EMAIL")
    to_email = os.environ.get("DIGEST_TO_EMAIL")
    return resend.Emails.send({
        "from": from_email,
        "to": [to_email],
        "subject": "Pain Point Finder — Weekly Digest",
        "html": html,
    })


def build_digest(limit: int = 10, days: int = 7) -> tuple[list[dict], str]:
    supabase = get_client()
    pain_points = get_top_pain_points(supabase, days=days, limit=limit, confirmed_only=True)
    html = _render_html(pain_points)
    return pain_points, html


def send_digest(limit: int = 10, days: int = 7) -> None:
    pain_points, html = build_digest(limit=limit, days=days)
    if not pain_points:
        logger.info("No confirmed pain points to send — skipping digest send.")
        return
    result = _send_email(html)
    logger.info("Sent digest with %d pain points (resend id=%s)", len(pain_points), result.get("id"))


if __name__ == "__main__":
    send_digest()
