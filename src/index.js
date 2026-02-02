import { getSupabaseAdmin } from "./db.js";
import { seedOnce } from "./seed.js";

async function main() {
  console.log("[growth-worker] boot");
  const supabase = getSupabaseAdmin();

  // Run seed once (first deploy)
  if (process.env.RUN_SEED === "true") {
    console.log("[growth-worker] RUN_SEED=true, seeding...");
    const result = await seedOnce(supabase);
    console.log("[growth-worker] seed ok:", result);
    console.log("[growth-worker] IMPORTANT: set RUN_SEED=false after verification.");
  } else {
    console.log("[growth-worker] RUN_SEED!=true, idle mode (no-op).");
  }

  // Keep worker alive (Render background workers should not exit)
  setInterval(() => {
    console.log("[growth-worker] heartbeat", new Date().toISOString());
  }, 60_000);
}

main().catch((err) => {
  console.error("[growth-worker] fatal:", err);
  process.exit(1);
});
