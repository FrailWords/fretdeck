import { neon } from "@neondatabase/serverless";
import { SEED_SONGS } from "./seed.js";
import { randomUUID } from "crypto";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const hasDb = Boolean(url);
const sql = hasDb ? neon(url) : null;

const tok = () => randomUUID().replace(/-/g, "").slice(0, 12);

/* ---------------- postgres init / migration ---------------- */
let initPromise = null;
function init() {
  if (!hasDb) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS collections (
        id text PRIMARY KEY, name text NOT NULL,
        edit_token text UNIQUE NOT NULL, view_token text UNIQUE NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS songs (
        id text PRIMARY KEY, collection_id text, data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now())`;
      await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS collection_id text`;
      // ensure a default collection
      let def = (await sql`SELECT id FROM collections ORDER BY created_at ASC LIMIT 1`)[0];
      if (!def) {
        const id = "c_" + tok();
        await sql`INSERT INTO collections (id, name, edit_token, view_token)
                  VALUES (${id}, ${"Band library"}, ${tok()}, ${tok()})`;
        def = { id };
      }
      // adopt any orphaned songs (from the pre-collections schema)
      await sql`UPDATE songs SET collection_id = ${def.id} WHERE collection_id IS NULL`;
      // seed if empty
      const n = (await sql`SELECT count(*)::int AS n FROM songs`)[0].n;
      if (n === 0) {
        for (const s of SEED_SONGS) {
          await sql`INSERT INTO songs (id, collection_id, data)
                    VALUES (${s.id}, ${def.id}, ${JSON.stringify(s)}::jsonb)`;
        }
      }
    })().catch((e) => { initPromise = null; throw e; });
  }
  return initPromise;
}

/* ---------------- in-memory fallback (no DATABASE_URL) ---------------- */
const memCols = new Map();
const memSongs = new Map(); // songId -> { song, collectionId }
(function seedMem() {
  const id = "c_demo";
  memCols.set(id, { id, name: "Band library", edit_token: "edit-demo", view_token: "view-demo" });
  SEED_SONGS.forEach((s) => memSongs.set(s.id, { song: s, collectionId: id }));
})();

/* ---------------- public api ---------------- */
export async function listCollections() {
  if (!hasDb) {
    return [...memCols.values()].map((c) => ({
      id: c.id, name: c.name, editToken: c.edit_token, viewToken: c.view_token,
      songCount: [...memSongs.values()].filter((x) => x.collectionId === c.id).length,
    }));
  }
  await init();
  const rows = await sql`
    SELECT c.id, c.name, c.edit_token, c.view_token,
      (SELECT count(*)::int FROM songs s WHERE s.collection_id = c.id) AS song_count
    FROM collections c ORDER BY c.created_at ASC`;
  return rows.map((r) => ({ id: r.id, name: r.name, editToken: r.edit_token, viewToken: r.view_token, songCount: r.song_count }));
}

export async function createCollection(name) {
  const c = { id: "c_" + tok(), name: name || "Untitled collection", editToken: tok(), viewToken: tok() };
  if (!hasDb) {
    memCols.set(c.id, { id: c.id, name: c.name, edit_token: c.editToken, view_token: c.viewToken });
    return c;
  }
  await init();
  await sql`INSERT INTO collections (id, name, edit_token, view_token)
            VALUES (${c.id}, ${c.name}, ${c.editToken}, ${c.viewToken})`;
  return c;
}

export async function resolveToken(t) {
  if (!hasDb) {
    const c = [...memCols.values()].find((x) => x.edit_token === t || x.view_token === t);
    if (!c) return null;
    const access = c.edit_token === t ? "edit" : "view";
    const songs = [...memSongs.values()].filter((x) => x.collectionId === c.id).map((x) => x.song);
    return { collection: { id: c.id, name: c.name }, access, viewToken: c.view_token, editToken: access === "edit" ? c.edit_token : undefined, songs };
  }
  await init();
  const rows = await sql`SELECT * FROM collections WHERE edit_token = ${t} OR view_token = ${t} LIMIT 1`;
  if (!rows.length) return null;
  const c = rows[0];
  const access = c.edit_token === t ? "edit" : "view";
  const songs = await sql`SELECT data FROM songs WHERE collection_id = ${c.id} ORDER BY updated_at ASC`;
  return {
    collection: { id: c.id, name: c.name }, access, viewToken: c.view_token,
    editToken: access === "edit" ? c.edit_token : undefined, songs: songs.map((r) => r.data),
  };
}

async function colByEditToken(t) {
  if (!hasDb) {
    const c = [...memCols.values()].find((x) => x.edit_token === t);
    return c || null;
  }
  await init();
  const rows = await sql`SELECT * FROM collections WHERE edit_token = ${t} LIMIT 1`;
  return rows.length ? rows[0] : null;
}

export async function renameCollection(editToken, name) {
  const col = await colByEditToken(editToken);
  if (!col) return { error: "unauthorized" };
  if (!hasDb) { col.name = name; return { ok: true }; }
  await init();
  await sql`UPDATE collections SET name = ${name} WHERE id = ${col.id}`;
  return { ok: true };
}

export async function saveSong(song, editToken) {
  const col = await colByEditToken(editToken);
  if (!col) return { error: "unauthorized" };
  if (!hasDb) { memSongs.set(song.id, { song, collectionId: col.id }); return { song }; }
  await init();
  await sql`INSERT INTO songs (id, collection_id, data, updated_at)
            VALUES (${song.id}, ${col.id}, ${JSON.stringify(song)}::jsonb, now())
            ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
            WHERE songs.collection_id = ${col.id}`;
  return { song };
}

export async function deleteSong(id, editToken) {
  const col = await colByEditToken(editToken);
  if (!col) return { error: "unauthorized" };
  if (!hasDb) { memSongs.delete(id); return { ok: true }; }
  await init();
  await sql`DELETE FROM songs WHERE id = ${id} AND collection_id = ${col.id}`;
  return { ok: true };
}

export async function deleteCollection(editToken) {
  const col = await colByEditToken(editToken);
  if (!col) return { error: "unauthorized" };
  if (!hasDb) {
    [...memSongs.entries()].forEach(([k, v]) => { if (v.collectionId === col.id) memSongs.delete(k); });
    memCols.delete(col.id);
    return { ok: true };
  }
  await init();
  await sql`DELETE FROM songs WHERE collection_id = ${col.id}`;
  await sql`DELETE FROM collections WHERE id = ${col.id}`;
  return { ok: true };
}
