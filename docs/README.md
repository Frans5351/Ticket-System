# Park Manor Ticket System — Architecture Documentation

This folder documents the architecture of the Park Manor body-corporate ticket system using the [C4 model](https://c4model.com/). It's aimed at a future maintainer (which may be you six months from now) who needs to understand *why* the system is shaped the way it is, not just *what* it does.

## Reading order

If you're new to the system, read in this order:

1. **[Context](./01-context.md)** — what the system is for and who touches it
2. **[Containers](./02-containers.md)** — the deployable pieces and how they talk
3. **[Components](./03-components.md)** — the logical modules inside the frontend
4. **[Data model](./data-model.md)** — Supabase tables and record shapes
5. **[Runbook](./runbook.md)** — how to deploy, configure, and operate

## What this is not

- **Not exhaustive.** The system has ~10,000 lines of JavaScript; this documents shape and intent, not every function.
- **Not auto-generated.** Written by hand; expect drift. If you find something wrong, update it.
- **Not a spec.** The source of truth is the code. These docs describe what's there, not what should be.

## About the diagrams

Diagrams are written in [Mermaid](https://mermaid.js.org/) and render natively on GitHub. To edit them locally, any Mermaid-capable editor works (VS Code has extensions). If a diagram is missing something obvious, add it and open a PR — better to have it wrong and fixable than absent.

## Glossary

Terms used throughout these docs:

- **Body corporate / BC** — the legal entity that owns the common property of a sectional title scheme. Park Manor is one such scheme.
- **Trustee** — an elected member of the body corporate's governing body. Trustees vote on quotes and proposals.
- **Resident** — an owner or tenant of a unit. Reads-mostly access.
- **Admin** — the operational owner of the app (currently one person: Franco). Full access.
- **Ticket** — a maintenance issue, question, or general enquiry. The system's primary entity.
- **Quote** / **Proposal** — items attached to a ticket that trustees vote on. Quotes come from suppliers; proposals are internally-generated ideas. Both need 3 trustee approvals on the same item before work can start.
- **Public submission** — a ticket created via the public form (no login required).
