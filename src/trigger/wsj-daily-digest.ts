import { schedules } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { XMLParser } from "fast-xml-parser";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Article {
  title: string;
  link: string;
  description: string;
  author: string;
  pubDate: string;
}

interface Category {
  key: string;
  label: string;
  badge: string;
  feedUrl: string;
  accent: string;
  textColor: string;
}

// ---------------------------------------------------------------------------
// Google News RSS — searches within wsj.com, works from any IP, no key needed
// ---------------------------------------------------------------------------

const CATEGORIES: Category[] = [
  {
    key: "macro",
    label: "Macroeconomics",
    badge: "ECONOMY",
    feedUrl:
      'https://news.google.com/rss/search?q=site:wsj.com+economy+OR+inflation+OR+"federal+reserve"+OR+GDP&hl=en-US&gl=US&ceid=US:en',
    accent: "#1e3a5f",
    textColor: "#1e40af",
  },
  {
    key: "business",
    label: "Industry / Company",
    badge: "BUSINESS",
    feedUrl:
      "https://news.google.com/rss/search?q=site:wsj.com+company+OR+earnings+OR+merger+OR+acquisition&hl=en-US&gl=US&ceid=US:en",
    accent: "#14532d",
    textColor: "#166534",
  },
  {
    key: "opinion",
    label: "Opinion",
    badge: "OP-ED",
    feedUrl:
      "https://news.google.com/rss/search?q=site:wsj.com+opinion&hl=en-US&gl=US&ceid=US:en",
    accent: "#7c2d12",
    textColor: "#991b1b",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPubDate(pubDate: string): string {
  if (!pubDate) return "";
  try {
    const dt = new Date(pubDate);
    return dt.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
      timeZoneName: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return pubDate;
  }
}

async function fetchTopArticle(feedUrl: string): Promise<Article | null> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error(`Feed failed: ${feedUrl} → HTTP ${response.status}`);
      return null;
    }

    const xml = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml);

    const items = parsed?.rss?.channel?.item;
    const item = Array.isArray(items) ? items[0] : items;
    if (!item) return null;

    // Google News appends " - Wall Street Journal" to titles — strip it
    let title = stripHtml(String(item.title ?? ""));
    title = title.replace(/\s*-\s*Wall Street Journal\s*$/i, "").trim();

    const link = String(item.link ?? "").trim();
    let description = stripHtml(String(item.description ?? ""));
    const pubDate = String(item.pubDate ?? "").trim();

    if (!title || !link) return null;
    if (description.length > 380) {
      description = description.slice(0, 377).trimEnd() + "...";
    }

    return { title, link, description, author: "Wall Street Journal", pubDate };
  } catch (err) {
    console.error(`Failed to fetch feed ${feedUrl}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML email builder
// ---------------------------------------------------------------------------

function buildArticleCard(cat: Category, article: Article | null): string {
  const { accent, badge, label, textColor } = cat;

  if (!article) {
    return `
    <div style="margin-bottom:24px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:${accent};padding:14px 20px;">
        <span style="background:rgba(255,255,255,0.18);color:#fff;font-size:0.68em;font-weight:700;
                     letter-spacing:0.1em;padding:3px 9px;border-radius:4px;">${badge}</span>
        <span style="color:#fff;font-size:0.88em;margin-left:10px;opacity:0.88;">${label}</span>
      </div>
      <div style="padding:20px;color:#6b7280;font-style:italic;font-size:0.9em;">
        Could not load an article for this category. Visit
        <a href="https://www.wsj.com" style="color:${textColor};">wsj.com</a> directly.
      </div>
    </div>`;
  }

  const { title, link, description, author, pubDate } = article;
  const metaParts = [author, pubDate ? formatPubDate(pubDate) : ""].filter(Boolean);
  const metaHtml = metaParts.length
    ? `<p style="margin:0 0 14px;font-size:0.76em;color:#9ca3af;">${metaParts.join(" &bull; ")}</p>`
    : "";

  return `
    <div style="margin-bottom:24px;border-radius:12px;overflow:hidden;
                border:1px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
      <div style="background:${accent};padding:14px 20px;">
        <span style="background:rgba(255,255,255,0.18);color:#fff;font-size:0.68em;font-weight:700;
                     letter-spacing:0.1em;padding:3px 9px;border-radius:4px;">${badge}</span>
        <span style="color:#fff;font-size:0.88em;margin-left:10px;opacity:0.88;">${label}</span>
      </div>
      <div style="padding:22px 22px 20px;background:#fff;">
        <a href="${link}" style="text-decoration:none;">
          <h2 style="margin:0 0 10px;font-size:1.12em;font-weight:700;color:#111827;
                     line-height:1.45;font-family:Georgia,serif;">${title}</h2>
        </a>
        ${metaHtml}
        <p style="margin:0 0 18px;font-size:0.9em;color:#374151;line-height:1.65;">${description}</p>
        <a href="${link}"
           style="display:inline-block;padding:9px 20px;background:${accent};color:#fff;
                  font-size:0.8em;font-weight:600;border-radius:6px;text-decoration:none;
                  letter-spacing:0.02em;">
          Read Full Article &rarr;
        </a>
      </div>
    </div>`;
}

function buildHtml(results: Array<[Category, Article | null]>): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const cards = results.map(([cat, art]) => buildArticleCard(cat, art)).join("\n");

  return `<!DOCTYPE html>
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

    <div style="background:#0a1628;padding:30px 28px 26px;">
      <div style="font-size:1.35em;font-weight:800;color:#fff;letter-spacing:-0.01em;
                  font-family:Georgia,serif;">The Wall Street Journal</div>
      <div style="margin-top:6px;color:#94a3b8;font-size:0.82em;letter-spacing:0.03em;">
        DAILY DIGEST &nbsp;&bull;&nbsp; ${today}
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);
                  color:#cbd5e1;font-size:0.82em;line-height:1.5;">
        Your three-article morning briefing: macroeconomics &bull; industry news &bull; opinion.
      </div>
    </div>

    <div style="padding:26px 22px 10px;">
      ${cards}
    </div>

    <div style="background:#f8fafc;padding:16px 28px;text-align:center;
                font-size:0.73em;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Articles sourced from
      <a href="https://www.wsj.com" style="color:#64748b;">The Wall Street Journal</a>.
      Full text requires your WSJ subscription.
    </div>

  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Trigger.dev scheduled task — runs weekdays at 6:30 AM Eastern (11:30 UTC)
// ---------------------------------------------------------------------------

export const wsjDailyDigest = schedules.task({
  id: "wsj-daily-digest",
  cron: "30 11 * * 1-5",
  run: async (payload) => {
    console.log("WSJ Daily Digest starting...", { timestamp: payload.timestamp });

    const results: Array<[Category, Article | null]> = [];

    for (const cat of CATEGORIES) {
      console.log(`Fetching [${cat.badge}] ${cat.label}...`);
      const article = await fetchTopArticle(cat.feedUrl);
      if (article) {
        console.log(`  -> "${article.title.slice(0, 72)}..."`);
      } else {
        console.warn(`  -> No article retrieved for ${cat.label}`);
      }
      results.push([cat, article]);
    }

    if (results.every(([, art]) => art === null)) {
      throw new Error("All feeds failed — aborting, no email sent");
    }

    const html = buildHtml(results);
    const todayShort = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "WSJ Digest <onboarding@resend.dev>",
      to: process.env.EMAIL_RECIPIENT!,
      subject: `WSJ Daily Digest — ${todayShort}`,
      html,
    });

    if (error) {
      throw new Error(`Resend send failed: ${JSON.stringify(error)}`);
    }

    console.log(`Email sent. Resend message ID: ${data?.id}`);
    return {
      messageId: data?.id,
      articlesFound: results.filter(([, a]) => a !== null).length,
    };
  },
});
