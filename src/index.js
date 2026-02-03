import { getSupabaseAdmin } from "./db.js";
import { seedOnce } from "./seed.js";
import { publishOne } from "./publish.js";

async function main() {
  console.log("[growth-worker] boot");
  const supabase = getSupabaseAdmin();

  // Optional: seed once (creates a draft in growth.drafts)
  if (process.env.RUN_SEED === "true") {
    console.log("[growth-worker] RUN_SEED=true, seeding...");
    const result = await seedOnce(supabase);
    console.log("[growth-worker] seed ok:", result);
    console.log("[growth-worker] IMPORTANT: set RUN_SEED=false after verification.");
  } else {
    console.log("[growth-worker] RUN_SEED!=true, normal mode.");
  }

  // Try publish once on boot
  try {
    await publishOne();
  } catch (e) {
    console.error("[growth-worker] publish error on boot:", e);
  }

  // Check every hour; publishOne enforces 24h minimum via X_MIN_HOURS_BETWEEN_POSTS
  setInterval(async () => {
    console.log("[growth-worker] heartbeat", new Date().toISOString());
    try {
      await publishOne();
    } catch (e) {
      console.error("[growth-worker] publish error:", e);
    }
  }, 60 * 60 * 1000);
}

main().catch((err) => {
  console.error("[growth-worker] fatal:", err);
  process.exit(1);
});
