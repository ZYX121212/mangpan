"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STOCK_SAMPLES, type Candle } from "./stock-data";

const INITIAL_CASH = 100_000;
const INITIAL_BARS = 60;
const STEP = 5;
const MAX_ROUNDS = 20;
const nf = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type TradeMode = "buy" | "sell";
type TradeMarker = { index: number; type: "B" | "S"; price: number };

function average(data: Candle[], at: number, period: number) {
  if (at < period - 1) return null;
  let total = 0;
  for (let i = at - period + 1; i <= at; i++) total += data[i].close;
  return total / period;
}

function CandleChart({ data, markers }: { data: Candle[]; markers: TradeMarker[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [viewSize, setViewSize] = useState(INITIAL_BARS);
  const maxView = Math.min(120, data.length);
  const effectiveView = Math.min(viewSize, data.length);
  const changeZoom = (delta: number) => {
    setHover(null);
    setViewSize((value) => Math.max(24, Math.min(maxView, value + delta)));
  };

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
      const w = rect.width, h = rect.height, right = 62, top = 18, volumeH = 82;
      const priceBottom = h - volumeH - 30;
      const start = Math.max(0, data.length - effectiveView);
      const shown = data.slice(start);
      const values = shown.flatMap((d) => [d.high, d.low]);
      const min = Math.min(...values), max = Math.max(...values), range = Math.max(1, max - min), pad = range * 0.07;
      const priceY = (value: number) => top + ((max + pad - value) / (range + pad * 2)) * (priceBottom - top);
      const slot = (w - right) / shown.length, bodyW = Math.max(2, Math.min(8, slot * 0.62));
      ctx.clearRect(0, 0, w, h);
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "left";
      for (let i = 0; i < 5; i++) {
        const y = top + ((priceBottom - top) / 4) * i;
        ctx.strokeStyle = "#eae7df"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w - right, Math.round(y) + 0.5); ctx.stroke();
        const label = max + pad - ((range + pad * 2) / 4) * i;
        ctx.fillStyle = "#97958f"; ctx.fillText(label.toFixed(2), w - right + 8, y + 4);
      }
      for (let i = 0; i <= 4; i++) {
        const x = ((w - right) / 4) * i;
        ctx.strokeStyle = "#f0ede7"; ctx.beginPath(); ctx.moveTo(x + 0.5, top); ctx.lineTo(x + 0.5, h - 22); ctx.stroke();
        if (i < 4) { ctx.fillStyle = "#aaa8a2"; ctx.fillText(`T${start + Math.round((shown.length / 4) * i) - data.length}`, x + 5, h - 7); }
      }
      ctx.strokeStyle = "#dedbd3"; ctx.beginPath(); ctx.moveTo(0, priceBottom + 17.5); ctx.lineTo(w - right, priceBottom + 17.5); ctx.stroke();
      const maxVolume = Math.max(...shown.map((d) => d.volume));
      shown.forEach((d, i) => {
        const x = slot * i + slot / 2, up = d.close >= d.open, color = up ? "#df4a56" : "#129a76";
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, priceY(d.high)); ctx.lineTo(Math.round(x) + 0.5, priceY(d.low)); ctx.stroke();
        const y = Math.min(priceY(d.open), priceY(d.close));
        const bh = Math.max(1.3, Math.abs(priceY(d.open) - priceY(d.close)));
        if (up) { ctx.strokeRect(x - bodyW / 2, y, bodyW, bh); ctx.fillStyle = "#fffdf9"; ctx.fillRect(x - bodyW / 2 + 1, y + 1, Math.max(0, bodyW - 2), Math.max(0, bh - 2)); }
        else ctx.fillRect(x - bodyW / 2, y, bodyW, bh);
        ctx.globalAlpha = 0.34; ctx.fillStyle = color;
        const vh = (d.volume / maxVolume) * (volumeH - 22);
        ctx.fillRect(x - bodyW / 2, h - 24 - vh, bodyW, vh); ctx.globalAlpha = 1;
      });
      ([{ p: 5, c: "#c9952f" }, { p: 10, c: "#6b79bd" }, { p: 20, c: "#a06999" }] as const).forEach(({ p, c }) => {
        ctx.strokeStyle = c; ctx.lineWidth = 1.15; ctx.globalAlpha = 0.92; ctx.beginPath(); let active = false;
        shown.forEach((_, i) => { const value = average(data, start + i, p); if (value == null) return; const x = slot * i + slot / 2, y = priceY(value); if (!active) { ctx.moveTo(x, y); active = true; } else ctx.lineTo(x, y); });
        ctx.stroke(); ctx.globalAlpha = 1;
      });
      const last = shown[shown.length - 1];
      const ly = priceY(last.close);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = last.close >= last.open ? "#df4a56" : "#129a76"; ctx.globalAlpha = 0.65;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w - right, ly); ctx.stroke(); ctx.restore();
      ctx.fillStyle = last.close >= last.open ? "#df4a56" : "#129a76"; ctx.fillRect(w - right, ly - 10, right, 20);
      ctx.fillStyle = "white"; ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.fillText(last.close.toFixed(2), w - right + 7, ly + 4);
      markers.filter((marker) => marker.index >= start && marker.index < data.length).forEach((marker) => {
        const localIndex = marker.index - start, candle = shown[localIndex];
        if (!candle) return;
        const x = slot * localIndex + slot / 2, buy = marker.type === "B", color = buy ? "#df4a56" : "#129a76";
        const wickY = priceY(buy ? candle.low : candle.high);
        const markerY = buy ? Math.min(priceBottom - 11, wickY + 18) : Math.max(top + 13, wickY - 18);
        ctx.strokeStyle = color; ctx.globalAlpha = 0.72; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, wickY); ctx.lineTo(x, markerY); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, markerY, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "700 10px Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText(marker.type, x, markerY + 3.5); ctx.textAlign = "left";
      });
      if (hover != null && hover >= 0 && hover < shown.length) {
        const d = shown[hover], x = slot * hover + slot / 2, y = priceY(d.close);
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = "#77766f"; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - 22); ctx.moveTo(0, y); ctx.lineTo(w - right, y); ctx.stroke(); ctx.restore();
        const trade = markers.find((marker) => marker.index === start + hover);
        const label = `第 ${start + hover + 1} 日  开 ${d.open.toFixed(2)}  高 ${d.high.toFixed(2)}  低 ${d.low.toFixed(2)}  收 ${d.close.toFixed(2)}${trade ? `  ·  ${trade.type} ${trade.type === "B" ? "买入" : "卖出"}` : ""}`;
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        const tw = Math.min(w - right - 16, ctx.measureText(label).width + 18), tx = Math.min(Math.max(7, x - tw / 2), w - right - tw - 7);
        ctx.fillStyle = "rgba(32,33,29,.92)"; ctx.fillRect(tx, top + 4, tw, 25); ctx.fillStyle = "white"; ctx.fillText(label, tx + 9, top + 20);
      }
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(canvas); return () => observer.disconnect();
  }, [data, effectiveView, hover, markers]);

  return <div className="chart-area">
    <div className="chart-tools">
      <div className="trade-legend"><span className="buy-dot">B</span>买入点<span className="sell-dot">S</span>卖出点</div>
      <div className="zoom-tools"><small>显示 {effectiveView} 根</small><button onClick={() => changeZoom(12)} disabled={effectiveView >= maxView} aria-label="缩小K线图">−</button><button onClick={() => changeZoom(-12)} disabled={effectiveView <= 24} aria-label="放大K线图">＋</button><button className="reset-zoom" onClick={() => changeZoom(INITIAL_BARS - viewSize)}>重置</button></div>
    </div>
    <canvas ref={canvasRef} className="chart-canvas" aria-label="可缩放的真实历史日K线图" onWheel={(event) => { event.preventDefault(); changeZoom(event.deltaY > 0 ? 8 : -8); }} onMouseLeave={() => setHover(null)} onMouseMove={(event) => { const shownLength = effectiveView; const slot = (event.currentTarget.getBoundingClientRect().width - 62) / shownLength; setHover(Math.max(0, Math.min(shownLength - 1, Math.floor(event.nativeEvent.offsetX / slot)))); }} />
  </div>;
}

export default function Home() {
  const [stockIndex, setStockIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BARS);
  const [round, setRound] = useState(0);
  const [cash, setCash] = useState(INITIAL_CASH);
  const [shares, setShares] = useState(0);
  const [mode, setMode] = useState<TradeMode>("buy");
  const [allocation, setAllocation] = useState(1);
  const [trades, setTrades] = useState(0);
  const [tradeMarkers, setTradeMarkers] = useState<TradeMarker[]>([]);
  const [equityHistory, setEquityHistory] = useState([INITIAL_CASH]);
  const [ended, setEnded] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [revealPulse, setRevealPulse] = useState(0);
  const stock = STOCK_SAMPLES[stockIndex];
  const data = stock.candles.slice(0, visibleCount);
  const current = data[data.length - 1], previous = data[data.length - 2];
  const positionValue = shares * current.close, equity = cash + positionValue;
  const returnRate = (equity / INITIAL_CASH - 1) * 100;
  const dayChange = (current.close / previous.close - 1) * 100;
  const ma5 = average(data, data.length - 1, 5), ma10 = average(data, data.length - 1, 10), ma20 = average(data, data.length - 1, 20);
  const benchmark = (current.close / stock.candles[INITIAL_BARS - 1].close - 1) * 100;
  const maxDrawdown = useMemo(() => { let peak = equityHistory[0], worst = 0; equityHistory.forEach((v) => { peak = Math.max(peak, v); worst = Math.min(worst, (v / peak - 1) * 100); }); return worst; }, [equityHistory]);

  const reset = () => {
    setStockIndex((stockIndex + 1 + Math.floor(Math.random() * (STOCK_SAMPLES.length - 1))) % STOCK_SAMPLES.length);
    setVisibleCount(INITIAL_BARS); setRound(0); setCash(INITIAL_CASH); setShares(0); setMode("buy"); setAllocation(1); setTrades(0); setTradeMarkers([]); setEquityHistory([INITIAL_CASH]); setEnded(false); setRevealPulse(0);
  };

  const advance = (action: "trade" | "hold") => {
    if (ended) return;
    let nextCash = cash, nextShares = shares, didTrade = false;
    if (action === "trade" && mode === "buy" && cash > 0.01) { const spend = cash * allocation; nextCash -= spend; nextShares += spend / current.close; didTrade = spend > 0.01; }
    if (action === "trade" && mode === "sell" && shares > 0.000001) { const amount = shares * allocation; nextShares -= amount; nextCash += amount * current.close; didTrade = amount > 0.000001; }
    const nextVisible = Math.min(visibleCount + STEP, INITIAL_BARS + MAX_ROUNDS * STEP, stock.candles.length);
    const nextPrice = stock.candles[nextVisible - 1].close;
    const nextEquity = nextCash + nextShares * nextPrice;
    const nextRound = round + 1;
    if (didTrade) setTradeMarkers((value) => [...value, { index: visibleCount - 1, type: mode === "buy" ? "B" : "S", price: current.close }]);
    setCash(nextCash); setShares(nextShares); setVisibleCount(nextVisible); setRound(nextRound); setTrades((v) => v + (didTrade ? 1 : 0)); setEquityHistory((v) => [...v, nextEquity]); setRevealPulse((v) => v + 1);
    if (nextRound >= MAX_ROUNDS || nextEquity <= INITIAL_CASH * 0.2 || nextVisible >= stock.candles.length) setEnded(true);
  };

  const tradeDisabled = mode === "buy" ? cash < 0.01 : shares < 0.000001;
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">K</span><span>盲盘</span></div>
        <div className="round-pill"><span>第 {String(round + 1).padStart(2, "0")} 局</span><i />剩余 {MAX_ROUNDS - round} 回合</div>
        <button className="text-button" onClick={() => setRulesOpen(true)}>游戏规则</button>
      </header>
      <section className="portfolio-strip">
        <div><small>总资产</small><strong>¥{nf.format(equity)}</strong></div><div><small>持仓市值</small><strong>¥{nf.format(positionValue)}</strong></div><div><small>可用现金</small><strong>¥{nf.format(cash)}</strong></div><div><small>累计收益</small><strong className={returnRate > 0 ? "up" : returnRate < 0 ? "down" : "muted"}>{returnRate > 0 ? "+" : ""}{returnRate.toFixed(2)}%</strong></div>
        <div className="challenge"><span>未知股票</span><small>身份将在结算后揭晓</small></div>
      </section>
      <section className="workspace">
        <div className="chart-panel">
          {revealPulse > 0 && <span key={revealPulse} className="reveal-toast">+5 个交易日</span>}
          <div className="chart-head"><div><span className="ticker-mask">••••••</span><span className="market-tag">日 K</span><span className="adjust-tag">前复权</span></div><div className="ohlc"><span>开 <b>{current.open.toFixed(2)}</b></span><span>高 <b>{current.high.toFixed(2)}</b></span><span>低 <b>{current.low.toFixed(2)}</b></span><span>收 <b>{current.close.toFixed(2)}</b></span><strong className={dayChange >= 0 ? "up" : "down"}>{dayChange >= 0 ? "+" : ""}{dayChange.toFixed(2)}%</strong></div></div>
          <div className="ma-row"><span>MA5 {ma5?.toFixed(2)}</span><span>MA10 {ma10?.toFixed(2)}</span><span>MA20 {ma20?.toFixed(2)}</span><em>VOL {Math.round(current.volume / 100) / 100} 手</em></div>
          <CandleChart data={data} markers={tradeMarkers} />
        </div>
        <aside className="trade-panel">
          <div className="decision-head"><span>做出决策</span><small>按当前收盘价成交</small></div>
          <div className="price-block"><small>当前价格</small><strong>{current.close.toFixed(2)}</strong><span className={dayChange >= 0 ? "up" : "down"}>{dayChange >= 0 ? "+" : ""}{dayChange.toFixed(2)}%</span></div>
          {shares > 0.000001 ? <div className="position-card"><div><small>持仓数量</small><b>{nf.format(shares)} 股</b></div><div><small>当前市值</small><b>¥{nf.format(positionValue)}</b></div><div className="position-bar"><i style={{ width: `${Math.min(100, positionValue / equity * 100)}%` }} /></div><span>仓位 {((positionValue / equity) * 100).toFixed(1)}%</span></div> : <div className="position-empty"><span className="empty-ring" /><b>当前空仓</b><small>选择买入仓位开始交易</small></div>}
          <div className="mode-tabs"><button className={mode === "buy" ? "active buy" : ""} onClick={() => setMode("buy")}>买入</button><button className={mode === "sell" ? "active sell" : ""} onClick={() => setMode("sell")} disabled={!shares}>卖出</button></div>
          <label className="field-label">{mode === "buy" ? "使用可用现金" : "卖出当前持仓"}</label>
          <div className="allocation-grid">{[.25, .5, 1].map((value) => <button key={value} className={allocation === value ? "selected" : ""} onClick={() => setAllocation(value)}>{value === 1 ? "全部" : `${value * 100}%`}</button>)}</div>
          <button className={`primary-action ${mode}`} disabled={tradeDisabled} onClick={() => advance("trade")}>{mode === "buy" ? "买入" : "卖出"}并推进 5 天 <span>→</span></button>
          <button className="hold-action" onClick={() => advance("hold")}>{shares ? "保持仓位" : "保持空仓"}，推进 5 天</button>
          <button className="finish-action" onClick={() => setEnded(true)}>结束本局并揭晓股票</button>
          <p className="hint">每次行动后，将揭晓未来 5 个真实交易日</p>
        </aside>
      </section>
      <footer className="source-note">历史行情样本 · 前复权日线 · 不构成任何投资建议</footer>

      {rulesOpen && <div className="modal-backdrop" onMouseDown={() => setRulesOpen(false)}><section className="rules-modal" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setRulesOpen(false)}>×</button><small>HOW TO PLAY</small><h2>只看走势，不看答案</h2><ol><li><b>观察</b><span>开局提供 60 根真实历史日 K 线，股票和日期完全隐藏。</span></li><li><b>决策</b><span>按当前收盘价买入、卖出或持有，成交后图中会留下 B/S 点。</span></li><li><b>缩放</b><span>滚动鼠标滚轮或使用图上按钮，放大查看 K 线细节。</span></li><li><b>揭晓</b><span>每次行动推进 5 个交易日，最多 20 回合。</span></li><li><b>结算</b><span>结束后揭晓股票代码、日期、收益和同期涨跌幅。</span></li></ol><button className="primary-action" onClick={() => setRulesOpen(false)}>开始挑战</button></section></div>}

      {ended && <div className="modal-backdrop result-backdrop"><section className="result-modal"><small className="eyebrow">挑战结束 · 股票揭晓</small><h1>{stock.name}</h1><p className="stock-code">{stock.market} · {stock.code}</p><div className={`result-hero ${returnRate >= 0 ? "positive" : "negative"}`}><span>最终收益</span><strong>{returnRate >= 0 ? "+" : ""}{returnRate.toFixed(2)}%</strong><small>¥{nf.format(INITIAL_CASH)} → ¥{nf.format(equity)}</small></div><div className="result-grid"><div><small>股票同期</small><b className={benchmark >= 0 ? "up" : "down"}>{benchmark >= 0 ? "+" : ""}{benchmark.toFixed(2)}%</b></div><div><small>超额收益</small><b>{returnRate - benchmark >= 0 ? "+" : ""}{(returnRate - benchmark).toFixed(2)}%</b></div><div><small>最大回撤</small><b>{maxDrawdown.toFixed(2)}%</b></div><div><small>交易次数</small><b>{trades} 次</b></div></div><div className="date-reveal">真实区间：{stock.candles[INITIAL_BARS - 1].date} — {current.date}</div><div className="result-actions"><button className="primary-action" onClick={reset}>再来一局 <span>→</span></button><button className="hold-action" onClick={() => setEnded(false)} disabled={round >= MAX_ROUNDS}>返回复盘</button></div></section></div>}
    </main>
  );
}
