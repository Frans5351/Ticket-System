// functions/list-attachments.js
// Returns the list of attachments for a given txKey

import { getStore } from "@netlify/blobs";

export const config = { path: "/api/attachments/list" };

export default async function handler(req, context) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const txKey = url.searchParams.get("txKey");

  if (!txKey) {
    return new Response(JSON.stringify({ error: "Missing txKey" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const store = getStore("attachments");
    const indexKey = `index/${encodeURIComponent(txKey)}`;
    const result = await store.get(indexKey, { type: "text" });

    const list = result ? JSON.parse(result) : [];
    const enriched = list.map((item) => ({
      ...item,
      url: `/api/attachments/file/${item.filename}`,
    }));

    return new Response(JSON.stringify({ attachments: enriched }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("List error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
