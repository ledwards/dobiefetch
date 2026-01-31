# Dobiefetch API (LLM-readable)

## Overview

- Purpose: Provide read-only access to dog adoption listings scraped from the source platform.
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

## Dog Schema (full)

```json
{
  "id": "string",
  "source": "string",
  "source_animal_id": "string",
  "client_id": "string",
  "name": "string",
  "full_name": "string|null",
  "animal_type": "string",
  "primary_breed": "string|null",
  "secondary_breed": "string|null",
  "breed1": "string|null",
  "breed2": "string|null",
  "breed_display": "string|null",
  "age": "string|null",
  "age_display": "string|null",
  "gender": "string|null",
  "size_category": "string|null",
  "description_html": "string|null",
  "bio_html": "string|null",
  "more_info_html": "string|null",
  "placement_info": "string|null",
  "weight_lbs": "number|null",
  "status": "string|null",
  "cover_image_url": "string|null",
  "located_at": "string|null",
  "brought_to_shelter": "string|null",
  "city": "string|null",
  "state": "string|null",
  "lat": "number|null",
  "lon": "number|null",
  "filter_breed_group": "string|null",
  "client_sort": "number|null",
  "listing_url": "string",
  "source_api_url": "string",
  "data_updated_note": "string|null",
  "filters": {
    "filter_age": "string|null",
    "filter_gender": "string|null",
    "filter_size": "string|null",
    "filter_dob": "string|null",
    "filter_days_out": "number|null",
    "filter_primary_breed": "string|null"
  },
  "shelter": {
    "name": "string",
    "address_line1": "string|null",
    "city": "string|null",
    "state": "string|null",
    "zip": "string|null",
    "phone": "string|null",
    "email": "string|null",
    "website_url": "string|null",
    "location_label": "string|null",
    "location_address_html": "string|null"
  },
  "photos": [
    { "url": "string", "is_primary": "boolean", "position": "number" }
  ],
  "raw_payload": "object",
  "ingested_at": "string",
  "source_updated_at": "string|null"
}
```

## Endpoints

### GET /health

- Auth: not required
- Response: `200 OK` with body `OK`

### GET /dogs

List dogs with optional filters and search. Returns full dog records by default. Use `view=summary` to return a lighter payload.

Query parameters:
- `q`: substring search across name, breeds, description, shelter name
- `breed`: substring match against primary breed
- `age`: exact match
- `gender`: exact match
- `size`: exact match
- `status`: exact match
- `client_id`: exact match
- `source_animal_id`: exact match
- `view`: `summary` for a reduced response; omit for full records
- `limit`: number of dogs (default 50, max 200)
- `offset`: offset for pagination

Example:

```
GET /dogs?breed=Doberman&limit=10
X-API-Key: your-secret
```

Summary example:

```
GET /dogs?breed=Doberman&limit=10&view=summary
X-API-Key: your-secret
```

Response:

```json
{
  "count": 1,
  "dogs": [
    {
      "id": "...",
      "source": "source",
      "source_animal_id": "A1042472",
      "client_id": "CCST",
      "name": "MINDY",
      "full_name": "MINDY (A1042472)",
      "animal_type": "Dog",
      "primary_breed": "Doberman Pinscher",
      "secondary_breed": null,
      "breed1": "DOBERMAN PINSCH",
      "breed2": null,
      "breed_display": "Doberman Pinscher",
      "age": "Adult",
      "age_display": "4 years old",
      "gender": "Female",
      "size_category": "Large",
      "description_html": "...",
      "bio_html": "...",
      "more_info_html": "...",
      "placement_info": "...",
      "weight_lbs": 68,
      "status": "available",
      "cover_image_url": "https://...",
      "located_at": "Contra Costa County Animal Services - Martinez",
      "brought_to_shelter": "2025.12.22",
      "city": "Martinez",
      "state": "CA",
      "lat": 37.975074,
      "lon": -122.154813,
      "filter_breed_group": "POINTER",
      "client_sort": 1,
      "listing_url": "https://www.source.example/pet-adoption/dogs/A1042472/CCST",
      "source_api_url": "https://api.source.example/animal/A1042472/client/CCST",
      "data_updated_note": "...",
      "filters": {
        "filter_age": "A",
        "filter_gender": "F",
        "filter_size": "L",
        "filter_dob": "2021-12-22",
        "filter_days_out": 39,
        "filter_primary_breed": "DOBERMAN PINSCH"
      },
      "shelter": {
        "name": "Contra Costa County Animal Services - Martinez",
        "address_line1": "4800 Imhoff Place",
        "city": "Martinez",
        "state": "CA",
        "zip": "94553",
        "phone": "(925) 608-8400",
        "email": "lostandfound@asd.cccounty.us",
        "website_url": "https://www.contracosta.ca.gov/7282/Animal-Services",
        "location_label": "Martinez",
        "location_address_html": "4800 Imhoff Place"
      },
      "photos": [
        { "url": "https://...", "is_primary": true, "position": 0 }
      ],
      "raw_payload": { "detail": {}, "search": {} },
      "ingested_at": "...",
      "source_updated_at": null
    }
  ]
}
```

### GET /dogs/:id

Fetch a single dog by internal `id`. Returns the same full schema as `/dogs`.

Example:

```
GET /dogs/abc123
X-API-Key: your-secret
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
