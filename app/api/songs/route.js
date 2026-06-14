import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveSong } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const body = await req.json();
    const song = { ...body, id: body.id || randomUUID() };
    const r = await saveSong(song, token);
    if (r.error) return NextResponse.json(r, { status: 403 });
    return NextResponse.json({ song });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
