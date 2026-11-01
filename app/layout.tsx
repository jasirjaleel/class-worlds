import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import SoundListeners from "@/components/SoundListeners";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });
const body = Figtree({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Class Worlds",
  description: "Reward your class from your phone and watch their world grow on the big screen.",
};

export const viewport: Viewport = {
  themeColor: "#070b18",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SoundListeners />
        {children}
      </body>
    </html>
  );
}
