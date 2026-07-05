"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  LineStyle,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { useMarketHistory } from "@/hooks/useMarketHistory";
import type { PolymarketMarket } from "@/lib/polymarket/types";

type Props = {
  market: PolymarketMarket | null;
};

type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  HYPE: "HYPEUSDT",
  ADA: "ADAUSDT",
};

const PCT_FORMAT = {
  type: "custom" as const,
  formatter: (v: number) => `${(v * 100).toFixed(0)}¢`,
};

type SeriesToggle = "market" | "model" | "asset";

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
      style={{
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      {label}
    </button>
  );
}

export function PriceChart({ market }: Props) {
  const asset = market?.asset;
  const { midSeries, probSeries, isLoading } = useMarketHistory(market?.id);

  const [visible, setVisible] = useState<Record<SeriesToggle, boolean>>({
    market: true,
    model: true,
    asset: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const marketSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const modelSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasFitRef = useRef(false);

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0c0c10" },
        textColor: "#6b6b7a",
      },
      grid: {
        vertLines: { color: "#1e1e26" },
        horzLines: { color: "#1e1e26" },
      },
      crosshair: {
        vertLine: { color: "#2a2a38", labelBackgroundColor: "#16161d" },
        horzLine: { color: "#2a2a38", labelBackgroundColor: "#16161d" },
      },
      rightPriceScale: {
        borderColor: "#1e1e26",
      },
      leftPriceScale: {
        visible: false,
        borderColor: "#1e1e26",
      },
      timeScale: {
        borderColor: "#1e1e26",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    // Market (Up) price — main series, right scale, 0–100¢
    const marketSeries = chart.addSeries(LineSeries, {
      color: "#4f5cf0",
      lineWidth: 2,
      priceScaleId: "right",
      title: "Market",
      priceFormat: PCT_FORMAT,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    marketSeriesRef.current = marketSeries;

    // Model probability — dashed, same right scale
    const modelSeries = chart.addSeries(LineSeries, {
      color: "#f0a94f",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceScaleId: "right",
      title: "Model",
      priceFormat: PCT_FORMAT,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    modelSeriesRef.current = modelSeries;

    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.1 },
      autoScale: false,
    });
    const fixedRange = () => ({
      priceRange: { minValue: 0, maxValue: 1 },
      margins: { above: 0.1, below: 0.1 },
    });
    marketSeries.applyOptions({ autoscaleInfoProvider: fixedRange });
    modelSeries.applyOptions({ autoscaleInfoProvider: fixedRange });

    // Asset candles — left scale, off by default
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceScaleId: "left",
      visible: false,
    });
    candleSeriesRef.current = candleSeries;

    // ResizeObserver
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;
      const { width, height } = entry.contentRect;
      chartRef.current.resize(width, height);
    });
    ro.observe(containerRef.current);
    resizeObserverRef.current = ro;

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      marketSeriesRef.current = null;
      modelSeriesRef.current = null;
    };
  }, []);

  // Push history + live series data as it changes
  useEffect(() => {
    marketSeriesRef.current?.setData(midSeries);
  }, [midSeries]);

  useEffect(() => {
    modelSeriesRef.current?.setData(probSeries);
  }, [probSeries]);

  // Fit the view once per market, after the initial history seed lands
  useEffect(() => {
    hasFitRef.current = false;
  }, [market?.id]);

  useEffect(() => {
    if (hasFitRef.current || isLoading) return;
    if (midSeries.length === 0 && probSeries.length === 0) return;
    chartRef.current?.timeScale().fitContent();
    hasFitRef.current = true;
  }, [midSeries, probSeries, isLoading]);

  // Asset candles — fetch + subscribe whenever asset changes (unchanged logic,
  // just rendered on the left scale now and gated by the "asset" toggle)
  useEffect(() => {
    if (!asset) return;

    const symbol = BINANCE_SYMBOL_MAP[asset];
    if (!symbol) return;

    candleSeriesRef.current?.setData([]);
    wsRef.current?.close();

    const fetchCandles = async () => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=60`
        );
        if (!res.ok) return;
        const raw: unknown[][] = await res.json();
        const candles: Candle[] = raw.map((k) => ({
          time: (Number(k[0]) / 1000) as UTCTimestamp,
          open: parseFloat(k[1] as string),
          high: parseFloat(k[2] as string),
          low: parseFloat(k[3] as string),
          close: parseFloat(k[4] as string),
        }));
        candleSeriesRef.current?.setData(candles);
      } catch {
        // silently ignore fetch errors
      }
    };

    fetchCandles();

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          k: { t: number; o: string; h: string; l: string; c: string };
        };
        const k = msg.k;
        const candle: Candle = {
          time: (k.t / 1000) as UTCTimestamp,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        };
        candleSeriesRef.current?.update(candle);
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => ws.close();

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [asset]);

  // Apply toggle visibility
  useEffect(() => {
    marketSeriesRef.current?.applyOptions({ visible: visible.market });
  }, [visible.market]);

  useEffect(() => {
    modelSeriesRef.current?.applyOptions({ visible: visible.model });
  }, [visible.model]);

  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: visible.asset });
    chartRef.current?.priceScale("left").applyOptions({ visible: visible.asset });
  }, [visible.asset]);

  function toggle(key: SeriesToggle) {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // IMPORTANT: the chart-init effect above has an empty dependency array, so
  // it only ever runs once, on this component's first mount. The container
  // div (with containerRef) must therefore always be in the tree — even when
  // no market is selected yet — or createChart() never gets a real DOM node
  // to attach to, and the chart silently never renders even after a market
  // is later selected.
  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#0c0c10" }}>
      {/* Series toggles */}
      {market && (
        <div
          className="flex items-center gap-1.5 px-3 py-2 shrink-0 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <ToggleChip label="Market" active={visible.market} onClick={() => toggle("market")} />
          <ToggleChip label="Model" active={visible.model} onClick={() => toggle("model")} />
          {asset && (
            <ToggleChip
              label={`${asset} price`}
              active={visible.asset}
              onClick={() => toggle("asset")}
            />
          )}
          {isLoading && (
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-dim)" }}>
              Loading history…
            </span>
          )}
        </div>
      )}

      <div ref={containerRef} className="flex-1 w-full relative" style={{ minHeight: 0 }}>
        {!market && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: "var(--text-dim)", fontSize: 12 }}
          >
            Select a market to view chart
          </div>
        )}
      </div>
    </div>
  );
}
