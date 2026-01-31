# Dobiefetch Smoke Check

## Live URL

- `https://dobiefetch.vercel.app`

## Deploys

- `git push` to `main` deploys to Vercel automatically.

## Quick checks

1. Health check
   - `GET https://dobiefetch.vercel.app/health`
   - Expect: `200 OK` with body `OK`
2. Authenticated list
   - `GET https://dobiefetch.vercel.app/dogs?limit=1`
   - Header: `X-API-Key: <API_KEY>`
   - Expect: `200 OK` with JSON payload containing `count` and `dogs`

## Troubleshooting

- `401 Unauthorized`: Confirm `API_KEY` is set in Vercel environment variables and header is present.
- `500 Internal Server Error`: Check `DATABASE_URL` (or `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`) and `TARGET_URL`.
