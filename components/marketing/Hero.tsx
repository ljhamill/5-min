import { WaitlistForm } from "@/components/marketing/WaitlistForm";

export function Hero() {
  return (
    <section className="px-4 sm:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-6">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid rgba(79,92,240,0.25)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "var(--accent)" }} />
          Closed beta
        </span>

        <h1 className="text-[32px] sm:text-[48px] leading-[1.1] font-semibold text-[var(--text-primary)] tracking-tight">
          The terminal for<br />Polymarket sharps
        </h1>

        <p className="text-[15px] sm:text-[17px] text-[var(--text-secondary)] max-w-xl leading-relaxed">
          Incantr brings orderbooks, model probabilities, and market data from
          across the web onto one screen — so you can find the edge and trade
          Polymarket with the tools sharps actually need.
        </p>

        <div id="waitlist" className="w-full max-w-md pt-2 scroll-mt-24">
          <WaitlistForm source="hero" />
          <p className="text-[11px] text-[var(--text-dim)] mt-3">
            We're onboarding beta users gradually. Join the waitlist to get early access.
          </p>
        </div>
      </div>
    </section>
  );
}
