"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ---------------- constants ---------------- */
const STRINGS = ["e", "B", "G", "D", "A", "E"];
const BAR = 8;
const TYPES = ["Intro", "Verse", "Pre-chorus", "Chorus", "Bridge", "Lead", "Outro", "Other"];
const TYPE_COLOR = {
  Intro: "#6b7787",
  Verse: "#4e9cd6",
  "Pre-chorus": "#d99a3e",
  Chorus: "#e0683e",
  Bridge: "#9b6cc9",
  Lead: "#d64e6e",
  Outro: "#5fae8e",
  Other: "#8a93a0",
};
const DRIVES = ["Clean", "Crunch", "Overdrive", "Distortion", "Heavy", "Fuzz"];
const REVERBS = ["None", "Room", "Hall", "Spring", "Plate"];

const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------------- pure helpers ---------------- */
function parseTime(s) {
  if (s == null) return null;
  s = String(s).trim();
  if (!s) return null;
  if (s.includes(":")) {
    const [m, sec] = s.split(":");
    return (parseInt(m, 10) || 0) * 60 + (parseInt(sec, 10) || 0);
  }
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
function fmtSec(sec) {
  if (sec == null || isNaN(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}
function rangeLabel(p) {
  const a = parseTime(p.start);
  const b = parseTime(p.end);
  if (a == null && b == null) return "—";
  return (a == null ? "?" : fmtSec(a)) + "–" + (b == null ? "?" : fmtSec(b));
}
function videoId(url) {
  if (!url) return "";
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return m ? m[1] : "";
}
function fxSummary(fx) {
  if (!fx) return "—";
  const p = [];
  if (fx.drive) p.push(fx.drive);
  if (fx.delay) p.push("Delay " + fx.delay + "ms");
  if (fx.reverb && fx.reverb !== "None") p.push(fx.reverb + " verb");
  if (fx.other) p.push(fx.other);
  return p.join("  ·  ") || "—";
}
function orderedParts(parts) {
  return [...(parts || [])]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const x = parseTime(a.p.start);
      const y = parseTime(b.p.start);
      if (x == null && y == null) return a.i - b.i;
      if (x == null) return 1;
      if (y == null) return -1;
      return x - y;
    })
    .map((o) => o.p);
}
function emptyPart(name = "Part", type = "Verse") {
  return {
    id: uid(),
    name,
    type,
    start: "",
    end: "",
    fx: { drive: "Clean", delay: "", reverb: "None", other: "", notes: "" },
    slots: Array.from({ length: 16 }, () => [null, null, null, null, null, null]),
  };
}

/* ---------------- text + pdf export ---------------- */
function partAscii(part) {
  const slots = part.slots || [];
  const w = slots.map((col) => Math.max(1, ...col.map((v) => (v == null ? 1 : String(v).length))));
  return STRINGS.map((s, si) => {
    let line = s + "|";
    slots.forEach((col, ci) => {
      if (ci > 0 && ci % BAR === 0) line += "|";
      const v = col[si];
      const t = v == null ? "-" : String(v);
      line += "-" + t + "-".repeat(w[ci] - t.length);
    });
    return line + "|";
  }).join("\n");
}
function buildAscii(song) {
  let out = (song.title || "Untitled") + (song.artist ? " — " + song.artist : "") + "\n";
  if (song.youtubeUrl) out += song.youtubeUrl + "\n";
  out += "\n";
  orderedParts(song.parts).forEach((p) => {
    out += "[" + p.name + "]  " + rangeLabel(p) + "   Tone: " + fxSummary(p.fx) + "\n";
    if (p.fx && p.fx.notes) out += "Notes: " + p.fx.notes + "\n";
    out += partAscii(p) + "\n\n";
  });
  return out.trimEnd() + "\n";
}
function pdfSystems(part, per) {
  const slots = part.slots || [];
  const out = [];
  for (let start = 0; start < slots.length; start += per) {
    const chunk = slots.slice(start, start + per);
    const w = chunk.map((col) => Math.max(1, ...col.map((v) => (v == null ? 1 : String(v).length))));
    const lines = STRINGS.map((s, si) => {
      let line = s + "|";
      chunk.forEach((col, ci) => {
        const gi = start + ci;
        if (gi > 0 && gi % BAR === 0 && ci > 0) line += "|";
        const v = col[si];
        const t = v == null ? "-" : String(v);
        line += "-" + t + "-".repeat(w[ci] - t.length);
      });
      return line + "|";
    });
    out.push(lines);
  }
  return out;
}
async function exportPdf(song) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const pageH = 792;
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(song.title || "Untitled", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  if (song.artist) {
    doc.text(song.artist, margin, y);
    y += 14;
  }
  if (song.youtubeUrl) {
    doc.text(song.youtubeUrl, margin, y);
    y += 16;
  }
  const ordered = orderedParts(song.parts);

  // song map
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("SONG MAP", margin, y);
  y += 14;
  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40);
  ordered.forEach((p) => {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    const line = rangeLabel(p).padEnd(13) + p.name.padEnd(16) + fxSummary(p.fx).replace(/\s+·\s+/g, " · ");
    doc.text(line, margin, y);
    y += 12;
  });
  y += 10;

  // per-part tabs
  ordered.forEach((p) => {
    if (y > pageH - margin - 100) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(rangeLabel(p) + "   " + p.name, margin, y);
    y += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Tone: " + fxSummary(p.fx), margin, y);
    y += 12;
    if (p.fx && p.fx.notes) {
      doc.text("Notes: " + p.fx.notes, margin, y);
      y += 12;
    }
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(25);
    pdfSystems(p, 16).forEach((lines) => {
      const h = lines.length * 12 + 14;
      if (y + h > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      lines.forEach((ln) => {
        doc.text(ln, margin, y);
        y += 12;
      });
      y += 14;
    });
    y += 8;
  });

  const name = (song.title || "fretdeck").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(name + ".pdf");
}

/* ---------------- component ---------------- */
export default function FretDeck() {
  const [songs, setSongs] = useState([]);
  const [activeSongId, setActiveSongId] = useState(null);
  const [activePartId, setActivePartId] = useState(null);
  const [sel, setSel] = useState(null);
  const [hasDb, setHasDb] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("saved");
  const [seek, setSeek] = useState({ sec: 0, nonce: 0, auto: false });
  const [toast, setToast] = useState("");

  const saveTimers = useRef({});
  const pendingRef = useRef({ v: "", t: 0, cell: "" });
  const toastT = useRef(null);
  const sheetRef = useRef(null);
  const fileRef = useRef(null);

  const activeSong = songs.find((s) => s.id === activeSongId) || null;
  const activePart =
    (activeSong && (activeSong.parts.find((p) => p.id === activePartId) || activeSong.parts[0])) || null;
  const ordered = activeSong ? orderedParts(activeSong.parts) : [];

  const showToast = (m) => {
    setToast(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 1600);
  };

  /* load */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/songs");
        const j = await r.json();
        setSongs(j.songs || []);
        setHasDb(j.hasDb !== false);
        if (j.songs && j.songs.length) setActiveSongId(j.songs[0].id);
      } catch (e) {
        setStatus("error");
      }
      setLoading(false);
    })();
  }, []);

  /* reset player + selection when switching songs */
  useEffect(() => {
    setSeek({ sec: 0, nonce: Date.now(), auto: false });
    setSel(null);
    setActivePartId(null);
  }, [activeSongId]);

  /* persistence */
  const saveSong = useCallback(async (song) => {
    setStatus("saving");
    try {
      const r = await fetch("/api/songs/" + song.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(song),
      });
      if (!r.ok) throw new Error("save failed");
      setStatus("saved");
    } catch (e) {
      setStatus("error");
    }
  }, []);
  const scheduleSave = useCallback(
    (song) => {
      clearTimeout(saveTimers.current[song.id]);
      saveTimers.current[song.id] = setTimeout(() => saveSong(song), 600);
    },
    [saveSong]
  );

  const updateActiveSong = useCallback(
    (mut) => {
      setSongs((prev) =>
        prev.map((s) => {
          if (s.id !== activeSongId) return s;
          const ns = structuredClone(s);
          mut(ns);
          scheduleSave(ns);
          return ns;
        })
      );
    },
    [activeSongId, scheduleSave]
  );
  const updateActivePart = useCallback(
    (mut) => {
      updateActiveSong((s) => {
        const p = s.parts.find((p) => p.id === (activePartId || s.parts[0]?.id));
        if (p) mut(p, s);
      });
    },
    [updateActiveSong, activePartId]
  );

  /* song ops */
  async function addSong() {
    const song = { id: uid(), title: "New song", artist: "", youtubeUrl: "", parts: [emptyPart("Intro", "Intro")] };
    setStatus("saving");
    try {
      const r = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(song),
      });
      const j = await r.json();
      const ns = j.song || song;
      setSongs((p) => [...p, ns]);
      setActiveSongId(ns.id);
      setStatus("saved");
    } catch (e) {
      setStatus("error");
    }
  }
  async function removeSong(id) {
    setSongs((p) => {
      const np = p.filter((s) => s.id !== id);
      if (id === activeSongId) setActiveSongId(np[0]?.id || null);
      return np;
    });
    try {
      await fetch("/api/songs/" + id, { method: "DELETE" });
    } catch (e) {}
  }

  /* part ops */
  function addPart() {
    const np = emptyPart("Part", "Verse");
    updateActiveSong((s) => s.parts.push(np));
    setActivePartId(np.id);
  }
  function duplicatePart(part) {
    const copy = structuredClone(part);
    copy.id = uid();
    updateActiveSong((s) => {
      const idx = s.parts.findIndex((p) => p.id === part.id);
      s.parts.splice(idx + 1, 0, copy);
    });
    setActivePartId(copy.id);
  }
  function deletePart(id) {
    updateActiveSong((s) => {
      s.parts = s.parts.filter((p) => p.id !== id);
    });
    if (id === activePartId) setActivePartId(null);
  }

  /* tab editing */
  function setFret(v, adv) {
    if (!sel) return;
    updateActiveSong((s) => {
      const p = s.parts.find((p) => p.id === (activePartId || s.parts[0]?.id));
      if (!p) return;
      if (sel.slot < p.slots.length) p.slots[sel.slot][sel.str] = v;
      if (adv && v !== null && sel.slot >= p.slots.length - 1)
        p.slots.push([null, null, null, null, null, null]);
    });
    if (adv && v !== null) setSel((se) => ({ slot: se.slot + 1, str: se.str }));
  }
  function advance() {
    updateActiveSong((s) => {
      const p = s.parts.find((p) => p.id === (activePartId || s.parts[0]?.id));
      if (p && sel && sel.slot >= p.slots.length - 1) p.slots.push([null, null, null, null, null, null]);
    });
    setSel((se) => ({ slot: (se ? se.slot : 0) + 1, str: se ? se.str : 0 }));
  }
  function move(dx, dy) {
    setSel((se) => {
      const cur = se || { slot: 0, str: 0 };
      const len = activePart ? activePart.slots.length : 1;
      return {
        slot: Math.max(0, Math.min(len - 1, cur.slot + dx)),
        str: Math.max(0, Math.min(5, cur.str + dy)),
      };
    });
  }
  function onKey(e) {
    if (!sel || !activePart) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      const now = Date.now();
      const pend = pendingRef.current;
      let val = parseInt(k, 10);
      const cellKey = sel.slot + "-" + sel.str;
      if (now - pend.t < 700 && pend.cell === cellKey && pend.v !== "") {
        const combo = parseInt(pend.v + k, 10);
        if (combo <= 24) val = combo;
      }
      setFret(val, false);
      pend.v = String(val);
      pend.t = now;
      pend.cell = cellKey;
    } else if (k === "x" || k === "X") {
      e.preventDefault();
      setFret("x", false);
    } else if (k === "Backspace" || k === "Delete") {
      e.preventDefault();
      setFret(null, false);
    } else if (k === "ArrowRight") {
      e.preventDefault();
      move(1, 0);
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      move(-1, 0);
    } else if (k === "ArrowUp") {
      e.preventDefault();
      move(0, -1);
    } else if (k === "ArrowDown") {
      e.preventDefault();
      move(0, 1);
    } else if (k === " ") {
      e.preventDefault();
      advance();
    }
  }
  function addSlots(n) {
    updateActivePart((p) => {
      for (let i = 0; i < n; i++) p.slots.push([null, null, null, null, null, null]);
    });
  }
  function delSlot() {
    updateActivePart((p) => {
      if (p.slots.length > 1) p.slots.pop();
    });
  }
  function clearPart() {
    updateActivePart((p) => {
      p.slots = p.slots.map(() => [null, null, null, null, null, null]);
    });
  }

  /* player */
  const vid = videoId(activeSong?.youtubeUrl);
  const embedSrc = vid
    ? `https://www.youtube.com/embed/${vid}?start=${seek.sec}&rel=0${seek.auto ? "&autoplay=1" : ""}`
    : "";
  function playFrom(part) {
    setSeek({ sec: parseTime(part.start) || 0, nonce: Date.now(), auto: true });
  }

  /* exports */
  async function copyToClip(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch (e) {
      showToast("Copy failed — select manually");
    }
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(songs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fretdeck-library.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function importJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      setSongs(arr);
      if (arr[0]) setActiveSongId(arr[0].id);
      for (const s of arr) {
        if (!s.id) s.id = uid();
        await fetch("/api/songs/" + s.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s),
        });
      }
      showToast("Library imported");
    } catch (err) {
      showToast("Import failed — invalid file");
    }
    e.target.value = "";
  }

  const statusText = { saved: "saved", saving: "saving…", error: "save error" }[status] || "";

  return (
    <div className="app">
      <header className="deck">
        <div className="brand">
          <span className="pilot" />
          <div>
            <h1>FRETDECK</h1>
            <small>SHARED SONG ROADMAP</small>
          </div>
        </div>
        <div className={"status " + status}>
          <b>●</b> {statusText}
        </div>
      </header>

      {!hasDb && (
        <div className="banner">
          No database connected — edits won&apos;t persist. Add a <b>Neon Postgres</b> store in your Vercel
          project&apos;s <b>Storage</b> tab (it sets <code>DATABASE_URL</code> automatically), then redeploy. See
          the README for steps.
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <div className="lib-head">Songs</div>
          {songs.map((s) => (
            <div
              key={s.id}
              className={"song-item" + (s.id === activeSongId ? " active" : "")}
              onClick={() => setActiveSongId(s.id)}
            >
              <div className="t">
                {s.title || "Untitled"}
                <div className="n">{(s.parts || []).length} parts</div>
              </div>
              <button
                className="del"
                title="Delete song"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSong(s.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button className="add-song" onClick={addSong}>
            + Add song
          </button>
        </aside>

        <main className="main">
          {activeSong ? (
            <>
              <div className="meta">
                <div className="field f-title">
                  <label>Song</label>
                  <input
                    value={activeSong.title}
                    onChange={(e) => updateActiveSong((s) => (s.title = e.target.value))}
                  />
                </div>
                <div className="field f-artist">
                  <label>Artist</label>
                  <input
                    value={activeSong.artist || ""}
                    onChange={(e) => updateActiveSong((s) => (s.artist = e.target.value))}
                  />
                </div>
                <div className="field f-url">
                  <label>YouTube URL</label>
                  <input
                    value={activeSong.youtubeUrl || ""}
                    placeholder="https://www.youtube.com/watch?v=…"
                    onChange={(e) => updateActiveSong((s) => (s.youtubeUrl = e.target.value))}
                  />
                </div>
              </div>

              <div className="tube">
                <div className="ratio">
                  {embedSrc ? (
                    <iframe
                      key={vid + "-" + seek.nonce}
                      src={embedSrc}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="empty">Paste a YouTube link above to listen along.</div>
                  )}
                </div>
              </div>

              <div className="sec-label">Song map</div>
              <div className="timeline">
                {ordered.length ? (
                  ordered.map((p) => {
                    const a = parseTime(p.start);
                    const b = parseTime(p.end);
                    const dur = a != null && b != null ? Math.max(1, b - a) : 1;
                    return (
                      <div
                        key={p.id}
                        className={"tl-block" + (p.id === activePart?.id ? " active" : "")}
                        style={{ background: TYPE_COLOR[p.type] || "#8a93a0", flexGrow: dur }}
                        onClick={() => {
                          setActivePartId(p.id);
                          playFrom(p);
                        }}
                      >
                        <div className="nm">{p.name}</div>
                        <div className="tm">{rangeLabel(p)}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="tl-empty">No parts yet — add one below.</div>
                )}
              </div>

              <div className="sec-label">Parts</div>
              <div className="road">
                {ordered.map((p) => (
                  <div
                    key={p.id}
                    className={"road-row" + (p.id === activePart?.id ? " active" : "")}
                    onClick={() => setActivePartId(p.id)}
                  >
                    <span className="chip" style={{ background: TYPE_COLOR[p.type] || "#8a93a0" }} />
                    <span className="time">{rangeLabel(p)}</span>
                    <div className="info">
                      <div>
                        <span className="nm">{p.name}</span>
                        <span className="ty">{p.type}</span>
                      </div>
                      <div className="fx">{fxSummary(p.fx)}</div>
                    </div>
                    <div className="acts">
                      <button
                        className="iconbtn"
                        title="Play from here"
                        onClick={(e) => {
                          e.stopPropagation();
                          playFrom(p);
                        }}
                      >
                        ▶
                      </button>
                      <button
                        className="iconbtn"
                        title="Duplicate"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePart(p);
                        }}
                      >
                        ⧉
                      </button>
                      <button
                        className="iconbtn danger"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePart(p.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-part" onClick={addPart}>
                + Add part
              </button>

              {activePart && (
                <div className="editor">
                  <div className="ed-head">
                    <div className="field">
                      <label>Part name</label>
                      <input
                        value={activePart.name}
                        onChange={(e) => updateActivePart((p) => (p.name = e.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label>Type</label>
                      <select
                        value={activePart.type}
                        onChange={(e) => updateActivePart((p) => (p.type = e.target.value))}
                      >
                        {TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Start</label>
                      <input
                        placeholder="0:00"
                        value={activePart.start}
                        onChange={(e) => updateActivePart((p) => (p.start = e.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label>End</label>
                      <input
                        placeholder="0:00"
                        value={activePart.end}
                        onChange={(e) => updateActivePart((p) => (p.end = e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="fx">
                    <div className="field">
                      <label>Drive</label>
                      <select
                        value={activePart.fx.drive}
                        onChange={(e) => updateActivePart((p) => (p.fx.drive = e.target.value))}
                      >
                        {DRIVES.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field f-delay">
                      <label>Delay (ms)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={activePart.fx.delay}
                        onChange={(e) => updateActivePart((p) => (p.fx.delay = e.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label>Reverb</label>
                      <select
                        value={activePart.fx.reverb}
                        onChange={(e) => updateActivePart((p) => (p.fx.reverb = e.target.value))}
                      >
                        {REVERBS.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field f-other">
                      <label>Other FX</label>
                      <input
                        placeholder="chorus, wah, octave…"
                        value={activePart.fx.other}
                        onChange={(e) => updateActivePart((p) => (p.fx.other = e.target.value))}
                      />
                    </div>
                    <div className="field f-notes">
                      <label>Notes</label>
                      <input
                        placeholder="capo 2, drop D, pick near bridge…"
                        value={activePart.fx.notes}
                        onChange={(e) => updateActivePart((p) => (p.fx.notes = e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="sheet" tabIndex={0} ref={sheetRef} onKeyDown={onKey}>
                    <div className="grid">
                      {STRINGS.map((s, si) => (
                        <div className="grow" key={si}>
                          <div className="gut">{s}</div>
                          <div className="lane">
                            {activePart.slots.map((col, ci) => {
                              const v = col[si];
                              const isSel = sel && sel.slot === ci && sel.str === si;
                              return (
                                <div
                                  key={ci}
                                  className={
                                    "cell" + (ci > 0 && ci % BAR === 0 ? " bar" : "") + (isSel ? " sel" : "")
                                  }
                                  onClick={() => {
                                    setSel({ slot: ci, str: si });
                                    sheetRef.current?.focus();
                                  }}
                                >
                                  {v == null ? <span className="dot" /> : <span className="num">{v}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="sheet-foot">
                      <button className="mini" onClick={() => addSlots(4)}>
                        + 4 slots
                      </button>
                      <button className="mini" onClick={() => addSlots(BAR)}>
                        + bar
                      </button>
                      <button className="mini" onClick={delSlot}>
                        – slot
                      </button>
                      <button className="mini" onClick={clearPart}>
                        clear
                      </button>
                    </div>
                  </div>

                  <div className="palette">
                    <span className="pl">Fret</span>
                    {Array.from({ length: 16 }, (_, f) => (
                      <button key={f} className="fret" onClick={() => setFret(f, true)}>
                        {f}
                      </button>
                    ))}
                    <button className="fret special" onClick={() => setFret("x", true)}>
                      x
                    </button>
                    <button className="fret special" onClick={() => setFret(null, false)}>
                      ⌫
                    </button>
                  </div>
                  <div className="hint">
                    Click a cell, then a fret (auto-advances). Keys: <kbd>0–24</kbd> fret · <kbd>← ↑ ↓ →</kbd>{" "}
                    move · <kbd>x</kbd> mute · <kbd>⌫</kbd> clear · <kbd>space</kbd> next.
                  </div>
                </div>
              )}

              <div className="exports">
                <button className="btn primary" onClick={() => exportPdf(activeSong)}>
                  Download PDF
                </button>
                <button className="btn" onClick={() => copyToClip(buildAscii(activeSong), "Tab text copied")}>
                  Copy tab text
                </button>
                <button
                  className="btn"
                  onClick={() => copyToClip(typeof window !== "undefined" ? window.location.href : "", "App link copied")}
                >
                  Copy app link
                </button>
                <button className="btn" onClick={exportJson}>
                  Export JSON
                </button>
                <button className="btn" onClick={() => fileRef.current?.click()}>
                  Import JSON
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  style={{ display: "none" }}
                  onChange={importJson}
                />
              </div>
            </>
          ) : (
            <div className="loading">{loading ? "Loading library…" : "No song selected — add one on the left."}</div>
          )}
        </main>
      </div>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}
