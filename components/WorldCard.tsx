import Image from "next/image";
import type { WorldMeta } from "@/game/worlds/registry";

/** A world shown as a real picture from the game. The name sits on the picture. */
export default function WorldCard({
  world,
  active,
  sizes,
  onSelect,
}: {
  world: WorldMeta;
  active: boolean;
  sizes: string;
  onSelect: () => void;
}) {
  return (
    <button
      disabled={!world.ready}
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className="cw-world-card aspect-[16/10] disabled:cursor-not-allowed"
    >
      <Image src={`/worlds/${world.id}.jpg`} alt="" fill sizes={sizes} className="object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      {(active || !world.ready) && (
        <span className={`cw-chip absolute right-2 top-2 ${active ? "cw-chip-gold" : ""}`}>
          {active ? "Playing" : "Soon"}
        </span>
      )}
      <span className="cw-heading absolute inset-x-3 bottom-2.5 text-sm leading-tight text-white">{world.name}</span>
    </button>
  );
}
