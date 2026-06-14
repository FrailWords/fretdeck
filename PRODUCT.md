# FretDeck

**A shared roadmap for learning and teaching songs on guitar.**

FretDeck is a small web app for working out how a song is actually played — its
sections, its tones, and its riffs — and handing that understanding to another
guitarist as a single link. It's built for the moment a new player joins and needs
to pick up the set fast.

---

## The idea

Most tab tools treat a song as one long sheet of notes. A working guitarist doesn't
think that way — they think in **parts** over **time**: *intro here, verse from 0:10,
the chorus is the loud one with the delay, that bridge only happens once.*

FretDeck is built around that. You lay a song out as parts on a timeline synced to its
YouTube recording, note the tone for each part, tab the riffs that matter, and the
result is a chart someone can read **while listening to the actual track**.

---

## What it does

- **Plays along with the real song.** Drop in a YouTube link; a transport bar with a
  master timeline scrubs and plays the track. A playhead shows exactly where you are.
- **Parts on a timeline.** Break a song into sections (Intro, Verse, Pre-chorus,
  Chorus, Bridge, Lead, Outro — or anything you type). Each part has a start/end time,
  so the timeline mirrors the song. Overlapping parts (two guitar layers) stack into
  separate lanes.
- **Tone per part.** Capture the rig for each section — drive/distortion, delay in ms,
  reverb type, plus free notes for things like chorus, wah, capo, or tuning.
- **Tabs that read like tabs.** A click-or-keyboard tab editor that wraps bar-by-bar,
  no fiddly horizontal scrolling.
- **Repeats done right.** A chorus that plays three times is *one* part placed three
  times — edit it once and every repeat updates. Need to vary the last one? Make it an
  independent copy.
- **Follow mode.** Press play and the editor follows the song into each part, so you
  can read along hands-free.
- **A library of songs**, saved to a shared database so your bandmates see the same set.
- **Hand it off.** Export a clean PDF or plain-text chart, or share a live link.

---

## How you'd use it

1. Paste a song's YouTube link and give it a title.
2. Scrub the track and mark the parts — where each one starts and ends.
3. Note the tone for each part and tab the riffs worth tabbing.
4. Send the link (or a PDF) to whoever needs to learn it.

---

## What it isn't

FretDeck isn't full notation software. It captures fret positions, section structure,
tone, and timing — not precise rhythm notation, and not articulations like bends and
slides (those live in the notes for now). The recording carries the feel; FretDeck
carries the map.

---

## Status

An early, working build. The core — timeline, parts, tone, tabs, repeats, sharing — is
in place and usable. It's the kind of thing best judged by trying it on a song you know
and seeing whether the chart that comes out is something you'd actually hand a bandmate.

*Feedback welcome — especially where it feels heavier than it should, or where it's
missing something obvious for how you'd really use it.*
