// src/ai.js
// Minimal OpenAI helper (no SDK) using the Responses API via fetch.

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

/**
 * Generate a tweet from a draft (or from scratch) with strict 280-char target.
 * @param {object} args
 * @param {string} [args.draftText] - existing draft text to improve, optional
 * @param {string} [args.context] - optional context (e.g., source text/topic)
 * @param {string} [args.tone] - optional tone hint
 * @returns {Promise<string>}
 */
export async function generateTweet({ draftText = "", context = "", tone = "witty, clear, helpful" } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const system =
    "You write high-performing X (Twitter) posts for a consumer app. " +
    "Constraints: max 280 characters. No hashtags unless explicitly requested. " +
    "Avoid clickbait. Keep it human, sharp, and clear. One idea per tweet.";

  const userParts = [];
  if (context) userParts.push(`Context/idea:\n${context}`);
  if (draftText) userParts.push(`Existing draft (improve it):\n${draftText}`);

  if (!context && !draftText) {
    userParts.push(
      "Write one tweet about how people argue about money because tracking is messy — " +
      "and how scanning receipts + splitting costs removes friction."
    );
  }

  userParts.push(
    `Tone: ${tone}\n` +
      "Return ONLY the final tweet text, nothing else. " +
      "Hard limit: 280 characters."
  );

  const payload = {
    model: DEFAULT_MODEL,
    input: [
      { role: "system", content: [{ type: "text", text: system }] },
      { role: "user", content: [{ type: "text", text: userParts.join("\n\n") }] },
    ],
    // Keep it deterministic-ish
    temperature: 0.7,
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${txt}`);
  }

  const data = await res.json();

  // Responses API typically returns output text in output_text
  const text =
    (data.output_text && String(data.output_text)) ||
    extractAnyText(data) ||
    "";

  const tweet = text.trim().replace(/\s+/g, " ");

  // Final guard
  if (!tweet) throw new Error("OpenAI returned empty tweet");
  if (tweet.length > 280) {
    // Hard-trim as last resort (keeps it robust)
    return tweet.slice(0, 277) + "...";
  }

  return tweet;
}

function extractAnyText(data) {
  try {
    // Fallback parsing if output_text isn't present
    const outputs = data.output || [];
    for (const o of outputs) {
      const content = o.content || [];
      for (const c of content) {
        if (c.type === "output_text" && c.text) return c.text;
        if (c.type === "text" && c.text) return c.text;
      }
    }
  } catch (_) {}
  return null;
}
