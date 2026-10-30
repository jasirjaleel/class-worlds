import type { NextRequest } from "next/server";
import { bus, getClassroom, type ClassEvent } from "@/lib/server/db";

// Live updates for the class screen and remotes (Server-Sent Events).
// The first message is the current classroom; then one message per change.

export async function GET(req: NextRequest, ctx: RouteContext<"/api/classes/[id]/events">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return new Response("Invalid class id", { status: 400 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ClassEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      send({ type: "changed", classroom: getClassroom(id) });

      bus.on(id, send);
      // Comment line every 20s so proxies and school networks keep the connection open
      const ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 20_000);
      cleanup = () => {
        clearInterval(ping);
        bus.off(id, send);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
