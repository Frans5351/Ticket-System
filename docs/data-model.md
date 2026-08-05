# Data model

Supabase Postgres tables and the shapes of records they hold.

## Schema convention

Most tables use a two-column shape:

```sql
CREATE TABLE <name> (
  id TEXT PRIMARY KEY,
  data JSONB
);
```

The `data` blob holds everything else. This trades schema discipline for iteration speed: adding a new field to tickets doesn't need a migration. The trade-off is that queries can't filter on fields as efficiently as they would with columns, and there's no schema enforcement.

**Exception:** the `settings` table uses `(key, value)` instead of `(id, data)`.

Query fields inside `data` using PostgREST's JSON operators: `?data->>fieldName=eq.value`.

## Tables

### `tickets`

The primary entity. Represents a maintenance issue, question, or enquiry.

```typescript
{
  id: string,                        // t_<timestamp>_<random>
  title: string,                     // Short subject
  desc: string,                      // Long description
  status: 'open' | 'in_progress' | 'awaiting_quote'
        | 'awaiting_trustee_approval' | 'work_in_progress' | 'resolved',
  priority: 'low' | 'medium' | 'high' | 'urgent',
  category: string,                  // Free-text: Plumbing, Security, etc.
  unit: string,                      // Free-text unit number
  reporter: string,                  // Display name of who reported it
  reporterUserId?: string,           // Optional link to a users record
  reporterPhone?: string,
  reporterEmail?: string,
  createdBy?: string | null,         // User ID; null for public submissions
  createdViaPublicForm?: boolean,
  reporterEditToken?: string,        // 16-char, gates ?reportEdit=<token>
  shareToken?: string,               // Separate token for ?share=<id>&t=<token>
  ticketNumber: number,              // Sequential display number
  dateOpen: string,                  // YYYY-MM-DD
  dateClose?: string,
  linkedDocIds: string[],            // References into invoices.id
  approvals: Array<{                 // Trustee approvals
    userId: string,
    userName: string,
    quoteId: string,                 // References linkedDocIds OR crit_<...>
    ts: number
  }>,
  criteria?: Array<{                 // User-added "proposal" items
    id: string,                      // 'crit_<random>'
    text: string,
    createdBy: string,
    createdByName: string,
    createdAt: number
  }>,
  approvedQuoteId?: string,          // Set when 3-trustee threshold met
  approvedBy?: string,
  approvedByName?: string,
  approvedAt?: number,
  log: Array<{                       // Activity log
    type: 'status' | 'note' | ...,
    text: string,
    ts: number,
    by?: string,
    byName?: string
  }>,
  added: number,                     // Timestamp
  updated: number
}
```

**Approval rule:** work can start on a ticket only when 3 or more entries in `approvals` share the same `quoteId`. This is enforced in the approval-panel UI, not at the database level.

**Public submissions** are identified by `createdViaPublicForm: true`. They have `createdBy: null` and their `reporter` field is a free-text name (possibly "Anonymous"). Admin can link them to a real user account, which sets `reporterUserId` and replaces `reporter` with the user's full name.

### `invoices`

Documents attached to tickets. Poorly named — this table holds photos, quotes, invoices, receipts, reports, and any other attachment.

```typescript
{
  id: string,                        // inv_<timestamp>_<random>
  name: string,                      // Original filename
  type: string,                      // MIME type
  data?: string,                     // base64-encoded file bytes (see caveat)
  url?: string,                      // Alternative: a URL if stored in Supabase Storage
  docType: 'Invoice' | 'Quote' | 'Report' | 'Receipt' | 'Supporting Evidence' | ...,
  invCompany?: string,               // Supplier/company name
  invNumber?: string,                // Invoice/quote number
  amount?: number,                   // Rand value if applicable
  date?: string,                     // YYYY-MM-DD
  uploadedBy?: string,               // User ID; used for canDeleteAttachments 'own' scope
  added: number
}
```

**Data storage caveat:** most files are stored as base64 in `data`. That means:
- A 5MB photo becomes a ~7MB row in Postgres
- Query result payloads can be huge
- The Supabase Storage bucket named `attachments` is intended for large files but is currently under-used

Not fixing this yet because at Park Manor's scale (17 units, low ticket volume) it hasn't caused problems. If ticket volume grows or photos get larger, migrate to real Storage bucket references.

### `users`

App users. This is *not* an auth table — it's the domain-side user record.

```typescript
{
  id: string,                        // user_<timestamp>_<random>
  username: string,                  // Login handle
  fullName?: string,
  role: 'admin' | 'trustee' | 'resident' | 'viewer' | 'guest',
  password?: string,                 // ⚠️ Plaintext — known issue, see runbook
  email?: string,
  phone?: string,
  permissions?: Record<string, boolean | 'always' | 'own' | 'never'>,
  createdAt: number
}
```

**Permission override:** `permissions[key]` on a user record overrides `ROLE_PERMISSIONS[user.role][key]`. Admin role always wins regardless of overrides.

**Plaintext passwords:** biggest security issue in the system. Documented in `runbook.md` under known issues. Anyone with `service_role` access to Supabase can read all passwords. Fix would be a bcrypt hash + a Netlify function that does the comparison, but that's a bigger refactor.

### `suppliers`

Third-party companies used for quotes.

```typescript
{
  id: string,                        // sup_<timestamp>_<random>
  name: string,                      // Company name — cascade-renamed to invoices.invCompany
  phone?: string,
  email?: string,
  address?: string,
  notes?: string,
  added: number
}
```

**Cascade rename:** when admin renames a supplier, the app also updates every invoice's `invCompany` field to match. Without this, `importSuppliersFromInvoices()` would re-create ghost suppliers from stale invoice references.

### `settings`

App-wide configuration. Two-column shape `(key, value)` instead of the `(id, data)` pattern.

```typescript
[
  { key: 'flagged', value: Array<string> },              // Flagged transactions
  { key: 'role_permissions', value: Record<Role, Record<Key, ...>> },
  { key: 'public_reports_enabled', value: boolean },
  // ...
]
```

Reads/writes go through `sbGetSetting(key)` and `sbSetSetting(key, value)`.

### `passkeys` and `passkey_challenges`

WebAuthn credential storage. Consumed only by Netlify functions.

```typescript
// passkeys
{
  credential_id: string,             // Base64URL
  user_id: string,                   // References users.id
  public_key: string,                // Base64URL
  counter: number,
  created_at: string                 // ISO
}

// passkey_challenges (short-lived)
{
  challenge: string,                 // Base64URL
  user_id: string,
  purpose: 'registration' | 'authentication',
  expires_at: string                 // ISO
}
```

## Referential integrity

Postgres doesn't enforce cross-table references — no foreign keys are defined. All referential integrity is application-level:

| Reference | Enforced where |
|---|---|
| `tickets.linkedDocIds` → `invoices.id` | Frontend filter; missing IDs render a warning banner |
| `tickets.createdBy` → `users.id` | Not enforced; null is valid |
| `tickets.reporterUserId` → `users.id` | Not enforced; render falls back to "(unknown user)" |
| `tickets.approvals[].userId` → `users.id` | Not enforced |
| `invoices.uploadedBy` → `users.id` | Not enforced |
| `passkeys.user_id` → `users.id` | Not enforced |

**Consequence:** deleting a user does not clean up their references. This is intentional (keeps the audit trail intact even if a trustee stands down) but means "orphaned reference" states are possible and code must tolerate them.

## Backup

Supabase does automatic daily backups on paid tiers. On the free tier, backups need to be manually triggered — or, more practically, do this once a quarter:

1. Dashboard → SQL editor → `SELECT * FROM tickets` → download as CSV
2. Same for `invoices` (⚠️ large — export in batches if needed)
3. Same for `users`, `suppliers`, `settings`

Store the CSVs somewhere durable. If Supabase disappears or the project is deleted by mistake, these are the recovery path.

## August 2026 field additions

- **`tickets.data`**: `reporterEmail`, `reporterEditToken` (public flow);
  `approvals[]` entries `{invId|quoteId|targetId, trusteeId, trusteeName, ts}`;
  `approvedAt`, `approvedQuoteId`; `journeyHidden[]` (display-only hide refs
  like `log:3`, `doc:<id>`, `appr:1`, `accepted`); log entries may carry
  `journey:true` (admin-inserted notes) and `amount` (Rand value on proposals).
- **`users.data`**: `email` (drives notification recipients + credential
  emails); `password` now `sha256$<hex>` (salt `park-manor-v1`, matching
  `functions/_passkey-shared.js`); roles now include `owner`, `tenant`,
  `management`.
- **`invoices.data`**: `added` (ms timestamp — the Journey's doc time; admin
  re-timing mutates it), spreadsheet mime types now accepted.
