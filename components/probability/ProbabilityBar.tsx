"use client";

type Props = {
  modelProb: number;   // 0–1, our model estimate
  marketPrice: number; // 0–1, Polymarket implied
  isValid: boolean;
};

export function ProbabilityBar({ modelProb, marketPrice, isValid }: Props) {
  const edge = modelProb - marketPrice;
  const edgeAbs = Math.abs(edge);
  const hasEdge = edgeAbs > 0.03;

  const modelPct = (modelProb * 100).toFixed(1);
  const marketPct = (marketPrice * 100).toFixed(1);
  const edgePct = (edge * 100).toFixed(1);

  const edgeColor =
    edge > 0.03
      ? "var(--green)"
      : edge < -0.03
      ? "var(--red)"
      : "var(--text-secondary)";

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="relative h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        {/* Market price indicator */}
        <div
          className="absolute top-0 bottom-0 bg-[var(--text-secondary)] opacity-40"
          style={{ width: `${marketPrice * 100}%` }}
        />
        {/* Model probability */}
        {isValid && (
          <div
            className="absolute top-0 bottom-0 transition-all duration-500"
            style={{
              width: `${modelProb * 100}%`,
              background: edgeColor,
              opacity: 0.9,
            }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-secondary)]">MKT</span>
          <span className="tabular-nums">{marketPct}%</span>
          {isValid && (
            <>
              <span className="text-[var(--text-dim)]">·</span>
              <span className="text-[var(--text-secondary)]">MDL</span>
              <span className="tabular-nums">{modelPct}%</span>
            </>
          )}
        </div>
        {isValid && hasEdge && (
          <span
            className="tabular-nums font-medium"
            style={{ color: edgeColor }}
          >
            {edge > 0 ? "+" : ""}{edgePct}% EDGE
          </span>
        )}
      </div>
    </div>
  );
}
