const PROPS = [
  {
    title: "All your data, one screen",
    body:
      "Orderbooks, live asset prices, and Polymarket odds — pulled together into a single terminal instead of a dozen open tabs.",
  },
  {
    title: "Find the edge",
    body:
      "See our model's probability estimate lined up against the market price in real time, so mispriced markets stand out immediately.",
  },
  {
    title: "Built for speed",
    body:
      "A fast, keyboard-friendly terminal designed around how sharps actually trade short-dated markets, not a retail dashboard.",
  },
  {
    title: "Built for sharps",
    body:
      "No noise, no gamification — just the data and tools you need to make a fast, informed decision and get in and out of a market.",
  },
];

export function ValueProps() {
  return (
    <section className="px-4 sm:px-8 py-16 sm:py-20 border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROPS.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-lg"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">
                {p.title}
              </h3>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
