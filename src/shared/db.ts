import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool: pg.Pool | null = null;

const isSupabaseUrl = (dbUrl: string) => {
  try {
    const url = new URL(dbUrl);
    return url.hostname.includes("supabase") || url.hostname.includes("pooler");
  } catch {
    return dbUrl.includes("supabase") || dbUrl.includes("pooler");
  }
};

const getSslConfig = (dbUrl: string): pg.PoolConfig["ssl"] | undefined => {
  const sslModeEnv = process.env.DATABASE_SSLMODE ?? process.env.PGSSLMODE ?? "";
  const strictSsl = process.env.DATABASE_SSLMODE_STRICT === "true";
  let sslMode = sslModeEnv;

  try {
    const url = new URL(dbUrl);
    sslMode = sslMode || url.searchParams.get("sslmode") || "";
  } catch {
    // Ignore malformed URLs; fall back to env.
  }

  if (!sslMode && isSupabaseUrl(dbUrl)) {
    sslMode = "require";
  }

  if (isSupabaseUrl(dbUrl) && !strictSsl) {
    if (!sslMode) {
      sslMode = "require";
    } else if (sslMode === "verify-full" || sslMode === "verify-ca" || sslMode === "prefer") {
      sslMode = "require";
    }
  }
  if (!sslMode) return undefined;
  if (sslMode === "disable") return false;
  if (sslMode === "verify-full") return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
};

export const getPool = (dbUrl: string): pg.Pool => {
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: getSslConfig(dbUrl)
    });
  }
  return pool;
};

export const ensureSchema = async (dbUrl: string) => {
  const schemaPath = path.resolve(__dirname, "..", "..", "..", "data", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const db = getPool(dbUrl);
  await db.query(schema);
};
