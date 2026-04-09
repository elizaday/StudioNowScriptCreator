import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Mode prompts
// ---------------------------------------------------------------------------

const MODE_PROMPTS = {
  tighten: `You are a StudioNow script editor. Your job is to tighten this script by cutting 20-30% of the word count.

Rules:
- Every action line must describe something visually specific. Remove anything generic.
- Every VO line must earn its place. If it doesn't move the story or reveal character, cut it.
- Compress redundant beats into single moments.
- Remove any line that tells the audience something the visual already shows.
- Preserve the emotional arc, the contrast structure, and the core concept engine.
- Keep the three-column format (AUDIO/VO | TC | VISUALS) intact.

Return your response in exactly this format:

---REFINED---
[the full tightened script, including metadata header and table]
---CHANGES---
• [change 1, under 20 words]
• [change 2, under 20 words]
• [change 3, under 20 words]
• [change 4, under 20 words]
---END---`,

  punch: `You are a world-class script doctor working for StudioNow. Elevate this script — sharper language, stronger verbs, more cinematic specificity. Do not make it longer. Make every word hit harder.

Rules:
- Replace every passive or weak verb with an active, specific alternative.
- Make visuals concrete. "footage of people" becomes a specific, shootable scene.
- Give dialogue and VO more subtext and rhythm. Use the StudioNow contrast structure.
- Strengthen the opening (no throat-clearing) and the close (must land like a gut punch).
- Keep the three-column format (AUDIO/VO | TC | VISUALS) intact.
- Check every line against the StudioNow blacklist: no "coveted," "leveraging," "best-in-class," "immersive," "game-changing," "world-class," "iconic," "transformative," "holistic," "synergy."

Return your response in exactly this format:

---REFINED---
[the full punched-up script, including metadata header and table]
---CHANGES---
• [change 1, under 20 words]
• [change 2, under 20 words]
• [change 3, under 20 words]
• [change 4, under 20 words]
---END---`,

  format: `You are a StudioNow script supervisor preparing this for client review and production.

Format rules:
- Ensure the three-column table format: AUDIO/VO | TC | VISUALS
- Add a metadata header if missing: [TITLE IN ALL CAPS], Client, Writer: StudioNow AI, Date, Version
- Write action/visual descriptions in present tense, active verbs
- Format all SUPERs in bold: **SUPER:** "Text"
- Format SFX in italics: *SFX: description*
- Add timecode ranges (e.g., :00–:12) per section based on content density
- Flag any asset needs: (stock), (existing footage), (to-shoot), (need assets)
- Keep all original content — reformat only, do not rewrite

Return your response in exactly this format:

---REFINED---
[the fully formatted script]
---CHANGES---
• [formatting change 1, under 20 words]
• [formatting change 2, under 20 words]
• [formatting change 3, under 20 words]
• [formatting change 4, under 20 words]
---END---`,

  notes: `You are a senior StudioNow creative director reviewing this script before production. Do NOT rewrite the script. Instead, annotate it with inline [NOTE: ...] comments.

Annotation rules:
- Flag unclear or unshootable visual direction
- Suggest specific visual approaches for key moments
- Identify beats that could hit harder with a small adjustment
- Praise moments that are working exactly right
- Raise questions the director or editor needs to answer before production
- Check against StudioNow voice: is this confident, contrast-driven, and specific? Flag where it isn't.
- Flag any blacklisted language
- Be direct, specific, and opinionated — you are talking to your team

Return your response in exactly this format:

---REFINED---
[the original script with [NOTE: ...] annotations woven throughout]
---CHANGES---
• [key note 1 summary, under 20 words]
• [key note 2 summary, under 20 words]
• [key note 3 summary, under 20 words]
• [key note 4 summary, under 20 words]
---END---`,
};

const VALID_MODES = Object.keys(MODE_PROMPTS);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrompt(script, mode, customFeedback) {
  const modePrompt = MODE_PROMPTS[mode];
  const feedbackBlock = customFeedback?.trim()
    ? `\nADDITIONAL DIRECTION FROM PRODUCER:\n${customFeedback.trim()}\n`
    : "";

  return `${modePrompt}
${feedbackBlock}
SCRIPT:
${script}`;
}

function parseResponse(text) {
  const refinedMatch = text.match(/---REFINED---\s*([\s\S]*?)\s*---CHANGES---/);
  const changesMatch = text.match(/---CHANGES---\s*([\s\S]*?)\s*---END---/);

  const refined = refinedMatch ? refinedMatch[1].trim() : text.trim();
  const changesRaw = changesMatch ? changesMatch[1].trim() : "";

  const changes = changesRaw
    .split("\n")
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);

  return { refined, changes };
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateRuntime(wordCount) {
  const seconds = Math.round((wordCount / 150) * 60);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `:${String(s).padStart(2, "0")}`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }

  let script = "";
  let mode = "";

  try {
    const body = await req.json();
    script = (body?.script || "").trim();
    mode = (body?.mode || "").trim();
    const customFeedback = body?.customFeedback || "";

    if (!script || script.length < 40) {
      return jsonResponse({ error: "Script is too short (minimum 40 characters)" }, 400);
    }

    if (!VALID_MODES.includes(mode)) {
      return jsonResponse({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` }, 400);
    }

    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(script, mode, customFeedback);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].text;
    const { refined, changes } = parseResponse(responseText);

    const originalWords = countWords(script);
    const refinedWords = countWords(refined);

    return jsonResponse({
      refined,
      changes,
      stats: {
        originalWords,
        refinedWords,
        originalRuntime: estimateRuntime(originalWords),
        refinedRuntime: estimateRuntime(refinedWords),
      },
    });
  } catch (error) {
    console.error("script-refine error:", error);
    const originalWords = countWords(script);
    return jsonResponse({
      refined: script || "",
      changes: ["An error occurred — original script returned."],
      stats: {
        originalWords,
        refinedWords: originalWords,
        originalRuntime: estimateRuntime(originalWords),
        refinedRuntime: estimateRuntime(originalWords),
      },
      fallback: true,
      details: error.message,
    });
  }
};

export const config = {
  path: "/api/refine",
};
