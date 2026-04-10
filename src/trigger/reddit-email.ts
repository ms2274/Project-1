import { schedules, logger } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";

// ── Types ────────────────────────────────────────────────────────────────────

interface RedditPost {
  title: string;
  author: string;
  score: number;
  url: string;
  permalink: string;
  num_comments: number;
  selftext: string;
}

interface RedditApiResponse {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchTopPosts(subreddit: string, limit = 5): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?limit=${limit}&t=day`;

  const response = await fetch(url, {
    headers: {
      // Reddit blocks the default Node.js User-Agent
      "User-Agent": "reddit-digest-bot/1.0 (automated digest; contact via Trigger.dev)",
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as RedditApiResponse;
  return json.data.children.map((child) => child.data);
}

function formatPostsAsHtml(posts: RedditPost[], subreddit: string): string {
  const postRows = posts
    .map(
      (post, i) => `
    <tr>
      <td style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">
          #${i + 1} &nbsp;·&nbsp; ▲ ${post.score.toLocaleString()} points &nbsp;·&nbsp;
          ${post.num_comments.toLocaleString()} comments &nbsp;·&nbsp;
          u/${post.author}
        </p>
        <a href="https://reddit.com${post.permalink}"
           style="font-size: 16px; font-weight: 600; color: #111827; text-decoration: none;">
          ${post.title}
        </a>
        ${
          post.selftext
            ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #374151; line-height: 1.5;">
            ${post.selftext.slice(0, 200).replace(/</g, "&lt;").replace(/>/g, "&gt;")}${post.selftext.length > 200 ? "…" : ""}
           </p>`
            : ""
        }
        <p style="margin: 8px 0 0 0;">
          <a href="https://reddit.com${post.permalink}"
             style="font-size: 13px; color: #f97316; text-decoration: none;">
            Read on Reddit →
          </a>
        </p>
      </td>
    </tr>`
    )
    .join("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #ff4500; padding: 28px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px;">r/${subreddit} Daily Digest</h1>
              <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                Top ${posts.length} posts for ${today}
              </p>
            </td>
          </tr>

          <!-- Posts -->
          <tr>
            <td style="padding: 8px 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${postRows}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f3f4f6; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Sent by your Trigger.dev Reddit digest ·
                <a href="https://www.reddit.com/r/${subreddit}" style="color: #f97316;">
                  Visit r/${subreddit}
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Scheduled Task ───────────────────────────────────────────────────────────

export const redditDigestTask = schedules.task({
  id: "reddit-daily-digest",
  // Runs every day at 8:00 AM UTC — adjust timezone via the Trigger.dev dashboard
  cron: "0 8 * * *",

  run: async () => {
    const subreddit = "entrepreneur";
    const recipientEmail = process.env.RECIPIENT_EMAIL;
    const senderEmail = process.env.SENDER_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!recipientEmail || !senderEmail || !resendApiKey) {
      throw new Error(
        "Missing required environment variables: RECIPIENT_EMAIL, SENDER_EMAIL, or RESEND_API_KEY"
      );
    }

    // 1. Fetch top posts
    logger.info(`Fetching top posts from r/${subreddit}...`);
    const posts = await fetchTopPosts(subreddit, 5);
    logger.info(`Fetched ${posts.length} posts`, {
      titles: posts.map((p) => p.title),
    });

    // 2. Build email HTML
    const html = formatPostsAsHtml(posts, subreddit);
    const subject = `r/${subreddit} Daily Digest — ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;

    // 3. Send via Resend
    logger.info("Sending email via Resend...");
    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend error: ${JSON.stringify(error)}`);
    }

    logger.info("Email sent successfully", { messageId: data?.id });
    return { success: true, messageId: data?.id, postCount: posts.length };
  },
});
