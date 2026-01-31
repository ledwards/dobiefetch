# Build API, Scraper, and Documentation for dobiefetch

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is maintained according to `.agent/PLANS.md` and must remain fully self-contained.

## Purpose / Big Picture

After this change, a user can run a local scraper that collects data from the target source URL (TARGET_URL="https://www.petplace.com"), stores normalized records in a local database, and then start an API that serves those records with search and filtering. The API is private and requires a shared secret key. A novice can verify success by running the scraper, starting the API, and making an authenticated request that returns data. The project will also produce two docs files: a Markdown API spec for LLMs and a plain HTML page for humans.

## Progress

- [x] (2026-01-31 00:10Z) Read repo agent instructions and current environment (.agent/AGENTS.md, .agent/PLANS.md, .env).
- [x] (2026-01-31 00:40Z) Draft and validate architecture choices for scraper, database, and API.
- [x] (2026-01-31 01:05Z) Implement scraper with dry-run mode and idempotent writes.
- [x] (2026-01-31 01:05Z) Implement API with authentication and search endpoints.
- [x] (2026-01-31 01:15Z) Add documentation outputs (Markdown + HTML).
- [x] (2026-01-31 01:20Z) Add minimal tests and a local smoke-test script.
- [x] (2026-01-31 02:05Z) Switch persistence from SQLite to Postgres and update code/tests/docs.
- [x] (2026-01-31 02:20Z) Prefer Supabase/Vercel Postgres env vars for database configuration.
- [ ] Validate end-to-end and record outcomes.

## Surprises & Discoveries

- Observation: None yet.
  Evidence: N/A.

## Decision Log

- Decision: Use a small Node.js + TypeScript implementation with Postgres for storage and simple SQL filtering.
  Rationale: The user requires Vercel-hosted dev/prod databases; Postgres is the supported option and still keeps queries simple.
  Date/Author: 2026-01-31 / Codex.

- Decision: Use Express for the HTTP API and `pg` for Postgres access.
  Rationale: Express keeps routing and middleware simple, while `pg` provides reliable Postgres access with Vercel support.
  Date/Author: 2026-01-31 / Codex.

- Decision: Export the Express app via `api/index.ts` for Vercel serverless deployment and keep `GET /health` unauthenticated.
  Rationale: Vercel expects a handler export, and leaving `/health` open enables straightforward health checks while still protecting data endpoints.
  Date/Author: 2026-01-31 / Codex.

- Decision: Default to running the scraper on a home laptop (manual or local cron) while documenting proxy-based alternatives for hosted runs.
  Rationale: The user expects IP-based blocking from host providers; local runs from a residential IP are most reliable with minimal integration risk.
  Date/Author: 2026-01-31 / Codex.

## Outcomes & Retrospective

- Pending until implementation is complete.

## Context and Orientation

The repository is currently an empty skeleton with no application code. The root contains `.env` and `.env.example`. The `.env` file defines `TARGET_URL` and is the source target for scraping. There is no existing server or scraper. This plan will introduce a “collector” (scraper) and a “server” (API). The “collector” is a script that fetches pages from the target site, extracts fields, and writes them to a local SQLite database file. The “server” reads from that database and exposes endpoints for listing, filtering, and searching records.

A “normalized record” is the common schema shared by both scraper and API. It defines the fields that can be filtered or searched. “Idempotent” means rerunning the scraper does not create duplicate records or corrupt existing ones.

## Plan of Work

First, choose a simple project layout and create a normalized record schema. The schema will likely include fields like `id`, `title`, `url`, `category`, `summary`, `tags`, `source`, and timestamps. The scraper will extract these attributes from pages under the target site (TARGET_URL="https://www.petplace.com"). The scraper will support a dry-run mode that writes to a temp file or prints counts without writing to the database. For idempotence, the scraper will use a stable `id` derived from the source URL and upsert records into the SQLite table.

Next, implement the API as a small Node.js server with a health endpoint and data endpoints. The API will require a shared secret key (for example `X-API-Key`) that is checked on every request. The API will support query parameters for filtering by attributes and a simple full-text search using SQL `LIKE` or SQLite FTS if needed. The server will read from the same SQLite database written by the scraper.

Then, create documentation in two formats: a Markdown file for LLMs and a simple HTML file for humans. Both docs will describe endpoints, authentication, request/response schemas, examples, and error codes. The HTML file is for local viewing only and will not be deployed.

Finally, add minimal tests and a smoke-test script that runs the scraper in dry-run mode, writes sample data, starts the API, and performs an authenticated query. Update this ExecPlan as changes are made.

## Concrete Steps

1) Create a Node.js + TypeScript project scaffold with separate folders:
   - `collector/` for the scraper
   - `server/` for the API
   - `data/` for the SQLite database and fixtures
   - `docs/` for `api.md` and `api.html`

2) Define a normalized schema in a shared module, for example `shared/record.ts`, and a SQLite migration in `data/schema.sql`.

3) Implement the scraper:
   - Read `TARGET_URL` from `.env`.
   - Crawl a bounded set of pages (start with a known index or sitemap if available).
   - Extract attributes into the normalized schema.
   - Upsert into SQLite by `id` to ensure idempotence.
   - Support `--dry-run` and `--limit` flags.

4) Implement the API:
   - `GET /health` returns `OK`.
   - `GET /records` lists data with optional query parameters (e.g., `category`, `tag`, `q` for search).
   - `GET /records/:id` returns a single record.
   - Require `X-API-Key` (or `Authorization: Bearer <key>`) on all endpoints.

5) Add documentation:
   - `docs/api.md` for LLMs with concise, structured sections and JSON examples.
   - `docs/api.html` as a human-readable mirror of the same content.

6) Add minimal tests:
   - Unit test for schema validation.
   - Integration test for API auth + search.
   - Add a local smoke-test script in `scripts/`.

7) Validate end-to-end and update this ExecPlan sections (Progress, Decision Log, Outcomes).

## Validation and Acceptance

A novice should be able to:

- Run the scraper in dry-run mode and see output indicating how many records would be written.
- Run the scraper in normal mode and see a SQLite file created or updated with records.
- Start the API server and request `GET /health`, receiving HTTP 200 and `OK`.
- Make an authenticated request to `GET /records` and receive JSON data.
- Run the test command (to be defined) and see it pass.

## Idempotence and Recovery

- Rerunning the scraper should update existing rows and not create duplicates. This is enforced by an `id` unique key and UPSERT behavior.
- If scraping fails partway, rerun with the same flags and it should converge to the same database state.
- If the database becomes corrupt or mis-scraped, delete `data/records.sqlite` and rerun the scraper.

## Artifacts and Notes

Example expected output for a dry-run (illustrative):

    $ node collector/index.js --dry-run --limit=10
    Loaded TARGET_URL=https://www.petplace.com
    Fetched 10 pages
    Parsed 10 records
    Dry-run: would upsert 10 records into data/records.sqlite

## Interfaces and Dependencies

- Node.js 20+ with TypeScript.
- SQLite database via `better-sqlite3` or `sqlite3` (choose one and document in this plan when implemented).
- HTTP server via `express` or a minimal Node.js server (choose one and document in this plan when implemented).
- Shared schema module in `shared/record.ts`:

    export type NormalizedRecord = {
      id: string;
      title: string;
      url: string;
      category: string | null;
      summary: string | null;
      tags: string[];
      source: string;
      fetched_at: string; // ISO timestamp
    };

## Scraper Hosting and IP-Blocking Mitigation Plan

The default plan is to run the scraper on a home laptop (manual or a local cron task). This uses a residential IP and avoids common blocks aimed at data-center IPs. If automated hosted scraping becomes necessary, the plan is to use one of these approaches:

- Use a residential proxy provider (paid) and configure the scraper to route requests through rotating residential IPs. This reduces blocking but adds cost and credentials management.
- Use a small VPS in a less-blocked region plus aggressive politeness settings (low rate, random delays, and user-agent rotation). This is cheaper but may still be blocked.
- Use a managed scraping API service that fetches pages and returns HTML for parsing. This offloads IP issues but changes the data flow and costs per request.

These options will be documented for later adoption; implementation will start with the laptop-run approach.

## Notes on Plan Updates

When this plan changes, append a short note below describing what changed and why, with date and author.

- Update: Marked implementation tasks complete, documented Express + better-sqlite3 choices, and Vercel handler decision.
  Why: Implementation now exists in the repo and required concrete dependency and deployment choices.
  Date/Author: 2026-01-31 / Codex.

- Update: Switched persistence from SQLite to Postgres and updated configuration and docs.
  Why: Requirement change to use Vercel-hosted Postgres for dev/prod.
  Date/Author: 2026-01-31 / Codex.

- Update: Added Supabase/Vercel env var support (`POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`).
  Why: User requested using Supabase-provided env vars instead of manual DATABASE_URL.
  Date/Author: 2026-01-31 / Codex.
