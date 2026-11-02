import { NextResponse, type NextRequest } from "next/server";
import { WORLDS } from "@/game/worlds/registry";
import { isReason } from "@/lib/reasons";
import { denyClassAccess, isUuid } from "@/lib/server/access";
import {
  addStudents,
  awardPoints,
  deleteClass,
  getClassroom,
  removeStudent,
  undoLast,
  updateSettings,
} from "@/lib/server/db";
import type { WorldId } from "@/lib/types";

const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/classes/[id]">) {
  const { id } = await ctx.params;
  const denied = await denyClassAccess(id);
  if (denied) return denied;
  return NextResponse.json(await getClassroom(id));
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/classes/[id]">) {
  const { id } = await ctx.params;
  const denied = await denyClassAccess(id);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return bad("Missing action");

  switch (body.action) {
    case "award": {
      const amount = body.amount === undefined ? 1 : Number(body.amount);
      if (typeof body.studentId !== "string" || !Number.isInteger(amount) || Math.abs(amount) > 10) return bad("Bad award");
      const known = (await getClassroom(id))?.students.some((s) => s.id === body.studentId);
      if (!known) return bad("Unknown student");
      if (body.reason !== undefined && !isReason(body.reason)) return bad("Unknown reason");
      return NextResponse.json(await awardPoints(id, body.studentId, amount, body.reason ?? null));
    }
    case "undo":
      return NextResponse.json(await undoLast(id));
    case "settings": {
      const patch: { name?: string; worldId?: WorldId; lowGraphics?: boolean; showScores?: boolean } = {};
      if (typeof body.name === "string") patch.name = body.name.slice(0, 60);
      if (typeof body.worldId === "string") {
        if (!WORLDS.some((w) => w.id === body.worldId)) return bad("Unknown world");
        patch.worldId = body.worldId as WorldId;
      }
      if (typeof body.lowGraphics === "boolean") patch.lowGraphics = body.lowGraphics;
      if (typeof body.showScores === "boolean") patch.showScores = body.showScores;
      return NextResponse.json(await updateSettings(id, patch));
    }
    case "addStudents": {
      const names = Array.isArray(body.names)
        ? body.names.filter((n): n is string => typeof n === "string").map((n) => n.trim().slice(0, 30)).filter(Boolean)
        : [];
      if (!names.length || names.length > 60) return bad("Add 1 to 60 names");
      return NextResponse.json(await addStudents(id, names));
    }
    case "removeStudent":
      if (!isUuid(body.studentId)) return bad("Missing student");
      return NextResponse.json(await removeStudent(id, body.studentId));
    case "delete":
      await deleteClass(id);
      return NextResponse.json({ deleted: true });
    default:
      return bad("Unknown action");
  }
}
