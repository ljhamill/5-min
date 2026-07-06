import type { Metadata } from "next";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "5 Min Terminal",
  description: "Trade Polymarket 5-minute crypto markets",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="h-dvh overflow-hidden">{children}</div>
    </Providers>
  );
}
