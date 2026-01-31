import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool: pg.Pool | null = null;

export const getPool = (dbUrl: string): pg.Pool => {
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!pool) {
    pool = new Pool({ connectionString: dbUrl });
  }
  return pool;
};

export const ensureSchema = async (dbUrl: string) => {
  const schemaPath = path.resolve(__dirname, "..", "..", "..", "data", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const db = getPool(dbUrl);
  await db.query(schema);
};
