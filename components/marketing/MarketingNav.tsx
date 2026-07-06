export function MarketingNav() {
  return (
    <header
      className="flex items-center justify-between px-4 sm:px-8 h-16 border-b border-[var(--border)] sticky top-0 z-10 backdrop-blur-sm"
      style={{ background: "rgba(12,12,16,0.85)" }}
    >
      <a href="#" className="flex items-center gap-2 shrink-0">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L18 10L10 18L2 10L10 2Z" fill="var(--accent)" />
          <path d="M10 5L15 10L10 15L5 10L10 5Z" fill="var(--bg-base)" />
        </svg>
        <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          INCANTR
        </span>
      </a>

      <div className="flex items-center gap-2 sm:gap-3">
        <a
          href="#waitlist"
          className="px-4 py-2 rounded text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:inline-block"
        >
          Join the beta
        </a>
        <a
          href="https://trade.incantr.com"
          className="px-4 py-2 rounded-full text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          Enter terminal →
        </a>
      </div>
    </header>
  );
}
