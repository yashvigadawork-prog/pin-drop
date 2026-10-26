import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Pin Drop: franchise partner engine",
  description: "Screens franchise applications, gives every territory slot to the strongest partner (one store per pin), keeps valid but unserved pins for later, and runs onboarding. Every recommendation is explained and the owner decides.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${sora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
