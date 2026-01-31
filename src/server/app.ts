import express from "express";
import { config } from "../shared/config.js";
import { getPool } from "../shared/db.js";

let db: ReturnType<typeof getPool> | null = null;

const getDb = async () => {
  if (!db) {
    const dbUrl = config.dbUrl;
    if (!dbUrl) {
      throw new Error("DATABASE_URL is required");
    }
    db = getPool(dbUrl);
  }
  return db;
};

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

  app.get("/records", async (req, res) => {
    const { q, category, source, tag, limit, offset } = req.query;

    try {
      const db = await getDb();
      const filters: string[] = [];
      const params: Array<string | number> = [];

      const pushParam = (value: string | number) => {
        params.push(value);
        return `$${params.length}`;
      };

      if (q && typeof q === "string") {
        const token = `%${q}%`;
        const ref = pushParam(token);
        filters.push(`(title ILIKE ${ref} OR summary ILIKE ${ref} OR url ILIKE ${ref} OR tags::text ILIKE ${ref})`);
      }

      if (category && typeof category === "string") {
        filters.push(`category = ${pushParam(category)}`);
      }

      if (source && typeof source === "string") {
        filters.push(`source = ${pushParam(source)}`);
      }

      if (tag && typeof tag === "string") {
        filters.push(`tags @> ${pushParam(JSON.stringify([tag]))}::jsonb`);
      }

      const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
      const limitValue = parseLimit(typeof limit === "string" ? limit : undefined, 50);
      const offsetValue = parseLimit(typeof offset === "string" ? offset : undefined, 0);

      const query = `
      SELECT id, title, url, category, summary, tags, source, fetched_at
      FROM records
      ${where}
      ORDER BY fetched_at DESC
      LIMIT ${pushParam(limitValue)} OFFSET ${pushParam(offsetValue)}
    `;

      const result = await db.query(query, params);

      res.json({
        count: result.rows.length,
        records: result.rows
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database error";
      res.status(500).json({ error: message });
    }
  });

  app.get("/records/:id", async (req, res) => {
    try {
      const db = await getDb();
      const query = `
      SELECT id, title, url, category, summary, tags, source, fetched_at
      FROM records
      WHERE id = $1
      LIMIT 1
    `;
      const result = await db.query(query, [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Not found" });
      }
      return res.json(result.rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database error";
      return res.status(500).json({ error: message });
    }
  });

  return app;
};
