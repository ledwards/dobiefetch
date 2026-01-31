# Dobiefetch

Live: `https://dobiefetch.vercel.app`

API docs: `docs/api.md`
Smoke checks: `docs/smoke.md`

## Local setup

1. Install deps: `npm install`
2. Build: `npm run build`
3. Create `.env.dev` with dev creds (used by default)
4. Run API: `npm start`

## Deploys

- `git push` to `main` deploys to Vercel automatically.

## Migrations

- Apply schema locally: `npm run migrate` or `npm run migrate:dev`
- Apply schema using prod creds: `npm run migrate:prod` (uses `.env.prod`)
- Deploys run `npm run vercel-build`, which applies migrations with prod creds.

## Scraper

- Dev creds: `npm run scrape:dev`
- Prod creds: `npm run scrape:prod`

Environment variables for search:
- `PETPLACE_BREED` (default: `DOBERMAN PINSCH`)
- `PETPLACE_ZIP` (default: `94110`)
- `PETPLACE_RADIUS` (default: `100`)
- `PETPLACE_START_INDEX` (default: `0`)
- `PETPLACE_SEARCH_URL` (optional full override; can be a `https://api.petplace.com/animal?...` URL)
