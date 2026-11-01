"use client";

import { useEffect } from "react";
import { startSoundListeners } from "@/game/engine/sound";

/** Lets sound start on the teacher's first click, on whichever page they open first. */
export default function SoundListeners() {
  useEffect(() => startSoundListeners(), []);
  return null;
}
