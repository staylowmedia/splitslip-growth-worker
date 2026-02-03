import { getSupabaseAdmin } from "./db.js";
import { generateTweet } from "./ai.js";
import { publishTweet } from "./publish.js";

const POST_INTERVAL_HOURS = 24;

async function shouldPost(supabase) {
  const { data } = await supabase
    .schema("growth")
    .from("meta")
    .select("value")
    .eq("key", "last_tweet_at")
    .maybeSingle();

  if (!data) return true;

  const last = new Date(data.value);
  const now = new Date();
  const diffHours = (now - last) / (1000 * 60 * 60);

  return diffHours >= POST_INTERVAL_HOURS;
}

async function updateLastPost(supabase) {
  const now = new Date().toISOString();

  await supabase
    .schema("growth")
    .from("meta")
    .upsert({
      key: "last_tweet_at",
      value: now,
    });
}

async function runOnce() {
  console.log("[growth-worker] tick");

  const supabase = getSupabaseAdmin();

  const ok = await shouldPost(supabase);
  if (!ok) {
    console.log("[growth-worker] Not time yet");
    return;
  }

  const tweet = await generateTweet();
  console.log("[growth-worker] Generated:", tweet);

  const res = await publishTweet(tweet);
  console.log("[growth-worker] Posted:", res.tweetId);

  await updateLastPost(supabase);
}

async function main() {
  console.log("[growth-worker] boot");

  // kjør umiddelbart ved deploy
  await runOnce();

  // sjekk hver time (men poster maks 1/dag)
  setInterval(runOnce, 60 * 60 * 1000);
}

main().catch((err) => {
  console.error("[growth-worker] fatal", err);
  process.exit(1);
});
