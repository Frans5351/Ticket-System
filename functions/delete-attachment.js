// functions/delete-attachment.js
// Removes a file from Netlify Blobs and updates the index

import { getStore } from "@netlify/blobs";

export const config = { path: "/api/attachments/delete" };

export default async function handler(req, context) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { txKey, filename } = await req.json();
    if (!txKey || !filename) {
      return new Response(JSON.stringify({ error: "Missing txKey or filename" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("attachments");

    // Delete the file blob
    await store.delete(`files/${filename}`);

    // Update the index
    const indexKey = `index/${encodeURIComponent(txKey)}`;
    const existing = await store.get(indexKey, { type: "text" });
    if (existing) {
      const list = JSON.parse(existing).filter((i) => i.filename !== filename);
      if (list.length > 0) {
        await store.set(indexKey, JSON.stringify(list));
      } else {
        await store.delete(indexKey);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Delete error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
