import { NextResponse } from "next/server";
import { listCollections, createCollection, hasDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const collections = await listCollections();
    return NextResponse.json({ collections, hasDb });
  } catch (e) {
    return NextResponse.json({ error: String(e), collections: [], hasDb }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const c = await createCollection(body.name);
    return NextResponse.json({ collection: c });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
