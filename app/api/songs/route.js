import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { listSongs, saveSong, hasDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const songs = await listSongs();
    return NextResponse.json({ songs, hasDb });
  } catch (e) {
    return NextResponse.json({ error: String(e), songs: [], hasDb }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const song = { ...body, id: body.id || randomUUID() };
    await saveSong(song);
    return NextResponse.json({ song });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
