import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "5 Min Terminal",
  description: "Trade Polymarket 5-minute crypto markets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
