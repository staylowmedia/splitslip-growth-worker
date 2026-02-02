export async function seedOnce(supabase) {
  const now = new Date().toISOString();
  const externalId = "seed-" + now;

  // 1) Insert a source (safe: growth schema only)
  const { data: src, error: srcErr } = await supabase
    .schema("growth")
    .from("sources")
    .insert({
      platform: "x",
      external_id: externalId,
      url: "https://example.com/seed",
      author_handle: "splitslip",
      author_display: "SplitSlip Seed",
      text: "Seed test: roommates arguing about who paid for groceries.",
      lang: "en",
      metrics: { seed: true, created_at: now }
    })
    .select()
    .single();

  if (srcErr) throw new Error("Insert growth.sources failed: " + srcErr.message);

  // 2) Insert a draft (minimal test)
  const { data: draft, error: dErr } = await supabase
    .schema("growth")
    .from("drafts")
    .insert({
      platform: "x",
      type: "post",
      text: "Money arguments aren’t about money. They’re about tracking. Fix the tracking.",
      risk: "low",
      confidence: 0.9,
      policy_flags: ["seed"],
      model: "seed",
      status: "drafted"
    })
    .select()
    .single();

  if (dErr) throw new Error("Insert growth.drafts failed: " + dErr.message);

  // 3) Read back count (proof it’s working)
  const { count, error: cErr } = await supabase
    .schema("growth")
    .from("drafts")
    .select("*", { count: "exact", head: true });

  if (cErr) throw new Error("Count growth.drafts failed: " + cErr.message);

  return { source_id: src.id, draft_id: draft.id, drafts_count: count };
}
