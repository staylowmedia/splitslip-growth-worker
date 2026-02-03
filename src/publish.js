// src/publish.js
import { getSupabaseAdmin } from "./db.js";
import { TwitterApi } from "twitter-api-v2";
import { generateTweet } from "./ai.js";

function getXClientOAuth1() {
  const appKey = process.env.X_CONSUMER_KEY || process.env.X_OAUTH1_CONSUMER_KEY;
  const appSecret = process.env.X_CONSUMER_SECRET || process.env.X_OAUTH1_CONSUMER_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN || process.env.X_OAUTH1_ACCESS_TOKEN;
  const accessSecret =
    process.env.X_ACCESS_TOKEN_SECRET || process.env.X_OAUTH1_ACCESS_TOKEN_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error(
      "Missing X OAuth1 env vars. Need X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET"
    );
  }

  return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
}

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

// ✅ No schema changes needed: we store posted_at inside metrics JSON
async function getLastPostedAtISO(supabase) {
  const { data, error } = await supabase
    .schema("growth")
    .from("drafts")
    .select("id, metrics, published_at")
    .eq("platform", "x")
    .eq("status", "published")
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw new Error("Fetch last published failed: " + error.message);
  const last = (data && data[0]) || null;
  if (!last) return null;

  // Prefer explicit column if it exists, else metrics.posted_at
  const iso =
    (last.published_at && String(last.published_at)) ||
    (last.metrics && last.metrics.posted_at) ||
    null;

  return iso ? String(iso) : null;
}

function hoursSince(iso) {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60);
}

async function markPublished(supabase, draft, { tweetId, postedAtISO }) {
  const posted_at = postedAtISO || new Date().toISOString();
  const metrics = { ...(draft.metrics || {}), tweet_id: tweetId, posted_at };

  // Try rich update first; if schema lacks columns, fall back
  const { error: e1 } = await supabase
    .schema("growth")
    .from("drafts")
    .update({
      status: "published",
      metrics,
      tweet_id: tweetId ?? null,
      published_at: posted_at,
    })
    .eq("id", draft.id);

  if (!e1) return;

  // fallback: status + metrics only (works with your current table)
  const { error: e2 } = await supabase
    .schema("growth")
    .from("drafts")
    .update({ status: "published", metrics })
    .eq("id", draft.id);

  if (e2) throw new Error("Update published failed: " + e2.message + " (after: " + e1.message + ")");
}

async function markFailed(supabase, draftId, err) {
  const msg = String(err?.message || err || "unknown error").slice(0, 500);

  const { error } = await supabase
    .schema("growth")
    .from("drafts")
    .update({ status: "failed", last_error: msg })
    .eq("id", draftId);

  if (!error) return;

  await supabase
    .schema("growth")
    .from("drafts")
    .update({ status: "failed" })
    .eq("id", draftId);
}

/**
 * Publish at most one tweet per N hours.
 * Controlled by env:
 *   X_POST_DRAFTS=true  -> enables posting
 *   X_MIN_HOURS_BETWEEN_POSTS=24 -> default 24
 */
export async function publishOne() {
  const supabase = getSupabaseAdmin();

  if (process.env.X_POST_DRAFTS !== "true") {
    console.log("[publish] X_POST_DRAFTS!=true, not posting.");
    return { ok: true, didPublish: false, reason: "disabled" };
  }

  const minHours = Number(process.env.X_MIN_HOURS_BETWEEN_POSTS || "24");
  const lastISO = await getLastPostedAtISO(supabase);
  const since = hoursSince(lastISO);

  if (since < minHours) {
    console.log(`[publish] Skipping (last post ${since.toFixed(2)}h ago, min=${minHours}h).`);
    return { ok: true, didPublish: false, reason: "rate_limited", lastPostedAt: lastISO };
  }

  const draft = await fetchNextDraft(supabase);
  if (!draft) {
    console.log("[publish] No drafted posts found.");
    return { ok: true, didPublish: false, reason: "no_drafts" };
  }

  const x = getXClientOAuth1();

  try {
    const tweet = await generateTweet({
      draftText: draft.text || "",
      context: "",
      tone: "witty, minimal, brand-safe",
    });

    console.log("[publish] Tweet length:", tweet.length);

    const result = await x.v2.tweet(tweet);
    const tweetId = result?.data?.id;
    const postedAtISO = new Date().toISOString();

    console.log("[publish] Posted tweet id:", tweetId);

    await markPublished(supabase, draft, { tweetId, postedAtISO });

    return { ok: true, didPublish: true, draftId: draft.id, tweetId, tweet };
  } catch (err) {
    console.error("[publish] Failed:", err);
    await markFailed(supabase, draft.id, err);
    return { ok: false, didPublish: false, draftId: draft.id, error: String(err?.message || err) };
  }
}
