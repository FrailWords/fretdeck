"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ---------------- constants ---------------- */
const STRINGS = ["e", "B", "G", "D", "A", "E"];
const BAR = 8; // slots per bar / per wrapped system row
const TYPE_SUGGESTIONS = [
  "Pre-intro", "Intro", "Pre-verse", "Verse", "Post-verse",
  "Pre-chorus", "Chorus", "Post-chorus", "Pre-bridge", "Bridge", "Post-bridge",
  "Lead", "Solo", "Breakdown", "Interlude", "Build-up", "Drop", "Outro", "Other",
];
const FAMILY_COLOR = {
  intro: "#6b7787", verse: "#4e9cd6", chorus: "#e0683e", bridge: "#9b6cc9",
  lead: "#d64e6e", solo: "#d64e6e", breakdown: "#c9603a", interlude: "#5aa0a8",
  outro: "#5fae8e", other: "#8a93a0",
};
const HASH_PALETTE = [
  "#6b7787", "#4e9cd6", "#d99a3e", "#e0683e", "#9b6cc9",
  "#d64e6e", "#5fae8e", "#5aa0a8", "#b07cc6", "#c98a3e",
];

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
  const s = Math.floor(sec % 60);
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
    id: uid(), name, type, start: "", end: "",
    fx: { drive: "Clean", delay: "", reverb: "None", other: "", notes: "" },
    slots: Array.from({ length: 16 }, () => [null, null, null, null, null, null]),
  };
}
const DRIVES = ["Clean", "Crunch", "Overdrive", "Distortion", "Heavy", "Fuzz"];
const REVERBS = ["None", "Room", "Hall", "Spring", "Plate"];

function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function mix(hex, target, amt) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const tr = (target >> 16) & 255, tg = (target >> 8) & 255, tb = target & 255;
  return "#" + [clampByte(r + (tr - r) * amt), clampByte(g + (tg - g) * amt), clampByte(b + (tb - b) * amt)]
    .map((x) => x.toString(16).padStart(2, "0")).join("");
}
function typeColor(type) {
  const t = (type || "").toLowerCase().trim();
  const fam = t.replace(/^(pre|post)[\s-]+/, "");
  let base = FAMILY_COLOR[fam];
  if (!base) {
    let hsh = 0;
    for (let i = 0; i < fam.length; i++) hsh = (hsh * 31 + fam.charCodeAt(i)) >>> 0;
    base = HASH_PALETTE[hsh % HASH_PALETTE.length];
  }
  if (/^pre[\s-]/.test(t)) return mix(base, 0xffffff, 0.22);
  if (/^post[\s-]/.test(t)) return mix(base, 0x000000, 0.2);
  return base;
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
  const margin = 54, pageH = 792;
  let y = margin;
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20);
  doc.text(song.title || "Untitled", margin, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
  if (song.artist) { doc.text(song.artist, margin, y); y += 14; }
  if (song.youtubeUrl) { doc.text(song.youtubeUrl, margin, y); y += 16; }
  const ordered = orderedParts(song.parts);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text("SONG MAP", margin, y); y += 14;
  doc.setFont("courier", "normal"); doc.setFontSize(10); doc.setTextColor(40);
  ordered.forEach((p) => {
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.text(rangeLabel(p).padEnd(13) + p.name.padEnd(16) + fxSummary(p.fx).replace(/\s+·\s+/g, " · "), margin, y);
    y += 12;
  });
  y += 10;
  ordered.forEach((p) => {
    if (y > pageH - margin - 100) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
    doc.text(rangeLabel(p) + "   " + p.name, margin, y); y += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
    doc.text("Tone: " + fxSummary(p.fx), margin, y); y += 12;
    if (p.fx && p.fx.notes) { doc.text("Notes: " + p.fx.notes, margin, y); y += 12; }
    doc.setFont("courier", "normal"); doc.setFontSize(10); doc.setTextColor(25);
    pdfSystems(p, 16).forEach((lines) => {
      const h = lines.length * 12 + 14;
      if (y + h > pageH - margin) { doc.addPage(); y = margin; }
      lines.forEach((ln) => { doc.text(ln, margin, y); y += 12; });
      y += 14;
    });
    y += 8;
  });
  doc.save((song.title || "fretdeck").replace(/[^a-z0-9]+/gi, "_").toLowerCase() + ".pdf");
}

/* ---------------- youtube iframe api ---------------- */
let ytApiPromise = null;
function loadYTApi() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof prev === "function") prev(); resolve(window.YT); };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return ytApiPromise;
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
  const [toast, setToast] = useState("");
  const [follow, setFollow] = useState(true);
  const [currentPartId, setCurrentPartId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const saveTimers = useRef({});
  const pendingRef = useRef({ v: "", t: 0, cell: "" });
  const toastT = useRef(null);
  const sheetRef = useRef(null);
  const fileRef = useRef(null);
  const ytHostRef = useRef(null);
  const playerRef = useRef(null);
  const rafRef = useRef(0);
  const playheadRef = useRef(null);
  const timingRef = useRef({ start: 0, end: 0, segs: [] });
  const lastSegRef = useRef(null);
  const followRef = useRef(true);
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const lastSeekRef = useRef(0);
  const lastTimeRef = useRef(0);
  const dragIndexRef = useRef(null);

  const activeSong = songs.find((s) => s.id === activeSongId) || null;
  const activePart =
    (activeSong && (activeSong.parts.find((p) => p.id === activePartId) || activeSong.parts[0])) || null;
  const ordered = activeSong ? orderedParts(activeSong.parts) : [];
  const vid = videoId(activeSong?.youtubeUrl);

  /* time axis + overlap lanes for the song map */
  const segList = [];
  ordered.forEach((p) => {
    const a = parseTime(p.start);
    if (a != null) segList.push({ id: p.id, a, b: parseTime(p.end) });
  });
  for (let i = 0; i < segList.length; i++) {
    if (segList[i].b == null) segList[i].b = segList[i + 1] ? segList[i + 1].a : segList[i].a + 10;
  }
  const mapStart = segList.length ? Math.min(...segList.map((s) => s.a)) : 0;
  const mapEnd = segList.length ? Math.max(...segList.map((s) => s.b)) : 0;
  const mapSpan = mapEnd - mapStart || 1;
  timingRef.current = { start: mapStart, end: mapEnd, segs: segList };
  const laneEnds = [];
  const placed = segList.map((s) => {
    let lane = laneEnds.findIndex((end) => end <= s.a + 0.001);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = s.b;
    return { ...s, lane };
  });
  const laneCount = Math.max(1, laneEnds.length);

  const showToast = (m) => {
    setToast(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 1600);
  };

  /* ---- playback follow loop ---- */
  const tick = useCallback(() => {
    const p = playerRef.current;
    const { start, end, segs } = timingRef.current;
    if (p && p.getCurrentTime) {
      const t = p.getCurrentTime() || 0;
      const span = end - start;
      if (playheadRef.current) {
        if (span > 0 && t >= start - 0.3 && t <= end + 0.3) {
          playheadRef.current.style.left = Math.max(0, Math.min(100, ((t - start) / span) * 100)) + "%";
          playheadRef.current.style.opacity = "1";
        } else {
          playheadRef.current.style.opacity = "0";
        }
      }
      const seg = (segs || []).find((s) => t >= s.a && (s.b == null || t < s.b));
      const id = seg ? seg.id : null;
      if (id !== lastSegRef.current) {
        lastSegRef.current = id;
        setCurrentPartId(id);
        if (id && followRef.current) setActivePartId(id);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);
  const stopLoop = useCallback(() => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => { followRef.current = follow; }, [follow]);

  /* ---- create / update the YouTube player ---- */
  useEffect(() => {
    if (!vid) {
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (e) {} playerRef.current = null; }
      if (ytHostRef.current) ytHostRef.current.innerHTML = "";
      return;
    }
    let cancelled = false;
    loadYTApi().then((YT) => {
      if (cancelled || !YT || !ytHostRef.current) return;
      if (playerRef.current && playerRef.current.cueVideoById) {
        playerRef.current.cueVideoById(vid);
        return;
      }
      const host = document.createElement("div");
      ytHostRef.current.innerHTML = "";
      ytHostRef.current.appendChild(host);
      playerRef.current = new YT.Player(host, {
        videoId: vid,
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
            const PS = window.YT.PlayerState;
            if (e.data === PS.PLAYING) startLoop();
            else if (e.data === PS.PAUSED || e.data === PS.ENDED) stopLoop();
          },
        },
      });
    });
    return () => { cancelled = true; };
  }, [vid, startLoop, stopLoop]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (playerRef.current) { try { playerRef.current.destroy(); } catch (e) {} }
  }, []);

  /* load library */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/songs");
        const j = await r.json();
        setSongs(j.songs || []);
        setHasDb(j.hasDb !== false);
        if (j.songs && j.songs.length) setActiveSongId(j.songs[0].id);
      } catch (e) { setStatus("error"); }
      setLoading(false);
    })();
  }, []);

  /* reset selection when switching songs */
  useEffect(() => {
    setSel(null);
    setActivePartId(null);
    setCurrentPartId(null);
    lastSegRef.current = null;
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
    } catch (e) { setStatus("error"); }
  }, []);
  const scheduleSave = useCallback((song) => {
    clearTimeout(saveTimers.current[song.id]);
    saveTimers.current[song.id] = setTimeout(() => saveSong(song), 600);
  }, [saveSong]);
  const updateActiveSong = useCallback((mut) => {
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== activeSongId) return s;
        const ns = structuredClone(s);
        mut(ns);
        scheduleSave(ns);
        return ns;
      })
    );
  }, [activeSongId, scheduleSave]);
  const updateActivePart = useCallback((mut) => {
    updateActiveSong((s) => {
      const p = s.parts.find((p) => p.id === (activePartId || s.parts[0]?.id));
      if (p) mut(p, s);
    });
  }, [updateActiveSong, activePartId]);

  /* song ops */
  async function addSong() {
    const song = { id: uid(), title: "New song", artist: "", youtubeUrl: "", parts: [emptyPart("Intro", "Intro")] };
    setStatus("saving");
    try {
      const r = await fetch("/api/songs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(song),
      });
      const j = await r.json();
      const ns = j.song || song;
      setSongs((p) => [...p, ns]);
      setActiveSongId(ns.id);
      setStatus("saved");
    } catch (e) { setStatus("error"); }
  }
  async function removeSong(id) {
    setSongs((p) => {
      const np = p.filter((s) => s.id !== id);
      if (id === activeSongId) setActiveSongId(np[0]?.id || null);
      return np;
    });
    try { await fetch("/api/songs/" + id, { method: "DELETE" }); } catch (e) {}
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
    updateActiveSong((s) => { s.parts = s.parts.filter((p) => p.id !== id); });
    if (id === activePartId) setActivePartId(null);
  }
  function reorderParts(from, to) {
    if (from == null || to == null || from === to) return;
    updateActiveSong((s) => {
      const [m] = s.parts.splice(from, 1);
      s.parts.splice(to, 0, m);
    });
  }

  /* tab editing */
  function setFret(v, adv) {
    if (!sel) return;
    updateActiveSong((s) => {
      const p = s.parts.find((p) => p.id === (activePartId || s.parts[0]?.id));
      if (!p) return;
      if (sel.slot < p.slots.length) p.slots[sel.slot][sel.str] = v;
      if (adv && v !== null && sel.slot >= p.slots.length - 1) p.slots.push([null, null, null, null, null, null]);
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
      return { slot: Math.max(0, Math.min(len - 1, cur.slot + dx)), str: Math.max(0, Math.min(5, cur.str + dy)) };
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
      pend.v = String(val); pend.t = now; pend.cell = cellKey;
    } else if (k === "x" || k === "X") { e.preventDefault(); setFret("x", false); }
    else if (k === "Backspace" || k === "Delete") { e.preventDefault(); setFret(null, false); }
    else if (k === "ArrowRight") { e.preventDefault(); move(1, 0); }
    else if (k === "ArrowLeft") { e.preventDefault(); move(-1, 0); }
    else if (k === "ArrowUp") { e.preventDefault(); move(0, -1); }
    else if (k === "ArrowDown") { e.preventDefault(); move(0, 1); }
    else if (k === " ") { e.preventDefault(); advance(); }
  }
  function addSlots(n) { updateActivePart((p) => { for (let i = 0; i < n; i++) p.slots.push([null, null, null, null, null, null]); }); }
  function delSlot() { updateActivePart((p) => { if (p.slots.length > 1) p.slots.pop(); }); }
  function clearPart() { updateActivePart((p) => { p.slots = p.slots.map(() => [null, null, null, null, null, null]); }); }

  /* player + scrub */
  function playFrom(part) {
    const sec = parseTime(part.start) || 0;
    const p = playerRef.current;
    if (p && p.seekTo) { p.seekTo(sec, true); p.playVideo(); }
  }
  function timeFromEvent(e) {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const { start, end } = timingRef.current;
    const span = end - start;
    if (span <= 0) return null;
    return start + (x / rect.width) * span;
  }
  function scrubMove(e) {
    const t = timeFromEvent(e);
    if (t == null) return;
    lastTimeRef.current = t;
    if (playheadRef.current) {
      const { start, end } = timingRef.current;
      playheadRef.current.style.left = Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100)) + "%";
      playheadRef.current.style.opacity = "1";
    }
    const now = performance.now();
    if (now - lastSeekRef.current > 70) {
      lastSeekRef.current = now;
      const p = playerRef.current;
      if (p && p.seekTo) p.seekTo(t, true);
    }
  }
  function onTrackDown(e) {
    const tm = timingRef.current;
    if (!tm || tm.end - tm.start <= 0) return;
    draggingRef.current = true;
    scrubMove(e);
    const mv = (ev) => { if (draggingRef.current) scrubMove(ev); };
    const up = () => {
      draggingRef.current = false;
      const p = playerRef.current;
      if (p && p.seekTo) p.seekTo(lastTimeRef.current, true);
      if (p && p.playVideo) p.playVideo();
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }

  /* exports */
  async function copyToClip(text, msg) {
    try { await navigator.clipboard.writeText(text); showToast(msg); }
    catch (e) { showToast("Copy failed — select manually"); }
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(songs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fretdeck-library.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function importJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const arr = Array.isArray(data) ? data : [data];
      setSongs(arr);
      if (arr[0]) setActiveSongId(arr[0].id);
      for (const s of arr) {
        if (!s.id) s.id = uid();
        await fetch("/api/songs/" + s.id, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s),
        });
      }
      showToast("Library imported");
    } catch (err) { showToast("Import failed — invalid file"); }
    e.target.value = "";
  }

  const statusText = { saved: "saved", saving: "saving…", error: "save error" }[status] || "";
  const systemCount = activePart ? Math.max(1, Math.ceil(activePart.slots.length / BAR)) : 0;

  return (
    <div className="app">
      <datalist id="part-types">
        {TYPE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

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
          project&apos;s <b>Storage</b> tab (it sets <code>DATABASE_URL</code> automatically), then redeploy.
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <div className="lib-head">Songs</div>
          {songs.map((s) => (
            <div key={s.id} className={"song-item" + (s.id === activeSongId ? " active" : "")} onClick={() => setActiveSongId(s.id)}>
              <div className="t">
                {s.title || "Untitled"}
                <div className="n">{(s.parts || []).length} parts</div>
              </div>
              <button className="del" title="Delete song" onClick={(e) => { e.stopPropagation(); removeSong(s.id); }}>×</button>
            </div>
          ))}
          <button className="add-song" onClick={addSong}>+ Add song</button>
        </aside>

        <main className="main">
          {activeSong ? (
            <>
              <div className="meta">
                <div className="field f-title">
                  <label>Song</label>
                  <input value={activeSong.title} onChange={(e) => updateActiveSong((s) => (s.title = e.target.value))} />
                </div>
                <div className="field f-artist">
                  <label>Artist</label>
                  <input value={activeSong.artist || ""} onChange={(e) => updateActiveSong((s) => (s.artist = e.target.value))} />
                </div>
                <div className="field f-url">
                  <label>YouTube URL</label>
                  <input value={activeSong.youtubeUrl || ""} placeholder="https://www.youtube.com/watch?v=…"
                    onChange={(e) => updateActiveSong((s) => (s.youtubeUrl = e.target.value))} />
                </div>
              </div>

              <div className="workspace">
                {/* ---- context column ---- */}
                <section className="context">
                  <div className="tube">
                    <div className="ratio">
                      <div className="yt-host" ref={ytHostRef} />
                      {!vid && <div className="empty">Paste a YouTube link above to listen along.</div>}
                    </div>
                  </div>

                  <div className="map-head">
                    <span className="sec-label">Song map</span>
                    <label className="follow">
                      <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
                      follow playback
                    </label>
                  </div>
                  {segList.length ? (
                    <div className="timeline-track" ref={trackRef} onPointerDown={onTrackDown} style={{ height: 14 + laneCount * 40 }}>
                      {placed.map((s) => {
                        const p = ordered.find((x) => x.id === s.id);
                        const left = ((s.a - mapStart) / mapSpan) * 100;
                        const width = Math.max(2.5, ((s.b - s.a) / mapSpan) * 100);
                        return (
                          <div key={s.id}
                            className={"tl-block" + (p.id === activePart?.id ? " active" : "") + (s.id === currentPartId ? " playing" : "")}
                            style={{ left: left + "%", width: width + "%", top: 7 + s.lane * 40, height: 34, background: typeColor(p.type) }}
                            onClick={() => setActivePartId(p.id)}>
                            <div className="nm">{p.name}</div>
                            <div className="tm">{rangeLabel(p)}</div>
                          </div>
                        );
                      })}
                      <div className="playhead" ref={playheadRef} />
                    </div>
                  ) : (
                    <div className="timeline"><div className="tl-empty">Add start/end times to a part to build the timeline.</div></div>
                  )}
                  <div className="scrub-hint">Click or drag the map to scrub the song</div>

                  <div className="sec-label" style={{ marginTop: 16 }}>Parts</div>
                  <div className="parts-scroll">
                    <div className="road">
                      {activeSong.parts.map((p, idx) => (
                        <div key={p.id}
                          className={"road-row" + (p.id === activePart?.id ? " active" : "") + (p.id === currentPartId ? " playing" : "") + (dragOver === idx ? " dragover" : "")}
                          onClick={() => setActivePartId(p.id)}
                          onDragOver={(e) => { e.preventDefault(); if (dragOver !== idx) setDragOver(idx); }}
                          onDrop={(e) => { e.preventDefault(); reorderParts(dragIndexRef.current, idx); dragIndexRef.current = null; setDragOver(null); }}
                          onDragEnd={() => { dragIndexRef.current = null; setDragOver(null); }}>
                          <span className="grip" title="Drag to reorder" draggable
                            onDragStart={(e) => { dragIndexRef.current = idx; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); }}
                            onClick={(e) => e.stopPropagation()}>⠿</span>
                          <span className="chip" style={{ background: typeColor(p.type) }} />
                          <span className="time">{rangeLabel(p)}</span>
                          <div className="info">
                            <div><span className="nm">{p.name}</span><span className="ty">{p.type}</span></div>
                            <div className="fx">{fxSummary(p.fx)}</div>
                          </div>
                          <div className="acts">
                            <button className="iconbtn" title="Play from here" onClick={(e) => { e.stopPropagation(); playFrom(p); }}>▶</button>
                            <button className="iconbtn" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicatePart(p); }}>⧉</button>
                            <button className="iconbtn danger" title="Delete" onClick={(e) => { e.stopPropagation(); deletePart(p.id); }}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button className="add-part" onClick={addPart}>+ Add part</button>
                </section>

                {/* ---- editor column ---- */}
                <section className="edit-col">
                  {activePart ? (
                    <div className="editor">
                      <div className="ed-title">Editing: <b>{activePart.name}</b></div>
                      <div className="ed-head">
                        <div className="field f-name">
                          <label>Part name</label>
                          <input value={activePart.name} onChange={(e) => updateActivePart((p) => (p.name = e.target.value))} />
                        </div>
                        <div className="field">
                          <label>Type</label>
                          <input list="part-types" value={activePart.type} placeholder="Verse, Pre-chorus…"
                            onChange={(e) => updateActivePart((p) => (p.type = e.target.value))} />
                        </div>
                        <div className="field f-time">
                          <label>Start</label>
                          <input placeholder="0:00" value={activePart.start} onChange={(e) => updateActivePart((p) => (p.start = e.target.value))} />
                        </div>
                        <div className="field f-time">
                          <label>End</label>
                          <input placeholder="0:00" value={activePart.end} onChange={(e) => updateActivePart((p) => (p.end = e.target.value))} />
                        </div>
                      </div>

                      <div className="fx">
                        <div className="field">
                          <label>Drive</label>
                          <select value={activePart.fx.drive} onChange={(e) => updateActivePart((p) => (p.fx.drive = e.target.value))}>
                            {DRIVES.map((d) => (<option key={d}>{d}</option>))}
                          </select>
                        </div>
                        <div className="field f-delay">
                          <label>Delay (ms)</label>
                          <input type="number" placeholder="0" value={activePart.fx.delay} onChange={(e) => updateActivePart((p) => (p.fx.delay = e.target.value))} />
                        </div>
                        <div className="field">
                          <label>Reverb</label>
                          <select value={activePart.fx.reverb} onChange={(e) => updateActivePart((p) => (p.fx.reverb = e.target.value))}>
                            {REVERBS.map((r) => (<option key={r}>{r}</option>))}
                          </select>
                        </div>
                        <div className="field f-other">
                          <label>Other FX</label>
                          <input placeholder="chorus, wah, octave…" value={activePart.fx.other} onChange={(e) => updateActivePart((p) => (p.fx.other = e.target.value))} />
                        </div>
                        <div className="field f-notes">
                          <label>Notes</label>
                          <input placeholder="capo 2, drop D…" value={activePart.fx.notes} onChange={(e) => updateActivePart((p) => (p.fx.notes = e.target.value))} />
                        </div>
                      </div>

                      <div className="sheet" tabIndex={0} ref={sheetRef} onKeyDown={onKey}>
                        {Array.from({ length: systemCount }, (_, sys) => {
                          const start = sys * BAR;
                          return (
                            <div className="system" key={sys}>
                              <div className="sys-head">bar {sys + 1}</div>
                              {STRINGS.map((s, si) => (
                                <div className="grow" key={si}>
                                  <div className="gut">{s}</div>
                                  <div className="lane">
                                    {Array.from({ length: BAR }, (_, j) => {
                                      const ci = start + j;
                                      if (ci >= activePart.slots.length) return <div className="cell pad" key={j} />;
                                      const v = activePart.slots[ci][si];
                                      const isSel = sel && sel.slot === ci && sel.str === si;
                                      return (
                                        <div key={j} className={"cell" + (isSel ? " sel" : "")}
                                          onClick={() => { setSel({ slot: ci, str: si }); sheetRef.current?.focus(); }}>
                                          {v == null ? <span className="dot" /> : <span className="num">{v}</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                        <div className="sheet-foot">
                          <button className="mini" onClick={() => addSlots(BAR)}>+ bar</button>
                          <button className="mini" onClick={() => addSlots(4)}>+ 4 slots</button>
                          <button className="mini" onClick={delSlot}>– slot</button>
                          <button className="mini" onClick={clearPart}>clear</button>
                        </div>
                      </div>

                      <div className="palette">
                        <span className="pl">Fret</span>
                        {Array.from({ length: 16 }, (_, f) => (
                          <button key={f} className="fret" onClick={() => setFret(f, true)}>{f}</button>
                        ))}
                        <button className="fret special" onClick={() => setFret("x", true)}>x</button>
                        <button className="fret special" onClick={() => setFret(null, false)}>⌫</button>
                      </div>
                      <div className="hint">
                        Click a cell, then a fret (auto-advances). Keys: <kbd>0–24</kbd> fret · <kbd>← ↑ ↓ →</kbd> move · <kbd>x</kbd> mute · <kbd>⌫</kbd> clear · <kbd>space</kbd> next.
                      </div>
                    </div>
                  ) : (
                    <div className="editor"><div className="loading">Select a part on the left to edit it.</div></div>
                  )}

                  <div className="exports">
                    <button className="btn primary" onClick={() => exportPdf(activeSong)}>Download PDF</button>
                    <button className="btn" onClick={() => copyToClip(buildAscii(activeSong), "Tab text copied")}>Copy tab text</button>
                    <button className="btn" onClick={() => copyToClip(typeof window !== "undefined" ? window.location.href : "", "App link copied")}>Copy app link</button>
                    <button className="btn" onClick={exportJson}>Export JSON</button>
                    <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
                    <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={importJson} />
                  </div>
                </section>
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
