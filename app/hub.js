"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Hub() {
  const [cols, setCols] = useState([]);
  const [hasDb, setHasDb] = useState(true);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [openLink, setOpenLink] = useState("");
  const [toast, setToast] = useState("");
  const router = useRouter();

  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 1500); };

  async function load() {
    try {
      const r = await fetch("/api/collections");
      const j = await r.json();
      setCols(j.collections || []);
      setHasDb(j.hasDb !== false);
    } catch (e) {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const r = await fetch("/api/collections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "Untitled collection" }),
    });
    const j = await r.json();
    if (j.collection) router.push("/c/" + j.collection.editToken);
  }
  function open() {
    const m = openLink.trim().match(/\/c\/([\w-]+)/);
    const t = m ? m[1] : openLink.trim();
    if (t) router.push("/c/" + t);
  }
  async function del(editToken, name) {
    if (!confirm("Delete “" + name + "” and all its songs? This cannot be undone.")) return;
    await fetch("/api/collections/" + editToken, { method: "DELETE" });
    load();
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); ping(msg); } catch (e) { ping("Copy failed"); }
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="hub">
      <header className="deck">
        <div className="brand">
          <span className="pilot" />
          <div><h1>FRETDECK</h1><small>SONG COLLECTIONS</small></div>
        </div>
      </header>

      {!hasDb && (
        <div className="banner">No database connected — changes won&apos;t persist. Add a Neon Postgres store in Vercel&apos;s Storage tab, then redeploy.</div>
      )}

      <div className="hub-grid">
        <section className="hub-card">
          <div className="hc-head">New collection</div>
          <p className="hc-sub">A collection is a shareable set of songs — your setlist, a covers list, one per band.</p>
          <div className="hc-row">
            <input className="hc-input" placeholder="Collection name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
            <button className="btn primary" onClick={create}>Create</button>
          </div>
          <div className="hc-head" style={{ marginTop: 18 }}>Open by link</div>
          <div className="hc-row">
            <input className="hc-input" placeholder="Paste a /c/… link or token" value={openLink} onChange={(e) => setOpenLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && open()} />
            <button className="btn" onClick={open}>Open</button>
          </div>
        </section>

        <section className="hub-card">
          <div className="hc-head">Your collections</div>
          {loading ? (
            <div className="hc-sub">Loading…</div>
          ) : cols.length === 0 ? (
            <div className="hc-sub">No collections yet — create one to get started.</div>
          ) : (
            <div className="col-list">
              {cols.map((c) => (
                <div className="col-row" key={c.id}>
                  <div className="cr-main" onClick={() => router.push("/c/" + c.editToken)}>
                    <div className="cr-name">{c.name}</div>
                    <div className="cr-sub">{c.songCount} song{c.songCount === 1 ? "" : "s"}</div>
                  </div>
                  <div className="cr-acts">
                    <button className="btn sm" onClick={() => router.push("/c/" + c.editToken)}>Open</button>
                    <button className="btn sm" onClick={() => copy(origin + "/c/" + c.viewToken, "Read-only link copied")}>Copy view link</button>
                    <button className="btn sm" onClick={() => copy(origin + "/c/" + c.editToken, "Edit link copied")}>Copy edit link</button>
                    <button className="btn sm danger" onClick={() => del(c.editToken, c.name)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="hc-foot">This page lists every collection in your library — keep its URL to yourself. Share individual collections with the per-collection links.</p>
        </section>
      </div>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}
