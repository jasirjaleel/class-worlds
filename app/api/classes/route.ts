import { NextResponse, type NextRequest } from "next/server";
import { getTeacherId } from "@/lib/auth";
import { createClass, listClasses } from "@/lib/server/db";

/** The signed-in teacher's classes. Being signed out is a normal answer here: the menu is public. */
export async function GET() {
  const teacherId = await getTeacherId();
  if (!teacherId) return NextResponse.json({ signedIn: false, classes: [] });
  return NextResponse.json({ signedIn: true, classes: await listClasses(teacherId) });
}

export async function POST(req: NextRequest) {
  const teacherId = await getTeacherId();
  if (!teacherId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Give the class a name" }, { status: 400 });
  return NextResponse.json(await createClass(teacherId, name));
}
