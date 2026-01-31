import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const openDb = (dbPath: string): Database.Database => {
  const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
  const db = new Database(resolvedPath);
  ensureSchema(db);
  return db;
};

const ensureSchema = (db: Database.Database) => {
  const schemaPath = path.resolve(__dirname, "..", "..", "..", "data", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);
};
