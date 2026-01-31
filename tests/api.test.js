import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "..", "data", "test.sqlite");

const startServer = async () => {
  process.env.API_KEY = "test-key";
  process.env.DB_PATH = dbPath;

  const { openDb } = await import("../dist/shared/db.js");
  const db = openDb(dbPath);
  db.prepare(`
    INSERT INTO records (id, title, url, category, summary, tags, source, fetched_at)
    VALUES (@id, @title, @url, @category, @summary, @tags, @source, @fetched_at)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      url=excluded.url,
      category=excluded.category,
      summary=excluded.summary,
      tags=excluded.tags,
      source=excluded.source,
      fetched_at=excluded.fetched_at
  `).run({
    id: "test-id",
    title: "Test Title",
    url: "https://example.com/test",
    category: "test",
    summary: "Test summary",
    tags: JSON.stringify(["one", "two"]),
    source: "example.com",
    fetched_at: new Date().toISOString()
  });
  db.close();

  const { createApp } = await import("../dist/server/app.js");
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to start server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
};

test("health endpoint works without auth", async () => {
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
  const { server, baseUrl } = await startServer();
  const res = await fetch(`${baseUrl}/health`);
  const text = await res.text();
  server.close();
  assert.equal(res.status, 200);
  assert.equal(text, "OK");
});

test("records endpoint requires auth and returns data", async () => {
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
  const { server, baseUrl } = await startServer();

  const unauth = await fetch(`${baseUrl}/records`);
  assert.equal(unauth.status, 401);

  const auth = await fetch(`${baseUrl}/records`, {
    headers: {
      "x-api-key": "test-key"
    }
  });
  const body = await auth.json();
  server.close();

  assert.equal(auth.status, 200);
  assert.equal(body.count, 1);
  assert.equal(body.records[0].id, "test-id");
});
