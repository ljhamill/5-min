"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

type Props = {
  asset: string | undefined;
  marketEndIso: string | undefined;
  midPrice: number;
};

type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ProbPoint = {
  time: UTCTimestamp;
  value: number;
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

export function PriceChart({ asset, marketEndIso: _marketEndIso, midPrice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const probSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const probDataRef = useRef<ProbPoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

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
        visible: true,
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

    // Candlestick series on right scale
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceScaleId: "right",
    });
    candleSeriesRef.current = candleSeries;

    // Prob line on left scale (0–1)
    const probSeries = chart.addSeries(LineSeries, {
      color: "#4f5cf0",
      lineWidth: 2,
      priceScaleId: "left",
      title: "Prob",
      lastValueVisible: true,
      priceLineVisible: false,
    });

    chart.priceScale("left").applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.1 },
      autoScale: false,
      visible: true,
    });
    // Fix left scale to 0–1
    probSeries.applyOptions({
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 1 },
        margins: { above: 0.1, below: 0.1 },
      }),
    });

    probSeriesRef.current = probSeries;

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
      probSeriesRef.current = null;
    };
  }, []);

  // Fetch + subscribe whenever asset changes
  useEffect(() => {
    if (!asset) return;

    const symbol = BINANCE_SYMBOL_MAP[asset];
    if (!symbol) return;

    // Clear previous data
    probDataRef.current = [];
    candleSeriesRef.current?.setData([]);
    probSeriesRef.current?.setData([]);

    // Close previous WS
    wsRef.current?.close();

    // Fetch historical 1m candles
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

    // Subscribe to live kline WebSocket
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          k: {
            t: number;
            o: string;
            h: string;
            l: string;
            c: string;
            x: boolean;
          };
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

  // Update prob line whenever midPrice changes
  useEffect(() => {
    if (!midPrice || midPrice <= 0 || !probSeriesRef.current) return;

    const nowSec = Math.floor(Date.now() / 1000) as UTCTimestamp;
    const pts = probDataRef.current;

    // Avoid duplicate timestamps
    const last = pts[pts.length - 1];
    if (last && last.time === nowSec) {
      last.value = midPrice;
    } else {
      pts.push({ time: nowSec, value: midPrice });
    }

    // Keep only last 200 points to avoid unbounded growth
    if (pts.length > 200) pts.splice(0, pts.length - 200);

    try {
      probSeriesRef.current.setData([...pts]);
    } catch {
      // ignore series update errors (e.g. out-of-order time)
    }
  }, [midPrice]);

  if (!asset) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "#0c0c10", color: "var(--text-dim)", fontSize: 12 }}
      >
        Select a market to view chart
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full"
      style={{ background: "#0c0c10", minHeight: 0 }}
    />
  );
}
