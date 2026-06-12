# FretDeck

A shared **song roadmap** for guitarists. Each song has an embedded YouTube video, a
time-ordered set of **parts** (Intro / Verse / Chorus / Bridge / Lead / Outro…), and for
every part: a **time range** that seeks the video, the **tone/FX** (drive, delay, reverb,
plus free fields for chorus/wah and notes like tuning/capo), and the **riff tab**. Built so a
second guitarist can open one URL and pick up the set fast.

Stack: **Next.js (App Router)** + **Neon Postgres** + **jsPDF**, deployed on **Vercel**.

---

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

With no database configured it runs on an in-memory store seeded with three songs — fully
usable, but edits reset when the server restarts. A banner in the app reminds you of this.

---

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project → Import** the repo. No build settings to change — Next.js
   is auto-detected. Deploy.

(Or use the CLI: `npm i -g vercel`, then `vercel` and `vercel --prod`.)

The app deploys and works immediately on the seeded in-memory data. Add the database next so
edits actually save and both guitarists see the same library.

---

## Add the database (Neon Postgres)

1. Open your project on Vercel → **Storage** tab → **Create Database** → choose **Neon**
   (Postgres) and follow the prompts. This provisions a free Neon database and automatically
   adds a `DATABASE_URL` environment variable to your project.
2. **Redeploy** (Deployments → ⋯ → Redeploy) so the new env var is picked up.

That's it. On the first request the app creates the `songs` table and seeds the three songs.
From then on, every edit is saved to Postgres and shared across everyone using the URL.

For local development against the same database, copy the connection string into a `.env`
file (see `.env.example`) — use the **pooled** connection string (host contains `-pooler`).

---

## Sharing with your second guitarist

- **Simplest:** send them the deployed URL. Same app, same database, same songs.
- **Per-song handoff:** open a song → **Download PDF** for a clean printable chart (song map,
  per-part tone, and tabs), or **Copy tab text** for plain text.
- **Backup / move:** **Export JSON** saves the whole library to a file; **Import JSON** loads
  one back in.

There is no login — anyone with the URL can view and edit. For a private band tool that's
usually fine (keep the URL to yourselves). If you later want accounts or a read-only share
mode, that's a straightforward add-on.

---

## Project layout

```
app/
  layout.js            fonts + global styles
  globals.css          DAW-inspired theme
  page.js              renders the client app
  fretdeck-app.js      the whole UI (library, song map, parts, FX, tab editor, exports)
  api/songs/route.js           GET list / POST create
  api/songs/[id]/route.js      GET / PUT / DELETE one song
lib/
  db.js                Neon when DATABASE_URL is set, in-memory fallback otherwise
  seed.js              the three starter songs
```

Data model: each song is one Postgres row — `songs(id text pk, data jsonb, updated_at)` — with
the parts/FX/tabs stored in the `data` JSON. Simple to query, easy to back up.
