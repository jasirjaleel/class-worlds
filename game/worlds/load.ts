import type { WorldId } from "@/lib/types";
import type { CreateWorld } from "./types";

/** Each world is loaded only when it is played. */
export async function loadWorld(id: WorldId): Promise<CreateWorld> {
  switch (id) {
    case "space-fleet":
      return (await import("./space-fleet/scene")).createSpaceFleet;
    case "hot-air-balloons":
      return (await import("./hot-air-balloons/scene")).createHotAirBalloons;
    case "dino-eggs":
      return (await import("./dino-eggs/scene")).createDinoEggs;
    case "garden":
      return (await import("./garden/scene")).createGarden;
    case "build-the-city":
      return (await import("./build-the-city/scene")).createBuildTheCity;
    case "ship-voyage":
      return (await import("./ship-voyage/scene")).createShipVoyage;
  }
}
