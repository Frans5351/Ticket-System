// pm_mapper.js — turns parsed WeconnectU documents into per-unit updates for
// the app's billing module, applying Park Manor's billing rules:
//   • Only doors 1–12 are billed. Sections 13+ are garages/stores — never a
//     separate bill; their entries fold onto the owner's main (≤12) door.
//   • Door 19 (Koegelenberg garage) → door 10, matched by owner-code prefix.
//   • Credit notes attach to their door (e.g. door 9 solar).
// Pure: feed it the array of parsed docs, get { units, remaps, flags }.
(function (root) {
  "use strict";

  var RESIDENTIAL_MAX = 12; // doors 1..12 are billable units; 13+ are garages

  function ownerCode(ref) { var m = /^([A-Za-z]+)/.exec(ref || ""); return m ? m[1].toUpperCase() : ""; }

  // Build garage-door -> residential-door remap by matching owner code.
  function buildRemaps(docs) {
    var residentialByCode = {}; // code -> door (<=12)
    docs.forEach(function (d) {
      if (d.doorNo != null && d.doorNo <= RESIDENTIAL_MAX) {
        var c = ownerCode(d.reference);
        if (c && residentialByCode[c] == null) residentialByCode[c] = d.doorNo;
      }
    });
    var remaps = {}; // garageDoor -> { to, code }
    docs.forEach(function (d) {
      if (d.doorNo != null && d.doorNo > RESIDENTIAL_MAX) {
        var c = ownerCode(d.reference);
        var to = residentialByCode[c];
        if (to != null) remaps[d.doorNo] = { to: to, code: c, from: d.doorNo };
      }
    });
    return remaps;
  }

  function mapDocsToUnits(docs) {
    var remaps = buildRemaps(docs);
    var units = {}; // door -> unit record
    var flags = [];

    function unit(door) {
      if (!units[door]) units[door] = {
        door: door, section: door, owner: "", email: "", tel: "", reference: "",
        invoices: [], meterReadings: [], creditNotes: [], charges: {}, latestInvoiceDate: "",
      };
      return units[door];
    }

    docs.forEach(function (d) {
      if (d.docType === "invoice") {
        if (d.doorNo > RESIDENTIAL_MAX) {
          // A garage got a real (non-zero) invoice — shouldn't happen; flag it.
          if (d.total > 0) flags.push("Garage door " + d.doorNo + " was billed " + d.total.toFixed(2) + " on " + d.invoiceNo + " — review (garages shouldn't be billed).");
          return;
        }
        var u = unit(d.doorNo);
        u.owner = d.owner || u.owner; u.email = d.email || u.email; u.tel = d.tel || u.tel; u.reference = d.reference || u.reference;
        u.invoices.push({ invoiceNo: d.invoiceNo, date: d.invoiceDate, due: d.dueDate, total: d.total, lines: d.lines, meter: d.meter, reconciles: d.reconciles });
        if (!d.reconciles) flags.push(d.invoiceNo + " (door " + d.doorNo + ") does not reconcile: lines " + d.lineSum + " vs total " + d.total + ".");
        // Meter readings: one row per invoice month (water & elec cumulative).
        if (d.meter && (d.meter.water || d.meter.elec)) {
          u.meterReadings.push({ date: d.invoiceDate,
            water: d.meter.water ? d.meter.water.curr : null,
            elec: d.meter.elec ? d.meter.elec.curr : null, src: d.invoiceNo });
        }
        // Keep the latest month's named charges as the unit's current charges.
        if (d.invoiceDate >= u.latestInvoiceDate) { u.latestInvoiceDate = d.invoiceDate; u.charges = d.charges; }
      } else if (d.docType === "credit_note") {
        var door = d.doorNo;
        if (door > RESIDENTIAL_MAX && remaps[door]) door = remaps[door].to;
        unit(door).creditNotes.push({ creditNoteNo: d.creditNoteNo, date: d.date, total: d.total, appliesTo: d.appliesTo, lines: d.lines });
      }
    });

    // ── Statements: attach to billable units; consolidate garage statements ──
    var consolidations = [];
    docs.forEach(function (d) {
      if (d.docType !== "statement") return;
      var ledger = (d.ledger || []).map(function (e) {
        return { date: e.date, src: e.src, desc: e.desc, debit: e.debit, credit: e.credit, cumulative: e.cumulative };
      });
      if (d.doorNo <= RESIDENTIAL_MAX) {
        var u = unit(d.doorNo);
        u.owner = u.owner || d.owner; u.reference = u.reference || d.reference;
        u.statement = { ref: d.reference, asOf: d.statementDate, ageing: d.ageing || null, ledger: ledger };
      } else {
        // Garage statement (e.g. door 19). Its only real postings are payments
        // that were misallocated; move them to the owner's main (≤12) door.
        var to = remaps[d.doorNo] ? remaps[d.doorNo].to : null;
        var real = ledger.filter(function (e) { return Math.abs(e.debit) > 0.005 || Math.abs(e.credit) > 0.005; });
        consolidations.push({ from: d.doorNo, to: to, ref: d.reference, postings: real });
      }
    });

    // Apply consolidations: append the garage's real postings onto the target
    // unit's ledger, re-sort by date, and recompute the running balance.
    consolidations.forEach(function (c) {
      if (c.to == null) { flags.push("Garage " + c.ref + " has no matching main unit — " + c.postings.length + " posting(s) left unassigned, review."); return; }
      var u = unit(c.to);
      if (!u.statement) u.statement = { ref: "", asOf: "", ageing: null, ledger: [] };
      c.postings.forEach(function (p) {
        u.statement.ledger.push({ date: p.date, src: p.src, desc: p.desc + " [moved from " + c.ref + "]", debit: p.debit, credit: p.credit, cumulative: null });
      });
      u.statement.ledger.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
      var bal = 0;
      u.statement.ledger.forEach(function (e) { bal = Math.round((bal + e.debit - e.credit) * 100) / 100; e.cumulative = bal; });
      u.statement.ageing = null; // let the app recompute ageing from the merged ledger
      u.statement.consolidatedBalance = bal;
      flags.push("Door " + c.from + " (" + c.ref + ") → moved " + c.postings.length + " payment(s) totalling " +
        c.postings.reduce(function (s, p) { return s + p.credit - p.debit; }, 0).toFixed(2) + " onto door " + c.to + ". New balance there: " + bal.toFixed(2) + ".");
    });

    // Sort each unit's invoices & readings by date.
    Object.keys(units).forEach(function (k) {
      units[k].invoices.sort(function (a, b) { return a.date.localeCompare(b.date); });
      units[k].meterReadings.sort(function (a, b) { return a.date.localeCompare(b.date); });
    });

    return { units: units, remaps: remaps, flags: flags };
  }

  var API = { mapDocsToUnits: mapDocsToUnits, buildRemaps: buildRemaps, RESIDENTIAL_MAX: RESIDENTIAL_MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.PMMapper = API;
})(typeof window !== "undefined" ? window : this);
