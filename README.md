# Late Records

E-commerce storefront for curated vinyl records — Japanese city pop, AOR, and rare pressings. Ships anywhere in the Philippines.

**Live site:** [late-records.shop](https://late-records.shop)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Static HTML/CSS/JS — no framework, no build step |
| Hosting | Cloudflare Pages |
| API | Cloudflare Worker (catalog, orders, tags) |
| Media | Cloudflare R2 |
| Data | Google Sheets + Apps Script |
| CI/CD | GitHub Actions |

## Architecture

- **Worker** handles `/api/catalog`, `/api/album`, `/api/order`, `/api/tags`, `/api/suggest`
- **R2** caches the catalog (10-min TTL, cron-refreshed) and AI-generated tags (24-hr TTL)
- **Orders** are validated server-side — prices recalculated from catalog, never trusted from the client
- **Payments** are handled manually via bank transfer (GCash / BPI)

## Project Docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system overview and API reference
- [`ARCHITECT_NOTES.md`](ARCHITECT_NOTES.md) — decisions, constraints, and backlog
- [`AGENT_HANDOFF.md`](AGENT_HANDOFF.md) — full context brief for AI-assisted development
