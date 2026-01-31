import crypto from "crypto";
import { URL } from "url";
import { config, envInfo } from "../shared/config.js";
import { ensureSchema, getPool } from "../shared/db.js";
import type { NormalizedRecord } from "../shared/record.js";

const parseArgs = (argv: string[]) => {
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
  }
  return {
    dryRun: Boolean(args.get("dry-run")),
    limit: Number(args.get("limit") ?? 25),
    delayMs: Number(args.get("delay-ms") ?? 250)
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hashId = (input: string) => {
  return crypto.createHash("sha256").update(input).digest("hex");
};

const extractTitle = (html: string): string | null => {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
};

const extractMeta = (html: string, name: string): string | null => {
  const pattern = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
};

const extractLinks = (html: string, base: URL): string[] => {
  const links: string[] = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      const href = match[1];
      if (href.startsWith("#") || href.startsWith("mailto:")) continue;
      const resolved = new URL(href, base);
      if (resolved.origin !== base.origin) continue;
      links.push(resolved.href);
    } catch {
      continue;
    }
  }
  return links;
};

const categoryFromUrl = (url: URL): string | null => {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.length > 0 ? parts[0] : null;
};

const run = async () => {
  if (!config.targetUrl) {
    const details = envInfo.envFileExists
      ? `Check ${envInfo.envFile}.`
      : `Expected ${envInfo.envFile} (not found).`;
    throw new Error(`TARGET_URL is required. ${details}`);
  }

  const { dryRun, limit, delayMs } = parseArgs(process.argv.slice(2));
  const base = new URL(config.targetUrl);

  const toVisit: string[] = [base.href];
  const visited = new Set<string>();
  const records: NormalizedRecord[] = [];

  while (toVisit.length > 0 && records.length < limit) {
    const current = toVisit.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const response = await fetch(current, {
      headers: {
        "User-Agent": "dobiefetch/0.1 (+https://example.local)"
      }
    });

    if (!response.ok) {
      await sleep(delayMs);
      continue;
    }

    const html = await response.text();
    const title = extractTitle(html);
    if (!title) {
      await sleep(delayMs);
      continue;
    }

    const summary = extractMeta(html, "description");
    const keywords = extractMeta(html, "keywords");
    const tags = keywords ? keywords.split(",").map((tag) => tag.trim()).filter(Boolean) : [];

    const urlObj = new URL(current);
    const record: NormalizedRecord = {
      id: hashId(current),
      title,
      url: current,
      category: categoryFromUrl(urlObj),
      summary,
      tags,
      source: base.hostname,
      fetched_at: new Date().toISOString()
    };

    records.push(record);

    const links = extractLinks(html, base);
    for (const link of links) {
      if (records.length + toVisit.length >= limit * 3) break;
      if (!visited.has(link)) {
        toVisit.push(link);
      }
    }

    await sleep(delayMs);
  }

  console.log(`Loaded TARGET_URL=${base.href}`);
  console.log(`Fetched ${visited.size} pages`);
  console.log(`Parsed ${records.length} records`);

  if (dryRun) {
    console.log(`Dry-run: would upsert ${records.length} records into DATABASE_URL`);
    return;
  }

  await ensureSchema(config.dbUrl);
  const db = getPool(config.dbUrl);

  const query = `
    INSERT INTO records (id, title, url, category, summary, tags, source, fetched_at)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      title=excluded.title,
      url=excluded.url,
      category=excluded.category,
      summary=excluded.summary,
      tags=excluded.tags,
      source=excluded.source,
      fetched_at=excluded.fetched_at
  `;

  for (const record of records) {
    await db.query(query, [
      record.id,
      record.title,
      record.url,
      record.category,
      record.summary,
      JSON.stringify(record.tags),
      record.source,
      record.fetched_at
    ]);
  }

  console.log(`Upserted ${records.length} records into DATABASE_URL`);
};

run().catch((err) => {
  console.error("Scraper failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
