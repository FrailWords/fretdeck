// Seed library. Used to populate the database on first run, and as the
// in-memory fallback when no DATABASE_URL is configured.

function part(id, name, type, start, end, fx) {
  return {
    id,
    name,
    type,
    start: start || "",
    end: end || "",
    fx: Object.assign({ drive: "Clean", delay: "", reverb: "None", other: "", notes: "" }, fx || {}),
    // 16 empty slots, 6 strings each (high e .. low E), null = no note
    slots: Array.from({ length: 16 }, () => [null, null, null, null, null, null]),
  };
}

export const SEED_SONGS = [
  {
    id: "song-1",
    title: "Song 1 (rename me)",
    artist: "",
    youtubeUrl: "https://music.youtube.com/watch?v=n8B-RamUPxQ",
    parts: [
      part("p1a", "Intro", "Intro", "0:00", "0:10", { drive: "Clean", reverb: "Hall" }),
      part("p1b", "Verse", "Verse", "0:10", "0:42", { drive: "Crunch" }),
      part("p1c", "Chorus", "Chorus", "0:42", "1:08", { drive: "Distortion", delay: "350" }),
    ],
  },
  {
    id: "song-2",
    title: "Song 2 (rename me)",
    artist: "",
    youtubeUrl: "https://music.youtube.com/watch?v=rQmWtEGIKUQ",
    parts: [part("p2a", "Intro", "Intro", "0:00", "", {})],
  },
  {
    id: "song-3",
    title: "Song 3 (rename me)",
    artist: "",
    youtubeUrl: "https://music.youtube.com/watch?v=KuitHZCVMxc",
    parts: [part("p3a", "Intro", "Intro", "0:00", "", {})],
  },
];
