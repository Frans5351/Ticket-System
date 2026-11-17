// functions/upload-attachment.js
// Accepts multipart file upload, stores in Netlify Blobs under the txKey namespace

import { getStore } from "@netlify/blobs";
import Busboy from "busboy";

export const config = { path: "/api/attachments/upload" };

export default async function handler(req, context) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  try {
    const store = getStore("attachments");
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse multipart form data
    const result = await parseMultipart(buffer, contentType);
    const { txKey, file } = result;

    if (!txKey || !file) {
      return new Response(JSON.stringify({ error: "Missing txKey or file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique filename
    const ext = file.filename.includes(".")
      ? file.filename.slice(file.filename.lastIndexOf("."))
      : "";
    const safeTxKey = txKey.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    const filename = `${safeTxKey}_${Date.now()}${ext}`;
    const blobKey = `files/${filename}`;

    // Store the file in Netlify Blobs
    await store.set(blobKey, file.data, {
      metadata: {
        originalName: file.filename,
        txKey: txKey,
        contentType: file.mimetype,
        uploaded: new Date().toISOString(),
      },
    });

    // Update the index for this txKey (list of filenames)
    const indexKey = `index/${encodeURIComponent(txKey)}`;
    let index = [];
    try {
      const existing = await store.getWithMetadata(indexKey);
      if (existing) index = JSON.parse(existing.data);
    } catch (e) {}

    index.push({
      filename,
      name: file.filename,
      type: file.mimetype,
      added: Date.now(),
    });

    await store.set(indexKey, JSON.stringify(index));

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        url: `/api/attachments/file/${filename}`,
        name: file.filename,
        type: file.mimetype,
        added: Date.now(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function parseMultipart(buffer, contentType) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: { "content-type": contentType } });
    let txKey = null;
    let file = null;

    bb.on("field", (name, value) => {
      if (name === "txKey") txKey = value;
    });

    bb.on("file", (name, stream, info) => {
      const chunks = [];
      stream.on("data", (d) => chunks.push(d));
      stream.on("end", () => {
        file = {
          filename: info.filename,
          mimetype: info.mimeType,
          data: Buffer.concat(chunks),
        };
      });
    });

    bb.on("finish", () => resolve({ txKey, file }));
    bb.on("error", reject);
    bb.write(buffer);
    bb.end();
  });
}
