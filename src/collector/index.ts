import crypto from "crypto";
import { URL } from "url";
import { config, envInfo } from "../shared/config.js";
import { ensureSchema, getPool } from "../shared/db.js";
import type { DogRecord, PhotoRecord, PetPlacePayload, ShelterRecord } from "../shared/record.js";

type SearchResult = {
  animalId: string;
  clientId: string;
  detailUrl: string;
  coverImagePath?: string | null;
};

type RunOptions = {
  dryRun: boolean;
  limit: number;
  delayMs: number;
  zip: string;
  breed: string;
  radius: string;
  startIndex: number;
  searchUrlOverride?: string;
};

const parseArgs = (argv: string[]): RunOptions => {
  const args = new Map<string, string | boolean>();
  for (const arg of argv) {
    if (arg === "--dry-run") {
      args.set("dry-run", true);
      continue;
    }
    if (arg.startsWith("--limit=")) {
      args.set("limit", arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--delay-ms=")) {
      args.set("delay-ms", arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--zip=")) {
      args.set("zip", arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--breed=")) {
      args.set("breed", arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--radius=")) {
      args.set("radius", arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--start-index=")) {
      args.set("start-index", arg.split("=")[1]);
      continue;
    }
    if (arg.startsWith("--search-url=")) {
      args.set("search-url", arg.split("=")[1]);
      continue;
    }
  }

  const zip = (args.get("zip") as string) || process.env.PETPLACE_ZIP || "94110";
  const breed = (args.get("breed") as string) || process.env.PETPLACE_BREED || "DOBERMAN PINSCH";
  const radius = (args.get("radius") as string) || process.env.PETPLACE_RADIUS || "100";
  const searchUrlOverride = (args.get("search-url") as string) || process.env.PETPLACE_SEARCH_URL;
  const startIndex = Number(args.get("start-index") ?? process.env.PETPLACE_START_INDEX ?? 0);

  return {
    dryRun: Boolean(args.get("dry-run")),
    limit: Number(args.get("limit") ?? 25),
    delayMs: Number(args.get("delay-ms") ?? 250),
    zip,
    breed,
    radius,
    startIndex,
    searchUrlOverride
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hashId = (input: string) => crypto.createHash("sha256").update(input).digest("hex");

const toStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return String(value);
};

const parseWeight = (value: unknown): number | null => {
  if (!value) return null;
  const str = String(value);
  const match = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
};

const parseDate = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const parseWebsiteUrl = (value: unknown): string | null => {
  if (!value) return null;
  const str = String(value);
  const match = str.match(/href="([^"]+)"/i);
  return match ? match[1] : str;
};

const inferStatus = (value: string | null) => {
  if (!value) return null;
  return /available for adoption/i.test(value) ? "available" : null;
};

const buildSearchUrl = (options: RunOptions) => {
  if (options.searchUrlOverride) {
    return new URL(options.searchUrlOverride);
  }
  const base = config.targetUrl || "https://www.petplace.com";
  const url = new URL("/pet-adoption/search", base);
  url.searchParams.set("milesRadius", options.radius);
  url.searchParams.set("filterGender", "");
  url.searchParams.set("filterAge", "");
  url.searchParams.set("filterAnimalType", "Dog");
  url.searchParams.set("filterBreed", options.breed);
  url.searchParams.set("filterShelter", "");
  url.searchParams.set("zipPostal", options.zip);
  url.searchParams.set("filterSize", "");
  return url;
};

const extractSearchResults = (html: string, baseUrl: URL): SearchResult[] => {
  const results = new Map<string, SearchResult>();
  const regex = /\/pet-adoption\/dogs\/([A-Za-z0-9]+)\/([A-Za-z0-9_-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const animalId = match[1];
    const clientId = match[2];
    const detailUrl = new URL(`/pet-adoption/dogs/${animalId}/${clientId}`, baseUrl).toString();
    const key = `${animalId}:${clientId}`;
    if (!results.has(key)) {
      results.set(key, { animalId, clientId, detailUrl });
    }
  }
  return Array.from(results.values());
};

const extractSearchResultsFromApi = (payload: Record<string, unknown>, baseUrl: URL): SearchResult[] => {
  const animals = Array.isArray(payload.animal) ? payload.animal : [];
  const results: SearchResult[] = [];
  for (const item of animals) {
    if (!item || typeof item !== "object") continue;
    const animalId = toStringOrNull((item as Record<string, unknown>).animalId);
    const clientId = toStringOrNull((item as Record<string, unknown>).clientId);
    if (!animalId || !clientId) continue;
    const detailUrl = new URL(`/pet-adoption/dogs/${animalId}/${clientId}`, baseUrl).toString();
    results.push({
      animalId,
      clientId,
      detailUrl,
      coverImagePath: toStringOrNull((item as Record<string, unknown>).coverImagePath)
    });
  }
  return results;
};

const fetchSearchResultsFromApi = async (options: RunOptions) => {
  const response = await fetch("https://api.petplace.com/animal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://www.petplace.com",
      Referer: "https://www.petplace.com/",
      "User-Agent": "dobiefetch/0.1 (+https://example.local)"
    },
    body: JSON.stringify({
      locationInformation: {
        clientId: null,
        zipPostal: options.zip,
        milesRadius: options.radius
      },
      animalFilters: {
        startIndex: options.startIndex,
        filterAnimalType: "Dog",
        filterBreed: [options.breed],
        filterGender: "",
        filterAge: null,
        filterSize: null
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Search API fetch failed (${response.status})`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return extractSearchResultsFromApi(payload, new URL("https://www.petplace.com"));
};

const fetchDetailPayload = async (animalId: string, clientId: string): Promise<PetPlacePayload> => {
  const apiUrl = `https://api.petplace.com/animal/${animalId}/client/${clientId}`;
  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": "dobiefetch/0.1 (+https://example.local)",
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Detail fetch failed (${response.status}) for ${animalId}/${clientId}`);
  }
  return (await response.json()) as PetPlacePayload;
};

const normalizeDog = (payload: PetPlacePayload, source: string, coverImagePath?: string | null) => {
  const pp = payload.ppRequired?.[0] ?? {};
  const detail = payload.animalDetail?.[0] ?? {};

  const sourceAnimalId = toStringOrNull(pp["AnimalId"]) ?? "";
  const clientId = toStringOrNull(pp["ClientId"]) ?? "";
  const fullName = toStringOrNull(pp["Pet Name"]);
  const name = fullName ? fullName.replace(/\s*\([^)]*\)\s*$/, "").trim() : "";

  const listingUrl = `https://www.petplace.com/pet-adoption/dogs/${sourceAnimalId}/${clientId}`;
  const sourceApiUrl = `https://api.petplace.com/animal/${sourceAnimalId}/client/${clientId}`;
  const ingestedAt = new Date().toISOString();

  const shelterId = hashId(`${source}:${clientId}`);
  const dogId = hashId(`${source}:${sourceAnimalId}:${clientId}`);

  const dog: DogRecord = {
    id: dogId,
    source,
    source_animal_id: sourceAnimalId,
    client_id: clientId,
    name,
    full_name: fullName,
    animal_type: toStringOrNull(pp["Animal Type"]) ?? "Dog",
    primary_breed: toStringOrNull(pp["Primary Breed"]),
    secondary_breed: toStringOrNull(pp["Secondary Breed"]),
    age: toStringOrNull(pp["Age"]),
    gender: toStringOrNull(pp["Gender"]),
    size_category: toStringOrNull(pp["Size Category"]),
    description_html: toStringOrNull(pp["Description"]),
    bio_html: toStringOrNull(detail["Bio"]),
    more_info_html: toStringOrNull(detail["More Info"]),
    placement_info: toStringOrNull(detail["Placement Info"]),
    weight_lbs: parseWeight(detail["Weight"]),
    status: inferStatus(toStringOrNull(detail["More Info"])),
    shelter_id: shelterId,
    listing_url: listingUrl,
    source_api_url: sourceApiUrl,
    data_updated_note: toStringOrNull(detail["Data Updated"]),
    filter_age: toStringOrNull(pp["filterAge"]),
    filter_gender: toStringOrNull(pp["filterGender"]),
    filter_size: toStringOrNull(pp["filterSize"]),
    filter_dob: parseDate(pp["filterDOB"]),
    filter_days_out: pp["filterDaysOut"] ? Number(pp["filterDaysOut"]) : null,
    filter_primary_breed: toStringOrNull(pp["filterPrimaryBreed"]),
    ingested_at: ingestedAt,
    source_updated_at: null,
    raw_payload: payload
  };

  const shelter: ShelterRecord = {
    id: shelterId,
    source,
    client_id: clientId,
    name: toStringOrNull(pp["Shelter Name"]) ?? "",
    address_line1: toStringOrNull(pp["Shelter Address"]),
    city: toStringOrNull(pp["City"]),
    state: toStringOrNull(pp["State"]),
    zip: toStringOrNull(pp["Zip"]),
    phone: toStringOrNull(pp["Phone Number"]) || toStringOrNull(pp["Pet Location Phone"]),
    email: toStringOrNull(pp["Email"]),
    website_url: parseWebsiteUrl(pp["Website"]),
    location_label: toStringOrNull(pp["Pet Location"]),
    location_address_html: toStringOrNull(pp["Pet Location Address"]),
    ingested_at: ingestedAt
  };

  const photoUrls = payload.imageURL ?? [];
  const normalizedCover = coverImagePath && !photoUrls.includes(coverImagePath) ? [coverImagePath] : [];
  const photos: PhotoRecord[] = [...normalizedCover, ...photoUrls].map((url, index) => ({
    id: hashId(`${dogId}:${url}`),
    dog_id: dogId,
    url,
    is_primary: index === 0,
    position: index,
    source,
    ingested_at: ingestedAt
  }));

  return { dog, shelter, photos };
};

const upsertShelter = async (db: ReturnType<typeof getPool>, shelter: ShelterRecord) => {
  const query = `
    INSERT INTO shelters (
      id, source, client_id, name, address_line1, city, state, zip,
      phone, email, website_url, location_label, location_address_html, ingested_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14
    )
    ON CONFLICT (source, client_id) DO UPDATE SET
      name = EXCLUDED.name,
      address_line1 = EXCLUDED.address_line1,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip = EXCLUDED.zip,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      website_url = EXCLUDED.website_url,
      location_label = EXCLUDED.location_label,
      location_address_html = EXCLUDED.location_address_html,
      ingested_at = EXCLUDED.ingested_at
    RETURNING id
  `;
  const values = [
    shelter.id,
    shelter.source,
    shelter.client_id,
    shelter.name,
    shelter.address_line1,
    shelter.city,
    shelter.state,
    shelter.zip,
    shelter.phone,
    shelter.email,
    shelter.website_url,
    shelter.location_label,
    shelter.location_address_html,
    shelter.ingested_at
  ];
  const result = await db.query(query, values);
  return result.rows[0]?.id ?? shelter.id;
};

const upsertDog = async (db: ReturnType<typeof getPool>, dog: DogRecord) => {
  const query = `
    INSERT INTO dogs (
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
    )
    ON CONFLICT (source, source_animal_id, client_id) DO UPDATE SET
      name = EXCLUDED.name,
      full_name = EXCLUDED.full_name,
      animal_type = EXCLUDED.animal_type,
      primary_breed = EXCLUDED.primary_breed,
      secondary_breed = EXCLUDED.secondary_breed,
      age = EXCLUDED.age,
      gender = EXCLUDED.gender,
      size_category = EXCLUDED.size_category,
      description_html = EXCLUDED.description_html,
      bio_html = EXCLUDED.bio_html,
      more_info_html = EXCLUDED.more_info_html,
      placement_info = EXCLUDED.placement_info,
      weight_lbs = EXCLUDED.weight_lbs,
      status = EXCLUDED.status,
      shelter_id = EXCLUDED.shelter_id,
      listing_url = EXCLUDED.listing_url,
      source_api_url = EXCLUDED.source_api_url,
      data_updated_note = EXCLUDED.data_updated_note,
      filter_age = EXCLUDED.filter_age,
      filter_gender = EXCLUDED.filter_gender,
      filter_size = EXCLUDED.filter_size,
      filter_dob = EXCLUDED.filter_dob,
      filter_days_out = EXCLUDED.filter_days_out,
      filter_primary_breed = EXCLUDED.filter_primary_breed,
      ingested_at = EXCLUDED.ingested_at,
      source_updated_at = EXCLUDED.source_updated_at,
      raw_payload = EXCLUDED.raw_payload
    RETURNING id
  `;
  const values = [
    dog.id,
    dog.source,
    dog.source_animal_id,
    dog.client_id,
    dog.name,
    dog.full_name,
    dog.animal_type,
    dog.primary_breed,
    dog.secondary_breed,
    dog.age,
    dog.gender,
    dog.size_category,
    dog.description_html,
    dog.bio_html,
    dog.more_info_html,
    dog.placement_info,
    dog.weight_lbs,
    dog.status,
    dog.shelter_id,
    dog.listing_url,
    dog.source_api_url,
    dog.data_updated_note,
    dog.filter_age,
    dog.filter_gender,
    dog.filter_size,
    dog.filter_dob,
    dog.filter_days_out,
    dog.filter_primary_breed,
    dog.ingested_at,
    dog.source_updated_at,
    JSON.stringify(dog.raw_payload)
  ];
  const result = await db.query(query, values);
  return result.rows[0]?.id ?? dog.id;
};

const replacePhotos = async (db: ReturnType<typeof getPool>, dogId: string, photos: PhotoRecord[]) => {
  await db.query("DELETE FROM photos WHERE dog_id = $1", [dogId]);
  for (const photo of photos) {
    await db.query(
      `INSERT INTO photos (id, dog_id, url, is_primary, position, source, ingested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)` ,
      [photo.id, photo.dog_id, photo.url, photo.is_primary, photo.position, photo.source, photo.ingested_at]
    );
  }
};

const run = async () => {
  if (!config.targetUrl && !process.env.PETPLACE_SEARCH_URL) {
    const details = envInfo.envFileExists
      ? `Check ${envInfo.envFile}.`
      : `Expected ${envInfo.envFile} (not found).`;
    throw new Error(`TARGET_URL is required (or set PETPLACE_SEARCH_URL). ${details}`);
  }

  const options = parseArgs(process.argv.slice(2));
  const searchUrl = buildSearchUrl(options);

  const response = await fetch(searchUrl.toString(), {
    headers: {
      "User-Agent": "dobiefetch/0.1 (+https://example.local)"
    }
  });

  if (!response.ok) {
    throw new Error(`Search fetch failed (${response.status})`);
  }

  let results: SearchResult[] = [];
  if (searchUrl.hostname === "api.petplace.com" && searchUrl.pathname.startsWith("/animal")) {
    const payload = (await response.json()) as Record<string, unknown>;
    results = extractSearchResultsFromApi(payload, searchUrl);
  } else {
    const html = await response.text();
    results = extractSearchResults(html, searchUrl);
    if (results.length === 0) {
      results = await fetchSearchResultsFromApi(options);
    }
  }
  const sliced = results.slice(0, options.limit);

  console.log(`Loaded search URL=${searchUrl.toString()}`);
  console.log(`Found ${results.length} listings`);

  if (results.length === 0) {
    throw new Error(
      "No listings found. The PetPlace API returned no animals for the search filters. " +
        "Verify PETPLACE_ZIP, PETPLACE_RADIUS, and PETPLACE_BREED."
    );
  }

  if (options.dryRun) {
    console.log(`Dry-run: would fetch ${sliced.length} detail payloads`);
    return;
  }

  await ensureSchema(config.dbUrl);
  const db = getPool(config.dbUrl);

  const runId = hashId(`${searchUrl.toString()}:${new Date().toISOString()}`);
  await db.query(
    `INSERT INTO search_runs (id, zip_postal, breed, animal_type, search_url, started_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [runId, options.zip, options.breed, "Dog", searchUrl.toString(), new Date().toISOString()]
  );

  let upserted = 0;

  for (const result of sliced) {
    try {
      const payload = await fetchDetailPayload(result.animalId, result.clientId);
      const normalized = normalizeDog(payload, "petplace", result.coverImagePath ?? null);

      await db.query("BEGIN");
      const shelterId = await upsertShelter(db, normalized.shelter);
      normalized.dog.shelter_id = shelterId;
      const dogId = await upsertDog(db, normalized.dog);
      await replacePhotos(db, dogId, normalized.photos);
      await db.query(
        `INSERT INTO search_results (search_run_id, dog_id, source_animal_id, client_id, ingested_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (search_run_id, dog_id) DO NOTHING`,
        [runId, dogId, normalized.dog.source_animal_id, normalized.dog.client_id, new Date().toISOString()]
      );
      await db.query("COMMIT");
      upserted += 1;
    } catch (error) {
      await db.query("ROLLBACK");
      console.error(
        `Failed to process ${result.animalId}/${result.clientId}:`,
        error instanceof Error ? error.message : error
      );
    }
    await sleep(options.delayMs);
  }

  await db.query("UPDATE search_runs SET completed_at = $1 WHERE id = $2", [new Date().toISOString(), runId]);

  console.log(`Upserted ${upserted} dogs into DATABASE_URL`);
};

run().catch((err) => {
  console.error("Scraper failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
