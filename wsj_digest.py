#!/usr/bin/env python3
"""
Daily WSJ article digest email.

Pulls one article from each of three WSJ RSS categories:
  1. Macroeconomics (Economy)
  2. Industry / Company / Transaction (US Business)
  3. Opinion (Op-Ed)

Sends a formatted HTML digest via Gmail SMTP.

Setup:
  1. Copy .env.example to .env and fill in your Gmail credentials
  2. Use a Gmail App Password (not your regular password):
     https://myaccount.google.com/apppasswords
  3. Run manually:  python wsj_digest.py
  4. Schedule daily: bash setup_wsj_cron.sh

Environment variables (set in .env):
  EMAIL_SENDER        - Gmail address used to send the email
  EMAIL_PASSWORD      - Gmail App Password
  EMAIL_RECIPIENT     - Address that receives the digest (defaults to sender)
  WSJ_MACRO_FEED      - Override RSS URL for macroeconomics section (optional)
  WSJ_BUSINESS_FEED   - Override RSS URL for business/company section (optional)
  WSJ_OPINION_FEED    - Override RSS URL for opinion section (optional)
  DIGEST_SEND_TIME    - Informational only; actual schedule set in cron (optional)
"""

import os
import re
import sys
import smtplib
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import date, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
EMAIL_SENDER    = os.environ["EMAIL_SENDER"]
EMAIL_PASSWORD  = os.environ["EMAIL_PASSWORD"]
EMAIL_RECIPIENT = os.getenv("EMAIL_RECIPIENT", EMAIL_SENDER)

# WSJ RSS feed URLs — override via .env if WSJ changes them
CATEGORIES = [
    {
        "key":    "macro",
        "label":  "Macroeconomics",
        "badge":  "ECONOMY",
        "feed":   os.getenv(
            "WSJ_MACRO_FEED",
            "https://feeds.content.dowjones.io/public/rss/WSJ_Economy",
        ),
        "accent": "#1e3a5f",
        "light":  "#dbeafe",
        "text":   "#1e40af",
    },
    {
        "key":    "business",
        "label":  "Industry / Company",
        "badge":  "BUSINESS",
        "feed":   os.getenv(
            "WSJ_BUSINESS_FEED",
            "https://feeds.content.dowjones.io/public/rss/WSJ_US_Business",
        ),
        "accent": "#14532d",
        "light":  "#dcfce7",
        "text":   "#166534",
    },
    {
        "key":    "opinion",
        "label":  "Opinion",
        "badge":  "OP-ED",
        "feed":   os.getenv(
            "WSJ_OPINION_FEED",
            "https://feeds.content.dowjones.io/public/rss/WSJopinion",
        ),
        "accent": "#7c2d12",
        "light":  "#fee2e2",
        "text":   "#991b1b",
    },
]

DC_NS = "http://purl.org/dc/elements/1.1/"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_html(text):
    """Remove HTML tags and decode common entities."""
    text = re.sub(r"<[^>]+>", "", text)
    replacements = {
        "&amp;": "&", "&lt;": "<", "&gt;": ">",
        "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
        "&#8220;": "\u201c", "&#8221;": "\u201d",
        "&#8216;": "\u2018", "&#8217;": "\u2019",
    }
    for entity, char in replacements.items():
        text = text.replace(entity, char)
    return " ".join(text.split())


def format_pub_date(pub_date_str):
    """Parse an RSS pubDate string and return a human-readable form."""
    if not pub_date_str:
        return ""
    # RFC 2822 with timezone offset, e.g. "Mon, 07 Apr 2025 10:30:00 +0000"
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z"):
        try:
            dt = datetime.strptime(pub_date_str.strip(), fmt)
            return dt.strftime("%-I:%M %p ET, %b %-d")
        except ValueError:
            continue
    return pub_date_str.strip()


def fetch_top_article(feed_url):
    """
    Fetch an RSS feed and return a dict for the most recent item, or None on failure.

    Returned dict keys: title, link, description, author, pub_display
    """
    try:
        req = urllib.request.Request(
            feed_url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; WSJ-Digest/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
    except urllib.error.URLError as exc:
        print(f"  Warning: could not fetch {feed_url}: {exc}", file=sys.stderr)
        return None

    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        print(f"  Warning: could not parse feed {feed_url}: {exc}", file=sys.stderr)
        return None

    channel = root.find("channel")
    if channel is None:
        print(f"  Warning: no <channel> in feed {feed_url}", file=sys.stderr)
        return None

    item = channel.find("item")
    if item is None:
        print(f"  Warning: no <item> in feed {feed_url}", file=sys.stderr)
        return None

    title = strip_html(item.findtext("title") or "")
    link  = (item.findtext("link") or "").strip()

    # Some feeds use <description>, others <content:encoded>
    description = strip_html(item.findtext("description") or "")

    pub_display = format_pub_date(item.findtext("pubDate") or "")
    author = (item.findtext(f"{{{DC_NS}}}creator") or "").strip()

    # Truncate long summaries
    if len(description) > 380:
        description = description[:377].rstrip() + "..."

    if not title or not link:
        return None

    return {
        "title":       title,
        "link":        link,
        "description": description,
        "author":      author,
        "pub_display": pub_display,
    }


# ---------------------------------------------------------------------------
# HTML builders
# ---------------------------------------------------------------------------

def build_article_card(cat, article):
    """Return the HTML block for one article card."""
    accent = cat["accent"]
    badge  = cat["badge"]
    label  = cat["label"]
    text_c = cat["text"]

    if article is None:
        return f"""
    <div style="margin-bottom:24px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:{accent};padding:14px 20px;">
        <span style="background:rgba(255,255,255,0.18);color:#fff;font-size:0.68em;font-weight:700;
                     letter-spacing:0.1em;padding:3px 9px;border-radius:4px;">{badge}</span>
        <span style="color:#fff;font-size:0.88em;margin-left:10px;opacity:0.88;">{label}</span>
      </div>
      <div style="padding:20px;color:#6b7280;font-style:italic;font-size:0.9em;">
        Could not load an article for this category. Visit
        <a href="https://www.wsj.com" style="color:{text_c};">wsj.com</a> directly.
      </div>
    </div>"""

    title       = article["title"]
    link        = article["link"]
    description = article["description"]
    author      = article.get("author", "")
    pub_display = article.get("pub_display", "")

    meta_parts = [p for p in [author, pub_display] if p]
    meta_html  = (
        f'<p style="margin:0 0 14px;font-size:0.76em;color:#9ca3af;">'
        + " &bull; ".join(meta_parts)
        + "</p>"
        if meta_parts else ""
    )

    return f"""
    <div style="margin-bottom:24px;border-radius:12px;overflow:hidden;
                border:1px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      <!-- Category header -->
      <div style="background:{accent};padding:14px 20px;">
        <span style="background:rgba(255,255,255,0.18);color:#fff;font-size:0.68em;font-weight:700;
                     letter-spacing:0.1em;padding:3px 9px;border-radius:4px;">{badge}</span>
        <span style="color:#fff;font-size:0.88em;margin-left:10px;opacity:0.88;">{label}</span>
      </div>
      <!-- Article body -->
      <div style="padding:22px 22px 20px;background:#fff;">
        <a href="{link}" style="text-decoration:none;">
          <h2 style="margin:0 0 10px;font-size:1.12em;font-weight:700;color:#111827;
                     line-height:1.45;font-family:Georgia,serif;">{title}</h2>
        </a>
        {meta_html}
        <p style="margin:0 0 18px;font-size:0.9em;color:#374151;line-height:1.65;">{description}</p>
        <a href="{link}"
           style="display:inline-block;padding:9px 20px;background:{accent};color:#fff;
                  font-size:0.8em;font-weight:600;border-radius:6px;text-decoration:none;
                  letter-spacing:0.02em;">
          Read Full Article &rarr;
        </a>
      </div>
    </div>"""


def build_html(results):
    """Build the full HTML email body."""
    today   = date.today()
    day_str = today.strftime("%A, %B %-d, %Y")

    cards = "\n".join(build_article_card(cat, art) for cat, art in results)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WSJ Daily Digest</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:28px auto;background:#fff;border-radius:16px;
              overflow:hidden;box-shadow:0 4px 28px rgba(0,0,0,0.09);">

    <!-- Header -->
    <div style="background:#0a1628;padding:30px 28px 26px;">
      <div style="font-size:1.35em;font-weight:800;color:#ffffff;letter-spacing:-0.01em;
                  font-family:Georgia,serif;">
        The Wall Street Journal
      </div>
      <div style="margin-top:6px;color:#94a3b8;font-size:0.82em;letter-spacing:0.03em;">
        DAILY DIGEST &nbsp;&bull;&nbsp; {day_str}
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);
                  color:#cbd5e1;font-size:0.82em;line-height:1.5;">
        Your three-article morning briefing: macroeconomics &bull; industry news &bull; opinion.
      </div>
    </div>

    <!-- Article cards -->
    <div style="padding:26px 22px 10px;">
{cards}
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;
                font-size:0.73em;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Articles sourced via
      <a href="https://www.wsj.com/news/rss-news-and-feeds" style="color:#64748b;">WSJ RSS feeds</a>.
      Full text requires your WSJ subscription.
    </div>

  </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Email sender
# ---------------------------------------------------------------------------

def send_email(html_body, subject):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = EMAIL_SENDER
    msg["To"]      = EMAIL_RECIPIENT
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, EMAIL_RECIPIENT, msg.as_string())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    today = date.today()
    print(f"WSJ Daily Digest — {today}")

    results = []
    for cat in CATEGORIES:
        print(f"  [{cat['badge']}] Fetching {cat['label']} feed ...")
        article = fetch_top_article(cat["feed"])
        if article:
            print(f"         -> {article['title'][:72]}...")
        else:
            print(f"         -> No article retrieved (check feed URL or network)")
        results.append((cat, article))

    # Require at least one article to send
    if all(art is None for _, art in results):
        print("ERROR: All feeds failed. No email sent.", file=sys.stderr)
        sys.exit(1)

    html    = build_html(results)
    subject = f"WSJ Daily Digest — {today.strftime('%a, %b %-d')}"

    print(f"\nSending digest to {EMAIL_RECIPIENT} ...")
    try:
        send_email(html, subject)
        print("Email sent successfully!")
    except smtplib.SMTPAuthenticationError as exc:
        print(f"SMTP auth failed — check EMAIL_SENDER / EMAIL_PASSWORD: {exc}", file=sys.stderr)
        sys.exit(1)
    except smtplib.SMTPException as exc:
        print(f"Failed to send email: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
