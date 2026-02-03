// src/publish.js
import { getSupabaseAdmin } from "./db.js";
import { TwitterApi } from "twitter-api-v2";
import { generateTweet } from "./ai.js";

/**
 * Build an X client using OAuth 1.0a user context.
 * Uses the env vars you already have in Render:
 *   X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 * (Also supports the older naming if you switch later.)
 */
function getXClientOAuth1() {
  const appKey = process.env.X_CONSUMER_KEY || process.env.X_OAUTH1_CONSUMER_KEY;
  const appSecret = process.env.X_CONSUMER_SECRET || process.env.X_OAUTH1_CONSUMER_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN || process.env.X_OAUTH1_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET || process.env.X_OAUTH1_ACCESS_TOKEN_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error(
      "Missing X OAuth1 env vars. Need X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET"
    );
  }

  return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
}

/**
 * Fetch one draft to publish.
 * Expects: growth.drafts with columns: id, text, status, platform, created_at (or at least id/text/status/platform)
 */
async function fetchNextDraft(supabase) {
  const { data, error } = await supabase
    .schema("growth")
    .from("drafts")
    .select("*")
    .eq("platform", "x")
    .eq("status", "drafted")
    .order("id", { ascending: true })
    .limit(1);

  if (error) throw new Error("Fetch draft failed: " + error.message);
  return (data && data[0]) || null;
}

/**
 * Update draft status. Tries to set tweet_id + published_at if possible,
 * otherwise falls back to status only (so you don't get blocked by schema).
 */
async function markPublished(supabase, draftId, { tweetId } = {}) {
  const publishedAt = new Date().toISOString();

  // Attempt with extra columns first
  const attempt1 = await supabase
    .schema("growth")
    .from("drafts")
    .update({
      status: "published",
      tweet_id: tweetId || null,
      published_at: publishedAt,
    })
    .eq("id", draftId)
    .select()
    .maybeSingle?.();

  // some supabase-js versions don't have maybeSingle() on update
  // so we also catch errors and retry with minimal update
  if (attempt1?.error) {
    const msg = attempt1.error.message || "";
    // fallback if schema doesn't have those columns
    const { error: e2 } = await supabase
      .schema("growth")
      .from("drafts")
      .update({ status: "published" })
      .eq("id", draftId);

    if (e2) throw new Error("Update published failed: " + e2.message + " (after: " + msg + ")");
    return;
  }

  // If attempt1 didn't run because maybeSingle isn't available:
  if (!attempt1) {
    const { error: e1 } = await supabase
      .schema("growth")
      .from("drafts")
      .update({
        status: "published",
        tweet_id: tweetId || null,
        published_at: publishedAt,
      })
      .eq("id", draftId);

    if (e1) {
      const { error: e2 } = await supabase
        .schema("growth")
        .from("drafts")
        .update({ status: "published" })
        .eq("id", draftId);

      if (e2) throw new Error("Update published failed: " + e2.message + " (after: " + e1.message + ")");
    }
  }
}

/**
 * Mark draft as failed so you can see it and not get stuck in a loop.
 */
async function markFailed(supabase, draftId, err) {
  const msg = String(err?.message || err || "unknown error").slice(0, 500);
  // Try to store error in common columns if present; else just status.
  const { error } = await supabase
    .schema("growth")
    .from("drafts")
    .update({ status: "failed", last_error: msg })
    .eq("id", draftId);

  if (!error) return;

  // fallback
  await supabase
    .schema("growth")
    .from("drafts")
    .update({ status: "failed" })
    .eq("id", draftId);
}

/**
 * Publish exactly one draft if available.
 */
export async function publishOne() {
  const supabase = getSupabaseAdmin();
  const x = getXClientOAuth1();

  const draft = await fetchNextDraft(supabase);
  if (!draft) {
    console.log("[publish] No drafted posts found.");
    return { ok: true, didPublish: false };
  }

  console.log("[publish] Found draft id:", draft.id);

  try {
    // If draft.text exists, improve it; otherwise generate from scratch.
    const tweet = await generateTweet({
      draftText: draft.text || "",
      context: "", // You can enrich later with sources/topics
      tone: "witty, minimal, brand-safe",
    });

    console.log("[publish] Tweet length:", tweet.length);

    // Post to X
    const result = await x.v2.tweet(tweet);
    const tweetId = result?.data?.id;

    console.log("[publish] Posted tweet id:", tweetId);

    // Mark published in DB
    await markPublished(supabase, draft.id, { tweetId });

    return { ok: true, didPublish: true, draftId: draft.id, tweetId, tweet };
  } catch (err) {
    console.error("[publish] Failed:", err);
    await markFailed(supabase, draft.id, err);
    return { ok: false, didPublish: false, draftId: draft.id, error: String(err?.message || err) };
  }
}
