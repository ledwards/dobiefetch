# Add PetPlace Adoption Schema and Scraper Pipeline

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is maintained according to `.agent/PLANS.md` and must remain fully self-contained.

## Purpose / Big Picture

After this change, a user can run the scraper to collect PetPlace adoption data for dogs based on a search URL (breed + ZIP), store normalized dog listings and photos in Postgres, and serve them through the API. A novice can verify success by running the scraper against a single ZIP, starting the API, and fetching dogs and dog details from HTTP endpoints. The schema and API will match the real PetPlace JSON payload.

## Progress

- [x] (2026-01-31 02:40Z) Read `.agent/AGENTS.md` and `.agent/PLANS.md` requirements for ExecPlans.
- [x] (2026-01-31 03:10Z) Update ExecPlan to cover PetPlace API payload, schema, migrations, scraper, API changes, and tests.
- [x] (2026-01-31 03:25Z) Replace database schema with dogs/shelters/photos/search tables and add indexes.
- [x] (2026-01-31 03:40Z) Update shared types, scraper, and API to use PetPlace JSON payload.
- [x] (2026-01-31 03:55Z) Update docs, smoke script, and env examples for new endpoints and search parameters.
- [x] (2026-01-31 04:00Z) Update API tests to seed dog data and validate /dogs.
- [x] (2026-01-31 04:20Z) Expand scraper to iterate CA zip codes, dedupe results, and update docs/env examples.
- [x] (2026-01-31 04:40Z) Expose full dog schema in API responses and update docs accordingly.
- [ ] Validate end-to-end (migrate, scrape, serve, test) and record outcomes.

## Surprises & Discoveries

- Observation: PetPlace dog detail pages are mostly empty HTML shells; real data comes from `https://api.petplace.com/animal/{AnimalId}/client/{ClientId}`.
  Evidence: Provided JSON payload includes `ppRequired`, `animalDetail`, and `imageURL` fields.
- Observation: PetPlace search results are client-rendered and call `https://api.petplace.com/animal` to return `animalId` and `clientId` pairs.
  Evidence: Browser network response returns JSON with `animal` array and `totalCount`.

## Decision Log

- Decision: Scrape the PetPlace JSON API endpoint instead of the rendered HTML page.
  Rationale: The HTML shell does not contain data; the JSON endpoint is structured and includes all dog fields.
  Date/Author: 2026-01-31 / Codex.

- Decision: Extract listing IDs from search HTML using a URL regex for `/pet-adoption/dogs/{AnimalId}/{ClientId}`.
  Rationale: No extra dependencies required, and the URL pattern is stable when HTML contains listings.
  Date/Author: 2026-01-31 / Codex.

- Decision: Support the PetPlace search API (`https://api.petplace.com/animal`) when HTML listings are client-rendered.
  Rationale: The HTML search page can be empty while the API returns all listings; this ensures scraping still works.
  Date/Author: 2026-01-31 / Codex.

- Decision: Iterate a default CA zip list and dedupe by `(animalId, clientId)` in memory before detail fetches.
  Rationale: Avoid duplicate detail requests while covering multiple zip codes for statewide coverage.
  Date/Author: 2026-01-31 / Codex.

- Decision: Return full dog records from `/dogs` instead of a summary.
  Rationale: User requested “expose EVERYTHING” and keep docs aligned with API output.
  Date/Author: 2026-01-31 / Codex.

- Decision: Store the full raw payload alongside normalized columns.
  Rationale: Keeps schema resilient to future field additions without a full migration and supports debugging.
  Date/Author: 2026-01-31 / Codex.

## Outcomes & Retrospective

- Pending until validation is complete.

## Context and Orientation

The repo already contains a working Express API and a TypeScript scraper in `src/collector/index.ts`. Postgres is used for storage via `src/shared/db.ts`. The current schema and API have now been updated to a dog-adoption model based on the PetPlace JSON payload. The scraper fetches a PetPlace search results page, extracts animal IDs and client IDs from listing URLs, then calls `https://api.petplace.com/animal/{AnimalId}/client/{ClientId}` to fetch detail JSON. Dogs, shelters, photos, and search metadata are stored in Postgres. The API exposes `GET /dogs` and `GET /dogs/:id` plus `/health`.

Key files:
- `data/schema.sql`: database schema migration for dogs/shelters/photos/search tables.
- `src/shared/record.ts`: dog, shelter, photo, and payload types.
- `src/collector/index.ts`: scraper entrypoint.
- `src/server/app.ts`: Express API routes for dogs.
- `docs/api.md` + `docs/api.html`: documentation.
- `tests/api.test.js`: API tests.

Terms:
- “Search URL”: the PetPlace search endpoint with query params for zip and breed.
- “Detail JSON”: PetPlace API endpoint returning a JSON payload with `ppRequired`, `animalDetail`, and `imageURL`.

## Plan of Work

First, update `data/schema.sql` to define new tables for `dogs`, `shelters`, `photos`, and `search_runs` + `search_results`. Include a JSONB column `raw_payload` on `dogs` and indexes on `(source, source_animal_id, client_id)`.

Second, update shared TypeScript types in `src/shared/record.ts` to represent normalized dog records, shelters, and photos.

Third, update the scraper in `src/collector/index.ts` to:
- Build the search URL from `TARGET_URL` or `PETPLACE_SEARCH_URL` and env defaults.
- Fetch the search HTML and extract listing IDs.
- If the search URL points at `api.petplace.com/animal`, parse the JSON response and extract listing IDs from the `animal` array.
- Fetch the detail JSON for each listing.
- Normalize fields into dog, shelter, and photos tables.
- Upsert by `(source, source_animal_id, client_id)` for idempotence.
- Provide `--dry-run`, `--limit`, `--zip`, `--breed`, `--radius` flags.

Fourth, update the API in `src/server/app.ts` to expose:
- `GET /dogs` with filters (breed, age, gender, size, status, client_id, source_animal_id) and pagination.
- `GET /dogs/:id` returning full dog details and photos.
- Keep `GET /health` unchanged.

Fifth, update docs (`docs/api.md`, `docs/api.html`, `docs/smoke.md`, `README.md`, `.env.example`) to reflect new endpoints and fields.

Finally, update tests:
- `tests/api.test.js` seeds dog/shelter/photo data and validates `/dogs`.

## Concrete Steps

1) Run migrations for local dev:
   - Working directory: repo root
   - Command: `npm run migrate:dev`
   - Expect: `Schema applied.`

2) Scrape a small sample:
   - Command: `npm run scrape:dev -- --limit=3`
   - Expect: logs showing search URL, listings count, and `Upserted 3 dogs...`.

3) Start the API:
   - Command: `npm start`
   - Expect: server listens on `http://localhost:3000`.

4) Query the API:
   - Command: `curl -H "X-API-Key: <API_KEY>" "http://localhost:3000/dogs?limit=1"`
   - Expect: JSON containing `count` and `dogs` array.

5) Run tests:
   - Command: `npm test`
   - Expect: tests pass (health + dogs endpoint).

## Validation and Acceptance

A novice should be able to:
- Run `npm run migrate:dev` and see “Schema applied.”
- Run `npm run scrape:dev -- --limit=3` and see “Upserted 3 dogs into DATABASE_URL.”
- Start the API and query `GET /dogs` to receive at least one dog.
- Query `GET /dogs/:id` for a known dog and receive full details including photos.
- Run `npm test` and see it pass.

## Idempotence and Recovery

- Scraper writes use UPSERT by `(source, source_animal_id, client_id)`; rerunning updates, not duplicates.
- If scraping fails, rerun with the same flags.
- If schema changes cause conflicts, rerun `npm run migrate:dev` to reapply schema.

## Artifacts and Notes

Expected example output:

    $ npm run scrape:dev -- --limit=1
    Loaded search URL=https://www.petplace.com/pet-adoption/search?...zipPostal=94110...
    Found 12 listings
    Upserted 1 dogs into DATABASE_URL

## Interfaces and Dependencies

- Keep existing dependencies (`express`, `pg`, `dotenv`). No new third-party libs.
- `src/shared/record.ts` defines `DogRecord`, `ShelterRecord`, `PhotoRecord`, and `PetPlacePayload`.

## Notes on Plan Updates

- Update: Re-scoped the ExecPlan to PetPlace adoption schema, JSON API scraper, and new dog endpoints.
  Why: The project now targets adoption listings and needs a new normalized schema and API to match real payloads.
  Date/Author: 2026-01-31 / Codex.

- Update: Documented progress for schema/API/scraper/doc/test updates.
  Why: Implementation work completed before final validation.
  Date/Author: 2026-01-31 / Codex.
