import { neon } from "@neondatabase/serverless";
import { SEED_SONGS } from "./seed.js";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const hasDb = Boolean(url);

const sql = hasDb ? neon(url) : null;

// One-time table creation + seeding (per warm serverless instance).
let initPromise = null;
function init() {
  if (!hasDb) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS songs (
          id text PRIMARY KEY,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;
      const rows = await sql`SELECT count(*)::int AS n FROM songs`;
      if (rows[0].n === 0) {
        for (const s of SEED_SONGS) {
          await sql`INSERT INTO songs (id, data) VALUES (${s.id}, ${JSON.stringify(s)}::jsonb)`;
        }
      }
    })().catch((e) => {
      initPromise = null; // allow retry on a later request
      throw e;
    });
  }
  return initPromise;
}

// In-memory fallback store (ephemeral; resets between serverless invocations).
const mem = new Map(SEED_SONGS.map((s) => [s.id, structuredClone(s)]));

export async function listSongs() {
  if (!hasDb) return [...mem.values()];
  await init();
  const rows = await sql`SELECT data FROM songs ORDER BY updated_at ASC`;
  return rows.map((r) => r.data);
}

export async function getSong(id) {
  if (!hasDb) return mem.get(id) || null;
  await init();
  const rows = await sql`SELECT data FROM songs WHERE id = ${id}`;
  return rows[0] ? rows[0].data : null;
}

export async function saveSong(song) {
  if (!hasDb) {
    mem.set(song.id, song);
    return song;
  }
  await init();
  await sql`
    INSERT INTO songs (id, data, updated_at)
    VALUES (${song.id}, ${JSON.stringify(song)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  return song;
}

export async function deleteSong(id) {
  if (!hasDb) {
    mem.delete(id);
    return;
  }
  await init();
  await sql`DELETE FROM songs WHERE id = ${id}`;
}
