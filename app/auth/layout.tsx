import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Incantr",
  description: "Sign in to Incantr.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen w-full flex items-center justify-center px-4">{children}</div>;
}
