import type { WorldId } from "@/lib/types";
import type { CreateWorld } from "./types";

/** Each world is loaded only when it is played. Unfinished worlds fall back to Space Fleet. */
export async function loadWorld(id: WorldId): Promise<CreateWorld> {
  switch (id) {
    case "space-fleet":
    default:
      return (await import("./space-fleet/scene")).createSpaceFleet;
  }
}
