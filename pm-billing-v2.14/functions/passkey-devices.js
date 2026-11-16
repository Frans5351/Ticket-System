// functions/passkey-devices.js
// GET  /api/passkey/devices       — list devices for the authenticated user
// DELETE /api/passkey/devices?id= — revoke one device
//
// Both require a valid session JWT (Authorization: Bearer <token>). A user
// can only list/revoke their own passkeys via this endpoint.

import {
  getConfig,
  requireConfig,
  supaFetch,
  verifySessionJwt,
  jsonResponse,
  errorResponse,
} from "./_passkey-shared.js";

export const config = { path: "/api/passkey/devices" };

export default async function handler(req) {
  let cfg;
  try {
    cfg = getConfig();
    requireConfig(cfg);
  } catch (e) {
    return errorResponse(500, e.message);
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const session = verifySessionJwt(cfg, token);
  if (!session || !session.sub) return errorResponse(401, "Authentication required");
  const userId = session.sub;

  if (req.method === "GET") {
    const rows = await supaFetch(
      cfg,
      `/rest/v1/passkeys?select=id,device_name,created_at,counter&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
    );
    return jsonResponse(200, { devices: rows || [] });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse(400, "id query param required");
    // Only allow deleting passkeys that belong to this user
    await supaFetch(
      cfg,
      `/rest/v1/passkeys?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } }
    );
    return jsonResponse(200, { ok: true });
  }

  return errorResponse(405, "Method not allowed");
}
