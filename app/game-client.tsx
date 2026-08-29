"use client";

/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- dialog backdrops only close when the backdrop itself is pressed */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle, StockSample } from "./stock-data";
import {
  INITIAL_BARS,
  INITIAL_CASH,
  ORDER_ALLOCATIONS,
  clamp,
  initialBarsFor,
  lotSizeFor,
  orderQuantity,
  type ConfidenceLevel,
  type DecisionThesis,
  type MarketKind,
  type MarketOutlook,
  type OrderAllocation,
  type ReplayAction,
} from "./game-config";
import { buildTradeAnalysis } from "./trade-analysis";

const nf = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const shareNf = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const delay = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

type TradeMode = "buy" | "sell";
type OrderInputMode = "allocation" | "quantity";
type GameMode = "daily" | "practice";
type ScenarioKind = "random" | "trend" | "reversal" | "crash" | "volatile";
type TradeMarker = {
  index: number;
  type: "B" | "S";
  price: number;
  quantity: number;
  round: number;
};
type RankedScore = {
  nickname: string;
  score: number;
  returnRate: number;
  rank: number;
  percentile?: number;
  isPlayer?: boolean;
  excess?: number;
  maxDrawdown?: number;
};
type Scoreboard = {
  total: number;
  leaderboard: RankedScore[];
  playerScore: RankedScore | null;
  opponent: RankedScore | null;
  stats: null | {
    completedDays: number;
    streak: number;
    averageScore: number;
    bestScore: number;
    xp: number;
    level: number;
    levelProgress: number;
    profile: { title: string; text: string };
  };
};
type ChallengeSession = {
  sessionId: string;
  date: string;
  market: MarketKind;
  mode: GameMode;
  stock: StockSample;
  totalBars: number;
  remainingBars: number;
  decisionsUsed: number;
  maxDecisions: number | null;
  universeSize: number;
  dataSource: "live-universe" | "embedded-fallback";
  scenario: ScenarioKind;
};
type InitialChallenges = Record<MarketKind, ChallengeSession>;
type AdvanceResponse = {
  candles: Candle[];
  remainingBars: number;
  decisionsUsed: number;
  maxDecisions: number | null;
  finished: boolean;
  action: ReplayAction;
};

function average(data: Candle[], at: number, period: number) {
  if (at < period - 1) return null;
  let total = 0;
  for (let i = at - period + 1; i <= at; i++) total += data[i].close;
  return total / period;
}

function formatVolume(value: number, market: MarketKind) {
  const unit = market === "cn" ? "手" : "股";
  if (value >= 100_000_000)
    return `${(value / 100_000_000).toFixed(2)}亿${unit}`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(2)}万${unit}`;
  return `${Math.round(value).toLocaleString("zh-CN")}${unit}`;
}

function CandleChart({
  data,
  markers,
  market,
}: {
  data: Candle[];
  markers: TradeMarker[];
  market: MarketKind;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startOffset: number;
    slot: number;
  } | null>(null);
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; viewSize: number } | null>(null);
  const previousLengthRef = useRef(data.length);
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    width: number;
  } | null>(null);
  const [viewSize, setViewSize] = useState(INITIAL_BARS);
  const [rightOffset, setRightOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const maxView = data.length,
    effectiveView = Math.min(viewSize, data.length);
  const maxOffset = Math.max(0, data.length - effectiveView);
  const effectiveOffset = Math.min(rightOffset, maxOffset);
  const viewEnd = data.length - effectiveOffset;
  const viewStart = Math.max(0, viewEnd - effectiveView);
  const navigationStep = Math.max(1, Math.round(effectiveView / 3));
  const changeZoom = (delta: number) => {
    setHover(null);
    setViewSize((value) => {
      const next = Math.max(24, Math.min(maxView, value + delta));
      setRightOffset((offset) =>
        Math.min(offset, Math.max(0, data.length - next)),
      );
      return next;
    });
  };
  const panBy = (bars: number) => {
    setHover(null);
    setRightOffset((value) => clamp(value + bars, 0, maxOffset));
  };
  const resetView = () => {
    setHover(null);
    setViewSize(Math.min(INITIAL_BARS, maxView));
    setRightOffset(0);
  };
  const showAll = () => {
    setHover(null);
    setViewSize(maxView);
    setRightOffset(0);
  };

  useEffect(() => {
    const added = data.length - previousLengthRef.current;
    previousLengthRef.current = data.length;
    if (added > 0)
      setRightOffset((value) =>
        value > 0
          ? Math.min(value + added, Math.max(0, data.length - effectiveView))
          : 0,
      );
    if (added < 0) setRightOffset(0);
  }, [data.length, effectiveView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width,
        h = rect.height,
        right = 62,
        top = 18,
        volumeH = 82,
        priceBottom = h - volumeH - 30;
      const start = viewStart,
        shown = data.slice(viewStart, viewEnd);
      const values = shown.flatMap((d) => [d.high, d.low]);
      const min = Math.min(...values),
        max = Math.max(...values),
        range = Math.max(1, max - min),
        pad = range * 0.07;
      const priceY = (value: number) =>
        top + ((max + pad - value) / (range + pad * 2)) * (priceBottom - top);
      const slot = (w - right) / shown.length,
        bodyW = Math.max(2, Math.min(9, slot * 0.62));
      ctx.clearRect(0, 0, w, h);
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "left";
      for (let i = 0; i < 5; i++) {
        const y = top + ((priceBottom - top) / 4) * i;
        ctx.strokeStyle = "#eae7df";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w - right, Math.round(y) + 0.5);
        ctx.stroke();
        const label = max + pad - ((range + pad * 2) / 4) * i;
        ctx.fillStyle = "#97958f";
        ctx.fillText(label.toFixed(2), w - right + 8, y + 4);
      }
      for (let i = 0; i <= 4; i++) {
        const x = ((w - right) / 4) * i;
        ctx.strokeStyle = "#f0ede7";
        ctx.beginPath();
        ctx.moveTo(x + 0.5, top);
        ctx.lineTo(x + 0.5, h - 22);
        ctx.stroke();
        if (i < 4) {
          ctx.fillStyle = "#aaa8a2";
          ctx.fillText(
            `T${start + Math.round((shown.length / 4) * i) - data.length}`,
            x + 5,
            h - 7,
          );
        }
      }
      ctx.strokeStyle = "#dedbd3";
      ctx.beginPath();
      ctx.moveTo(0, priceBottom + 17.5);
      ctx.lineTo(w - right, priceBottom + 17.5);
      ctx.stroke();
      const maxVolume = Math.max(...shown.map((d) => d.volume));
      shown.forEach((d, i) => {
        const x = slot * i + slot / 2,
          up = d.close >= d.open,
          color = up ? "#df4a56" : "#129a76";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, priceY(d.high));
        ctx.lineTo(Math.round(x) + 0.5, priceY(d.low));
        ctx.stroke();
        const y = Math.min(priceY(d.open), priceY(d.close)),
          bh = Math.max(1.3, Math.abs(priceY(d.open) - priceY(d.close)));
        if (up) {
          ctx.strokeRect(x - bodyW / 2, y, bodyW, bh);
          ctx.fillStyle = "#fffdf9";
          ctx.fillRect(
            x - bodyW / 2 + 1,
            y + 1,
            Math.max(0, bodyW - 2),
            Math.max(0, bh - 2),
          );
        } else ctx.fillRect(x - bodyW / 2, y, bodyW, bh);
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = color;
        const vh = (d.volume / maxVolume) * (volumeH - 22);
        ctx.fillRect(x - bodyW / 2, h - 24 - vh, bodyW, vh);
        ctx.globalAlpha = 1;
      });
      (
        [
          { p: 5, c: "#c9952f" },
          { p: 10, c: "#6b79bd" },
          { p: 20, c: "#a06999" },
        ] as const
      ).forEach(({ p, c }) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.15;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        let active = false;
        shown.forEach((_, i) => {
          const value = average(data, start + i, p);
          if (value == null) return;
          const x = slot * i + slot / 2,
            y = priceY(value);
          if (!active) {
            ctx.moveTo(x, y);
            active = true;
          } else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      const last = shown[shown.length - 1],
        ly = priceY(last.close);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = last.close >= last.open ? "#df4a56" : "#129a76";
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(w - right, ly);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = last.close >= last.open ? "#df4a56" : "#129a76";
      ctx.fillRect(w - right, ly - 10, right, 20);
      ctx.fillStyle = "white";
      ctx.fillText(last.close.toFixed(2), w - right + 7, ly + 4);
      markers
        .filter((marker) => marker.index >= start && marker.index < viewEnd)
        .forEach((marker) => {
          const localIndex = marker.index - start,
            candle = shown[localIndex];
          if (!candle) return;
          const x = slot * localIndex + slot / 2,
            buy = marker.type === "B",
            color = buy ? "#df4a56" : "#129a76",
            wickY = priceY(buy ? candle.low : candle.high),
            markerY = buy
              ? Math.min(priceBottom - 11, wickY + 18)
              : Math.max(top + 13, wickY - 18);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.72;
          ctx.beginPath();
          ctx.moveTo(x, wickY);
          ctx.lineTo(x, markerY);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, markerY, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "700 10px Arial";
          ctx.textAlign = "center";
          ctx.fillText(marker.type, x, markerY + 3.5);
          ctx.textAlign = "left";
        });
      if (hover != null && hover.index >= 0 && hover.index < shown.length) {
        const d = shown[hover.index],
          x = slot * hover.index + slot / 2,
          y = priceY(d.close);
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = "#77766f";
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, h - 22);
        ctx.moveTo(0, y);
        ctx.lineTo(w - right, y);
        ctx.stroke();
        ctx.restore();
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = "rgba(38,39,34,.94)";
        ctx.fillRect(w - right, y - 9, right, 18);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(d.close.toFixed(2), w - right / 2, y + 3.5);
        ctx.textAlign = "left";
        const dayLabel = `第 ${start + hover.index + 1} 日`;
        const labelW = 58,
          labelX = Math.max(0, Math.min(w - right - labelW, x - labelW / 2));
        ctx.fillStyle = "rgba(38,39,34,.94)";
        ctx.fillRect(labelX, h - 21, labelW, 18);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(dayLabel, labelX + labelW / 2, h - 8);
        ctx.textAlign = "left";
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [data, effectiveView, hover, markers, viewEnd, viewStart]);

  const hoverIndex = hover ? viewStart + hover.index : -1;
  const hoverCandle = hoverIndex >= 0 ? data[hoverIndex] : null;
  const hoverPrevious = hoverIndex > 0 ? data[hoverIndex - 1] : hoverCandle;
  const hoverChange =
    hoverCandle && hoverPrevious ? hoverCandle.close - hoverPrevious.close : 0;
  const hoverChangeRate =
    hoverCandle && hoverPrevious
      ? (hoverCandle.close / hoverPrevious.close - 1) * 100
      : 0;
  const hoverAmplitude =
    hoverCandle && hoverPrevious
      ? ((hoverCandle.high - hoverCandle.low) / hoverPrevious.close) * 100
      : 0;
  const volumeWindow =
    hoverIndex > 0 ? data.slice(Math.max(0, hoverIndex - 5), hoverIndex) : [];
  const averageVolume = volumeWindow.length
    ? volumeWindow.reduce((sum, candle) => sum + candle.volume, 0) /
      volumeWindow.length
    : hoverCandle?.volume || 1;
  const hoverTrade = markers.find((marker) => marker.index === hoverIndex);
  const priceClass = (value: number) =>
    !hoverPrevious
      ? "flat"
      : value > hoverPrevious.close
        ? "quote-up"
        : value < hoverPrevious.close
          ? "quote-down"
          : "flat";

  return (
    <div className="chart-area">
      <div className="chart-tools">
        <div className="trade-legend">
          <span className="buy-dot">B</span>买入点
          <span className="sell-dot">S</span>卖出点
        </div>
        <div className="chart-actions">
          <div className="pan-tools">
            <button
              onClick={() => panBy(navigationStep)}
              disabled={effectiveOffset >= maxOffset}
              aria-label="向左查看更早K线"
              title="向左查看更早K线"
            >
              ←
            </button>
            <button
              onClick={() => panBy(-navigationStep)}
              disabled={effectiveOffset <= 0}
              aria-label="向右查看更新K线"
              title="向右查看更新K线"
            >
              →
            </button>
            <button
              className="text-tool"
              onClick={() => setRightOffset(0)}
              disabled={effectiveOffset <= 0}
            >
              最新
            </button>
            <input
              className="history-slider"
              type="range"
              min={0}
              max={maxOffset}
              value={maxOffset - effectiveOffset}
              disabled={maxOffset <= 0}
              aria-label="定位K线历史位置"
              onChange={(event) => {
                setHover(null);
                setRightOffset(maxOffset - Number(event.target.value));
              }}
            />
          </div>
          <div className="zoom-tools">
            <small>
              {effectiveOffset
                ? `距最新 ${effectiveOffset} 根`
                : `显示 ${effectiveView} 根`}
            </small>
            <button
              onClick={() => changeZoom(12)}
              disabled={effectiveView >= maxView}
              aria-label="缩小K线图"
            >
              −
            </button>
            <button
              onClick={() => changeZoom(-12)}
              disabled={effectiveView <= 24}
              aria-label="放大K线图"
            >
              ＋
            </button>
            <button
              className="reset-zoom"
              onClick={showAll}
              disabled={effectiveView >= maxView && effectiveOffset === 0}
            >
              全部
            </button>
            <button
              className="reset-zoom"
              onClick={resetView}
              disabled={
                effectiveView === Math.min(INITIAL_BARS, maxView) &&
                effectiveOffset === 0
              }
            >
              复位
            </button>
          </div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className={`chart-canvas ${dragging ? "dragging" : ""}`}
        aria-label="可缩放、拖动和键盘操作的真实历史日K线图"
        onDoubleClick={resetView}
        onWheel={(event) => {
          event.preventDefault();
          if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))
            panBy(
              (event.deltaX || event.deltaY) > 0
                ? navigationStep
                : -navigationStep,
            );
          else changeZoom(event.deltaY > 0 ? 8 : -8);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") panBy(navigationStep);
          else if (event.key === "ArrowRight") panBy(-navigationStep);
          else if (event.key === "Home") setRightOffset(maxOffset);
          else if (event.key === "End") setRightOffset(0);
          else if (event.key === "+" || event.key === "=") changeZoom(-12);
          else if (event.key === "-" || event.key === "_") changeZoom(12);
          else if (event.key === "0") resetView();
          else return;
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          event.currentTarget.setPointerCapture(event.pointerId);
          if (event.pointerType === "touch") {
            touchPointsRef.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            const points = [...touchPointsRef.current.values()];
            if (points.length >= 2) {
              pinchRef.current = {
                distance: Math.hypot(
                  points[0].x - points[1].x,
                  points[0].y - points[1].y,
                ),
                viewSize: effectiveView,
              };
              dragRef.current = null;
            } else
              dragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startOffset: effectiveOffset,
                slot: Math.max(1, (rect.width - 62) / effectiveView),
              };
          } else
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startOffset: effectiveOffset,
              slot: Math.max(1, (rect.width - 62) / effectiveView),
            };
          setDragging(true);
          setHover(null);
        }}
        onPointerUp={(event) => {
          touchPointsRef.current.delete(event.pointerId);
          pinchRef.current = null;
          if (dragRef.current?.pointerId === event.pointerId)
            dragRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => {
          touchPointsRef.current.clear();
          pinchRef.current = null;
          dragRef.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => {
          if (!dragRef.current) setHover(null);
        }}
        onPointerMove={(event) => {
          if (
            event.pointerType === "touch" &&
            touchPointsRef.current.has(event.pointerId)
          ) {
            touchPointsRef.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            const points = [...touchPointsRef.current.values()],
              pinch = pinchRef.current;
            if (pinch && points.length >= 2) {
              const distance = Math.max(
                1,
                Math.hypot(
                  points[0].x - points[1].x,
                  points[0].y - points[1].y,
                ),
              );
              const next = clamp(
                Math.round((pinch.viewSize * pinch.distance) / distance),
                24,
                maxView,
              );
              setViewSize(next);
              setRightOffset((offset) =>
                Math.min(offset, Math.max(0, data.length - next)),
              );
              return;
            }
          }
          const drag = dragRef.current;
          if (drag?.pointerId === event.pointerId) {
            setRightOffset(
              clamp(
                drag.startOffset +
                  Math.round((event.clientX - drag.startX) / drag.slot),
                0,
                maxOffset,
              ),
            );
            return;
          }
          if (event.pointerType !== "mouse") return;
          const rect = event.currentTarget.getBoundingClientRect();
          const slot = (rect.width - 62) / effectiveView;
          setHover({
            index: Math.max(
              0,
              Math.min(
                effectiveView - 1,
                Math.floor(event.nativeEvent.offsetX / slot),
              ),
            ),
            x: event.nativeEvent.offsetX,
            width: rect.width,
          });
        }}
      />
      {hover && hoverCandle && hoverPrevious && (
        <div
          className="market-tooltip"
          style={
            hover.x < hover.width / 2
              ? { left: Math.max(8, hover.x + 14) }
              : { right: Math.max(70, hover.width - hover.x + 14) }
          }
        >
          <div className="tooltip-head">
            <b>第 {hoverIndex + 1} 日</b>
            <span>
              {hoverTrade
                ? `${hoverTrade.type} · ${hoverTrade.type === "B" ? "买入成交" : "卖出成交"}`
                : "日期隐藏"}
            </span>
          </div>
          <dl>
            <div>
              <dt>开盘</dt>
              <dd className={priceClass(hoverCandle.open)}>
                {hoverCandle.open.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>收盘</dt>
              <dd className={priceClass(hoverCandle.close)}>
                {hoverCandle.close.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>最高</dt>
              <dd className={priceClass(hoverCandle.high)}>
                {hoverCandle.high.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>最低</dt>
              <dd className={priceClass(hoverCandle.low)}>
                {hoverCandle.low.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>涨跌</dt>
              <dd className={hoverChange >= 0 ? "quote-up" : "quote-down"}>
                {hoverChange >= 0 ? "+" : ""}
                {hoverChange.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>涨幅</dt>
              <dd className={hoverChangeRate >= 0 ? "quote-up" : "quote-down"}>
                {hoverChangeRate >= 0 ? "+" : ""}
                {hoverChangeRate.toFixed(2)}%
              </dd>
            </div>
            <div>
              <dt>振幅</dt>
              <dd>{hoverAmplitude.toFixed(2)}%</dd>
            </div>
            <div>
              <dt>成交量</dt>
              <dd>{formatVolume(hoverCandle.volume, market)}</dd>
            </div>
            <div>
              <dt>量比</dt>
              <dd>{(hoverCandle.volume / averageVolume).toFixed(2)}</dd>
            </div>
          </dl>
          <div className="tooltip-ma">
            <span>
              MA5 <b>{average(data, hoverIndex, 5)?.toFixed(2) || "—"}</b>
            </span>
            <span>
              MA10 <b>{average(data, hoverIndex, 10)?.toFixed(2) || "—"}</b>
            </span>
            <span>
              MA20 <b>{average(data, hoverIndex, 20)?.toFixed(2) || "—"}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GameClient({
  initialChallenges,
}: {
  initialChallenges: InitialChallenges;
}) {
  const today = initialChallenges.cn.date;
  const [market, setMarket] = useState<MarketKind>("cn");
  const [gameMode, setGameMode] = useState<GameMode>("daily");
  const [session, setSession] = useState(initialChallenges.cn);
  const [stock, setStock] = useState(initialChallenges.cn.stock);
  const [visibleCount, setVisibleCount] = useState(() =>
      initialBarsFor(initialChallenges.cn.stock),
    ),
    [round, setRound] = useState(0);
  const [cash, setCash] = useState(INITIAL_CASH),
    [shares, setShares] = useState(0);
  const [mode, setMode] = useState<TradeMode>("buy"),
    [allocation, setAllocation] = useState<OrderAllocation>(1);
  const [orderInputMode, setOrderInputMode] =
      useState<OrderInputMode>("allocation"),
    [quantityInput, setQuantityInput] = useState("");
  const [revealDays, setRevealDays] = useState<1 | 3 | 5>(3);
  const [outlook, setOutlook] = useState<MarketOutlook>("up");
  const [thesis, setThesis] = useState<DecisionThesis>("trend");
  const [confidence, setConfidence] = useState<ConfidenceLevel>(2);
  const [trades, setTrades] = useState(0),
    [tradeMarkers, setTradeMarkers] = useState<TradeMarker[]>([]);
  const [equityHistory, setEquityHistory] = useState([INITIAL_CASH]);
  const [exposureHistory, setExposureHistory] = useState([0]);
  const [finished, setFinished] = useState(false),
    [resultOpen, setResultOpen] = useState(false),
    [rulesOpen, setRulesOpen] = useState(false),
    [isRevealing, setIsRevealing] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [revealPulse, setRevealPulse] = useState(0),
    [shareStatus, setShareStatus] = useState("");
  const [actions, setActions] = useState<ReplayAction[]>([]),
    [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("盲盘客"),
    [duelId, setDuelId] = useState("");
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null),
    [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [scoreStatus, setScoreStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [challengeLoading, setChallengeLoading] = useState(false);
  const submissionRef = useRef(false);
  const initialUrlHandledRef = useRef(false);
  const marketLabel = market === "cn" ? "A股" : "美股";
  const scenarioLabel = (
    {
      random: "随机练习",
      trend: "趋势识别",
      reversal: "拐点应对",
      crash: "急跌生存",
      volatile: "高波动控仓",
    } as const
  )[session.scenario];
  const currencySymbol = market === "cn" ? "¥" : "$";
  const initialVisibleCount = initialBarsFor(stock);
  const normalized = useMemo(() => {
    const factor = 100 / stock.candles[initialVisibleCount - 1].close;
    return stock.candles.map((candle) => ({
      ...candle,
      open: candle.open * factor,
      close: candle.close * factor,
      high: candle.high * factor,
      low: candle.low * factor,
    }));
  }, [initialVisibleCount, stock]);
  const data = normalized.slice(0, visibleCount),
    current = data[data.length - 1],
    previous = data[data.length - 2];
  const positionValue = shares * current.close,
    equity = cash + positionValue,
    returnRate = (equity / INITIAL_CASH - 1) * 100,
    dayChange = (current.close / previous.close - 1) * 100;
  const lotSize = lotSizeFor(market),
    enteredQuantity = quantityInput === "" ? undefined : Number(quantityInput);
  const maxQuotedQuantity = orderQuantity({
    market,
    kind: mode,
    price: current.close,
    cash,
    shares,
    allocation: 1,
  });
  const quantityError =
    orderInputMode !== "quantity"
      ? ""
      : enteredQuantity === undefined
        ? "请输入委托股数"
        : !Number.isInteger(enteredQuantity) || enteredQuantity <= 0
          ? "请输入正整数股数"
          : market === "cn" && enteredQuantity % lotSize !== 0
            ? `A股${mode === "buy" ? "买入" : "卖出"}须为 ${lotSize} 股的整数倍`
            : enteredQuantity > maxQuotedQuantity
              ? mode === "buy"
                ? "委托股数超过当前可用资金"
                : "委托股数超过当前持仓"
              : "";
  const estimatedQuantity = quantityError
    ? 0
    : orderQuantity({
        market,
        kind: mode,
        price: current.close,
        cash,
        shares,
        allocation,
        quantity: orderInputMode === "quantity" ? enteredQuantity : undefined,
      });
  const estimatedOrderValue = estimatedQuantity * current.close;
  const advancedDays = visibleCount - initialVisibleCount;
  const remainingDays = Math.max(0, session.remainingBars);
  const ma5 = average(data, data.length - 1, 5),
    ma10 = average(data, data.length - 1, 10),
    ma20 = average(data, data.length - 1, 20);
  const benchmark =
      (current.close / data[initialVisibleCount - 1].close - 1) * 100,
    excess = returnRate - benchmark;
  const maxDrawdown = useMemo(() => {
    let peak = equityHistory[0],
      worst = 0;
    equityHistory.forEach((value) => {
      peak = Math.max(peak, value);
      worst = Math.min(worst, (value / peak - 1) * 100);
    });
    return worst;
  }, [equityHistory]);
  const decisionStats = useMemo(() => {
    let offset = 0,
      total = 0,
      hits = 0,
      weight = 0,
      weightedHits = 0,
      confidentMisses = 0;
    for (const action of actions) {
      const days = action.days || 3;
      const execution = normalized[initialVisibleCount + offset]?.open;
      const outcome =
        normalized[initialVisibleCount + offset + days - 1]?.close;
      if (
        execution != null &&
        outcome != null &&
        action.outlook &&
        action.confidence
      ) {
        const move = (outcome / execution - 1) * 100;
        const actual = move > 0.75 ? "up" : move < -0.75 ? "down" : "range";
        const matched = action.outlook === actual;
        const actionWeight =
          action.confidence === 3 ? 2 : action.confidence === 2 ? 1.5 : 1;
        total++;
        weight += actionWeight;
        if (matched) {
          hits++;
          weightedHits += actionWeight;
        } else if (action.confidence === 3) confidentMisses++;
      }
      offset += days;
    }
    const accuracy = total ? (hits / total) * 100 : 0;
    const calibration = weight
      ? clamp((weightedHits / weight) * 100 - confidentMisses * 4, 0, 100)
      : 50;
    return { total, hits, accuracy, calibration, confidentMisses };
  }, [actions, initialVisibleCount, normalized]);
  const allowedTrades = Math.max(4, Math.ceil(advancedDays / 10) + 1);
  const skillScore = Math.round(
    clamp(50 + excess * 2.5, 0, 100) * 0.4 +
      clamp(100 + maxDrawdown * 5, 0, 100) * 0.25 +
      clamp(100 - Math.max(0, trades - allowedTrades) * 10, 35, 100) * 0.15 +
      decisionStats.calibration * 0.2,
  );
  const deepProfile = useMemo(
    () =>
      buildTradeAnalysis({
        candles: normalized.slice(0, visibleCount),
        markers: tradeMarkers,
        equityHistory,
        exposureHistory,
        advancedDays,
        returnRate,
        benchmark,
        excess,
        maxDrawdown,
      }),
    [
      advancedDays,
      benchmark,
      equityHistory,
      excess,
      exposureHistory,
      maxDrawdown,
      normalized,
      returnRate,
      tradeMarkers,
      visibleCount,
    ],
  );
  const profile = { title: deepProfile.title, text: deepProfile.summary };

  useEffect(() => {
    if (initialUrlHandledRef.current) return;
    initialUrlHandledRef.current = true;
    let id = localStorage.getItem("mangpan-player-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mangpan-player-id", id);
    }
    const storedNickname =
      localStorage.getItem("mangpan-player-name") ||
      `盲盘客${id.slice(-4).toUpperCase()}`;
    const params = new URLSearchParams(location.search);
    const challenger = params.get("duel") || "";
    const requestedMarket: MarketKind =
      params.get("market") === "us" ? "us" : "cn";
    queueMicrotask(() => {
      if (
        params.get("date") === today &&
        challenger !== id &&
        /^[a-zA-Z0-9_-]{10,80}$/.test(challenger)
      )
        setDuelId(challenger);
      if (requestedMarket === "us") {
        setMarket(requestedMarket);
        setSession(initialChallenges[requestedMarket]);
        setStock(initialChallenges[requestedMarket].stock);
        setVisibleCount(
          initialBarsFor(initialChallenges[requestedMarket].stock),
        );
      }
      setPlayerId(id);
      setNickname(storedNickname);
    });
  }, [initialChallenges, today]);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    const query = new URLSearchParams({ date: today, market, playerId });
    if (duelId) query.set("opponentId", duelId);
    fetch(`/api/scores?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("load failed");
        const next = (await response.json()) as Scoreboard;
        if (!cancelled) setScoreboard(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [duelId, market, playerId, today]);

  useEffect(() => {
    if (
      !playerId ||
      !finished ||
      gameMode !== "daily" ||
      scoreStatus !== "idle" ||
      submissionRef.current
    )
      return;
    submissionRef.current = true;
    queueMicrotask(() => setScoreStatus("loading"));
    fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: today,
        market,
        playerId,
        nickname,
        sessionId: session.sessionId,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("submit failed");
        const next = (await response.json()) as Scoreboard;
        if (duelId) {
          const query = new URLSearchParams({
            date: today,
            market,
            playerId,
            opponentId: duelId,
          });
          const duelResponse = await fetch(`/api/scores?${query}`);
          if (duelResponse.ok)
            setScoreboard((await duelResponse.json()) as Scoreboard);
          else setScoreboard(next);
        } else setScoreboard(next);
        setScoreStatus("done");
      })
      .catch(() => {
        submissionRef.current = false;
        setScoreStatus("error");
      });
  }, [
    duelId,
    finished,
    gameMode,
    market,
    nickname,
    playerId,
    scoreStatus,
    session.sessionId,
    today,
  ]);

  const resetSession = (nextSession: ChallengeSession) => {
    submissionRef.current = false;
    setGameMode(nextSession.mode);
    setSession(nextSession);
    setStock(nextSession.stock);
    setVisibleCount(initialBarsFor(nextSession.stock));
    setRound(0);
    setCash(INITIAL_CASH);
    setShares(0);
    setMode("buy");
    setAllocation(1);
    setOrderInputMode("allocation");
    setQuantityInput("");
    setRevealDays(3);
    setOutlook("up");
    setThesis("trend");
    setConfidence(2);
    setTrades(0);
    setTradeMarkers([]);
    setEquityHistory([INITIAL_CASH]);
    setExposureHistory([0]);
    setActions([]);
    setFinished(false);
    setResultOpen(false);
    setAnalysisOpen(false);
    setRevealPulse(0);
    setShareStatus("");
    setScoreStatus("idle");
    setScoreboard(null);
  };

  const resetGame = async (
    nextMode: GameMode,
    nextMarket = market,
    scenario: ScenarioKind = "random",
  ) => {
    setChallengeLoading(true);
    try {
      const seed = crypto.randomUUID();
      const response = await fetch(
        `/api/challenge?mode=${nextMode}&seed=${encodeURIComponent(seed)}&market=${nextMarket}&scenario=${scenario}`,
      );
      if (!response.ok) throw new Error("challenge load failed");
      resetSession((await response.json()) as ChallengeSession);
      setTrainingOpen(false);
    } finally {
      setChallengeLoading(false);
    }
  };

  const changeMarket = (nextMarket: MarketKind) => {
    if (nextMarket === market || challengeLoading || isRevealing) return;
    setMarket(nextMarket);
    setDuelId("");
    void resetGame(gameMode, nextMarket);
    history.replaceState(null, "", location.pathname);
  };

  const finishGame = async () => {
    if (isRevealing || finished) return;
    setIsRevealing(true);
    try {
      const response = await fetch("/api/challenge", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!response.ok) throw new Error("reveal failed");
      const revealed = (await response.json()) as {
        stock: StockSample;
        actions: ReplayAction[];
        visibleCount: number;
      };
      setStock(revealed.stock);
      setActions(revealed.actions);
      setVisibleCount(revealed.visibleCount);
      setSession((value) => ({
        ...value,
        stock: revealed.stock,
        remainingBars: Math.max(0, value.totalBars - revealed.visibleCount),
        decisionsUsed: revealed.actions.length,
      }));
      setFinished(true);
      setResultOpen(true);
    } finally {
      setIsRevealing(false);
    }
  };
  const advance = async (action: "trade" | "hold") => {
    if (finished || isRevealing || remainingDays <= 0) return;
    setIsRevealing(true);
    const holdingDays = Math.min(revealDays, remainingDays);
    const requestedQuantity =
      orderInputMode === "quantity" ? enteredQuantity : undefined;
    const replayAction: ReplayAction =
      action === "hold"
        ? {
            kind: "hold",
            days: holdingDays as ReplayAction["days"],
            outlook,
            thesis,
            confidence,
          }
        : {
            kind: mode,
            ...(requestedQuantity !== undefined
              ? { quantity: requestedQuantity }
              : { allocation }),
            days: holdingDays as ReplayAction["days"],
            outlook,
            thesis,
            confidence,
          };
    const response = await fetch("/api/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        action: replayAction,
      }),
    });
    if (!response.ok) {
      setIsRevealing(false);
      return;
    }
    const advanced = (await response.json()) as AdvanceResponse;
    const factor = 100 / stock.candles[initialVisibleCount - 1].close;
    const normalizedNew = advanced.candles.map((candle) => ({
      ...candle,
      open: candle.open * factor,
      close: candle.close * factor,
      high: candle.high * factor,
      low: candle.low * factor,
    }));
    setStock((value) => ({
      ...value,
      candles: [...value.candles, ...advanced.candles],
    }));
    setActions((value) => [...value, advanced.action]);
    setSession((value) => ({
      ...value,
      remainingBars: advanced.remainingBars,
      decisionsUsed: advanced.decisionsUsed,
      maxDecisions: advanced.maxDecisions,
    }));
    const executionIndex = visibleCount,
      execution = normalizedNew[0].open;
    let nextCash = cash,
      nextShares = shares,
      didTrade = false,
      amount = 0;
    if (action === "trade") {
      amount = orderQuantity({
        market,
        kind: mode,
        price: execution,
        cash,
        shares,
        allocation,
        quantity: requestedQuantity,
      });
      if (mode === "buy" && amount > 0) {
        const spend = amount * execution;
        nextCash -= spend;
        nextShares += amount;
        didTrade = true;
      }
      if (mode === "sell" && amount > 0) {
        nextShares -= amount;
        nextCash += amount * execution;
        didTrade = true;
      }
      setOrderInputMode("allocation");
      setQuantityInput("");
    }
    if (didTrade)
      setTradeMarkers((value) => [
        ...value,
        {
          index: executionIndex,
          type: mode === "buy" ? "B" : "S",
          price: execution,
          quantity: amount,
          round,
        },
      ]);
    setCash(nextCash);
    setShares(nextShares);
    const pathEquities: number[] = [],
      pathExposures: number[] = [];
    for (let step = 1; step <= advanced.candles.length; step++) {
      await delay(step === 1 ? 170 : 260);
      const stepPrice = normalizedNew[step - 1].close;
      const stepEquity = nextCash + nextShares * stepPrice;
      pathEquities.push(stepEquity);
      pathExposures.push(
        stepEquity > 0 ? ((nextShares * stepPrice) / stepEquity) * 100 : 0,
      );
      setVisibleCount(visibleCount + step);
    }
    const nextEquity = pathEquities[pathEquities.length - 1],
      nextRound = round + 1;
    setRound(nextRound);
    setTrades((value) => value + (didTrade ? 1 : 0));
    setEquityHistory((value) => [...value, ...pathEquities]);
    setExposureHistory((value) => [...value, ...pathExposures]);
    setRevealPulse((value) => value + 1);
    setIsRevealing(false);
    if (advanced.finished || nextEquity <= INITIAL_CASH * 0.2)
      await finishGame();
  };

  const shareResult = async () => {
    const sequence = Array.from({ length: Math.max(1, round) }, (_, index) => {
      const marker = tradeMarkers.find((item) => item.round === index);
      return marker?.type === "B" ? "🟥" : marker?.type === "S" ? "🟩" : "⬜";
    }).join("");
    const text = `${marketLabel}盲盘 #${today.replaceAll("-", "")}\n${sequence}\n收益 ${returnRate >= 0 ? "+" : ""}${returnRate.toFixed(1)}% · 操盘评分 ${skillScore}\n只看走势，不看答案`;
    const shareUrl = playerId
      ? `${location.origin}${location.pathname}?duel=${encodeURIComponent(playerId)}&date=${today}&market=${market}`
      : location.href;
    try {
      if (navigator.share)
        await navigator.share({
          title: "盲盘｜真实历史K线挑战",
          text,
          url: shareUrl,
        });
      else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        setShareStatus("挑战链接已复制");
      }
    } catch {
      setShareStatus("");
    }
  };

  const adjustQuantity = (direction: -1 | 1) => {
    const currentQuantity = Number(quantityInput) || 0;
    const nextQuantity = Math.max(
      0,
      Math.min(maxQuotedQuantity, currentQuantity + direction * lotSize),
    );
    setOrderInputMode("quantity");
    setQuantityInput(nextQuantity ? String(nextQuantity) : "");
  };

  const tradeDisabled =
    isRevealing ||
    finished ||
    remainingDays <= 0 ||
    estimatedQuantity <= 0 ||
    Boolean(quantityError);
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>盲盘</span>
        </div>
        <div className="market-switch" role="group" aria-label="选择股票市场">
          <button
            className={market === "cn" ? "active" : ""}
            disabled={challengeLoading || isRevealing}
            onClick={() => changeMarket("cn")}
          >
            A股
          </button>
          <button
            className="text-button training-button"
            onClick={() => setTrainingOpen(true)}
          >
            情境训练
          </button>
          <button
            className={market === "us" ? "active" : ""}
            disabled={challengeLoading || isRevealing}
            onClick={() => changeMarket("us")}
          >
            美股
          </button>
        </div>
        <div className="round-pill">
          <span>
            {gameMode === "daily"
              ? `${marketLabel}今日短局`
              : `${marketLabel}无限练习`}
          </span>
          <i />
          {gameMode === "daily"
            ? `${session.decisionsUsed}/${session.maxDecisions} 次决策`
            : `已推进 ${advancedDays} 个交易日`}
        </div>
        <div className="top-actions">
          <button
            className="player-chip"
            onClick={() => setScoreboardOpen(true)}
          >
            <i>{nickname.slice(0, 1)}</i>
            <span>{nickname}</span>
            {scoreboard?.stats?.streak ? (
              <b>🔥 {scoreboard.stats.streak}</b>
            ) : null}
          </button>
          <button
            className="text-button rank-button"
            onClick={() => setScoreboardOpen(true)}
          >
            今日排行
          </button>
          <button className="text-button" onClick={() => setRulesOpen(true)}>
            游戏规则
          </button>
        </div>
      </header>
      {duelId && (
        <div className="duel-banner">
          <span>⚔</span>
          <b>好友向你发起了今日同图挑战</b>
          <small>完成后立即对比分数，双方看到的 K 线完全相同</small>
        </div>
      )}
      <section className="portfolio-strip">
        <div>
          <small>总资产</small>
          <strong>
            {currencySymbol}
            {nf.format(equity)}
          </strong>
        </div>
        <div>
          <small>持仓市值</small>
          <strong>
            {currencySymbol}
            {nf.format(positionValue)}
          </strong>
        </div>
        <div>
          <small>可用现金</small>
          <strong>
            {currencySymbol}
            {nf.format(cash)}
          </strong>
        </div>
        <div>
          <small>累计收益</small>
          <strong
            className={
              returnRate > 0 ? "up" : returnRate < 0 ? "down" : "muted"
            }
          >
            {returnRate > 0 ? "+" : ""}
            {returnRate.toFixed(2)}%
          </strong>
        </div>
        <div className="challenge">
          <span>
            {gameMode === "daily"
              ? scoreboard?.playerScore
                ? `${marketLabel}已上榜 · 第 ${scoreboard.playerScore.rank} 名`
                : `${marketLabel}每日同题 · #${today.slice(5).replace("-", "")}`
              : `${marketLabel}${scenarioLabel}`}
          </span>
          <small>
            {duelId
              ? "好友挑战进行中，结算后对比"
              : "价格已归一化，身份结算后揭晓"}
          </small>
        </div>
      </section>
      <section className="workspace">
        <div className="chart-panel">
          {revealPulse > 0 && (
            <span key={revealPulse} className="reveal-toast">
              +{actions.at(-1)?.days || revealDays} 个交易日
            </span>
          )}
          <div className="chart-head">
            <div>
              <span className="ticker-mask">••••••</span>
              <span className="market-tag">{marketLabel}</span>
              <span className="market-tag">日 K</span>
              <span className="adjust-tag">服务器逐段揭示</span>
            </div>
            <div className="ohlc">
              <span>
                开 <b>{current.open.toFixed(2)}</b>
              </span>
              <span>
                高 <b>{current.high.toFixed(2)}</b>
              </span>
              <span>
                低 <b>{current.low.toFixed(2)}</b>
              </span>
              <span>
                收 <b>{current.close.toFixed(2)}</b>
              </span>
              <strong className={dayChange >= 0 ? "up" : "down"}>
                {dayChange >= 0 ? "+" : ""}
                {dayChange.toFixed(2)}%
              </strong>
            </div>
          </div>
          <div className="ma-row">
            <span>MA5 {ma5?.toFixed(2)}</span>
            <span>MA10 {ma10?.toFixed(2)}</span>
            <span>MA20 {ma20?.toFixed(2)}</span>
            <em>
              相对量{" "}
              {current.volume
                ? (
                    current.volume /
                    (data
                      .slice(-20)
                      .reduce((sum, candle) => sum + candle.volume, 0) /
                      Math.min(20, data.length))
                  ).toFixed(2)
                : "0"}
              ×
            </em>
          </div>
          <CandleChart
            key={session.sessionId}
            data={data}
            markers={tradeMarkers}
            market={market}
          />
        </div>
        <aside className="trade-panel">
          <div className="decision-head">
            <span>股票交易</span>
            <small>
              {gameMode === "daily"
                ? "今日短局 · 12 次决策"
                : "无限练习 · 随时结束"}
            </small>
          </div>
          <div
            className={`horizon-track ${gameMode === "practice" ? "open-ended" : ""}`}
          >
            <i
              style={
                gameMode === "daily"
                  ? {
                      width: `${Math.min(100, (session.decisionsUsed / Math.max(1, session.maxDecisions || 1)) * 100)}%`,
                    }
                  : undefined
              }
            />
            <span>
              {gameMode === "daily"
                ? `已完成 ${session.decisionsUsed}/${session.maxDecisions} 次判断`
                : `已推进 ${advancedDays} 个交易日 · 可随时结束`}
            </span>
          </div>
          <div className="price-block">
            <small>归一化价格</small>
            <strong>{current.close.toFixed(2)}</strong>
            <span className={dayChange >= 0 ? "up" : "down"}>
              {dayChange >= 0 ? "+" : ""}
              {dayChange.toFixed(2)}%
            </span>
          </div>
          {shares > 0.000001 ? (
            <div className="position-card">
              <div>
                <small>持仓数量</small>
                <b>{shareNf.format(shares)} 股</b>
              </div>
              <div>
                <small>当前市值</small>
                <b>
                  {currencySymbol}
                  {nf.format(positionValue)}
                </b>
              </div>
              <div className="position-bar">
                <i
                  style={{
                    width: `${Math.min(100, (positionValue / equity) * 100)}%`,
                  }}
                />
              </div>
              <span>仓位 {((positionValue / equity) * 100).toFixed(1)}%</span>
            </div>
          ) : (
            <div className="position-empty">
              <span className="empty-ring" />
              <b>当前空仓</b>
              <small>不操作也是一种有效决策</small>
            </div>
          )}
          {!finished ? (
            <>
              <div className="mode-tabs">
                <button
                  className={mode === "buy" ? "active buy" : ""}
                  onClick={() => {
                    setMode("buy");
                    setOrderInputMode("allocation");
                    setQuantityInput("");
                  }}
                >
                  买入
                </button>
                <button
                  className={mode === "sell" ? "active sell" : ""}
                  onClick={() => {
                    setMode("sell");
                    setOrderInputMode("allocation");
                    setQuantityInput("");
                  }}
                  disabled={!shares}
                >
                  卖出
                </button>
              </div>
              <div className="order-type-row">
                <span>市价委托</span>
                <small>下一交易日开盘成交</small>
              </div>
              <label className="field-label">
                {mode === "buy" ? "使用可用现金" : "卖出当前持仓"}
              </label>
              <div
                className="allocation-grid"
                role="group"
                aria-label="选择委托仓位"
              >
                {ORDER_ALLOCATIONS.map((value) => (
                  <button
                    key={value}
                    className={
                      orderInputMode === "allocation" && allocation === value
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setAllocation(value);
                      setOrderInputMode("allocation");
                      setQuantityInput("");
                    }}
                  >
                    {value === 1
                      ? "全仓"
                      : value === 1 / 3
                        ? "1/3"
                        : value === 0.25
                          ? "1/4"
                          : value === 0.5
                            ? "1/2"
                            : "3/4"}
                  </button>
                ))}
              </div>
              <label
                className="field-label quantity-label"
                htmlFor="order-quantity"
              >
                <span>或按股数委托</span>
                <small>
                  {market === "cn"
                    ? "A股 100 股起，按整手交易"
                    : "美股按整数股交易"}
                </small>
              </label>
              <div
                className={`quantity-field ${orderInputMode === "quantity" ? "active" : ""} ${quantityError ? "invalid" : ""}`}
              >
                <button
                  type="button"
                  className="quantity-step"
                  aria-label={`减少 ${lotSize} 股`}
                  disabled={
                    isRevealing || !quantityInput || Number(quantityInput) <= 0
                  }
                  onClick={() => adjustQuantity(-1)}
                >
                  −
                </button>
                <input
                  id="order-quantity"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={
                    market === "cn" ? "输入股数，如 500" : "输入股数，如 25"
                  }
                  value={quantityInput}
                  onFocus={() => setOrderInputMode("quantity")}
                  onChange={(event) => {
                    setOrderInputMode("quantity");
                    setQuantityInput(
                      event.target.value.replace(/\D/g, "").slice(0, 7),
                    );
                  }}
                />
                <button
                  type="button"
                  className="quantity-step"
                  aria-label={`增加 ${lotSize} 股`}
                  disabled={
                    isRevealing ||
                    maxQuotedQuantity <= 0 ||
                    Number(quantityInput || 0) >= maxQuotedQuantity
                  }
                  onClick={() => adjustQuantity(1)}
                >
                  ＋
                </button>
                <span>股</span>
              </div>
              {quantityError ? (
                <p className="order-error">{quantityError}</p>
              ) : (
                <div className="order-estimate">
                  <span>
                    预计委托 <b>{shareNf.format(estimatedQuantity)} 股</b>
                  </span>
                  <small>
                    按当前价约 {currencySymbol}
                    {nf.format(estimatedOrderValue)} · 实际以次日开盘价为准
                  </small>
                </div>
              )}
              <div className="decision-journal">
                <div className="field-label">
                  <span>本次判断</span>
                  <small>先写下观点，再看答案</small>
                </div>
                <div
                  className="outlook-grid"
                  role="group"
                  aria-label="判断后续走势"
                >
                  {(["up", "range", "down"] as const).map((value) => (
                    <button
                      key={value}
                      className={outlook === value ? "selected" : ""}
                      onClick={() => setOutlook(value)}
                    >
                      {value === "up"
                        ? "看涨"
                        : value === "range"
                          ? "震荡"
                          : "看跌"}
                    </button>
                  ))}
                </div>
                <div className="journal-row">
                  <label>
                    依据
                    <select
                      value={thesis}
                      onChange={(event) =>
                        setThesis(event.target.value as DecisionThesis)
                      }
                    >
                      <option value="trend">趋势延续</option>
                      <option value="breakout">突破确认</option>
                      <option value="reversal">反转预期</option>
                      <option value="volume">量价信号</option>
                      <option value="uncertain">没有把握</option>
                    </select>
                  </label>
                  <div>
                    <span>信心</span>
                    <div className="confidence-grid">
                      {([1, 2, 3] as const).map((value) => (
                        <button
                          key={value}
                          className={confidence === value ? "selected" : ""}
                          onClick={() => setConfidence(value)}
                        >
                          {value === 1 ? "低" : value === 2 ? "中" : "高"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="field-label holding-label">成交后推进多久</div>
              <div
                className="duration-grid"
                role="group"
                aria-label="选择持有交易日数"
              >
                {([1, 3, 5] as const).map((value) => (
                  <button
                    key={value}
                    className={revealDays === value ? "selected" : ""}
                    onClick={() => setRevealDays(value)}
                    disabled={value > remainingDays}
                  >
                    {value} 天
                  </button>
                ))}
              </div>
              <button
                className={`primary-action ${mode}`}
                disabled={tradeDisabled}
                onClick={() => advance("trade")}
              >
                {isRevealing
                  ? "行情逐日推进中…"
                  : `市价${mode === "buy" ? "买入" : "卖出"} ${shareNf.format(estimatedQuantity)} 股 · 推进 ${Math.min(revealDays, remainingDays)} 天`}{" "}
                {!isRevealing && <span>→</span>}
              </button>
              <button
                className="hold-action"
                disabled={isRevealing || remainingDays <= 0}
                onClick={() => advance("hold")}
              >
                {isRevealing
                  ? "逐根加载真实行情"
                  : `${shares ? "保持仓位" : "保持空仓"} ${Math.min(revealDays, remainingDays)} 天`}
              </button>
              <button className="finish-action" onClick={finishGame}>
                提前结束并揭晓股票
              </button>
              <p className="hint">
                {gameMode === "daily"
                  ? "今日短局共 12 次决策；服务器仅在提交判断后揭示后续行情"
                  : "不支持限价、做空或融资；可一直决策到该段真实历史结束"}
              </p>
            </>
          ) : (
            <div className="finished-panel">
              <small>本局已结束</small>
              <b>{profile.title}</b>
              <button
                className="primary-action"
                onClick={() => setResultOpen(true)}
              >
                查看完整结算
              </button>
            </div>
          )}
        </aside>
      </section>
      <footer className="source-note">
        A股 {initialChallenges.cn.universeSize.toLocaleString("zh-CN")}{" "}
        只全市场股票池 · 美股 {initialChallenges.us.universeSize} 只 ·
        每局按需加载真实日线 · 不构成投资建议
      </footer>

      {trainingOpen && (
        <dialog
          open
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTrainingOpen(false);
          }}
        >
          <section className="training-modal">
            <button
              className="modal-close"
              onClick={() => setTrainingOpen(false)}
            >
              ×
            </button>
            <small className="eyebrow">SCENARIO LAB · 针对性训练</small>
            <h2>今天想练哪一种行情？</h2>
            <p>系统从真实历史中筛选典型片段，但不会告诉你后面将如何发展。</p>
            <div className="scenario-grid">
              {(
                [
                  ["trend", "趋势识别", "练习顺势、加仓与退出节奏"],
                  ["reversal", "拐点应对", "练习辨别反弹与真正反转"],
                  ["crash", "急跌生存", "练习减仓、空仓和回撤控制"],
                  ["volatile", "高波动控仓", "练习仓位大小与信心校准"],
                ] as const
              ).map(([value, title, description]) => (
                <button
                  key={value}
                  disabled={challengeLoading}
                  onClick={() => void resetGame("practice", market, value)}
                >
                  <span>{title}</span>
                  <small>{description}</small>
                  <i>开始训练 →</i>
                </button>
              ))}
            </div>
            <div className="interval-roadmap">
              <div>
                <b>日 K 经典训练</b>
                <span>已开放 · 覆盖完整历史周期</span>
              </div>
              <div>
                <b>15 分钟事件局</b>
                <span>内测 · 仅接入合规分钟数据后开放</span>
              </div>
              <div>
                <b>5 分钟快节奏</b>
                <span>内测 · 不使用伪造或拼接行情</span>
              </div>
            </div>
          </section>
        </dialog>
      )}

      {rulesOpen && (
        <dialog
          open
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section className="rules-modal">
            <button className="modal-close" onClick={() => setRulesOpen(false)}>
              ×
            </button>
            <small>HOW TO PLAY</small>
            <h2>在真实牛熊周期里做决策</h2>
            <ol>
              <li>
                <b>市场</b>
                <span>
                  可随时选择 A 股或美股；A 股从{" "}
                  {initialChallenges.cn.universeSize.toLocaleString("zh-CN")}{" "}
                  只全市场股票池中抽取。
                </span>
              </li>
              <li>
                <b>观察</b>
                <span>
                  开局提供 120 根真实日
                  K，覆盖约半年走势，股票身份和历史日期隐藏。
                </span>
              </li>
              <li>
                <b>委托</b>
                <span>
                  仅支持市价买卖，可选
                  1/4、1/3、1/2、3/4、全仓，也可直接输入股数；统一在下一交易日开盘成交。
                </span>
              </li>
              <li>
                <b>交易单位</b>
                <span>
                  A 股买卖按 100
                  股整手处理，美股按整数股处理；不允许超出可用资金或当前持仓。
                </span>
              </li>
              <li>
                <b>持有</b>
                <span>
                  每次选择向前推进 1、3 或 5
                  个真实交易日，期间仓位不变、净值逐日计算。
                </span>
              </li>
              <li>
                <b>周期</b>
                <span>
                  今日短局包含 12
                  次决策；无限练习与情境训练不设固定上限，也可以随时提前结束。
                </span>
              </li>
              <li>
                <b>判断</b>
                <span>
                  每次推进前记录看涨、震荡或看跌，并选择判断依据与信心；结算时逐笔检查是否命中。
                </span>
              </li>
              <li>
                <b>评分</b>
                <span>
                  综合超额收益、最大回撤、交易纪律与信心校准；高收益但高信心误判不会获得满分。
                </span>
              </li>
              <li>
                <b>复盘</b>
                <span>
                  结算后揭晓真实股票、交易所和日期，并从仓位、风险、频率、持有周期和买卖时机生成深度画像。
                </span>
              </li>
            </ol>
            <button
              className="primary-action"
              onClick={() => setRulesOpen(false)}
            >
              继续挑战
            </button>
          </section>
        </dialog>
      )}

      {scoreboardOpen && (
        <dialog
          open
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setScoreboardOpen(false);
          }}
        >
          <section className="leaderboard-modal">
            <button
              className="modal-close"
              onClick={() => setScoreboardOpen(false)}
            >
              ×
            </button>
            <small className="eyebrow">
              PLAYER PROFILE · {marketLabel}今日同题榜
            </small>
            <div className="player-editor">
              <span>{nickname.slice(0, 1)}</span>
              <div>
                <small>我的盲盘名</small>
                <input
                  value={nickname}
                  maxLength={12}
                  onChange={(event) => setNickname(event.target.value)}
                  onBlur={() => {
                    const name =
                      nickname.trim() ||
                      `盲盘客${playerId.slice(-4).toUpperCase()}`;
                    setNickname(name);
                    localStorage.setItem("mangpan-player-name", name);
                  }}
                />
              </div>
            </div>
            {scoreboard?.stats && (
              <>
                <div className="career-grid">
                  <div>
                    <b>{scoreboard.stats.streak}</b>
                    <small>连续挑战</small>
                  </div>
                  <div>
                    <b>{scoreboard.stats.completedDays}</b>
                    <small>完成天数</small>
                  </div>
                  <div>
                    <b>{scoreboard.stats.averageScore}</b>
                    <small>平均评分</small>
                  </div>
                  <div>
                    <b>{scoreboard.stats.bestScore}</b>
                    <small>最佳评分</small>
                  </div>
                </div>
                <div className="profile-card career-profile">
                  <small>近 7 局决策画像</small>
                  <b>{scoreboard.stats.profile.title}</b>
                  <p>{scoreboard.stats.profile.text}</p>
                </div>
                <div className="growth-track">
                  <div>
                    <span>交易等级 LV.{scoreboard.stats.level}</span>
                    <b>{scoreboard.stats.xp} XP</b>
                  </div>
                  <i>
                    <em
                      style={{
                        width: `${scoreboard.stats.levelProgress / 3}%`,
                      }}
                    />
                  </i>
                  <small>
                    再获得 {300 - scoreboard.stats.levelProgress} XP 升级 ·
                    每局按风险调整评分积累
                  </small>
                </div>
              </>
            )}
            <div className="board-head">
              <b>{marketLabel}今日排行榜</b>
              <span>{scoreboard?.total || 0} 人完成</span>
            </div>
            <div className="board-list">
              {scoreboard?.leaderboard.length ? (
                scoreboard.leaderboard.map((item) => (
                  <div
                    key={`${item.rank}-${item.nickname}`}
                    className={item.isPlayer ? "me" : ""}
                  >
                    <i>
                      {item.rank <= 3
                        ? ["🥇", "🥈", "🥉"][item.rank - 1]
                        : item.rank}
                    </i>
                    <span>
                      {item.nickname}
                      {item.isPlayer && <em>我</em>}
                    </span>
                    <b>{item.score}</b>
                    <small className={item.returnRate >= 0 ? "up" : "down"}>
                      {item.returnRate >= 0 ? "+" : ""}
                      {item.returnRate.toFixed(1)}%
                    </small>
                  </div>
                ))
              ) : (
                <p className="board-empty">
                  还没有人完成今日挑战，等你成为第一名。
                </p>
              )}
            </div>
            <p className="board-note">
              排名按服务器复算的首次正式成绩生成；A股与美股分榜，股票身份在结算前隐藏。
            </p>
          </section>
        </dialog>
      )}

      {resultOpen && (
        <div className="modal-backdrop result-backdrop">
          <section className="result-modal">
            <small className="eyebrow">
              {gameMode === "daily"
                ? `${marketLabel}今日盲盘 #${today.slice(5).replace("-", "")}`
                : `${marketLabel}${scenarioLabel}`}{" "}
              · 股票揭晓
            </small>
            <h1>{stock.name}</h1>
            <p className="stock-code">
              {stock.market} · {stock.code}
            </p>
            <div
              className={`result-hero ${returnRate >= 0 ? "positive" : "negative"}`}
            >
              <span>最终收益</span>
              <strong>
                {returnRate >= 0 ? "+" : ""}
                {returnRate.toFixed(2)}%
              </strong>
              <small>
                {currencySymbol}
                {nf.format(INITIAL_CASH)} → {currencySymbol}
                {nf.format(equity)}
              </small>
            </div>
            <div className="result-grid">
              <div>
                <small>操盘评分</small>
                <b>{skillScore}</b>
              </div>
              <div>
                <small>股票同期</small>
                <b className={benchmark >= 0 ? "up" : "down"}>
                  {benchmark >= 0 ? "+" : ""}
                  {benchmark.toFixed(2)}%
                </b>
              </div>
              <div>
                <small>超额收益</small>
                <b>
                  {excess >= 0 ? "+" : ""}
                  {excess.toFixed(2)}%
                </b>
              </div>
              <div>
                <small>最大回撤</small>
                <b>{maxDrawdown.toFixed(2)}%</b>
              </div>
            </div>
            <div className="decision-result">
              <div>
                <small>方向判断</small>
                <b>
                  {decisionStats.hits}/{decisionStats.total}
                </b>
              </div>
              <div>
                <small>命中率</small>
                <b>{decisionStats.accuracy.toFixed(0)}%</b>
              </div>
              <div>
                <small>信心校准</small>
                <b>{decisionStats.calibration.toFixed(0)}</b>
              </div>
              <p>
                {decisionStats.confidentMisses
                  ? `有 ${decisionStats.confidentMisses} 次高信心误判；下局先降低仓位，再等待走势确认。`
                  : "你的主观判断与真实后续走势会被逐笔对照，评分不再只奖励高收益。"}
              </p>
            </div>
            {gameMode === "daily" && (
              <div className="rank-result">
                {scoreStatus === "loading" ? (
                  <p>正在由服务器复算决策路径并生成排名…</p>
                ) : scoreStatus === "error" ? (
                  <button onClick={() => setScoreStatus("idle")}>
                    成绩提交失败，点击重试
                  </button>
                ) : scoreboard?.playerScore ? (
                  <>
                    <div>
                      <small>{marketLabel}今日首次成绩</small>
                      <b>第 {scoreboard.playerScore.rank} 名</b>
                      <span>
                        超过 {scoreboard.playerScore.percentile}% 玩家 · 共{" "}
                        {scoreboard.total} 人
                      </span>
                    </div>
                    {duelId && (
                      <div className="duel-result">
                        <small>好友对决</small>
                        {scoreboard.opponent ? (
                          <b
                            className={
                              scoreboard.playerScore.score >=
                              scoreboard.opponent.score
                                ? "win"
                                : "lose"
                            }
                          >
                            {scoreboard.playerScore.score} :{" "}
                            {scoreboard.opponent.score}
                            <em>
                              {scoreboard.playerScore.score >=
                              scoreboard.opponent.score
                                ? "你领先"
                                : "好友领先"}
                            </em>
                          </b>
                        ) : (
                          <span>好友尚未完成，稍后再来看</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p>完成校验后显示今日排名</p>
                )}
              </div>
            )}
            <div className="profile-card">
              <small>本局交易画像</small>
              <b>{profile.title}</b>
              <p>{profile.text}</p>
            </div>
            <button
              className="analysis-action"
              onClick={() => setAnalysisOpen(true)}
            >
              <span>
                <small>个性化交易复盘</small>
                <b>深度分析我的画像</b>
              </span>
              <i>查看仓位、风险、择时与训练建议 →</i>
            </button>
            <div className="date-reveal">
              本局走到：{stock.candles[initialVisibleCount - 1].date} —{" "}
              {stock.candles[visibleCount - 1].date} · 完整数据：
              {stock.candles[0].date} — {stock.candles.at(-1)?.date}（
              {stock.candles.length.toLocaleString("zh-CN")} 根）· 共 {trades}{" "}
              次交易
            </div>
            <div className="result-actions three">
              <button className="primary-action" onClick={shareResult}>
                {shareStatus ||
                  (gameMode === "daily" ? "发起好友同图挑战" : "分享战绩")}
              </button>
              <button
                className="hold-action"
                disabled={challengeLoading}
                onClick={() =>
                  void resetGame(gameMode === "daily" ? "practice" : "daily")
                }
              >
                {challengeLoading
                  ? "正在抽取历史行情…"
                  : gameMode === "daily"
                    ? "随机练习"
                    : "返回今日挑战"}
              </button>
              <button
                className="review-action"
                onClick={() => setResultOpen(false)}
              >
                返回复盘 K 线
              </button>
            </div>
          </section>
        </div>
      )}

      {analysisOpen && (
        <dialog
          open
          className="modal-backdrop analysis-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAnalysisOpen(false);
          }}
        >
          <section className="analysis-modal">
            <button
              className="modal-close"
              onClick={() => setAnalysisOpen(false)}
            >
              ×
            </button>
            <small className="eyebrow">MY TRADING DNA · 本局深度复盘</small>
            <div className="analysis-hero">
              <span>你的交易画像</span>
              <h2>{deepProfile.title}</h2>
              <p>{deepProfile.summary}</p>
              <small>{deepProfile.confidence}</small>
            </div>
            <div className="analysis-metrics">
              {deepProfile.metrics.map((metric) => (
                <div key={metric.label}>
                  <small>{metric.label}</small>
                  <b>{metric.value}</b>
                  <span>{metric.note}</span>
                </div>
              ))}
            </div>
            <div className="analysis-section-head">
              <b>四维诊断</b>
              <span>基于本局逐日净值与真实成交点</span>
            </div>
            <div className="analysis-dimensions">
              {deepProfile.dimensions.map((dimension) => (
                <article key={dimension.label} className={dimension.tone}>
                  <div>
                    <span>{dimension.label}</span>
                    <b>{dimension.grade}</b>
                  </div>
                  <p>{dimension.text}</p>
                </article>
              ))}
            </div>
            <div className="analysis-section-head">
              <b>判断校准</b>
              <span>观点 × 信心 × 后续真实走势</span>
            </div>
            <div className="calibration-card">
              <strong>{decisionStats.accuracy.toFixed(0)}%</strong>
              <div>
                <b>
                  {decisionStats.hits} / {decisionStats.total} 次方向命中
                </b>
                <p>
                  {decisionStats.total < 4
                    ? "样本仍少，继续记录判断后才能形成稳定画像。"
                    : decisionStats.calibration >= 70
                      ? "方向与信心匹配良好，继续避免因为连续命中而突然放大仓位。"
                      : "高信心并没有稳定转化成命中，建议把‘预测’和‘下单仓位’分开管理。"}
                </p>
              </div>
            </div>
            <div className="analysis-section-head">
              <b>带走的 3 条经验</b>
              <span>下一局可以直接执行</span>
            </div>
            <ol className="analysis-lessons">
              {deepProfile.lessons.map((lesson, index) => (
                <li key={lesson}>
                  <i>0{index + 1}</i>
                  <span>{lesson}</span>
                </li>
              ))}
            </ol>
            <div className="training-goal">
              <small>NEXT SESSION GOAL</small>
              <b>{deepProfile.trainingGoal}</b>
            </div>
            <p className="analysis-disclaimer">
              画像只反映本局历史样本，用于训练决策与复盘，不构成投资建议。
            </p>
            <button
              className="primary-action"
              onClick={() => setAnalysisOpen(false)}
            >
              返回结算
            </button>
          </section>
        </dialog>
      )}
    </main>
  );
}
