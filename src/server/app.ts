import express from "express";
import { config } from "../shared/config.js";
import { openDb } from "../shared/db.js";

const db = openDb(config.dbPath);

const getApiKey = (req: express.Request): string | null => {
  const headerKey = req.header("x-api-key");
  if (headerKey) return headerKey;
  const auth = req.header("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const authMiddleware: express.RequestHandler = (req, res, next) => {
  if (req.path === "/health") {
    return next();
  }
  const expected = config.apiKey || process.env.API_KEY;
  if (!expected) {
    return res.status(500).json({ error: "API_KEY not configured" });
  }
  const provided = getApiKey(req);
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
};

const parseLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
};

export const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);

  app.get("/health", (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/records", (req, res) => {
    const { q, category, source, tag, limit, offset } = req.query;

    const filters: string[] = [];
    const params: Record<string, string | number> = {};

    if (q && typeof q === "string") {
      filters.push("(title LIKE @q OR summary LIKE @q OR url LIKE @q OR tags LIKE @q)");
      params.q = `%${q}%`;
    }

    if (category && typeof category === "string") {
      filters.push("category = @category");
      params.category = category;
    }

    if (source && typeof source === "string") {
      filters.push("source = @source");
      params.source = source;
    }

    if (tag && typeof tag === "string") {
      filters.push("tags LIKE @tag");
      params.tag = `%"${tag}"%`;
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const limitValue = parseLimit(typeof limit === "string" ? limit : undefined, 50);
    const offsetValue = parseLimit(typeof offset === "string" ? offset : undefined, 0);

    const stmt = db.prepare(`
      SELECT id, title, url, category, summary, tags, source, fetched_at
      FROM records
      ${where}
      ORDER BY fetched_at DESC
      LIMIT @limit OFFSET @offset
    `);

    const rows = stmt.all({ ...params, limit: limitValue, offset: offsetValue });

    const records = rows.map((row: any) => ({
      ...row,
      tags: JSON.parse(row.tags)
    }));

    res.json({
      count: records.length,
      records
    });
  });

  app.get("/records/:id", (req, res) => {
    const stmt = db.prepare(`
      SELECT id, title, url, category, summary, tags, source, fetched_at
      FROM records
      WHERE id = @id
      LIMIT 1
    `);
    const row = stmt.get({ id: req.params.id });
    if (!row) {
      return res.status(404).json({ error: "Not found" });
    }
    const record = {
      ...row,
      tags: JSON.parse(row.tags)
    };
    return res.json(record);
  });

  return app;
};
