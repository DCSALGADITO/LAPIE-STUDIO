import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LAPIE Studio — Self-Hosted Image Processing",
  description:
    "Studio de transformation d'image 100% self-hosted. Suppression de fond (RMBG-1.4) et vectorisation (potrace) — gratuit, illimité, local.",
  keywords: ["background removal", "vectorization", "potrace", "rembg", "self-hosted"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-void text-ink-primary min-h-screen">
        {children}
      </body>
    </html>
  );
}
