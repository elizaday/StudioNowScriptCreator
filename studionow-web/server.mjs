import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// Force load .env manually (bypass any shell env vars)
const envFile = readFileSync(resolve(__dir, ".env"), "utf-8");
const envVars = {};
for (const line of envFile.split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0) envVars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
// Override process.env with .env file values
Object.assign(process.env, envVars);
console.log("API key from .env:", process.env.ANTHROPIC_API_KEY?.slice(0, 25) + "...");

// Dynamic import generate function AFTER env is set
const { default: handleGenerate } = await import("./netlify/functions/generate.mjs");

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // API route
  if (req.url === "/api/generate" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();

    // Create a fake Request object for the handler
    const fakeReq = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    try {
      const response = await handleGenerate(fakeReq);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (err) {
      console.error("Handler error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  let filePath = resolve(__dir, "public", req.url === "/" ? "index.html" : req.url.slice(1));
  if (!existsSync(filePath)) {
    res.writeHead(404);
    return res.end("Not found");
  }

  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(readFileSync(filePath));
});

const PORT = 8888;
server.listen(PORT, () => {
  console.log(`\n  StudioNow Script Creator running at: http://localhost:${PORT}\n`);
  console.log(`  Full prompt loaded with all 15 reference files\n`);
});
