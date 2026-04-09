import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import JSZip from "jszip";

// ---------------------------------------------------------------------------
// Load FULL reference files + CLAUDE.md as system prompt
// ---------------------------------------------------------------------------
const _fnDir = dirname(fileURLToPath(import.meta.url));

// Load the pre-built full prompt (CLAUDE.md + all 15 reference files)
let SYSTEM_PROMPT = "";
const promptPaths = [
  resolve(_fnDir, "../../full-prompt.md"),       // netlify dev (runs from project root)
  resolve(_fnDir, "../full-prompt.md"),           // alternate
  resolve(_fnDir, "full-prompt.md"),              // bundled
];
for (const p of promptPaths) {
  try {
    SYSTEM_PROMPT = readFileSync(p, "utf-8");
    console.log(`Full prompt loaded: ${SYSTEM_PROMPT.length} chars (~${Math.round(SYSTEM_PROMPT.length / 4)} tokens) from ${p}`);
    break;
  } catch { /* try next */ }
}
if (!SYSTEM_PROMPT) {
  console.error("WARNING: Could not load full-prompt.md from any path. Tried:", promptPaths);
}

// ---------------------------------------------------------------------------
// Attachment processing
// ---------------------------------------------------------------------------

const IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
]);

const DOCX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const PPTX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

// ---------------------------------------------------------------------------
// PPTX extraction — pulls text from slides + embedded images
// ---------------------------------------------------------------------------

async function extractPptx(base64Data) {
  const buffer = Buffer.from(base64Data, "base64");
  const zip = await JSZip.loadAsync(buffer);

  // --- Extract text from each slide XML ---
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)[1]);
      const numB = parseInt(b.match(/slide(\d+)/)[1]);
      return numA - numB;
    });

  const slideTexts = [];
  for (const path of slideFiles) {
    const xml = await zip.file(path).async("string");
    // Pull all <a:t> text nodes from the slide XML
    const texts = [];
    const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const t = match[1].trim();
      if (t) texts.push(t);
    }
    const slideNum = path.match(/slide(\d+)/)[1];
    if (texts.length > 0) {
      slideTexts.push(`--- Slide ${slideNum} ---\n${texts.join(" ")}`);
    }
  }

  // --- Extract speaker notes from each slide ---
  const noteFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f))
    .sort();

  for (const path of noteFiles) {
    const xml = await zip.file(path).async("string");
    const texts = [];
    const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const t = match[1].trim();
      // Skip common placeholder text in notes
      if (t && !/^\d+$/.test(t) && t.toLowerCase() !== "slide number placeholder") {
        texts.push(t);
      }
    }
    const noteNum = path.match(/notesSlide(\d+)/)[1];
    if (texts.length > 0) {
      slideTexts.push(`--- Slide ${noteNum} Speaker Notes ---\n${texts.join(" ")}`);
    }
  }

  // --- Extract embedded images ---
  const imageFiles = Object.keys(zip.files).filter((f) =>
    /^ppt\/media\/image\d+\.(png|jpe?g|gif|webp)$/i.test(f)
  );

  const images = [];
  for (const path of imageFiles) {
    const ext = path.split(".").pop().toLowerCase();
    const mediaType =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "png" ? "image/png" :
      ext === "gif" ? "image/gif" :
      ext === "webp" ? "image/webp" : null;

    if (!mediaType) continue;

    const imgData = await zip.file(path).async("base64");
    // Skip tiny images (likely icons/bullets, under 5KB)
    if (imgData.length < 6800) continue;

    images.push({ mediaType, data: imgData, name: path.split("/").pop() });
  }

  return {
    text: slideTexts.join("\n\n"),
    images,
  };
}

async function buildAttachmentBlocks(attachments) {
  const blocks = [];

  for (const file of attachments) {
    if (IMAGE_TYPES.has(file.type)) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: file.type, data: file.data },
      });
      // Preserve asset label if the client sent one (e.g. "Asset 3: filename.jpg")
      const assetLabel = file.name.match(/^Asset \d+:/)
        ? `[${file.name}] — This is an available visual asset. Reference it in the VISUALS column as [${file.name.split(':')[0]}] where appropriate.`
        : `[Attached image: ${file.name}] — Use this as visual reference for the script.`;
      blocks.push({
        type: "text",
        text: assetLabel,
      });
    } else if (file.type === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.data },
      });
      blocks.push({
        type: "text",
        text: `[Attached PDF: ${file.name}] — Extract relevant information for the script.`,
      });
    } else if (DOCX_TYPES.has(file.type)) {
      const buffer = Buffer.from(file.data, "base64");
      const result = await mammoth.extractRawText({ buffer });
      if (result.value.trim()) {
        blocks.push({
          type: "text",
          text: `[Attached document: ${file.name}]\n\n${result.value}`,
        });
      }
    } else if (file.type === "text/plain") {
      // Pre-extracted text from client-side PDF/PPTX processing
      const text = Buffer.from(file.data, "base64").toString("utf-8");
      if (text.trim()) {
        blocks.push({
          type: "text",
          text: `[Extracted text: ${file.name}]\n\n${text}`,
        });
      }
    } else if (PPTX_TYPES.has(file.type)) {
      const { text, images } = await extractPptx(file.data);

      // Send extracted images so Claude can see the actual slide visuals/assets
      for (const img of images) {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.data },
        });
        // Preserve asset label if the client sent one
        const imgLabel = img.name.match(/^Asset \d+:/)
          ? `[${img.name}] — This is an available visual asset. Reference it in the VISUALS column as [${img.name.split(':')[0]}] where appropriate.`
          : `[Image from PowerPoint: ${img.name}] — This is an existing visual asset from the deck. Reference it in the script visuals where appropriate.`;
        blocks.push({
          type: "text",
          text: imgLabel,
        });
      }

      // Send slide text content
      if (text.trim()) {
        blocks.push({
          type: "text",
          text: `[Attached PowerPoint: ${file.name}]\n\nSlide content and speaker notes:\n\n${text}`,
        });
      }
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Date helper
// ---------------------------------------------------------------------------

function todayFormatted() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)}`;
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

export default async (req) => {
  // CORS preflight
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

  try {
    const { brief, attachments = [] } = await req.json();

    if (!brief || brief.trim().length === 0) {
      return jsonResponse({ error: "Brief is required" }, 400);
    }

    // Build multi-part content array for the user message
    const content = [];

    // 1. Attachment blocks (images, PDFs, DOCX text)
    if (attachments.length > 0) {
      const attachmentBlocks = await buildAttachmentBlocks(attachments);
      content.push(...attachmentBlocks);
    }

    // 2. Brief text
    let briefText = `Today's date is ${todayFormatted()}. Use this as the Date in the script metadata header.\n\n`;
    if (attachments.length > 0) {
      // Count image attachments for asset reference instructions
      const imageAttachments = attachments.filter(a => IMAGE_TYPES.has(a.type));
      const assetAttachments = imageAttachments.filter(a => a.name && a.name.match(/^Asset \d+:/));

      if (assetAttachments.length > 0) {
        briefText += `I've attached ${assetAttachments.length} visual assets numbered [Asset 1] through [Asset ${assetAttachments.length}]. When writing the VISUALS column, reference specific assets using their [Asset N] tag wherever a visual matches. For example: "[Asset 3] — Slow zoom on product hero shot"\n\n`;
      }
      briefText += `I've attached ${attachments.length} reference file(s). Study them carefully and use them to inform the script — specific details, metrics, visual references, brand language, and any other relevant material.\n\n`;
    }
    briefText += `Write a production script from the following brief:\n\n${brief}`;
    content.push({ type: "text", text: briefText });

    // Stream the response
    const client = new Anthropic({ apiKey });
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
            if (event.type === "message_delta" && event.usage) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ usage: { output_tokens: event.usage.output_tokens } })}\n\n`)
              );
            }
          }
          const finalMessage = await stream.finalMessage();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              done: true,
              usage: {
                input_tokens: finalMessage.usage.input_tokens,
                output_tokens: finalMessage.usage.output_tokens,
              },
            })}\n\n`)
          );
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: error.message || "Generation failed" }, 500);
  }
};

export const config = {
  path: "/api/generate",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
