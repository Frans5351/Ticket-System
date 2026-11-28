// functions/_frame-shared.js — helpers for frame-check.js (kept apart so the function file exports only its handler)

// Only ordinary public https sites: no IP addresses, no internal names.
export function publicHttps(u) {
  let x; try { x = new URL(String(u || "")); } catch (e) { return ""; }
  if (x.protocol !== "https:" || x.username || x.password || (x.port && x.port !== "443")) return "";
  const h = x.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || /^\d+(\.\d+){3}$/.test(h) || /\.(local|internal|lan|home|localhost|test|invalid)$/.test(h)) return "";
  return x.href;
}

// What the two headers say about being shown inside `siteOrigin`.
export function decide(xfo, csp, siteOrigin) {
  const site = String(siteOrigin || "").toLowerCase().replace(/\/+$/, "");
  const dirs = String(csp || "").split(";").map((d) => d.trim()).filter(Boolean);
  const fa = dirs.find((d) => /^frame-ancestors(\s|$)/i.test(d));
  if (fa) {                                              // when present it overrides X-Frame-Options
    const list = fa.split(/\s+/).slice(1).map((t) => t.toLowerCase());
    if (!list.length || list.includes("'none'")) return { embed: false, reason: "the portal does not allow being shown inside any other site" };
    const ok = list.some((t) => {
      if (t === "*" || t === "https:") return true;
      if (!site) return false;
      if (t.replace(/\/+$/, "") === site) return true;
      const m = /^(https:\/\/)?\*\.(.+?)\/?$/.exec(t);        // https://*.example.com
      return !!m && site.replace(/^https:\/\//, "").endsWith("." + m[2]);
    });
    return ok ? { embed: true, reason: "allowed by the portal" } : { embed: false, reason: "the portal only allows itself to be shown inside its own sites" };
  }
  const x = String(xfo || "").trim().toLowerCase();
  if (x) return { embed: false, reason: "the portal does not allow being shown inside another site" };   // DENY, SAMEORIGIN, ALLOW-FROM (obsolete)
  return { embed: true, reason: "the portal sets no restriction" };
}
