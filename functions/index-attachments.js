// functions/index-attachments.js
// Returns all txKeys that have attachments stored — used for session sync

import { getStore } from "@netlify/blobs";

export const config = { path: "/api/attachments/index" };

export default async function handler(req, context) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const store = getStore("attachments");
    
    // List all blobs with prefix "index/" to find all txKeys
    const { blobs } = await store.list({ prefix: "index/" });
    
    const txKeys = blobs.map(blob => 
      decodeURIComponent(blob.key.replace("index/", ""))
    );

    return new Response(JSON.stringify({ txKeys }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
    });
  } catch (err) {
    console.error("Index error:", err);
    return new Response(JSON.stringify({ txKeys: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
