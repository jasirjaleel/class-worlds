import { networkInterfaces } from "node:os";
import { connection, NextResponse } from "next/server";

/** This computer's address on the Wi-Fi, so the QR code points phones at it instead of "localhost". */
export async function GET() {
  await connection(); // read the address on each request, not at build time
  const ip = Object.values(networkInterfaces())
    .flat()
    .find((a) => a && a.family === "IPv4" && !a.internal)?.address;
  return NextResponse.json({ ip: ip ?? null });
}
