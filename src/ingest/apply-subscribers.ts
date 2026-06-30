import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

// ADDITIVE applier for 0002_subscribers.sql — unlike apply-migration.ts this
// NEVER drops anything, so it is safe to run against the live DB (events data
// is untouched). The migration is fully idempotent (create ... if not exists).

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing — set it in .env.local.");
  process.exit(1);
}

const migration = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/0002_subscribers.sql", import.meta.url)),
  "utf8",
);

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log("applying 0002_subscribers.sql (additive, no drops)...");
  await client.query(migration);
  const { rows } = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='subscribers' order by ordinal_position`,
  );
  console.log("subscribers columns:", rows.map((r) => r.column_name).join(", ") || "(table missing!)");
  await client.end();
  console.log("done ✓");
}

main().catch(async (err) => {
  console.error("FAILED:", err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
