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

  app.get("/dogs", async (req, res) => {
    const { q, breed, age, gender, size, status, client_id, source_animal_id, limit, offset, view } = req.query;

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
        filters.push(
          `(
            d.name ILIKE ${ref}
            OR d.primary_breed ILIKE ${ref}
            OR d.secondary_breed ILIKE ${ref}
            OR d.description_html ILIKE ${ref}
            OR s.name ILIKE ${ref}
          )`
        );
      }

      if (breed && typeof breed === "string") {
        const token = `%${breed}%`;
        filters.push(`d.primary_breed ILIKE ${pushParam(token)}`);
      }

      if (age && typeof age === "string") {
        filters.push(`d.age = ${pushParam(age)}`);
      }

      if (gender && typeof gender === "string") {
        filters.push(`d.gender = ${pushParam(gender)}`);
      }

      if (size && typeof size === "string") {
        filters.push(`d.size_category = ${pushParam(size)}`);
      }

      if (status && typeof status === "string") {
        filters.push(`d.status = ${pushParam(status)}`);
      }

      if (client_id && typeof client_id === "string") {
        filters.push(`d.client_id = ${pushParam(client_id)}`);
      }

      if (source_animal_id && typeof source_animal_id === "string") {
        filters.push(`d.source_animal_id = ${pushParam(source_animal_id)}`);
      }

      const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
      const limitValue = parseLimit(typeof limit === "string" ? limit : undefined, 50);
      const offsetValue = parseLimit(typeof offset === "string" ? offset : undefined, 0);

      const query = `
        SELECT
          d.*,
          s.name AS shelter_name,
          s.address_line1 AS shelter_address_line1,
          s.city AS shelter_city,
          s.state AS shelter_state,
          s.zip AS shelter_zip,
          s.phone AS shelter_phone,
          s.email AS shelter_email,
          s.website_url AS shelter_website_url,
          s.location_label AS shelter_location_label,
          s.location_address_html AS shelter_location_address_html,
          COALESCE(
            json_agg(
              json_build_object(
                'url', p.url,
                'is_primary', p.is_primary,
                'position', p.position
              )
            ) FILTER (WHERE p.url IS NOT NULL),
            '[]'::json
          ) AS photos
        FROM dogs d
        LEFT JOIN shelters s ON d.shelter_id = s.id
        LEFT JOIN photos p ON p.dog_id = d.id
        ${where}
        GROUP BY d.id, s.id
        ORDER BY d.ingested_at DESC
        LIMIT ${pushParam(limitValue)} OFFSET ${pushParam(offsetValue)}
      `;

      const result = await db.query(query, params);

      const dogs = result.rows.map((row) => ({
        id: row.id,
        source: row.source,
        source_animal_id: row.source_animal_id,
        client_id: row.client_id,
        name: row.name,
        full_name: row.full_name,
        animal_type: row.animal_type,
        primary_breed: row.primary_breed,
        secondary_breed: row.secondary_breed,
        breed1: row.breed1,
        breed2: row.breed2,
        breed_display: row.breed_display,
        age: row.age,
        age_display: row.age_display,
        gender: row.gender,
        size_category: row.size_category,
        description_html: row.description_html,
        bio_html: row.bio_html,
        more_info_html: row.more_info_html,
        placement_info: row.placement_info,
        weight_lbs: row.weight_lbs,
        status: row.status,
        cover_image_url: row.cover_image_url,
        located_at: row.located_at,
        brought_to_shelter: row.brought_to_shelter,
        city: row.city,
        state: row.state,
        lat: row.lat,
        lon: row.lon,
        filter_breed_group: row.filter_breed_group,
        client_sort: row.client_sort,
        listing_url: row.listing_url,
        source_api_url: row.source_api_url,
        data_updated_note: row.data_updated_note,
        filters: {
          filter_age: row.filter_age,
          filter_gender: row.filter_gender,
          filter_size: row.filter_size,
          filter_dob: row.filter_dob,
          filter_days_out: row.filter_days_out,
          filter_primary_breed: row.filter_primary_breed
        },
        shelter: row.shelter_name
          ? {
              name: row.shelter_name,
              address_line1: row.shelter_address_line1,
              city: row.shelter_city,
              state: row.shelter_state,
              zip: row.shelter_zip,
              phone: row.shelter_phone,
              email: row.shelter_email,
              website_url: row.shelter_website_url,
              location_label: row.shelter_location_label,
              location_address_html: row.shelter_location_address_html
            }
          : null,
        photos: row.photos ?? [],
        raw_payload: row.raw_payload,
        ingested_at: row.ingested_at,
        source_updated_at: row.source_updated_at
      }));

      if (view === "summary") {
        return res.json({
          count: dogs.length,
          dogs: dogs.map((dog) => ({
            id: dog.id,
            name: dog.name,
            breed_primary: dog.primary_breed,
            age: dog.age,
            gender: dog.gender,
            size_category: dog.size_category,
            status: dog.status,
            cover_image_url: dog.cover_image_url,
            listing_url: dog.listing_url,
            source_animal_id: dog.source_animal_id,
            client_id: dog.client_id,
            shelter: dog.shelter
              ? {
                  name: dog.shelter.name,
                  city: dog.shelter.city,
                  state: dog.shelter.state
                }
              : null
          }))
        });
      }

      res.json({
        count: dogs.length,
        dogs
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database error";
      res.status(500).json({ error: message });
    }
  });

  app.get("/dogs/:id", async (req, res) => {
    try {
      const db = await getDb();
      const dogQuery = `
        SELECT d.*, s.name AS shelter_name, s.address_line1, s.city, s.state, s.zip,
               s.phone, s.email, s.website_url, s.location_label, s.location_address_html
        FROM dogs d
        LEFT JOIN shelters s ON d.shelter_id = s.id
        WHERE d.id = $1
        LIMIT 1
      `;

      const dogResult = await db.query(dogQuery, [req.params.id]);
      if (dogResult.rows.length === 0) {
        return res.status(404).json({ error: "Not found" });
      }

      const dog = dogResult.rows[0];
      const photosResult = await db.query(
        `SELECT url, is_primary, position FROM photos WHERE dog_id = $1 ORDER BY position ASC`,
        [dog.id]
      );

      return res.json({
        id: dog.id,
        source: dog.source,
        source_animal_id: dog.source_animal_id,
        client_id: dog.client_id,
        name: dog.name,
        full_name: dog.full_name,
        animal_type: dog.animal_type,
        primary_breed: dog.primary_breed,
        secondary_breed: dog.secondary_breed,
        breed1: dog.breed1,
        breed2: dog.breed2,
        breed_display: dog.breed_display,
        age: dog.age,
        age_display: dog.age_display,
        gender: dog.gender,
        size_category: dog.size_category,
        description_html: dog.description_html,
        bio_html: dog.bio_html,
        more_info_html: dog.more_info_html,
        placement_info: dog.placement_info,
        weight_lbs: dog.weight_lbs,
        status: dog.status,
        cover_image_url: dog.cover_image_url,
        located_at: dog.located_at,
        brought_to_shelter: dog.brought_to_shelter,
        city: dog.city,
        state: dog.state,
        lat: dog.lat,
        lon: dog.lon,
        filter_breed_group: dog.filter_breed_group,
        client_sort: dog.client_sort,
        listing_url: dog.listing_url,
        source_api_url: dog.source_api_url,
        data_updated_note: dog.data_updated_note,
        filters: {
          filter_age: dog.filter_age,
          filter_gender: dog.filter_gender,
          filter_size: dog.filter_size,
          filter_dob: dog.filter_dob,
          filter_days_out: dog.filter_days_out,
          filter_primary_breed: dog.filter_primary_breed
        },
        shelter: dog.shelter_name
          ? {
              name: dog.shelter_name,
              address_line1: dog.address_line1,
              city: dog.city,
              state: dog.state,
              zip: dog.zip,
              phone: dog.phone,
              email: dog.email,
              website_url: dog.website_url,
              location_label: dog.location_label,
              location_address_html: dog.location_address_html
            }
          : null,
        photos: photosResult.rows,
        raw_payload: dog.raw_payload,
        ingested_at: dog.ingested_at,
        source_updated_at: dog.source_updated_at
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database error";
      return res.status(500).json({ error: message });
    }
  });

  return app;
};
