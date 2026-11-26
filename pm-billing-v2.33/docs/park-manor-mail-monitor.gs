/**
 * Park Manor — mailbox monitor (Google Apps Script)
 * ==================================================
 * Runs INSIDE the parkmanorbc@gmail.com Google account. On a timer it scans the
 * inbox for emails whose subject contains a ticket number (e.g. "#42"), and
 * posts each new one to the Park Manor web app, which appends it to that
 * ticket's activity log. The monitoring belongs to the Park Manor account —
 * not to any individual trustee.
 *
 * ── ONE-TIME SETUP ────────────────────────────────────────────────────────
 * 1. Sign in to Google as  parkmanorbc@gmail.com
 * 2. Go to  https://script.google.com  →  New project
 * 3. Delete the sample code, paste THIS whole file in, and Save.
 * 4. Fill in the two CONFIG values below:
 *      - INGEST_SECRET must EXACTLY match the EMAIL_INGEST_SECRET you set in
 *        Netlify (Site settings → Environment variables). Pick a long random
 *        string; use the same one in both places.
 *      - INGEST_URL should already be correct for park-manor-bc.netlify.app.
 * 5. Run the function  pmInstallTrigger  once (Run ▸). Google will ask you to
 *    authorise access to Gmail — approve it (it's your own account).
 *    This creates a trigger that runs every 5 minutes.
 * 6. (Optional) Run  pmScanInbox  once to process the last couple of days now.
 *
 * To pause monitoring: Triggers (clock icon) → delete the pmScanInbox trigger.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
var INGEST_URL    = 'https://park-manor-bc.netlify.app/api/ingest-email';
var INGEST_SECRET = 'PUT-THE-SAME-SECRET-AS-NETLIFY-HERE';
// Only treat a message as ticket-related when its subject looks like one of the
// app's emails (avoids random "#5" hashtags in unrelated mail).
var TICKET_CONTEXT = /(park manor|quote request|report\s*#)/i;
var TICKET_NUMBER  = /#(\d{1,7})/;
var DONE_LABEL     = 'PM-Logged';        // applied to threads we've processed
// ────────────────────────────────────────────────────────────────────────────

/** Create the 5-minute trigger. Run this ONCE. */
function pmInstallTrigger() {
  // Remove any existing trigger for pmScanInbox first (avoids duplicates).
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pmScanInbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pmScanInbox').timeBased().everyMinutes(5).create();
  Logger.log('Installed: pmScanInbox will run every 5 minutes.');
}

/** Main loop — called by the trigger. */
function pmScanInbox() {
  var props = PropertiesService.getScriptProperties();
  var lastRun = Number(props.getProperty('pmLastRun') || 0);
  // Overlap a little so a mid-run failure doesn't drop messages; the server
  // de-dups by message id, so re-sending is harmless.
  var windowStart = lastRun ? (lastRun - 10 * 60 * 1000) : (Date.now() - 2 * 24 * 60 * 60 * 1000);

  var label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var threads = GmailApp.search('newer_than:2d', 0, 100);
  var sent = 0;

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var msgs = thread.getMessages();
    var handledInThread = false;

    for (var j = 0; j < msgs.length; j++) {
      var msg = msgs[j];
      var when = msg.getDate().getTime();
      if (when < windowStart) continue;

      var subject = msg.getSubject() || '';
      if (!TICKET_CONTEXT.test(subject)) continue;
      var m = subject.match(TICKET_NUMBER);
      if (!m) continue;

      var payload = {
        secret: INGEST_SECRET,
        ticketNumber: m[1],
        from: msg.getFrom(),
        date: msg.getDate().toISOString(),
        subject: subject,
        snippet: (msg.getPlainBody() || '').replace(/\s+/g, ' ').trim().slice(0, 300),
        gmailUrl: 'https://mail.google.com/mail/u/0/#all/' + thread.getId(),
        messageId: msg.getId()
      };

      try {
        var res = UrlFetchApp.fetch(INGEST_URL, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        var code = res.getResponseCode();
        if (code >= 200 && code < 300) { sent++; handledInThread = true; }
        else { Logger.log('Ingest %s for #%s: %s', code, m[1], res.getContentText().slice(0, 200)); }
      } catch (e) {
        Logger.log('Ingest error for #%s: %s', m[1], e);
      }
    }

    if (handledInThread) thread.addLabel(label); // visual marker in Gmail
  }

  props.setProperty('pmLastRun', String(Date.now()));
  Logger.log('pmScanInbox done — %s message(s) sent to the tracker.', sent);
}
