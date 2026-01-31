import test from "node:test";
import assert from "node:assert/strict";

const dbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

if (!dbUrl) {
  test("database configured", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  const startServer = async () => {
    process.env.API_KEY = "test-key";
    process.env.DATABASE_URL = dbUrl;

    const { ensureSchema, getPool } = await import("../dist/shared/db.js");
    await ensureSchema(dbUrl);
    const db = getPool(dbUrl);

    await db.query("DELETE FROM records");
    await db.query(
      `INSERT INTO records (id, title, url, category, summary, tags, source, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        "test-id",
        "Test Title",
        "https://example.com/test",
        "test",
        "Test summary",
        JSON.stringify(["one", "two"]),
        "example.com",
        new Date().toISOString()
      ]
    );

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
    const { server, baseUrl } = await startServer();
    const res = await fetch(`${baseUrl}/health`);
    const text = await res.text();
    server.close();
    assert.equal(res.status, 200);
    assert.equal(text, "OK");
  });

  test("records endpoint requires auth and returns data", async () => {
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
}
