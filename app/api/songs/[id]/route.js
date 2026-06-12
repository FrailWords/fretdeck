import { NextResponse } from "next/server";
import { getSong, saveSong, deleteSong } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { id } = await params;
  const song = await getSong(id);
  if (!song) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ song });
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const song = { ...body, id };
    await saveSong(song);
    return NextResponse.json({ song });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    await deleteSong(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
