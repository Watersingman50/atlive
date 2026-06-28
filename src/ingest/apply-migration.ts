import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

// One-shot migration applier. Reads the clean on-disk migration and runs it
// over a direct Postgres connection (DATABASE_URL) — no clipboard, no DDL via
// the REST API (which can't). Drops any prior objects first so a corrupted
// manual paste gets cleaned up. Safe pre-launch: there is no real data yet.

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing — set it in .env.local (Supabase connection string).");
  process.exit(1);
}

const migrationPath = fileURLToPath(
  new URL("../../supabase/migrations/0001_init.sql", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8");

const RESET = `
drop trigger if exists events_touch_updated_at on public.events;
drop table if exists public.event_sources cascade;
drop table if exists public.events cascade;
drop function if exists public.touch_updated_at() cascade;
`;

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("connected. resetting any prior objects...");
  await client.query(RESET);
  console.log("applying migration 0001_init.sql...");
  await client.query(migration);

  // verify
  const { rows } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name in ('events','event_sources')
     order by table_name`,
  );
  console.log("tables now present:", rows.map((r) => r.table_name).join(", ") || "(none)");

  const cols = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='events' order by ordinal_position`,
  );
  console.log("events columns:", cols.rows.map((r) => r.column_name).join(", "));
  await client.end();
  console.log("migration applied ✓");
}

main().catch(async (err) => {
  console.error("FAILED:", err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
