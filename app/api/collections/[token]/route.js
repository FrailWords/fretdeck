import { NextResponse } from "next/server";
import { resolveToken, deleteCollection, renameCollection, hasDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  try {
    const { token } = await params;
    const r = await resolveToken(token);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...r, hasDb });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { token } = await params; // edit token
    const body = await req.json();
    const r = await renameCollection(token, body.name || "");
    if (r.error) return NextResponse.json(r, { status: 403 });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { token } = await params; // edit token
    const r = await deleteCollection(token);
    if (r.error) return NextResponse.json(r, { status: 403 });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
