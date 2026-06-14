import { NextResponse } from "next/server";
import { saveSong, deleteSong } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get("token");
    const body = await req.json();
    const song = { ...body, id };
    const r = await saveSong(song, token);
    if (r.error) return NextResponse.json(r, { status: 403 });
    return NextResponse.json({ song });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get("token");
    const r = await deleteSong(id, token);
    if (r.error) return NextResponse.json(r, { status: 403 });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
