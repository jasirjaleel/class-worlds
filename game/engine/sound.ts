// Sound effects, made in code so nothing has to be downloaded. There is no music:
// every sound is filtered noise or one single pitch glide, never notes in a row,
// so no sound can turn into a tune. Sounds stay short so they don't disturb a lesson.

export const SOUNDS = {
  hammer: "Hammer tap and block",
  hum: "City lights switching on",
  metalClick: "Rocket part clicking in",
  whoosh: "Rocket flying",
  rumble: "Deep rumble",
  crack: "Eggshell crack",
  shellBreak: "Egg hatching",
  squeak: "Baby dinosaur squeak",
  rustle: "Soil and leaves",
  breeze: "Soft breeze",
  birds: "Birdsong",
  burner: "Balloon burner",
  wind: "Wind",
  sail: "Sail filling and wood creaking",
  waves: "Waves",
  gulls: "Seagulls",
  step: "Class step reached",
  click: "Button click",
  undo: "Undo",
} as const;

export type SoundName = keyof typeof SOUNDS;

interface NoiseOptions {
  type: BiquadFilterType;
  f: number;
  fEnd?: number;
  q?: number;
  gain: number;
  attack?: number;
}

interface ToneOptions {
  f: number;
  fEnd: number;
  type?: OscillatorType;
  gain: number;
  attack?: number;
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(c);
  if (!buffer) {
    buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(c, buffer);
  }
  return buffer;
}

function envelope(c: BaseAudioContext, t: number, d: number, peak: number, attack: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  return g;
}

function noise(c: BaseAudioContext, out: AudioNode, t: number, d: number, o: NoiseOptions) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.type;
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.f, t);
  if (o.fEnd) filter.frequency.exponentialRampToValueAtTime(o.fEnd, t + d);
  src.connect(filter).connect(envelope(c, t, d, o.gain, o.attack ?? 0.004)).connect(out);
  src.start(t, Math.random());
  src.stop(t + d + 0.02);
}

/** One pitch sliding once. Used only for thuds, a squeak and bird or gull calls. */
function glide(c: BaseAudioContext, out: AudioNode, t: number, d: number, o: ToneOptions) {
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, t);
  osc.frequency.exponentialRampToValueAtTime(o.fEnd, t + d);
  osc.connect(envelope(c, t, d, o.gain, o.attack ?? 0.004)).connect(out);
  osc.start(t);
  osc.stop(t + d + 0.02);
}

function tick(c: BaseAudioContext, out: AudioNode, t: number, gain: number, f = 2200) {
  noise(c, out, t, 0.025, { type: "highpass", f, gain, attack: 0.001 });
}

function synth(c: BaseAudioContext, out: AudioNode, t: number, name: SoundName) {
  switch (name) {
    case "hammer":
      glide(c, out, t, 0.09, { f: 190, fEnd: 70, gain: 0.5, attack: 0.002 });
      tick(c, out, t, 0.25, 1800);
      noise(c, out, t + 0.1, 0.09, { type: "lowpass", f: 900, gain: 0.3 });
      break;
    case "hum":
      noise(c, out, t, 0.12, { type: "highpass", f: 2500, gain: 0.18, attack: 0.001 });
      glide(c, out, t, 0.9, { f: 100, fEnd: 100, type: "sawtooth", gain: 0.1, attack: 0.15 });
      break;
    case "metalClick":
      noise(c, out, t, 0.04, { type: "bandpass", f: 3400, q: 8, gain: 3, attack: 0.001 });
      noise(c, out, t + 0.055, 0.03, { type: "bandpass", f: 2600, q: 8, gain: 1.6, attack: 0.001 });
      break;
    case "whoosh":
      noise(c, out, t, 0.75, { type: "bandpass", f: 280, fEnd: 2600, q: 0.9, gain: 1.3, attack: 0.25 });
      break;
    case "rumble":
      noise(c, out, t, 1.5, { type: "lowpass", f: 170, fEnd: 70, gain: 3.5, attack: 0.2 });
      break;
    case "crack":
      tick(c, out, t, 0.42);
      tick(c, out, t + 0.032, 0.25, 2800);
      tick(c, out, t + 0.085, 0.35, 1900);
      break;
    case "shellBreak":
      glide(c, out, t, 0.1, { f: 150, fEnd: 70, gain: 0.5, attack: 0.002 });
      for (const [offset, gain] of [[0, 0.48], [0.03, 0.35], [0.07, 0.45], [0.12, 0.28], [0.18, 0.24], [0.26, 0.15]]) {
        tick(c, out, t + offset, gain, 1500 + Math.random() * 1800);
      }
      break;
    case "squeak":
      glide(c, out, t, 0.16, { f: 780, fEnd: 1500, type: "triangle", gain: 0.3, attack: 0.02 });
      break;
    case "rustle":
      for (let i = 0; i < 6; i++) {
        noise(c, out, t + i * 0.06 + Math.random() * 0.02, 0.07, { type: "bandpass", f: 3000 + Math.random() * 2500, q: 0.7, gain: 0.42, attack: 0.01 });
      }
      break;
    case "breeze":
      noise(c, out, t, 1.6, { type: "bandpass", f: 500, fEnd: 950, q: 0.5, gain: 0.45, attack: 0.5 });
      break;
    case "birds":
      // a few separate calls at random pitches and gaps, so they never form a melody
      for (let i = 0, at = 0; i < 4; i++, at += 0.09 + Math.random() * 0.18) {
        const f = 3000 + Math.random() * 1400;
        glide(c, out, t + at, 0.07, { f, fEnd: f * (0.82 + Math.random() * 0.4), gain: 0.18, attack: 0.008 });
      }
      break;
    case "burner":
      noise(c, out, t, 0.6, { type: "lowpass", f: 800, fEnd: 500, gain: 0.8, attack: 0.04 });
      noise(c, out, t, 0.5, { type: "highpass", f: 3000, gain: 0.06, attack: 0.04 });
      break;
    case "wind":
      noise(c, out, t, 1.5, { type: "bandpass", f: 380, fEnd: 1000, q: 0.7, gain: 0.65, attack: 0.6 });
      break;
    case "sail":
      noise(c, out, t, 0.55, { type: "bandpass", f: 450, fEnd: 1100, q: 0.6, gain: 0.9, attack: 0.15 });
      for (let i = 0, at = 0.08; i < 7; i++, at += 0.055 - i * 0.003) {
        noise(c, out, t + at, 0.02, { type: "bandpass", f: 650, q: 6, gain: 0.8, attack: 0.002 });
      }
      break;
    case "waves":
      noise(c, out, t, 1.7, { type: "lowpass", f: 450, fEnd: 2200, gain: 0.7, attack: 0.65 });
      break;
    case "gulls":
      for (let i = 0, at = 0; i < 2; i++, at += 0.32 + Math.random() * 0.15) {
        const f = 1300 + Math.random() * 300;
        glide(c, out, t + at, 0.26, { f, fEnd: f * 0.62, type: "triangle", gain: 0.24, attack: 0.03 });
      }
      break;
    case "step":
      noise(c, out, t, 0.9, { type: "highpass", f: 1500, fEnd: 4500, gain: 0.16, attack: 0.25 });
      glide(c, out, t, 0.28, { f: 90, fEnd: 55, gain: 0.45, attack: 0.02 });
      break;
    case "click":
      tick(c, out, t, 0.14, 1500);
      break;
    case "undo":
      glide(c, out, t, 0.08, { f: 220, fEnd: 130, gain: 0.35, attack: 0.002 });
      break;
  }
}

// --- Playing, and the teacher's on/off and volume

export interface SoundState {
  enabled: boolean;
  volume: number;
  /** Browsers keep sound blocked until someone clicks the page. */
  running: boolean;
}

const STORAGE_KEY = "cw:sound";
const OFF: SoundState = { enabled: false, volume: 0.7, running: false };

let state = OFF;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const lastPlayed = new Map<SoundName, number>();

function setState(patch: Partial<SoundState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof AudioContext === "undefined") return null;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = state.volume;
  // keeps overlapping sounds from getting harshly loud
  master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
  ctx.onstatechange = () => setState({ running: ctx?.state === "running" });
  return ctx;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: state.enabled, volume: state.volume }));
  } catch {
    // no saved choice this time; sound still works until the page closes
  }
}

function loadChoice() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved) setState({ enabled: saved.enabled === true, volume: clampVolume(saved.volume) });
  } catch {
    // nothing usable saved: stay off
  }
}

export function clampVolume(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : OFF.volume;
}

export const getSoundState = () => state;
export const getServerSoundState = () => OFF;

export function subscribeSound(listener: () => void): () => void {
  loadChoice();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSoundEnabled(enabled: boolean) {
  setState({ enabled });
  save();
  if (enabled) void ensureContext()?.resume();
}

export function setSoundVolume(volume: number) {
  setState({ volume: clampVolume(volume) });
  if (master) master.gain.value = state.volume;
  save();
}

function start(name: SoundName) {
  if (!ctx || !master || ctx.state !== "running") return;
  // the same sound twice in a blink would only sound like a glitch
  const now = ctx.currentTime;
  if (now - (lastPlayed.get(name) ?? -1) < 0.06) return;
  lastPlayed.set(name, now);
  synth(ctx, master, now + 0.005, name);
}

/** Plays a sound if the teacher has turned sound on. Safe to call from anywhere. */
export function playSound(name: SoundName, delay = 0) {
  if (!state.enabled) return;
  if (delay > 0) setTimeout(() => start(name), delay * 1000);
  else start(name);
}

/** Plays a sound from a preview button, even if sound is turned off. */
export function previewSound(name: SoundName) {
  const c = ensureContext();
  if (!c) return;
  void c.resume().then(() => start(name));
}

/** Unlocks sound on the first click, and gives menu buttons their soft click. */
export function startSoundListeners(): () => void {
  loadChoice();
  const onGesture = () => {
    if (state.enabled) void ensureContext()?.resume();
  };
  const onClick = (e: MouseEvent) => {
    if ((e.target as Element | null)?.closest?.(".cw-menu-btn, .cw-control, .cw-world-card")) playSound("click");
  };
  document.addEventListener("pointerdown", onGesture);
  document.addEventListener("keydown", onGesture);
  document.addEventListener("click", onClick);
  return () => {
    document.removeEventListener("pointerdown", onGesture);
    document.removeEventListener("keydown", onGesture);
    document.removeEventListener("click", onClick);
  };
}
