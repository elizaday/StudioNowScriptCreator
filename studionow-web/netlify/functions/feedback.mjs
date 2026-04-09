import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: CORS_HEADERS });
  }

  const store = getStore({ name: "feedback", consistency: "strong" });

  // GET — return all feedback
  if (req.method === "GET") {
    const { blobs } = await store.list();
    const entries = await Promise.all(
      blobs.map((b) => store.get(b.key, { type: "json" }))
    );
    // Sort newest first
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return json(entries);
  }

  // POST — add feedback entry
  if (req.method === "POST") {
    try {
      const entry = await req.json();
      if (!entry.feedback || !entry.feedback.trim()) {
        return json({ error: "Feedback is required" }, 400);
      }

      const id = Date.now().toString();
      const record = {
        id,
        timestamp: entry.timestamp || new Date().toISOString(),
        client: entry.client || "",
        genre: entry.genre || "",
        brief: entry.brief || "",
        feedback: entry.feedback,
      };

      await store.setJSON(id, record);

      return json({ ok: true, id });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
};

export const config = {
  path: "/api/feedback",
};
