import type { Metadata, Viewport } from "next";
import { Bungee, Nunito } from "next/font/google";
import "./globals.css";

const display = Bungee({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Class Worlds",
  description: "A blocky 3D classroom world that grows with every reward.",
};

export const viewport: Viewport = {
  themeColor: "#0b1026",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
