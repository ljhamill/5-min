export function ClosedBetaBand() {
  return (
    <section className="px-4 sm:px-8 py-16 sm:py-20 border-t border-[var(--border)]">
      <div
        className="max-w-3xl mx-auto text-center p-8 sm:p-12 rounded-xl"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <span
          className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wide mb-4"
          style={{
            background: "var(--bg-overlay)",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
          }}
        >
          Closed beta
        </span>
        <h2 className="text-[22px] sm:text-[28px] font-semibold text-[var(--text-primary)] mb-3">
          We're onboarding traders gradually
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
          Incantr is currently in closed beta while we tighten up execution and
          onboard the right early users. Join the waitlist and we'll invite you
          in as we open up more spots.
        </p>
        <a
          href="#waitlist"
          className="inline-block mt-6 px-5 py-2.5 rounded-full text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          Join the waitlist
        </a>
      </div>
    </section>
  );
}
