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

- Apply schema locally: `npm run migrate`
- Apply schema using prod creds: `DOBIE_ENV=prod npm run migrate` (uses `.env.prod`)
