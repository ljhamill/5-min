export function PricingScaffold() {
  return (
    <section className="px-4 sm:px-8 py-16 sm:py-20 border-t border-[var(--border)]">
      <div className="max-w-3xl mx-auto text-center mb-10">
        <h2 className="text-[22px] sm:text-[28px] font-semibold text-[var(--text-primary)] mb-3">
          Simple pricing
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
          No subscription. You only pay a small builder fee on trades placed
          through the terminal — nothing when you're just watching the market.
        </p>
      </div>

      <div
        className="max-w-sm mx-auto p-6 sm:p-8 rounded-lg text-center"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)] mb-1">
          Builder fee
        </div>
        <div className="text-[36px] font-semibold text-[var(--text-primary)] mb-1">
          TBD<span className="text-[18px] text-[var(--text-secondary)]">%</span>
        </div>
        <div className="text-[12px] text-[var(--text-dim)] mb-6">per executed trade</div>

        <ul className="text-left flex flex-col gap-2 text-[13px] text-[var(--text-secondary)]">
          <li className="flex items-start gap-2">
            <span style={{ color: "var(--green)" }}>✓</span>
            Full terminal access — data, charts, orderbooks
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "var(--green)" }}>✓</span>
            No monthly fee, no minimums
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "var(--green)" }}>✓</span>
            Pricing finalized before beta trading opens
          </li>
        </ul>
      </div>
    </section>
  );
}
