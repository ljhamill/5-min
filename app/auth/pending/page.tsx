export default function PendingApprovalPage() {
  return (
    <div
      className="w-full max-w-sm p-8 rounded-xl flex flex-col items-center gap-4 text-center"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L18 10L10 18L2 10L10 2Z" fill="var(--accent)" />
          <path d="M10 5L15 10L10 15L5 10L10 5Z" fill="var(--bg-surface)" />
        </svg>
        <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          INCANTR
        </span>
      </div>

      <span
        className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wide"
        style={{
          background: "var(--bg-overlay)",
          color: "var(--text-dim)",
          border: "1px solid var(--border)",
        }}
      >
        Closed beta
      </span>

      <h1 className="text-[16px] font-semibold text-[var(--text-primary)]">
        You're on the waitlist
      </h1>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
        You're signed in, but the terminal isn't open to your account yet.
        We're letting people into the beta gradually and will open it up for
        you as soon as we can — no need to do anything else.
      </p>
    </div>
  );
}
