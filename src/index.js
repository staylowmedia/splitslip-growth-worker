import { getSupabaseAdmin } from "./db.js";
import { seedOnce } from "./seed.js";
import { getXClient } from "./x-client.js";

async function postOneDraftIfEnabled(supabase) {
  if (process.env.X_POST_DRAFTS !== "true") {
    console.log("[growth-worker] X_POST_DRAFTS!=true, not posting.");
    return;
  }

  const x = getXClient();

  // 1) Fetch one draft
  const { data: draft, error } = await supabase
    .schema("growth")
    .from("drafts")
    .select("*")
    .eq("platform", "x")
    .eq("status", "drafted")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Fetch draft failed: " + error.message);
  if (!draft) {
    console.log("[growth-worker] No drafted posts found.");
    return;
  }

  // 2) Post tweet
  console.log("[growth-worker] Posting draft id:", draft.id);
  const res = await x.v2.tweet(draft.text);
  const tweetId = res?.data?.id;
  console.log("[growth-worker] Tweet posted:", tweetId);

  // 3) Mark draft as posted
  const { error: uErr } = await supabase
    .schema("growth")
    .from("drafts")
    .update({
      status: "posted",
      metrics: { ...(draft.metrics || {}), tweet_id: tweetId, posted_at: new Date().toISOString() }
    })
    .eq("id", draft.id);

  if (uErr) throw new Error("Update draft failed: " + uErr.message);
}

async function main() {
  console.log("[growth-worker] boot");
  const supabase = getSupabaseAdmin();

  if (process.env.RUN_SEED === "true") {
    console.log("[growth-worker] RUN_SEED=true, seeding...");
    const result = await seedOnce(supabase);
    console.log("[growth-worker] seed ok:", result);
    console.log("[growth-worker] IMPORTANT: set RUN_SEED=false after verification.");
  } else {
    console.log("[growth-worker] RUN_SEED!=true, idle mode (no-op).");
  }

  // Try post once on boot
  await postOneDraftIfEnabled(supabase);

  // Heartbeat + optional periodic posting
  setInterval(async () => {
    console.log("[growth-worker] heartbeat", new Date().toISOString());

    // Optional periodic posting
    if (process.env.X_POST_EVERY_MINUTES) {
      await postOneDraftIfEnabled(supabase);
    }
  }, 60_000);
}

main().catch((err) => {
  console.error("[growth-worker] fatal:", err);
  process.exit(1);
});
