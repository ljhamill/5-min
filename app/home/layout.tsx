import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Incantr — The terminal for Polymarket sharps",
  description:
    "Incantr brings orderbooks, model probabilities, and market data from across the web onto one screen — so sharp traders can trade Polymarket with an edge. Join the closed beta waitlist.",
  openGraph: {
    title: "Incantr — The terminal for Polymarket sharps",
    description:
      "All your Polymarket data, one screen. Join the closed beta waitlist.",
    type: "website",
  },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen w-full overflow-x-hidden">{children}</div>;
}
