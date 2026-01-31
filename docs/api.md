# Dobiefetch API (LLM-readable)

## Overview

- Purpose: Provide read-only access to normalized records scraped from the target source.
- Base URL: `https://<your-vercel-domain>` (local: `http://localhost:3000`)
- Auth: Shared secret via `X-API-Key` header or `Authorization: Bearer <API_KEY>`.
- Content type: JSON.

## Authentication

All endpoints except `GET /health` require authentication.

Example:

```
GET /records
X-API-Key: your-secret
```

## Record Schema

```json
{
  "id": "string",
  "title": "string",
  "url": "string",
  "category": "string|null",
  "summary": "string|null",
  "tags": ["string"],
  "source": "string",
  "fetched_at": "ISO-8601 timestamp"
}
```

## Endpoints

### GET /health

- Auth: not required
- Response: `200 OK` with body `OK`

### GET /records

List records with optional filters and search.

Query parameters:
- `q`: substring search across title, summary, url, and tags
- `category`: exact match
- `source`: exact match
- `tag`: exact match against tags array
- `limit`: number of records (default 50, max 200)
- `offset`: offset for pagination

Example:

```
GET /records?q=cat&category=care&limit=10
X-API-Key: your-secret
```

Response:

```json
{
  "count": 2,
  "records": [
    {
      "id": "...",
      "title": "...",
      "url": "...",
      "category": "...",
      "summary": "...",
      "tags": ["..."],
      "source": "...",
      "fetched_at": "..."
    }
  ]
}
```

### GET /records/:id

Fetch a single record by id.

Example:

```
GET /records/abc123
X-API-Key: your-secret
```

Responses:
- `200 OK` with a record JSON object
- `404 Not Found` if id does not exist

## Error Responses

- `401 Unauthorized`: missing or incorrect API key
- `500 Internal Server Error`: missing configuration (e.g., API_KEY not set)

## Deployment Notes (Vercel)

- `api/index.ts` exports the Express app for Vercel serverless runtime.
- `vercel.json` routes all requests to the API handler.
- Set `API_KEY`, `TARGET_URL`, and a database URL in Vercel environment variables.
  - If using Supabase + Vercel integration, the code will use `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING` automatically.
  - If not using the integration, set `DATABASE_URL` manually.
