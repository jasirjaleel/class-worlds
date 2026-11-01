import type { ReactNode } from "react";

// Small line icons, drawn on a 24-unit grid. They take the colour of the text around them.

function Icon({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type Props = { size?: number };

export const ArrowRight = (p: Props) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ArrowLeft = (p: Props) => <Icon {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Icon>;
export const Phone = (p: Props) => <Icon {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></Icon>;
export const Book = (p: Props) => <Icon {...p}><path d="M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2Z" /><path d="M12 6.5v14" /></Icon>;
export const Undo = (p: Props) => <Icon {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Icon>;
export const Star = (p: Props) => <Icon {...p}><path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8L12 3Z" /></Icon>;
export const SoundOn = (p: Props) => <Icon {...p}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" /></Icon>;
export const SoundOff = (p: Props) => <Icon {...p}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" /><path d="m16 10 4 4M20 10l-4 4" /></Icon>;
export const Plus = (p: Props) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const Close = (p: Props) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const Sliders = (p: Props) => <Icon {...p}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></Icon>;
