# Billing changelog

## v2.1 — instalments counted from the invoices on file
- "Payment n of 3" lines no longer depend on a stored counter that every test
  invoice bumped. The next number is worked out from the Davies invoices and the
  invoices issued here (fully credited ones don't count), so a draft you delete
  or a test invoice you credit puts the plan back where it was.
- Charges tab shows, per instalment line, what has been billed so far
  (e.g. "billed on INV00081 (1) — next is payment 2 of 3") and marks finished
  plans "finished" instead of silently dropping them; a draft says in its
  warnings when a plan was left off because all instalments are billed.

## v2 — invoicing engine
See billing.md.
