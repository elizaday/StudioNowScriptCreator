#!/usr/bin/env node
// ============================================================================
// StudioNow Script Creator — Local Server
// ============================================================================
// Zero dependencies. Run with: node server.js
// Opens at http://localhost:3000
//
// Requires: Node 18+ (for native fetch)
// Requires: package.json with "type": "module" in the same directory
//
// Reads all 15 reference .md files + CLAUDE.md + learning.md dynamically.
// Proxies requests to the Anthropic API with streaming.
// ============================================================================

// Version check
const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  console.error(`\n  Error: Node 18+ required (you have ${process.version})`);
  console.error(`  Install the latest LTS from https://nodejs.org\n`);
  process.exit(1);
}

import { createServer } from "http";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Load API key from .env file (simple parser, no dependency)
// ---------------------------------------------------------------------------
let envApiKey = "";
const envPath = join(__dirname, ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
  if (match) envApiKey = match[1].trim();
}
// Also check studionow-web/.env as fallback
if (!envApiKey) {
  const webEnvPath = join(__dirname, "studionow-web", ".env");
  if (existsSync(webEnvPath)) {
    const envContent = readFileSync(webEnvPath, "utf-8");
    const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
    if (match) envApiKey = match[1].trim();
  }
}

// ---------------------------------------------------------------------------
// Build system prompt from CLAUDE.md + all reference files + learning.md
// ---------------------------------------------------------------------------
function buildSystemPrompt() {
  const parts = [];

  // 1. CLAUDE.md (core instructions)
  const claudeMdPath = join(__dirname, "CLAUDE.md");
  if (existsSync(claudeMdPath)) {
    parts.push(readFileSync(claudeMdPath, "utf-8"));
  }

  // 2. All reference files in order
  const refsDir = join(__dirname, "references");
  if (existsSync(refsDir)) {
    const files = readdirSync(refsDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    parts.push("\n---\n\n# Reference Materials\n\nThe following reference documents provide detailed guidance for each aspect of script creation.\n");

    for (const file of files) {
      const content = readFileSync(join(refsDir, file), "utf-8");
      const label = file.replace(/\.md$/, "").replace(/^\d+_/, "");
      parts.push(`\n## Reference: ${file}\n\n${content}`);
    }

    console.log(`  Loaded ${files.length} reference files from /references`);
  }

  // 3. Learning file (accumulated team feedback)
  const learningPaths = [
    join(__dirname, "learning.md"),
    join(__dirname, "studionow-web", "learning.md"),
  ];
  for (const lp of learningPaths) {
    if (existsSync(lp)) {
      const content = readFileSync(lp, "utf-8").trim();
      if (content) {
        parts.push(
          "\n---\n\n# LEARNING FILE: Accumulated Team Feedback\n\nThe following notes come from real writer feedback and creative lead review. Treat these as overrides when they conflict with general guidance above.\n\n" +
            content
        );
        console.log(`  Loaded learning file from ${lp}`);
      }
      break;
    }
  }

  return parts.join("\n\n");
}

const SYSTEM_PROMPT = buildSystemPrompt();
console.log(
  `  System prompt built: ${Math.round(SYSTEM_PROMPT.length / 1024)}KB (~${Math.round(SYSTEM_PROMPT.split(/\s+/).length)} words)`
);

// ---------------------------------------------------------------------------
// Refine mode prompts (from existing refine.mjs)
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
[bullet list of key changes, each under 20 words]
---END---`,

  punch: `You are a world-class script doctor working for StudioNow. Elevate this script with sharper language, stronger verbs, more cinematic specificity. Do not make it longer. Make every word hit harder.

Rules:
- Replace every passive or weak verb with an active, specific alternative.
- Make visuals concrete. "footage of people" becomes a specific, shootable scene.
- Give dialogue and VO more subtext and rhythm. Use the StudioNow contrast structure.
- Strengthen the opening (no throat-clearing) and the close (must land like a gut punch).
- Keep the three-column format (AUDIO/VO | TC | VISUALS) intact.
- Check every line against the StudioNow blacklist.

Return your response in exactly this format:

---REFINED---
[the full punched-up script, including metadata header and table]
---CHANGES---
[bullet list of key changes, each under 20 words]
---END---`,

  format: `You are a StudioNow script supervisor preparing this for client review and production.

Format rules:
- Ensure the three-column table format: AUDIO/VO | TC | VISUALS
- Add a metadata header if missing: [TITLE IN ALL CAPS], Client, Writer: StudioNow AI, Date, Version
- Write action/visual descriptions in present tense, active verbs
- Format all SUPERs in bold: **SUPER:** "Text"
- Format SFX in italics: *SFX: description*
- Add timecode ranges per section based on content density
- Flag any asset needs: (stock), (existing footage), (to-shoot), (need assets)
- Keep all original content. Reformat only, do not rewrite.

Return your response in exactly this format:

---REFINED---
[the fully formatted script]
---CHANGES---
[bullet list of formatting changes, each under 20 words]
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
- Be direct, specific, and opinionated

Return your response in exactly this format:

---REFINED---
[the original script with [NOTE: ...] annotations woven throughout]
---CHANGES---
[bullet list of key notes, each under 20 words]
---END---`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayFormatted() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)}`;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function sendCors(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

// ---------------------------------------------------------------------------
// API: Generate script (streaming)
// ---------------------------------------------------------------------------
async function handleGenerate(req, res) {
  const body = await parseBody(req);
  const { brief, attachments = [], apiKey: clientKey } = body;
  const apiKey = clientKey || envApiKey;

  if (!apiKey) return sendJson(res, { error: "No API key configured. Add it in the UI or create a .env file." }, 400);
  if (!brief || brief.trim().length === 0) return sendJson(res, { error: "Brief is required" }, 400);

  // Build user message content
  const content = [];

  // Process attachments (images as base64)
  for (const file of attachments) {
    if (file.type && file.type.startsWith("image/")) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: file.type, data: file.data },
      });
      content.push({
        type: "text",
        text: `[Attached image: ${file.name}] Use this as visual reference for the script.`,
      });
    } else if (file.type === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.data },
      });
      content.push({
        type: "text",
        text: `[Attached PDF: ${file.name}] Extract relevant information for the script.`,
      });
    } else if (file.extractedText) {
      content.push({
        type: "text",
        text: `[Attached document: ${file.name}]\n\n${file.extractedText}`,
      });
    }
  }

  // Brief text
  let briefText = `Today's date is ${todayFormatted()}. Use this as the Date in the script metadata header.\n\n`;
  if (attachments.length > 0) {
    briefText += `I've attached ${attachments.length} reference file(s). Study them carefully and use them to inform the script.\n\n`;
  }
  briefText += `Write a production script from the following brief:\n\n${brief}`;
  content.push({ type: "text", text: briefText });

  // Stream from Anthropic
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.write(`data: ${JSON.stringify({ error: `API error ${response.status}: ${errText}` })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "content_block_delta" && event.delta?.text) {
            res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
          }
          if (event.type === "message_delta" && event.usage) {
            res.write(`data: ${JSON.stringify({ usage: event.usage })}\n\n`);
          }
          if (event.type === "message_stop") {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          }
        } catch {
          // skip unparseable lines
        }
      }
    }
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}

// ---------------------------------------------------------------------------
// API: Refine script
// ---------------------------------------------------------------------------
async function handleRefine(req, res) {
  const body = await parseBody(req);
  const { script, mode, customFeedback, apiKey: clientKey } = body;
  const apiKey = clientKey || envApiKey;

  if (!apiKey) return sendJson(res, { error: "No API key configured." }, 400);
  if (!script || script.length < 40) return sendJson(res, { error: "Script is too short." }, 400);
  if (!MODE_PROMPTS[mode]) return sendJson(res, { error: `Invalid mode. Use: ${Object.keys(MODE_PROMPTS).join(", ")}` }, 400);

  const modePrompt = MODE_PROMPTS[mode];
  const feedbackBlock = customFeedback?.trim()
    ? `\nADDITIONAL DIRECTION FROM PRODUCER:\n${customFeedback.trim()}\n`
    : "";

  const prompt = `${modePrompt}\n${feedbackBlock}\nSCRIPT:\n${script}`;

  // Stream the refine response
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.write(`data: ${JSON.stringify({ error: `API error ${response.status}: ${errText}` })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "content_block_delta" && event.delta?.text) {
            res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
          }
          if (event.type === "message_stop") {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          }
        } catch {
          // skip
        }
      }
    }
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}

// ---------------------------------------------------------------------------
// API: Status (what references are loaded)
// ---------------------------------------------------------------------------
function handleStatus(req, res) {
  const refsDir = join(__dirname, "references");
  const files = existsSync(refsDir)
    ? readdirSync(refsDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
    : [];

  sendJson(res, {
    ok: true,
    references: files,
    promptSize: `${Math.round(SYSTEM_PROMPT.length / 1024)}KB`,
    promptWords: SYSTEM_PROMPT.split(/\s+/).length,
    hasApiKey: !!envApiKey,
  });
}

// ---------------------------------------------------------------------------
// Serve static files
// ---------------------------------------------------------------------------
function serveFile(res, filePath, contentType) {
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") return sendCors(res);

  // API routes
  if (url.pathname === "/api/generate" && req.method === "POST") return handleGenerate(req, res);
  if (url.pathname === "/api/refine" && req.method === "POST") return handleRefine(req, res);
  if (url.pathname === "/api/status") return handleStatus(req, res);

  // Serve app.html as index
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return serveFile(res, join(__dirname, "app.html"), "text/html; charset=utf-8");
  }

  // 404
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n  StudioNow Script Creator`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  API key: ${envApiKey ? "loaded from .env" : "not set (enter in UI)"}\n`);
});
