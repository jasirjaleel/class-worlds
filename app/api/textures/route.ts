import { readdir } from "node:fs/promises";
import path from "node:path";
import { connection, NextResponse } from "next/server";

/** Planet photo files present in public/textures/solar/ (optional; drawn surfaces are used otherwise). */
export async function GET() {
  await connection();
  const dir = path.join(process.cwd(), "public", "textures", "solar");
  const files = await readdir(dir).catch(() => [] as string[]);
  return NextResponse.json({ files: files.filter((f) => /\.(jpg|png)$/i.test(f)) });
}
