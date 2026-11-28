// functions/get-attachment.js
// Serves a stored file from Netlify Blobs by filename

import { getStore } from "@netlify/blobs";

export const config = { path: "/api/attachments/file/:filename" };

export default async function handler(req, context) {
  const filename = context.params.filename;
  if (!filename) return new Response("Not found", { status: 404 });

  try {
    const store = getStore("attachments");
    const blobKey = `files/${filename}`;
    const result = await store.getWithMetadata(blobKey, { type: "arrayBuffer" });

    if (!result) return new Response("File not found", { status: 404 });

    const contentType = result.metadata?.contentType || "application/octet-stream";

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
        "Content-Disposition": `inline; filename="${result.metadata?.originalName || filename}"`,
      },
    });
  } catch (err) {
    console.error("Get attachment error:", err);
    return new Response("Error fetching file", { status: 500 });
  }
}
