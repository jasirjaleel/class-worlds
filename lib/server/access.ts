import "server-only";
import { NextResponse } from "next/server";
import { getTeacherId } from "@/lib/auth";
import { isOwner } from "./db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/**
 * The response to send when this visitor may not use this class, or null when they may.
 * Another teacher's class looks the same as one that doesn't exist.
 */
export async function denyClassAccess(id: string): Promise<NextResponse | null> {
  const teacherId = await getTeacherId();
  if (!teacherId) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  if (!isUuid(id) || !(await isOwner(teacherId, id))) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  return null;
}
