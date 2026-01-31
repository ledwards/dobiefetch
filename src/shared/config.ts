import dotenv from "dotenv";

dotenv.config();

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
  dbUrl: process.env.DATABASE_URL ?? "",
  requireEnv: requiredEnv
};
