import test from "node:test";
import assert from "node:assert/strict";

const dbUrl =
  process.env.DATABASE_URL_TEST ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

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

    await db.query("DELETE FROM photos");
    await db.query("DELETE FROM dogs");
    await db.query("DELETE FROM shelters");

    const shelterId = "shelter-test";
    const dogId = "dog-test";

    await db.query(
      `INSERT INTO shelters (id, source, client_id, name, address_line1, city, state, zip, phone, email, website_url, location_label, location_address_html, ingested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        shelterId,
        "petplace",
        "CCST",
        "Contra Costa County Animal Services",
        "4800 Imhoff Place",
        "Martinez",
        "CA",
        "94553",
        "(925) 608-8400",
        "test@example.com",
        "https://example.com",
        "Martinez",
        "4800 Imhoff Place",
        new Date().toISOString()
      ]
    );

    await db.query(
      `INSERT INTO dogs (
        id, source, source_animal_id, client_id, name, full_name, animal_type,
        primary_breed, secondary_breed, age, gender, size_category,
        description_html, bio_html, more_info_html, placement_info,
        weight_lbs, status, shelter_id, listing_url, source_api_url,
        data_updated_note, filter_age, filter_gender, filter_size,
        filter_dob, filter_days_out, filter_primary_breed,
        ingested_at, source_updated_at, raw_payload
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27, $28,
        $29, $30, $31
      )`,
      [
        dogId,
        "petplace",
        "A1042472",
        "CCST",
        "Mindy",
        "Mindy (A1042472)",
        "Dog",
        "Doberman Pinscher",
        null,
        "Adult",
        "Female",
        "Large",
        "Description",
        "Bio",
        "Available for adoption",
        "",
        68,
        "available",
        shelterId,
        "https://www.petplace.com/pet-adoption/dogs/A1042472/CCST",
        "https://api.petplace.com/animal/A1042472/client/CCST",
        "Updated",
        "A",
        "F",
        "L",
        "2021-12-22",
        39,
        "DOBERMAN PINSCH",
        new Date().toISOString(),
        null,
        JSON.stringify({ sample: true })
      ]
    );

    await db.query(
      `INSERT INTO photos (id, dog_id, url, is_primary, position, source, ingested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        "photo-test",
        dogId,
        "https://example.com/photo.png",
        true,
        0,
        "petplace",
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

  test("dogs endpoint requires auth and returns data", async () => {
    const { server, baseUrl } = await startServer();

    const unauth = await fetch(`${baseUrl}/dogs`);
    assert.equal(unauth.status, 401);

    const auth = await fetch(`${baseUrl}/dogs`, {
      headers: {
        "x-api-key": "test-key"
      }
    });
    const body = await auth.json();
    server.close();

    assert.equal(auth.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.dogs[0].name, "Mindy");
  });
}
