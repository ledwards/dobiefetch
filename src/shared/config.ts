import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const isProdEnv = process.env.DOBIE_ENV === "prod" || process.env.NODE_ENV === "production";
const envFile = isProdEnv ? ".env.prod" : ".env.dev";
const envPath = path.resolve(process.cwd(), envFile);
const envFileExists = fs.existsSync(envPath);

if (envFileExists) {
  dotenv.config({ path: envPath });
}

export const envInfo = {
  envFile,
  envPath,
  envFileExists
};

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const config = {
  targetUrl: process.env.TARGET_URL ?? "",
  apiKey: process.env.API_KEY ?? "",
  port: Number(process.env.PORT ?? 3000),
  dbUrl:
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    "",
  requireEnv: requiredEnv
};
