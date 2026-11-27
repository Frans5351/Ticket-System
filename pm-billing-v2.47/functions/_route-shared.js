// functions/_route-shared.js
// Which people at the managing agent a new report is emailed to.
//
// Settings key "agent_routing" (scheme-scoped):
//   { on:true,
//     adminCats:["Admin"],                       // report categories that are admin / billing matters
//     people:[ { name, email, role }, … ] }      // role: "admin" | "maintenance" | "always"
//
//   admin        gets admin and billing reports (levies, statements, payments)
//   maintenance  gets everything else (repairs, security, common areas …)
//   always       is copied on every report
//
// The report form shows these people with the right ones ticked, and the resident may change the
// ticks. What the form sends back (body.agentPeople) is a list of addresses; an address is only
// used if it is in the saved list, so the form can never direct mail anywhere else.

export const ROLE_LABEL = { admin: "Admin and billing", maintenance: "Maintenance and repairs", always: "Copied on every report" };

export const ROUTE_DEFAULT = {
  on: true,
  adminCats: ["Admin"],
  people: [
    { name: "Ruaan", email: "ruaan@daviesgroup.co.za", role: "admin" },
    { name: "Cheryl", email: "cheryl@daviesgroup.co.za", role: "maintenance" },
    { name: "Tara", email: "tara@daviesgroup.co.za", role: "always" },
  ],
};

const okEmail = (s) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(String(s || "").trim());
const txt = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

// Returns a tidy copy, or null when the value is not a routing object at all.
export function cleanRouting(v) {
  if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { return null; } }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const seen = new Set();
  const people = (Array.isArray(v.people) ? v.people : []).slice(0, 12).map((p) => {
    if (!p || typeof p !== "object" || !okEmail(p.email)) return null;
    const email = String(p.email).trim().toLowerCase();
    if (seen.has(email)) return null;
    seen.add(email);
    return { name: txt(p.name, 60) || email, email, role: ["admin", "maintenance", "always"].includes(p.role) ? p.role : "maintenance" };
  }).filter(Boolean);
  const adminCats = (Array.isArray(v.adminCats) ? v.adminCats : ["Admin"]).map((c) => txt(c, 60)).filter(Boolean).slice(0, 20);
  return { on: v.on !== false, adminCats, people };
}

export function isAdminCategory(routing, category) {
  const cat = String(category || "").trim().toLowerCase();
  return !!cat && (routing.adminCats || []).some((c) => c.toLowerCase() === cat);
}

// The people ticked by default for a category.
export function defaultPeople(routing, category) {
  const kind = isAdminCategory(routing, category) ? "admin" : "maintenance";
  let main = routing.people.filter((p) => p.role === kind);
  if (!main.length) main = routing.people.filter((p) => p.role !== "always");      // nobody has that job: whoever is there
  return main.concat(routing.people.filter((p) => p.role === "always"));
}

// → { to:[person], cc:[person], kind:"admin"|"maintenance", chosenBy:"resident"|"category" }
//   or null (= no routing: behave as before).
export function pickPeople(routing, category, wanted) {
  const r = cleanRouting(routing);
  if (!r || !r.on || !r.people.length) return null;
  const kind = isAdminCategory(r, category) ? "admin" : "maintenance";
  const want = new Set((Array.isArray(wanted) ? wanted : []).slice(0, 20).map((e) => String(e || "").trim().toLowerCase()));
  let chosen = r.people.filter((p) => want.has(p.email)), chosenBy = "resident";
  if (!chosen.length) { chosen = defaultPeople(r, category); chosenBy = "category"; }
  if (!chosen.length) return null;
  let to = chosen.filter((p) => p.role !== "always"), cc = chosen.filter((p) => p.role === "always");
  if (!to.length) { to = cc; cc = []; }                 // only the "copied" people were ticked: it is addressed to them
  return { to, cc, kind, chosenBy };
}

export const whoLine = (people) => people.map((p) => p.name + (ROLE_LABEL[p.role] && p.role !== "always" ? " (" + ROLE_LABEL[p.role] + ")" : "")).join(", ");
