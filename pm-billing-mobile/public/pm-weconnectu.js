// pm_weconnectu.js — parser for Davies Group / WeconnectU Park Manor documents.
// Pure, framework-free: give it the extracted text of one PDF, get a structured
// object back. In the app, pdf.js extracts the text; this module interprets it.
// Handles: monthly invoices (pre-Nov and Nov layouts), credit notes, and
// customer statements. Designed so the output maps straight onto the app's unit
// model (charges, meterReadings, statement.ledger).
(function (root) {
  "use strict";

  function money(s) { return parseFloat(String(s).replace(/\s/g, "")); }
  // The 4 trailing numbers on every charge line: unitPrice disc tax lineTotal.
  var TAIL = /1\.00 (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)\s*$/;

  function headerBits(lines) {
    var out = { owner: "", doorNo: null, reference: "", email: "", tel: "" };
    var all = lines.join("\n");
    // Owner: the line carrying "Door No N" (invoices/statements) or, failing
    // that, the one with the reference (credit notes). NOT line 0 — on a
    // statement line 0 is the footer banner.
    var ownerLine = null;
    for (var oi = 0; oi < lines.length; oi++) { if (/Door No\s+\d+/.test(lines[oi])) { ownerLine = lines[oi]; break; } }
    if (!ownerLine) for (var oj = 0; oj < lines.length; oj++) { if (/Reference:/.test(lines[oj]) && !/^Reference:/.test(lines[oj])) { ownerLine = lines[oj]; break; } }
    if (!ownerLine) ownerLine = lines[0] || "";
    var mOwner = /^(.*?)(?:\s+Door No\s+\d+|\s+Reference:)/.exec(ownerLine);
    out.owner = (mOwner ? mOwner[1] : ownerLine).trim();
    var mDoor = /Door No\s+(\d+)/.exec(all);
    var mRef = /Reference:\s*([A-Za-z0-9-]+)/.exec(all);
    if (mRef) out.reference = mRef[1].trim();
    // Door number: prefer an explicit "Door No", else derive from the ref "-D9".
    if (mDoor) out.doorNo = parseInt(mDoor[1], 10);
    else if (out.reference) { var mD = /-D(\d+)/.exec(out.reference); if (mD) out.doorNo = parseInt(mD[1], 10); }
    var mEmail = /Email:\s*(\S+@\S+)/.exec(all); if (mEmail) out.email = mEmail[1].trim();
    var mTel = /Tel:\s*(\+?\d[\d ]*)/.exec(all); if (mTel) out.tel = mTel[1].trim();
    return out;
  }

  function period(txt) {
    var m = /\((\d{4}-\d\d-\d\d) to (\d{4}-\d\d-\d\d)\)/.exec(txt);
    return m ? { from: m[1], to: m[2] } : null;
  }
  function meter(txt) {
    var m = /Previous:\s*([\d.]+),\s*Current:\s*([\d.]+)\s*-\s*Usage:\s*([\d.]+)/.exec(txt);
    return m ? { prev: parseFloat(m[1]), curr: parseFloat(m[2]), usage: parseFloat(m[3]) } : null;
  }

  // Classify a charge line from its (account + description) text. Ordered
  // specific→generic and substring-based, so it works whether the text is the
  // connector's one-liner or pdf.js's wrapped/merged cells.
  var CLASSIFIERS = [
    [/service charges as per/i, "elec_service"],
    [/Water Fixed Basic Charges\s*-\s*Backdate/i, "water_backdate"],
    [/Sewerage Fixed Basic Charges\s*-\s*Backdate/i, "sewer_backdate"],
    [/Water Fixed Basic Charges/i, "water_fixed"],
    [/Sewerage Fixed Basic Charges/i, "sewer_fixed"],
    [/Garden Service/i, "garden_service"],
    [/Garage Levy/i, "garage"],
    [/Reserve Fund Levies|RFI\/001/i, "reserve_fund"],
    [/CSOS/i, "csos"],
    [/Water \(/i, "water"],
    [/Sewerage \(/i, "sewerage"],
    [/Electricity \(/i, "electricity"],
    [/Levies/i, "levies"],
  ];
  function classify(txt) {
    for (var i = 0; i < CLASSIFIERS.length; i++) if (CLASSIFIERS[i][0].test(txt)) return CLASSIFIERS[i][1];
    return "other";
  }

  function parseInvoiceText(text) {
    var lines = String(text).split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var h = headerBits(lines);
    var hdr = null;
    for (var i = 0; i < lines.length; i++) {
      var m = /^(INV\d+)\s+(\d{4}-\d\d-\d\d)\s+(\d{4}-\d\d-\d\d)\s+R\s*([\d ]+\.\d\d)/.exec(lines[i]);
      if (m) { hdr = { no: m[1], date: m[2], due: m[3], total: money(m[4]), at: i }; break; }
    }
    if (!hdr) return { docType: "invoice", error: "no invoice header found", header: h };

    var res = {
      docType: "invoice",
      invoiceNo: hdr.no, reference: h.reference, doorNo: h.doorNo, section: h.doorNo,
      owner: h.owner, email: h.email, tel: h.tel,
      invoiceDate: hdr.date, dueDate: hdr.due, total: hdr.total,
      pages: /\(2 pages\)/.test(text) ? 2 : 1,
      lines: [], charges: {}, meter: {}, footerTotal: null, other: [],
    };
    for (var j = hdr.at + 1; j < lines.length; j++) {
      var l = lines[j];
      var ft = /^TOTAL R\s*([\d ]+\.\d\d)/.exec(l);
      if (ft) { res.footerTotal = money(ft[1]); continue; }
      var t = TAIL.exec(l);
      if (!t) continue; // address/banking boilerplate etc.
      var txt = l.slice(0, t.index).trim();
      var amount = money(t[4]);
      var kind = classify(txt);
      var line = { kind: kind, desc: txt, unitPrice: money(t[1]), disc: money(t[2]), tax: money(t[3]), amount: amount };
      var p = period(txt), mt = meter(txt);
      if (p) line.period = p;
      if (mt) line.meter = mt;
      res.lines.push(line);
      // Roll up named charges + pull meter readings out to the top level.
      if (kind === "other") res.other.push({ desc: txt, amount: amount });
      else res.charges[kind] = (res.charges[kind] || 0) + amount;
      if (kind === "water" && mt) res.meter.water = { prev: mt.prev, curr: mt.curr, usage: mt.usage, period: p };
      if (kind === "electricity" && mt) res.meter.elec = { prev: mt.prev, curr: mt.curr, usage: mt.usage, period: p };
      if (kind === "elec_service") res.charges.elec_service_label = /as per (\w+)/.exec(txt) ? RegExp.$1 : "";
    }
    res.lineSum = Math.round(res.lines.reduce(function (s, x) { return s + x.amount; }, 0) * 100) / 100;
    res.reconciles = Math.abs(res.lineSum - res.total) <= 0.05;
    return res;
  }

  function parseCreditNoteText(text) {
    var lines = String(text).split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var h = headerBits(lines);
    var hdr = null, at = -1;
    for (var i = 0; i < lines.length; i++) {
      var m = /^(CRN\d+)\s+(\d{4}-\d\d-\d\d)\s+(\d{4}-\d\d-\d\d)?\s*R?\s*([\d ]+\.\d\d)/.exec(lines[i]);
      if (m) { hdr = { no: m[1], date: m[2], total: money(m[4]) }; at = i; break; }
    }
    var res = { docType: "credit_note", creditNoteNo: hdr && hdr.no, reference: h.reference,
      doorNo: h.doorNo, owner: h.owner, date: hdr && hdr.date, total: hdr && hdr.total, lines: [] };
    for (var j = at + 1; j < lines.length; j++) {
      var t = TAIL.exec(lines[j]);
      if (!t) continue;
      var txt = lines[j].slice(0, t.index).trim();
      var line = { kind: classify(txt), desc: txt, amount: money(t[4]) };
      var mt = meter(txt); if (mt) line.meter = mt;
      var ai = /\((INV\d+)\s*line\s*\d+\)/.exec(txt); if (ai) res.appliesTo = ai[1];
      res.lines.push(line);
    }
    if (!res.lines.length && hdr) res.lines.push({ desc: "Credit", amount: hdr.total });
    return res;
  }

  // ── Statement parser (coordinate-based) ────────────────────────────────────
  // Statements are a table whose rows run together in flattened text, so we work
  // from pdf.js text items {x,y,str} and reconstruct columns by x-position.
  function groupRows(items) {
    var buckets = [];
    items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var y = it.y;
      var row = null;
      for (var i = 0; i < buckets.length; i++) { if (Math.abs(buckets[i].y - y) <= 2.5) { row = buckets[i]; break; } }
      if (!row) { row = { y: y, cells: [] }; buckets.push(row); }
      row.cells.push({ x: it.x, s: it.str });
    });
    buckets.sort(function (a, b) { return b.y - a.y; }); // top → bottom
    buckets.forEach(function (r) { r.cells.sort(function (a, b) { return a.x - b.x; }); });
    return buckets;
  }
  function nearest(anchors, x) {
    var best = null, bd = 1e9;
    Object.keys(anchors).forEach(function (k) { var d = Math.abs(anchors[k] - x); if (d < bd) { bd = d; best = k; } });
    return best;
  }
  function bucketRow(cells, anchors) {
    var out = {}; Object.keys(anchors).forEach(function (k) { out[k] = ""; });
    cells.forEach(function (c) { var k = nearest(anchors, c.x); out[k] = (out[k] ? out[k] + " " : "") + c.s; });
    Object.keys(out).forEach(function (k) { out[k] = out[k].trim(); });
    return out;
  }

  function parseStatementItems(items) {
    var rows = groupRows(items);
    var all = rows.map(function (r) { return r.cells.map(function (c) { return c.s; }).join(" "); }).join("\n");
    var h = headerBits(all.split("\n"));
    var res = { docType: "statement", reference: h.reference, doorNo: h.doorNo, owner: h.owner, email: h.email,
      statementDate: "", ledger: [], ageing: null, totalDue: null };
    var mDate = /DATE[^\d]{0,20}(\d{4}-\d\d-\d\d)/.exec(all.replace(/\n/g, " "));
    if (mDate) res.statementDate = mDate[1] || "";

    // Locate the ledger header row to get column anchors.
    var hdrIdx = -1, anchors = null;
    for (var i = 0; i < rows.length; i++) {
      var joined = rows[i].cells.map(function (c) { return c.s; }).join(" ");
      if (/Date/.test(joined) && /Cumulative/.test(joined) && /Debit/.test(joined)) {
        anchors = {};
        rows[i].cells.forEach(function (c) {
          if (/^Date/.test(c.s)) anchors.date = c.x;
          else if (/^Source/.test(c.s)) anchors.source = c.x;
          else if (/^Description/.test(c.s)) anchors.desc = c.x;
          else if (/^Debit/.test(c.s)) anchors.debit = c.x;
          else if (/^Credit/.test(c.s)) anchors.credit = c.x;
          else if (/^Cumulative/.test(c.s)) anchors.cum = c.x;
        });
        hdrIdx = i; break;
      }
    }
    if (hdrIdx < 0 || !anchors) { res.error = "no ledger header"; return res; }

    var cur = null;
    for (var r = hdrIdx + 1; r < rows.length; r++) {
      var joinedR = rows[r].cells.map(function (c) { return c.s; }).join(" ");
      if (/120\+\s*days/.test(joinedR)) { // ageing header — value row follows
        // Values are right-aligned (nearest-anchor misassigns), and there are
        // always exactly 5 buckets in order, so take them positionally.
        if (rows[r + 1]) {
          var line = rows[r + 1].cells.map(function (c) { return c.s; }).join(" ");
          var nums = line.match(/-?\d[\d ]*\.\d\d/g) || [];
          if (nums.length >= 5) res.ageing = { d120: money(nums[0]), d90: money(nums[1]), d60: money(nums[2]), d30: money(nums[3]), current: money(nums[4]) };
        }
        break;
      }
      if (/BANKING DETAILS|Powered by/.test(joinedR)) break;
      var b = bucketRow(rows[r].cells, anchors);
      if (/^\d{4}-\d\d-\d\d$/.test(b.date)) {
        cur = { date: b.date, src: b.source, desc: b.desc,
          debit: money(b.debit || 0), credit: money(b.credit || 0), cumulative: money((b.cum || "0").replace(/\s/g, "")) };
        res.ledger.push(cur);
      } else if (cur) { // continuation line → append to description
        var extra = [b.source, b.desc].filter(Boolean).join(" ").trim();
        if (extra) cur.desc = (cur.desc + " " + extra).trim();
      }
    }
    if (res.ledger.length) res.totalDue = res.ledger[res.ledger.length - 1].cumulative;

    // Recompute running balance to verify the parse.
    var bal = 0, okBal = true;
    res.ledger.forEach(function (e) { bal = Math.round((bal + e.debit - e.credit) * 100) / 100; if (Math.abs(bal - e.cumulative) > 0.05) okBal = false; });
    res.balanceReconciles = okBal;
    res.computedBalance = bal;
    return res;
  }

  // Coordinate-based invoice parser — robust to pdf.js wrapping the Account and
  // Description columns across several rows. Columns: Account, Description, Qty,
  // Unit Price, Disc, Tax, Total.
  function parseInvoiceItems(items) {
    var rows = groupRows(items);
    var flatLines = rows.map(function (r) { return r.cells.map(function (c) { return c.s; }).join(" "); });
    var h = headerBits(flatLines);
    var hdr = null;
    for (var i = 0; i < flatLines.length; i++) {
      var m = /(INV\d+)\s+(\d{4}-\d\d-\d\d)\s+(\d{4}-\d\d-\d\d)\s+R\s*([\d ]+\.\d\d)/.exec(flatLines[i]);
      if (m) { hdr = { no: m[1], date: m[2], due: m[3], total: money(m[4]) }; break; }
    }
    // Table header anchors.
    var anchors = null, hdrIdx = -1;
    for (var k = 0; k < rows.length; k++) {
      var j = rows[k].cells.map(function (c) { return c.s; }).join(" ");
      if (/\bAccount\b/.test(j) && /\bDescription\b/.test(j) && /\bTotal\b/.test(j) && /\bQty\b/.test(j)) {
        anchors = {};
        rows[k].cells.forEach(function (c) {
          if (/^Account/.test(c.s)) anchors.account = c.x; else if (/^Description/.test(c.s)) anchors.desc = c.x;
          else if (/^Qty/.test(c.s)) anchors.qty = c.x; else if (/^Unit/.test(c.s)) anchors.unit = c.x;
          else if (/^Disc/.test(c.s)) anchors.disc = c.x; else if (/^Tax/.test(c.s)) anchors.tax = c.x;
          else if (/^Total/.test(c.s)) anchors.total = c.x;
        });
        hdrIdx = k; break;
      }
    }
    var res = { docType: "invoice", invoiceNo: hdr && hdr.no, reference: h.reference, doorNo: h.doorNo, section: h.doorNo,
      owner: h.owner, email: h.email, tel: h.tel, invoiceDate: hdr && hdr.date, dueDate: hdr && hdr.due,
      total: hdr ? hdr.total : null, lines: [], charges: {}, meter: {}, other: [] };
    if (hdrIdx < 0 || !anchors) { res.error = "no line-item table"; return res; }

    var cur = null, raw = [];
    for (var r = hdrIdx + 1; r < rows.length; r++) {
      var jr = rows[r].cells.map(function (c) { return c.s; }).join(" ");
      if (/Sub-Total|BANKING DETAILS|Powered by|^TOTAL\b/.test(jr)) break;
      var b = bucketRow(rows[r].cells, anchors);
      var totalVal = (b.total || "").replace(/\s/g, "");
      var isLine = /^-?\d+\.\d\d$/.test(totalVal) && /1\.00/.test(b.qty || "");
      if (isLine) { cur = { account: b.account || "", desc: b.desc || "", amount: money(totalVal) }; raw.push(cur); }
      else if (cur) { if (b.account) cur.account = (cur.account + " " + b.account).trim(); if (b.desc) cur.desc = (cur.desc + " " + b.desc).trim(); }
    }
    raw.forEach(function (L) {
      var combined = (L.account + " " + L.desc).trim();
      var kind = classify(combined);
      var p = period(L.desc), mt = meter(L.desc);
      var line = { kind: kind, desc: combined, amount: L.amount };
      if (p) line.period = p; if (mt) line.meter = mt;
      res.lines.push(line);
      if (kind === "other") res.other.push({ desc: combined, amount: L.amount });
      else res.charges[kind] = (res.charges[kind] || 0) + L.amount;
      if (kind === "water" && mt) res.meter.water = { prev: mt.prev, curr: mt.curr, usage: mt.usage, period: p };
      if (kind === "electricity" && mt) res.meter.elec = { prev: mt.prev, curr: mt.curr, usage: mt.usage, period: p };
      if (kind === "elec_service") res.charges.elec_service_label = /as per (\w+)/.exec(combined) ? RegExp.$1 : "";
    });
    res.lineSum = Math.round(res.lines.reduce(function (s, x) { return s + x.amount; }, 0) * 100) / 100;
    res.reconciles = res.total != null && Math.abs(res.lineSum - res.total) <= 0.05;
    return res;
  }

  // Flatten pdf.js text items into one line per visual row (what the invoice &
  // credit-note text parsers expect).
  function flattenItems(items) {
    return groupRows(items).map(function (r) { return r.cells.map(function (c) { return c.s; }).join(" "); }).join("\n");
  }
  // Detect the document type from the extracted items (+ optional filename hint)
  // and parse with the right routine. This is the single entry point the app
  // calls per uploaded PDF.
  function detectAndParse(items, nameHint) {
    var flat = flattenItems(items);
    nameHint = nameHint || "";
    if (/CustomerStatement/i.test(nameHint) || (/\bCumulative\b/.test(flat) && /\bSTATEMENT\b/.test(flat) && !/INVOICE NO/.test(flat)))
      return parseStatementItems(items);
    if (/(^|\n)\s*CRN\d/.test(flat) || /CRN\d/.test(nameHint)) return parseCreditNoteText(flat);
    return parseInvoiceItems(items);
  }

  var API = { parseInvoiceText: parseInvoiceText, parseInvoiceItems: parseInvoiceItems,
    parseCreditNoteText: parseCreditNoteText, parseStatementItems: parseStatementItems,
    groupRows: groupRows, flattenItems: flattenItems, detectAndParse: detectAndParse, money: money };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMWeconnectU = API;
})(typeof window !== "undefined" ? window : this);
