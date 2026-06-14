"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ---------------- constants ---------------- */
const STRINGS = ["e", "B", "G", "D", "A", "E"];
const BAR = 8;
const ROW_SLOTS = 16;
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
const HASH_PALETTE = ["#6b7787", "#4e9cd6", "#d99a3e", "#e0683e", "#9b6cc9", "#d64e6e", "#5fae8e", "#5aa0a8", "#b07cc6", "#c98a3e"];
const DRIVES = ["Clean", "Crunch", "Overdrive", "Distortion", "Heavy", "Fuzz"];
const REVERBS = ["None", "Room", "Hall", "Spring", "Plate"];

const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------------- pure helpers ---------------- */
function parseTime(s) {
  if (s == null) return null;
  s = String(s).trim();
  if (!s) return null;
  if (s.includes(":")) { const [m, sec] = s.split(":"); return (parseInt(m, 10) || 0) * 60 + (parseInt(sec, 10) || 0); }
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
function fmtSec(sec) {
  if (sec == null || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}
function rangeLabel(plc) {
  const a = parseTime(plc.start), b = parseTime(plc.end);
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
function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function mix(hex, target, amt) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const tr = (target >> 16) & 255, tg = (target >> 8) & 255, tb = target & 255;
  return "#" + [clampByte(r + (tr - r) * amt), clampByte(g + (tg - g) * amt), clampByte(b + (tb - b) * amt)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function typeColor(type) {
  const t = (type || "").toLowerCase().trim();
  const fam = t.replace(/^(pre|post)[\s-]+/, "");
  let base = FAMILY_COLOR[fam];
  if (!base) { let hsh = 0; for (let i = 0; i < fam.length; i++) hsh = (hsh * 31 + fam.charCodeAt(i)) >>> 0; base = HASH_PALETTE[hsh % HASH_PALETTE.length]; }
  if (/^pre[\s-]/.test(t)) return mix(base, 0xffffff, 0.22);
  if (/^post[\s-]/.test(t)) return mix(base, 0x000000, 0.2);
  return base;
}
function niceStep(span) { const opts = [5, 10, 15, 30, 60, 120, 300, 600]; for (const o of opts) if (span / o <= 10) return o; return 600; }
function defFx() { return { drive: "Clean", delay: "", reverb: "None", other: "", notes: "" }; }
function emptySlots() { return Array.from({ length: 16 }, () => [null, null, null, null, null, null]); }
function normalizeSong(s) {
  if (s && Array.isArray(s.arrangement) && Array.isArray(s.parts) && (!s.parts[0] || s.parts[0].slots)) return s;
  const parts = [], arrangement = [];
  (s.parts || []).forEach((old) => {
    const pid = old.id || uid();
    parts.push({ id: pid, name: old.name || "Part", type: old.type || "Verse", fx: old.fx || defFx(), slots: old.slots || emptySlots() });
    arrangement.push({ id: uid(), partId: pid, start: old.start || "", end: old.end || "" });
  });
  return { ...s, parts, arrangement };
}
function placementsOrdered(song) {
  return [...(song.arrangement || [])].map((a, i) => ({ a, i })).sort((x, y) => {
    const p = parseTime(x.a.start), q = parseTime(y.a.start);
    if (p == null && q == null) return x.i - y.i;
    if (p == null) return 1; if (q == null) return -1; return p - q;
  }).map((o) => o.a);
}

/* ---------------- exports ---------------- */
function partAscii(part) {
  const slots = part.slots || [];
  const w = slots.map((col) => Math.max(1, ...col.map((v) => (v == null ? 1 : String(v).length))));
  return STRINGS.map((s, si) => {
    let line = s + "|";
    slots.forEach((col, ci) => { if (ci > 0 && ci % BAR === 0) line += "|"; const v = col[si]; const t = v == null ? "-" : String(v); line += "-" + t + "-".repeat(w[ci] - t.length); });
    return line + "|";
  }).join("\n");
}
function buildAscii(song) {
  const byId = Object.fromEntries((song.parts || []).map((p) => [p.id, p]));
  const arr = placementsOrdered(song);
  let out = (song.title || "Untitled") + (song.artist ? " — " + song.artist : "") + "\n";
  if (song.youtubeUrl) out += song.youtubeUrl + "\n";
  out += "\nSONG MAP\n";
  arr.forEach((plc) => { const p = byId[plc.partId]; if (p) out += rangeLabel(plc).padEnd(13) + p.name + "   Tone: " + fxSummary(p.fx) + "\n"; });
  out += "\n";
  const seen = new Set();
  arr.forEach((plc) => { const p = byId[plc.partId]; if (!p || seen.has(p.id)) return; seen.add(p.id); out += "[" + p.name + "]\n"; if (p.fx && p.fx.notes) out += "Notes: " + p.fx.notes + "\n"; out += partAscii(p) + "\n\n"; });
  return out.trimEnd() + "\n";
}
function pdfSystems(part, per) {
  const slots = part.slots || [], out = [];
  for (let start = 0; start < slots.length; start += per) {
    const chunk = slots.slice(start, start + per);
    const w = chunk.map((col) => Math.max(1, ...col.map((v) => (v == null ? 1 : String(v).length))));
    const lines = STRINGS.map((s, si) => {
      let line = s + "|";
      chunk.forEach((col, ci) => { const gi = start + ci; if (gi > 0 && gi % BAR === 0 && ci > 0) line += "|"; const v = col[si]; const t = v == null ? "-" : String(v); line += "-" + t + "-".repeat(w[ci] - t.length); });
      return line + "|";
    });
    out.push(lines);
  }
  return out;
}
async function exportPdf(song) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54, pageH = 792; let y = margin;
  const byId = Object.fromEntries((song.parts || []).map((p) => [p.id, p]));
  const arr = placementsOrdered(song);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20);
  doc.text(song.title || "Untitled", margin, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
  if (song.artist) { doc.text(song.artist, margin, y); y += 14; }
  if (song.youtubeUrl) { doc.text(song.youtubeUrl, margin, y); y += 16; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text("SONG MAP", margin, y); y += 14;
  doc.setFont("courier", "normal"); doc.setFontSize(10); doc.setTextColor(40);
  arr.forEach((plc) => { const p = byId[plc.partId]; if (!p) return; if (y > pageH - margin) { doc.addPage(); y = margin; } doc.text(rangeLabel(plc).padEnd(13) + p.name.padEnd(16) + fxSummary(p.fx).replace(/\s+·\s+/g, " · "), margin, y); y += 12; });
  y += 10;
  const seen = new Set();
  arr.forEach((plc) => {
    const p = byId[plc.partId]; if (!p || seen.has(p.id)) return; seen.add(p.id);
    if (y > pageH - margin - 100) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20); doc.text(p.name, margin, y); y += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110); doc.text("Tone: " + fxSummary(p.fx), margin, y); y += 12;
    if (p.fx && p.fx.notes) { doc.text("Notes: " + p.fx.notes, margin, y); y += 12; }
    doc.setFont("courier", "normal"); doc.setFontSize(10); doc.setTextColor(25);
    pdfSystems(p, 16).forEach((lines) => { const h = lines.length * 12 + 14; if (y + h > pageH - margin) { doc.addPage(); y = margin; } lines.forEach((ln) => { doc.text(ln, margin, y); y += 12; }); y += 14; });
    y += 8;
  });
  doc.save((song.title || "fretdeck").replace(/[^a-z0-9]+/gi, "_").toLowerCase() + ".pdf");
}

/* ---------------- youtube ---------------- */
let ytApiPromise = null;
function loadYTApi() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof prev === "function") prev(); resolve(window.YT); };
    const tag = document.createElement("script"); tag.src = "https://www.youtube.com/iframe_api"; document.body.appendChild(tag);
  });
  return ytApiPromise;
}

/* ---------------- component ---------------- */
export default function FretDeck({ token, initialSongId }) {
  const [songs, setSongs] = useState([]);
  const [activeSongId, setActiveSongId] = useState(null);
  const [activePlacementId, setActivePlacementId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [hasDb, setHasDb] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState("saved");
  const [toast, setToast] = useState("");
  const [follow, setFollow] = useState(true);
  const [currentPlacementId, setCurrentPlacementId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [access, setAccess] = useState("view");
  const [editToken, setEditToken] = useState("");
  const [viewToken, setViewToken] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  const ro = access !== "edit";

  const saveTimers = useRef({});
  const pendingRef = useRef({ v: "", t: 0, cell: "" });
  const toastT = useRef(null);
  const sheetRef = useRef(null);
  const fileRef = useRef(null);
  const ytHostRef = useRef(null);
  const playerRef = useRef(null);
  const rafRef = useRef(0);
  const playheadRef = useRef(null);
  const timeReadoutRef = useRef(null);
  const durationRef = useRef(0);
  const timingRef = useRef({ start: 0, end: 1, segs: [] });
  const lastSegRef = useRef(null);
  const followRef = useRef(true);
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const lastSeekRef = useRef(0);
  const lastTimeRef = useRef(0);
  const clickRef = useRef({ id: null, t: 0 });
  const markRef = useRef(null);

  const activeSong = songs.find((s) => s.id === activeSongId) || null;
  const arrangement = activeSong ? activeSong.arrangement || [] : [];
  const partById = {};
  if (activeSong) (activeSong.parts || []).forEach((p) => (partById[p.id] = p));
  const placements = activeSong ? placementsOrdered(activeSong) : [];
  const activePlacement = arrangement.find((a) => a.id === activePlacementId) || null;
  const activePart = activePlacement ? partById[activePlacement.partId] : null;
  const linkCount = activePart ? arrangement.filter((a) => a.partId === activePart.id).length : 0;
  const vid = videoId(activeSong?.youtubeUrl);

  const segList = [];
  placements.forEach((plc) => { const a = parseTime(plc.start); if (a != null) segList.push({ id: plc.id, partId: plc.partId, a, b: parseTime(plc.end) }); });
  for (let i = 0; i < segList.length; i++) if (segList[i].b == null) segList[i].b = segList[i + 1] ? segList[i + 1].a : segList[i].a + 10;
  const mapEnd = segList.length ? Math.max(...segList.map((s) => s.b)) : 0;
  const spanEnd = Math.max(mapEnd, duration, 1);
  timingRef.current = { start: 0, end: spanEnd, segs: segList };
  const laneEnds = [];
  const placed = segList.map((s) => { let lane = laneEnds.findIndex((e) => e <= s.a + 0.001); if (lane === -1) lane = laneEnds.length; laneEnds[lane] = s.b; return { ...s, lane }; });
  const laneCount = Math.max(1, laneEnds.length);
  const ticks = []; const step = niceStep(spanEnd); for (let t = 0; t <= spanEnd + 0.01; t += step) ticks.push(t);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareLinks = [];
  if (viewToken) shareLinks.push({ label: "Collection · read-only", url: origin + "/c/" + viewToken });
  if (editToken) shareLinks.push({ label: "Collection · can edit", url: origin + "/c/" + editToken });
  if (viewToken && activeSongId) shareLinks.push({ label: "This song · read-only", url: origin + "/c/" + viewToken + "/" + activeSongId });
  if (editToken && activeSongId) shareLinks.push({ label: "This song · can edit", url: origin + "/c/" + editToken + "/" + activeSongId });

  const showToast = (m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 1600); };

  /* loop */
  const tick = useCallback(() => {
    const p = playerRef.current;
    const { start, end, segs } = timingRef.current;
    if (p && p.getCurrentTime) {
      const t = p.getCurrentTime() || 0;
      const span = end - start;
      if (playheadRef.current && span > 0) { playheadRef.current.style.left = Math.max(0, Math.min(100, ((t - start) / span) * 100)) + "%"; playheadRef.current.style.opacity = "1"; }
      const dur = p.getDuration ? p.getDuration() : 0;
      if (timeReadoutRef.current) timeReadoutRef.current.textContent = fmtSec(t) + " / " + fmtSec(dur);
      if (dur && Math.abs(dur - durationRef.current) > 0.5) { durationRef.current = dur; setDuration(dur); }
      const seg = (segs || []).find((s) => t >= s.a && (s.b == null || t < s.b));
      const id = seg ? seg.id : null;
      if (id !== lastSegRef.current) { lastSegRef.current = id; setCurrentPlacementId(id); if (id && followRef.current) setActivePlacementId(id); }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  const startLoop = useCallback(() => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(tick); }, [tick]);
  const stopLoop = useCallback(() => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => { followRef.current = follow; }, [follow]);
  useEffect(() => { const h = (e) => { if (e.key === "Escape") setEditorOpen(false); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  useEffect(() => {
    const h = (e) => {
      if (e.key !== "m" && e.key !== "M") return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault(); if (markRef.current) markRef.current();
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  /* youtube */
  useEffect(() => {
    if (!vid) { if (playerRef.current) { try { playerRef.current.destroy(); } catch (e) {} playerRef.current = null; } if (ytHostRef.current) ytHostRef.current.innerHTML = ""; return; }
    let cancelled = false;
    loadYTApi().then((YT) => {
      if (cancelled || !YT || !ytHostRef.current) return;
      if (playerRef.current && playerRef.current.cueVideoById) { playerRef.current.cueVideoById(vid); return; }
      const host = document.createElement("div"); ytHostRef.current.innerHTML = ""; ytHostRef.current.appendChild(host);
      playerRef.current = new YT.Player(host, {
        videoId: vid, playerVars: { rel: 0, playsinline: 1, modestbranding: 1, controls: 0 },
        events: { onStateChange: (e) => { const PS = window.YT.PlayerState; const d = e.target.getDuration ? e.target.getDuration() : 0; if (d) { durationRef.current = d; setDuration(d); } if (e.data === PS.PLAYING) { setPlaying(true); startLoop(); } else { setPlaying(false); if (e.data === PS.PAUSED || e.data === PS.ENDED) stopLoop(); } } },
      });
    });
    return () => { cancelled = true; };
  }, [vid, startLoop, stopLoop]);
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); if (playerRef.current) { try { playerRef.current.destroy(); } catch (e) {} } }, []);

  /* load collection by token */
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const r = await fetch("/api/collections/" + token);
        if (!r.ok) { setLoadError(true); setLoading(false); return; }
        const j = await r.json();
        const list = (j.songs || []).map(normalizeSong);
        setSongs(list);
        setAccess(j.access || "view");
        setEditToken(j.editToken || "");
        setViewToken(j.viewToken || "");
        setCollectionName(j.collection?.name || "Collection");
        setHasDb(j.hasDb !== false);
        const init = initialSongId && list.find((s) => s.id === initialSongId) ? initialSongId : (list[0]?.id || null);
        setActiveSongId(init);
      } catch (e) { setLoadError(true); }
      setLoading(false);
    })();
  }, [token, initialSongId]);

  useEffect(() => { setSel(null); setActivePlacementId(null); setCurrentPlacementId(null); setEditorOpen(false); setDuration(0); durationRef.current = 0; lastSegRef.current = null; }, [activeSongId]);

  /* keep song URL in sync */
  useEffect(() => {
    if (typeof window === "undefined" || !token || !activeSongId) return;
    window.history.replaceState(null, "", "/c/" + token + "/" + activeSongId);
  }, [activeSongId, token]);

  /* persistence (edit only) */
  const saveSong = useCallback(async (song) => {
    if (ro || !editToken) return;
    setStatus("saving");
    try {
      const r = await fetch("/api/songs/" + song.id + "?token=" + editToken, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(song) });
      if (!r.ok) throw new Error("save failed");
      setStatus("saved");
    } catch (e) { setStatus("error"); }
  }, [ro, editToken]);
  const scheduleSave = useCallback((song) => { if (ro) return; clearTimeout(saveTimers.current[song.id]); saveTimers.current[song.id] = setTimeout(() => saveSong(song), 600); }, [saveSong, ro]);
  const updateActiveSong = useCallback((mut) => {
    setSongs((prev) => prev.map((s) => { if (s.id !== activeSongId) return s; const ns = structuredClone(s); mut(ns); scheduleSave(ns); return ns; }));
  }, [activeSongId, scheduleSave]);
  const updatePart = useCallback((mut) => { if (!activePart) return; const pid = activePart.id; updateActiveSong((s) => { const p = s.parts.find((p) => p.id === pid); if (p) mut(p); }); }, [updateActiveSong, activePart]);
  const updatePlacement = useCallback((plcId, mut) => { updateActiveSong((s) => { const a = s.arrangement.find((a) => a.id === plcId); if (a) mut(a); }); }, [updateActiveSong]);

  /* song ops */
  async function addSong() {
    if (ro || !editToken) return;
    const pid = uid();
    const song = { id: uid(), title: "New song", artist: "", youtubeUrl: "", parts: [{ id: pid, name: "Intro", type: "Intro", fx: defFx(), slots: emptySlots() }], arrangement: [{ id: uid(), partId: pid, start: "", end: "" }] };
    setStatus("saving");
    try {
      const r = await fetch("/api/songs?token=" + editToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(song) });
      const j = await r.json(); const ns = normalizeSong(j.song || song);
      setSongs((p) => [...p, ns]); setActiveSongId(ns.id); setStatus("saved");
    } catch (e) { setStatus("error"); }
  }
  async function removeSong(id) {
    if (ro || !editToken) return;
    setSongs((p) => { const np = p.filter((s) => s.id !== id); if (id === activeSongId) setActiveSongId(np[0]?.id || null); return np; });
    try { await fetch("/api/songs/" + id + "?token=" + editToken, { method: "DELETE" }); } catch (e) {}
  }
  function addPart() { const pid = uid(), plcId = uid(); updateActiveSong((s) => { s.parts.push({ id: pid, name: "Part", type: "Verse", fx: defFx(), slots: emptySlots() }); s.arrangement.push({ id: plcId, partId: pid, start: "", end: "" }); }); setActivePlacementId(plcId); setEditorOpen(true); }
  function repeatPlacement(plc) { const plcId = uid(); updateActiveSong((s) => { const i = s.arrangement.findIndex((a) => a.id === plc.id); s.arrangement.splice(i + 1, 0, { id: plcId, partId: plc.partId, start: "", end: "" }); }); setActivePlacementId(plcId); showToast("Linked repeat added — set its time"); }
  function makeIndependent(plc) { const newId = uid(); updateActiveSong((s) => { const src = s.parts.find((p) => p.id === plc.partId); if (!src) return; const copy = structuredClone(src); copy.id = newId; s.parts.push(copy); const a = s.arrangement.find((a) => a.id === plc.id); if (a) a.partId = newId; }); showToast("Now an independent copy"); }
  function deletePlacement(plcId) { updateActiveSong((s) => { const plc = s.arrangement.find((a) => a.id === plcId); s.arrangement = s.arrangement.filter((a) => a.id !== plcId); if (plc && !s.arrangement.some((a) => a.partId === plc.partId)) s.parts = s.parts.filter((p) => p.id !== plc.partId); }); if (plcId === activePlacementId) { setActivePlacementId(null); setEditorOpen(false); } }
  function openEditor(plcId) { setActivePlacementId(plcId); setEditorOpen(true); }
  function currentSec() { const p = playerRef.current; return p && p.getCurrentTime ? (p.getCurrentTime() || 0) : null; }
  function addPartAtPlayhead() {
    if (ro) return; const t = currentSec(); if (t == null) return;
    const pid = uid(), plcId = uid();
    updateActiveSong((s) => {
      const prev = [...s.arrangement].filter((a) => { const st = parseTime(a.start); return st != null && st <= t + 0.01 && a.id !== plcId; }).sort((x, y) => parseTime(y.start) - parseTime(x.start))[0];
      if (prev && (parseTime(prev.end) == null || parseTime(prev.end) > t)) prev.end = fmtSec(t);
      s.parts.push({ id: pid, name: "Part", type: "Verse", fx: defFx(), slots: emptySlots() });
      s.arrangement.push({ id: plcId, partId: pid, start: fmtSec(t), end: "" });
    });
    setActivePlacementId(plcId);
    showToast("Part marked at " + fmtSec(t) + " — name it later");
  }
  markRef.current = addPartAtPlayhead;
  function markField(field) {
    if (ro || !activePlacement) return; const t = currentSec(); if (t == null) return;
    updatePlacement(activePlacement.id, (a) => (a[field] = fmtSec(t)));
    showToast((field === "start" ? "Start" : "End") + " set to " + fmtSec(t));
  }

  /* tab editing */
  function setFret(v, adv) {
    if (ro || !sel || !activePart) return;
    const pid = activePart.id;
    updateActiveSong((s) => { const p = s.parts.find((p) => p.id === pid); if (!p) return; if (sel.slot < p.slots.length) p.slots[sel.slot][sel.str] = v; if (adv && v !== null && sel.slot >= p.slots.length - 1) p.slots.push([null, null, null, null, null, null]); });
    if (adv && v !== null) setSel((se) => ({ slot: se.slot + 1, str: se.str }));
  }
  function advance() { if (!activePart) return; const pid = activePart.id; updateActiveSong((s) => { const p = s.parts.find((p) => p.id === pid); if (p && sel && sel.slot >= p.slots.length - 1) p.slots.push([null, null, null, null, null, null]); }); setSel((se) => ({ slot: (se ? se.slot : 0) + 1, str: se ? se.str : 0 })); }
  function move(dx, dy) { setSel((se) => { const cur = se || { slot: 0, str: 0 }; const len = activePart ? activePart.slots.length : 1; return { slot: Math.max(0, Math.min(len - 1, cur.slot + dx)), str: Math.max(0, Math.min(5, cur.str + dy)) }; }); }
  function onKey(e) {
    if (ro || !sel || !activePart) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) { e.preventDefault(); const now = Date.now(); const pend = pendingRef.current; let val = parseInt(k, 10); const cellKey = sel.slot + "-" + sel.str; if (now - pend.t < 700 && pend.cell === cellKey && pend.v !== "") { const combo = parseInt(pend.v + k, 10); if (combo <= 24) val = combo; } setFret(val, false); pend.v = String(val); pend.t = now; pend.cell = cellKey; }
    else if (k === "x" || k === "X") { e.preventDefault(); setFret("x", false); }
    else if (k === "Backspace" || k === "Delete") { e.preventDefault(); setFret(null, false); }
    else if (k === "ArrowRight") { e.preventDefault(); move(1, 0); }
    else if (k === "ArrowLeft") { e.preventDefault(); move(-1, 0); }
    else if (k === "ArrowUp") { e.preventDefault(); move(0, -1); }
    else if (k === "ArrowDown") { e.preventDefault(); move(0, 1); }
    else if (k === " ") { e.preventDefault(); advance(); }
  }
  function addSlots(n) { if (!activePart) return; const pid = activePart.id; updateActiveSong((s) => { const p = s.parts.find((p) => p.id === pid); if (p) for (let i = 0; i < n; i++) p.slots.push([null, null, null, null, null, null]); }); }
  function delSlot() { if (!activePart) return; const pid = activePart.id; updateActiveSong((s) => { const p = s.parts.find((p) => p.id === pid); if (p && p.slots.length > 1) p.slots.pop(); }); }
  function clearTab() { if (!activePart) return; const pid = activePart.id; updateActiveSong((s) => { const p = s.parts.find((p) => p.id === pid); if (p) p.slots = p.slots.map(() => [null, null, null, null, null, null]); }); }

  /* transport + scrub + clip drag */
  function togglePlay() { const p = playerRef.current; if (!p || !p.getPlayerState) return; if (p.getPlayerState() === 1) p.pauseVideo(); else p.playVideo(); }
  function stopPlay() { const p = playerRef.current; if (!p) return; if (p.seekTo) p.seekTo(0, true); if (p.pauseVideo) p.pauseVideo(); if (playheadRef.current) playheadRef.current.style.left = "0%"; if (timeReadoutRef.current) timeReadoutRef.current.textContent = "0:00 / " + fmtSec(durationRef.current); }
  function seekTo(sec, play) { const p = playerRef.current; if (p && p.seekTo) { p.seekTo(sec, true); if (play && p.playVideo) p.playVideo(); } }
  function timeFromEvent(e) { const el = trackRef.current; if (!el) return null; const rect = el.getBoundingClientRect(); const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left)); const { start, end } = timingRef.current; const span = end - start; if (span <= 0) return null; return start + (x / rect.width) * span; }
  function scrubMove(e) { const t = timeFromEvent(e); if (t == null) return; lastTimeRef.current = t; if (playheadRef.current) { const { start, end } = timingRef.current; playheadRef.current.style.left = Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100)) + "%"; playheadRef.current.style.opacity = "1"; } if (timeReadoutRef.current) timeReadoutRef.current.textContent = fmtSec(t) + " / " + fmtSec(durationRef.current); const now = performance.now(); if (now - lastSeekRef.current > 70) { lastSeekRef.current = now; seekTo(t, false); } }
  function onTrackDown(e) { const tm = timingRef.current; if (!tm || tm.end - tm.start <= 0) return; draggingRef.current = true; scrubMove(e); const mv = (ev) => { if (draggingRef.current) scrubMove(ev); }; const up = () => { draggingRef.current = false; seekTo(lastTimeRef.current, true); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); }
  function onClipDown(e, plc) {
    e.stopPropagation();
    const el = e.currentTarget;
    const rect = trackRef.current.getBoundingClientRect();
    const span = timingRef.current.end - timingRef.current.start;
    const startX = e.clientX;
    const a0 = parseTime(plc.start) || 0;
    const b0 = parseTime(plc.end);
    const dur = (b0 != null ? b0 : a0) - a0;
    let moved = false, newA = a0;
    const mv = (ev) => { const dx = ev.clientX - startX; if (Math.abs(dx) > 4) moved = true; if (moved && !ro) { newA = Math.max(0, Math.round(a0 + (dx / rect.width) * span)); el.style.left = ((newA / (timingRef.current.end || 1)) * 100) + "%"; } };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      if (moved && !ro) { updatePlacement(plc.id, (a) => { a.start = fmtSec(newA); if (dur > 0) a.end = fmtSec(newA + dur); }); }
      else if (!moved) { const now = Date.now(); if (clickRef.current.id === plc.id && now - clickRef.current.t < 350) openEditor(plc.id); else { setActivePlacementId(plc.id); seekTo(a0, true); } clickRef.current = { id: plc.id, t: now }; }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }

  /* exports */
  async function copyToClip(text, msg) { try { await navigator.clipboard.writeText(text); showToast(msg); } catch (e) { showToast("Copy failed — select manually"); } }
  function exportJson() { const blob = new Blob([JSON.stringify(songs, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "fretdeck-collection.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
  async function importJson(e) {
    if (ro || !editToken) return;
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const arr = (Array.isArray(data) ? data : [data]).map(normalizeSong);
      setSongs(arr); if (arr[0]) setActiveSongId(arr[0].id);
      for (const s of arr) { if (!s.id) s.id = uid(); await fetch("/api/songs/" + s.id + "?token=" + editToken, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) }); }
      showToast("Imported into this collection");
    } catch (err) { showToast("Import failed — invalid file"); }
    e.target.value = "";
  }

  const statusText = { saved: "saved", saving: "saving…", error: "save error" }[status] || "";
  const systemCount = activePart ? Math.max(1, Math.ceil(activePart.slots.length / ROW_SLOTS)) : 0;

  if (loadError) {
    return (
      <div className="app"><header className="deck"><div className="brand"><span className="pilot" /><div><h1>FRETDECK</h1><small>NOT FOUND</small></div></div></header>
        <div className="loading">This collection link isn&apos;t valid. <a href="/">Go to your collections →</a></div></div>
    );
  }

  return (
    <div className="app">
      <datalist id="part-types">{TYPE_SUGGESTIONS.map((t) => (<option key={t} value={t} />))}</datalist>

      <header className="deck">
        <div className="brand"><span className="pilot" /><div><h1>FRETDECK</h1><small>{collectionName || "…"}</small></div></div>
        <a className="backlink" href="/">← Collections</a>
        <span className={"ro-tag " + (ro ? "view" : "edit")}>{ro ? "read-only" : "editing"}</span>
        <button className="btn share" onClick={() => setShareOpen((v) => !v)}>Share ▾</button>
        {!ro && <div className={"status " + status}><b>●</b> {statusText}</div>}
      </header>

      {shareOpen && (
        <div className="share-panel">
          <div className="sp-head">Share — a link opens FretDeck, no download needed</div>
          {shareLinks.map((l, i) => (
            <div className="share-row" key={i}>
              <span className="share-label">{l.label}</span>
              <input className="share-url" readOnly value={l.url} onFocus={(e) => e.target.select()} />
              <button className="btn sm" onClick={() => copyToClip(l.url, "Link copied")}>Copy</button>
            </div>
          ))}
        </div>
      )}

      {ro && (<div className="ro-banner">You&apos;re viewing a shared chart (read-only). <a href="/">Make your own with FretDeck →</a></div>)}
      {!hasDb && (<div className="banner">No database connected — edits won&apos;t persist. Add a Neon Postgres store in Vercel&apos;s Storage tab, then redeploy.</div>)}

      {activeSong && (
        <div className="transport">
          <div className="tbar">
            <button className="tb-btn play" onClick={togglePlay} title="Play / Pause">{playing ? "⏸" : "▶"}</button>
            <button className="tb-btn" onClick={stopPlay} title="Stop">⏹</button>
            <span className="tcode" ref={timeReadoutRef}>0:00 / 0:00</span>
            <label className="follow"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />follow</label>
            <span className="tb-title">{activeSong.title}</span>
            <div className="mini-video"><div className="mv-host" ref={ytHostRef} />{!vid && <div className="mv-empty">no video</div>}</div>
          </div>
          {segList.length ? (
            <>
              <div className="ruler">{ticks.map((tk, i) => (<span key={i} className="rtick" style={{ left: (tk / spanEnd) * 100 + "%" }}>{fmtSec(tk)}</span>))}</div>
              <div className="timeline-track" ref={trackRef} onPointerDown={onTrackDown} style={{ height: 12 + laneCount * 38 }}>
                {placed.map((s) => {
                  const p = partById[s.partId];
                  const left = (s.a / spanEnd) * 100;
                  const width = Math.max(1.2, ((s.b - s.a) / spanEnd) * 100);
                  const linked = arrangement.filter((a) => a.partId === s.partId).length > 1;
                  return (
                    <div key={s.id} className={"tl-block" + (s.id === activePlacementId ? " active" : "") + (s.id === currentPlacementId ? " playing" : "")}
                      style={{ left: left + "%", width: width + "%", top: 6 + s.lane * 38, height: 32, background: typeColor(p?.type) }}
                      onPointerDown={(e) => onClipDown(e, s)}>
                      <div className="nm">{p?.name}{linked ? " ⟲" : ""}</div>
                      <div className="tm">{rangeLabel(s)}</div>
                    </div>
                  );
                })}
                <div className="playhead" ref={playheadRef} />
              </div>
              <div className="scrub-hint">{ro ? "click a clip or the timeline to jump · double-click a clip to view it" : "drag a clip to move it · drag empty space to scrub · double-click a clip to edit"}</div>
            </>
          ) : (
            <div className="timeline"><div className="tl-empty">{ro ? "No timed parts in this song yet." : "Give a part start/end times to build the timeline."}</div></div>
          )}
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <div className="lib-head">Songs</div>
          {songs.map((s) => (
            <div key={s.id} className={"song-item" + (s.id === activeSongId ? " active" : "")} onClick={() => setActiveSongId(s.id)}>
              <div className="t">{s.title || "Untitled"}<div className="n">{(s.arrangement || []).length} parts</div></div>
              {!ro && <button className="del" title="Delete song" onClick={(e) => { e.stopPropagation(); removeSong(s.id); }}>×</button>}
            </div>
          ))}
          {!ro && <button className="add-song" onClick={addSong}>+ Add song</button>}
        </aside>

        <main className="main">
          {activeSong ? (
            <>
              <div className="meta">
                <div className="field f-title"><label>Song</label><input disabled={ro} value={activeSong.title} onChange={(e) => updateActiveSong((s) => (s.title = e.target.value))} /></div>
                <div className="field f-artist"><label>Artist</label><input disabled={ro} value={activeSong.artist || ""} onChange={(e) => updateActiveSong((s) => (s.artist = e.target.value))} /></div>
                <div className="field f-url"><label>YouTube URL</label><input disabled={ro} value={activeSong.youtubeUrl || ""} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => updateActiveSong((s) => (s.youtubeUrl = e.target.value))} /></div>
              </div>

              <div className="parts-panel">
                <div className="pp-head">
                  <span className="sec-label">Parts</span>
                  <span className="pp-hint">{ro ? "click to jump · double-click to view" : "play the track, then tap ⊙ (or press M) at each new section"}</span>
                  {!ro && <button className="add-part-sm playhead" onClick={addPartAtPlayhead} disabled={!vid} title={vid ? "Add a part starting at the current play position (key: M)" : "Add a YouTube URL first"}>⊙ Part at playhead</button>}
                  {!ro && <button className="add-part-sm" onClick={addPart}>+ Blank part</button>}
                </div>
                <div className="chips">
                  {placements.map((plc) => {
                    const p = partById[plc.partId];
                    const linked = arrangement.filter((a) => a.partId === plc.partId).length > 1;
                    return (
                      <button key={plc.id} className={"pchip" + (plc.id === activePlacementId ? " active" : "") + (plc.id === currentPlacementId ? " playing" : "")}
                        onClick={() => { setActivePlacementId(plc.id); const a = parseTime(plc.start); if (a != null) seekTo(a, true); }}
                        onDoubleClick={() => openEditor(plc.id)}>
                        <span className="d" style={{ background: typeColor(p?.type) }} />
                        <span className="pn">{p?.name}{linked ? " ⟲" : ""}</span>
                        <span className="pt">{rangeLabel(plc)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editorOpen && activePart ? (
                <section className="edit-col">
                  <div className="editor">
                    <div className="ed-title">
                      <span>{ro ? "Viewing" : "Editing"}: <b>{activePart.name}</b>{linkCount > 1 ? <span className="linkbadge">⟲ linked ×{linkCount}</span> : null}</span>
                      <span className="ed-acts">
                        {!ro && <button className="txtbtn" onClick={() => repeatPlacement(activePlacement)}>⟲ Repeat</button>}
                        {!ro && linkCount > 1 && <button className="txtbtn" onClick={() => makeIndependent(activePlacement)}>Make a copy</button>}
                        {!ro && <button className="txtbtn danger" onClick={() => deletePlacement(activePlacement.id)}>× Delete</button>}
                        <button className="txtbtn" onClick={() => setEditorOpen(false)} title="Collapse (Esc)">✕ Close</button>
                      </span>
                    </div>
                    {!ro && linkCount > 1 && (<div className="link-note">This part repeats {linkCount}× — edits here apply to all of them. Use “Make a copy” to change just this one.</div>)}
                    <div className="ed-head">
                      <div className="field f-name"><label>Part name</label><input disabled={ro} value={activePart.name} onChange={(e) => updatePart((p) => (p.name = e.target.value))} /></div>
                      <div className="field"><label>Type</label><input disabled={ro} list="part-types" value={activePart.type} placeholder="Verse, Pre-chorus…" onChange={(e) => updatePart((p) => (p.type = e.target.value))} /></div>
                      <div className="field f-time"><label>Start</label><div className="cap"><input disabled={ro} placeholder="0:00" value={activePlacement.start} onChange={(e) => updatePlacement(activePlacement.id, (a) => (a.start = e.target.value))} />{!ro && <button className="nowbtn" disabled={!vid} onClick={() => markField("start")} title="Set to current play position">now</button>}</div></div>
                      <div className="field f-time"><label>End</label><div className="cap"><input disabled={ro} placeholder="0:00" value={activePlacement.end} onChange={(e) => updatePlacement(activePlacement.id, (a) => (a.end = e.target.value))} />{!ro && <button className="nowbtn" disabled={!vid} onClick={() => markField("end")} title="Set to current play position">now</button>}</div></div>
                    </div>

                    <div className="fx">
                      <div className="field"><label>Drive</label><select disabled={ro} value={activePart.fx.drive} onChange={(e) => updatePart((p) => (p.fx.drive = e.target.value))}>{DRIVES.map((d) => (<option key={d}>{d}</option>))}</select></div>
                      <div className="field f-delay"><label>Delay (ms)</label><input disabled={ro} type="number" placeholder="0" value={activePart.fx.delay} onChange={(e) => updatePart((p) => (p.fx.delay = e.target.value))} /></div>
                      <div className="field"><label>Reverb</label><select disabled={ro} value={activePart.fx.reverb} onChange={(e) => updatePart((p) => (p.fx.reverb = e.target.value))}>{REVERBS.map((r) => (<option key={r}>{r}</option>))}</select></div>
                      <div className="field f-other"><label>Other FX</label><input disabled={ro} placeholder="chorus, wah, octave…" value={activePart.fx.other} onChange={(e) => updatePart((p) => (p.fx.other = e.target.value))} /></div>
                      <div className="field f-notes"><label>Notes</label><input disabled={ro} placeholder="capo 2, drop D…" value={activePart.fx.notes} onChange={(e) => updatePart((p) => (p.fx.notes = e.target.value))} /></div>
                    </div>

                    <div className="sheet" tabIndex={0} ref={sheetRef} onKeyDown={onKey}>
                      {Array.from({ length: systemCount }, (_, sys) => {
                        const start = sys * ROW_SLOTS;
                        return (
                          <div className="system" key={sys}>
                            <div className="sys-head">bars {sys * 2 + 1}–{sys * 2 + 2}</div>
                            {STRINGS.map((s, si) => (
                              <div className="grow" key={si}>
                                <div className="gut">{s}</div>
                                <div className="lane">
                                  {Array.from({ length: ROW_SLOTS }, (_, j) => {
                                    const ci = start + j; const midClass = j === BAR ? " mid" : "";
                                    if (ci >= activePart.slots.length) return <div className={"cell pad" + midClass} key={j} />;
                                    const v = activePart.slots[ci][si]; const isSel = sel && sel.slot === ci && sel.str === si;
                                    return (<div key={j} className={"cell" + midClass + (isSel ? " sel" : "")} onClick={ro ? undefined : () => { setSel({ slot: ci, str: si }); sheetRef.current?.focus(); }}>{v == null ? <span className="dot" /> : <span className="num">{v}</span>}</div>);
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {!ro && (
                        <div className="sheet-foot">
                          <button className="mini" onClick={() => addSlots(BAR)}>+ bar</button>
                          <button className="mini" onClick={() => addSlots(4)}>+ 4 slots</button>
                          <button className="mini" onClick={delSlot}>– slot</button>
                          <button className="mini" onClick={clearTab}>clear</button>
                        </div>
                      )}
                    </div>

                    {!ro && (
                      <>
                        <div className="palette">
                          <span className="pl">Fret</span>
                          {Array.from({ length: 16 }, (_, f) => (<button key={f} className="fret" onClick={() => setFret(f, true)}>{f}</button>))}
                          <button className="fret special" onClick={() => setFret("x", true)}>x</button>
                          <button className="fret special" onClick={() => setFret(null, false)}>⌫</button>
                        </div>
                        <div className="hint">Click a cell, then a fret (auto-advances). Keys: <kbd>0–24</kbd> fret · <kbd>← ↑ ↓ →</kbd> move · <kbd>x</kbd> mute · <kbd>⌫</kbd> clear · <kbd>space</kbd> next.</div>
                      </>
                    )}
                  </div>

                  <div className="exports">
                    <button className="btn primary" onClick={() => exportPdf(activeSong)}>Download PDF</button>
                    <button className="btn" onClick={() => copyToClip(buildAscii(activeSong), "Tab text copied")}>Copy tab text</button>
                    <button className="btn" onClick={() => setShareOpen(true)}>Share link</button>
                    <button className="btn" onClick={exportJson}>Export JSON</button>
                    {!ro && <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>}
                    <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={importJson} />
                  </div>
                </section>
              ) : (
                <div className="edit-closed">
                  <span>{ro ? "Double-click a part to view its tab & tone." : "Double-click a part to edit its tab & tone."}</span>
                  <div className="ec-exports">
                    <button className="btn primary" onClick={() => exportPdf(activeSong)}>Download PDF</button>
                    <button className="btn" onClick={() => copyToClip(buildAscii(activeSong), "Tab text copied")}>Copy tab text</button>
                    <button className="btn" onClick={() => setShareOpen(true)}>Share link</button>
                    <button className="btn" onClick={exportJson}>Export JSON</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="loading">{loading ? "Loading…" : (ro ? "This collection has no songs yet." : "No song selected — add one on the left.")}</div>
          )}
        </main>
      </div>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}
