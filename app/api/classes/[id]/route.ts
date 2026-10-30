import { NextResponse, type NextRequest } from "next/server";
import { WORLDS } from "@/game/worlds/registry";
import {
  addStudents,
  awardPoints,
  getClassroom,
  removeStudent,
  resetClass,
  undoLast,
  updateSettings,
} from "@/lib/server/db";
import type { WorldId } from "@/lib/types";

// Prototype API: no teacher login yet, so it is only meant for the local network.

const validId = (id: string) => /^[a-z0-9-]{1,40}$/.test(id);
const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/classes/[id]">) {
  const { id } = await ctx.params;
  if (!validId(id)) return bad("Invalid class id");
  return NextResponse.json(getClassroom(id));
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/classes/[id]">) {
  const { id } = await ctx.params;
  if (!validId(id)) return bad("Invalid class id");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return bad("Missing action");

  switch (body.action) {
    case "award": {
      const amount = body.amount === undefined ? 1 : Number(body.amount);
      if (typeof body.studentId !== "string" || !Number.isInteger(amount) || Math.abs(amount) > 10) return bad("Bad award");
      const known = getClassroom(id).students.some((s) => s.id === body.studentId);
      if (!known) return bad("Unknown student");
      return NextResponse.json(awardPoints(id, body.studentId, amount));
    }
    case "undo":
      return NextResponse.json(undoLast(id));
    case "settings": {
      const patch: { name?: string; worldId?: WorldId; lowGraphics?: boolean } = {};
      if (typeof body.name === "string") patch.name = body.name.slice(0, 60);
      if (typeof body.worldId === "string") {
        if (!WORLDS.some((w) => w.id === body.worldId)) return bad("Unknown world");
        patch.worldId = body.worldId as WorldId;
      }
      if (typeof body.lowGraphics === "boolean") patch.lowGraphics = body.lowGraphics;
      return NextResponse.json(updateSettings(id, patch));
    }
    case "addStudents": {
      const names = Array.isArray(body.names)
        ? body.names.filter((n): n is string => typeof n === "string").map((n) => n.trim().slice(0, 30)).filter(Boolean)
        : [];
      if (!names.length || names.length > 60) return bad("Add 1 to 60 names");
      return NextResponse.json(addStudents(id, names));
    }
    case "removeStudent":
      if (typeof body.studentId !== "string") return bad("Missing student");
      return NextResponse.json(removeStudent(id, body.studentId));
    case "reset":
      return NextResponse.json(resetClass(id));
    default:
      return bad("Unknown action");
  }
}
