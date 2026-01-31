-- Core dogs table based on PetPlace API payload
DROP TABLE IF EXISTS records;
CREATE TABLE IF NOT EXISTS shelters (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  website_url TEXT,
  location_label TEXT,
  location_address_html TEXT,
  ingested_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shelters_source_client ON shelters(source, client_id);

CREATE TABLE IF NOT EXISTS dogs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_animal_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT,
  animal_type TEXT NOT NULL,
  primary_breed TEXT,
  secondary_breed TEXT,
  age TEXT,
  gender TEXT,
  size_category TEXT,
  description_html TEXT,
  bio_html TEXT,
  more_info_html TEXT,
  placement_info TEXT,
  weight_lbs NUMERIC,
  status TEXT,
  shelter_id TEXT REFERENCES shelters(id),
  listing_url TEXT NOT NULL,
  source_api_url TEXT NOT NULL,
  data_updated_note TEXT,
  filter_age TEXT,
  filter_gender TEXT,
  filter_size TEXT,
  filter_dob DATE,
  filter_days_out INTEGER,
  filter_primary_breed TEXT,
  ingested_at TIMESTAMPTZ NOT NULL,
  source_updated_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dogs_source_animal_client ON dogs(source, source_animal_id, client_id);
CREATE INDEX IF NOT EXISTS idx_dogs_breed ON dogs(primary_breed);
CREATE INDEX IF NOT EXISTS idx_dogs_gender ON dogs(gender);
CREATE INDEX IF NOT EXISTS idx_dogs_age ON dogs(age);
CREATE INDEX IF NOT EXISTS idx_dogs_size ON dogs(size_category);
CREATE INDEX IF NOT EXISTS idx_dogs_status ON dogs(status);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  dog_id TEXT REFERENCES dogs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_dog ON photos(dog_id);

CREATE TABLE IF NOT EXISTS search_runs (
  id TEXT PRIMARY KEY,
  zip_postal TEXT,
  breed TEXT,
  animal_type TEXT,
  search_url TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS search_results (
  search_run_id TEXT REFERENCES search_runs(id) ON DELETE CASCADE,
  dog_id TEXT REFERENCES dogs(id) ON DELETE CASCADE,
  source_animal_id TEXT,
  client_id TEXT,
  ingested_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (search_run_id, dog_id)
);
