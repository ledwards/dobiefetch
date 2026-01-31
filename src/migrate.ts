import { config } from "./shared/config.js";
import { ensureSchema } from "./shared/db.js";

const run = async () => {
  if (!config.dbUrl) {
    throw new Error("DATABASE_URL is required");
  }
  await ensureSchema(config.dbUrl);
  console.log("Schema applied.");
};

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
