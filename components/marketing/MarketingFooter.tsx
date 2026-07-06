export function MarketingFooter() {
  return (
    <footer className="px-4 sm:px-8 py-8 border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L18 10L10 18L2 10L10 2Z" fill="var(--text-dim)" />
            <path d="M10 5L15 10L10 15L5 10L10 5Z" fill="var(--bg-base)" />
          </svg>
          <span className="text-[12px] text-[var(--text-dim)]">
            © {new Date().getFullYear()} Incantr
          </span>
        </div>

        <div className="flex items-center gap-5 text-[12px] text-[var(--text-dim)]">
          <a href="https://trade.incantr.com" className="hover:text-[var(--text-secondary)] transition-colors">
            Enter terminal
          </a>
          <a href="#" className="hover:text-[var(--text-secondary)] transition-colors">
            Terms
          </a>
          <a href="#" className="hover:text-[var(--text-secondary)] transition-colors">
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );
}
