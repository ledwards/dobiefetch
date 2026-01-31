# Dobiefetch API (LLM-readable)

## Overview

- Purpose: Provide read-only access to dog adoption listings scraped from PetPlace.
- Base URL: `https://dobiefetch.vercel.app` (local: `http://localhost:3000`)
- Auth: Shared secret via `X-API-Key` header or `Authorization: Bearer <API_KEY>`.
- Content type: JSON.

## Authentication

All endpoints except `GET /health` require authentication.

Example:

```
GET /dogs
X-API-Key: your-secret
```

## Dog Schema (summary)

```json
{
  "id": "string",
  "source_animal_id": "string",
  "client_id": "string",
  "name": "string",
  "primary_breed": "string|null",
  "age": "string|null",
  "gender": "string|null",
  "size_category": "string|null",
  "status": "string|null",
  "listing_url": "string",
  "primary_photo_url": "string|null",
  "shelter": {
    "name": "string",
    "city": "string|null",
    "state": "string|null"
  }
}
```

## Endpoints

### GET /health

- Auth: not required
- Response: `200 OK` with body `OK`

### GET /dogs

List dogs with optional filters and search.

Query parameters:
- `q`: substring search across name, breeds, description, shelter name
- `breed`: substring match against primary breed
- `age`: exact match
- `gender`: exact match
- `size`: exact match
- `status`: exact match
- `client_id`: exact match
- `source_animal_id`: exact match
- `limit`: number of dogs (default 50, max 200)
- `offset`: offset for pagination

Example:

```
GET /dogs?breed=Doberman&limit=10
X-API-Key: your-secret
```

Response:

```json
{
  "count": 1,
  "dogs": [
    {
      "id": "...",
      "name": "MINDY",
      "breed_primary": "Doberman Pinscher",
      "age": "Adult",
      "gender": "Female",
      "size_category": "Large",
      "status": "available",
      "primary_photo_url": "https://...",
      "detail_url": "https://www.petplace.com/pet-adoption/dogs/A1042472/CCST",
      "source_animal_id": "A1042472",
      "client_id": "CCST",
      "shelter": {
        "name": "Contra Costa County Animal Services - Martinez",
        "city": "Martinez",
        "state": "CA"
      }
    }
  ]
}
```

### GET /dogs/:id

Fetch a single dog by internal `id`.

Example:

```
GET /dogs/abc123
X-API-Key: your-secret
```

Response:

```json
{
  "id": "...",
  "source_animal_id": "A1042472",
  "client_id": "CCST",
  "name": "MINDY",
  "primary_breed": "Doberman Pinscher",
  "age": "Adult",
  "gender": "Female",
  "size_category": "Large",
  "description_html": "...",
  "bio_html": "...",
  "more_info_html": "...",
  "weight_lbs": 68,
  "status": "available",
  "listing_url": "https://www.petplace.com/pet-adoption/dogs/A1042472/CCST",
  "source_api_url": "https://api.petplace.com/animal/A1042472/client/CCST",
  "shelter": {
    "name": "Contra Costa County Animal Services - Martinez",
    "address_line1": "4800 Imhoff Place",
    "city": "Martinez",
    "state": "CA",
    "zip": "94553",
    "phone": "(925) 608-8400",
    "email": "lostandfound@asd.cccounty.us",
    "website_url": "https://www.contracosta.ca.gov/7282/Animal-Services"
  },
  "photos": [
    { "url": "https://...", "is_primary": true, "position": 0 }
  ]
}
```

## Deployment Notes (Vercel)

- `src/index.ts` is the Express entrypoint for Vercel.
- `vercel.json` uses the Vercel v2 format (no custom routes).
- `git push` to `main` deploys to Vercel automatically.
- Local dev reads `.env.dev`; local prod reads `.env.prod` when `DOBIE_ENV=prod` is set.
- Set `API_KEY`, `TARGET_URL`, and a database URL in Vercel environment variables.
  - If using Supabase + Vercel integration, the code will use `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING` automatically.
  - If not using the integration, set `DATABASE_URL` manually.
- Run `npm run migrate` with the same env vars to apply schema changes.
