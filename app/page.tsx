"use client";

/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- dialog backdrops only close when the backdrop itself is pressed */

import { useEffect, useMemo, useRef, useState } from "react";
import { STOCK_SAMPLES, type Candle } from "./stock-data";
import { INITIAL_BARS, INITIAL_CASH, MAX_ROUNDS, STEP, TOTAL_BARS, chinaDate, clamp, getChallenge, type ReplayAction } from "./game-core";

const nf = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type TradeMode = "buy" | "sell";
type GameMode = "daily" | "practice";
type TradeMarker = { index: number; type: "B" | "S"; price: number; round: number };
type RankedScore = { nickname: string; score: number; returnRate: number; rank: number; percentile?: number; isPlayer?: boolean; excess?: number; maxDrawdown?: number };
type Scoreboard = {
  total: number;
  leaderboard: RankedScore[];
  playerScore: RankedScore | null;
  opponent: RankedScore | null;
  stats: null | { completedDays: number; streak: number; averageScore: number; bestScore: number; profile: { title: string; text: string } };
};

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
  const maxView = Math.min(120, data.length), effectiveView = Math.min(viewSize, data.length);
  const changeZoom = (delta: number) => { setHover(null); setViewSize((value) => Math.max(24, Math.min(maxView, value + delta))); };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width, h = rect.height, right = 62, top = 18, volumeH = 82, priceBottom = h - volumeH - 30;
      const start = Math.max(0, data.length - effectiveView), shown = data.slice(start);
      const values = shown.flatMap((d) => [d.high, d.low]);
      const min = Math.min(...values), max = Math.max(...values), range = Math.max(1, max - min), pad = range * .07;
      const priceY = (value: number) => top + ((max + pad - value) / (range + pad * 2)) * (priceBottom - top);
      const slot = (w - right) / shown.length, bodyW = Math.max(2, Math.min(9, slot * .62));
      ctx.clearRect(0, 0, w, h); ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.textAlign = "left";
      for (let i = 0; i < 5; i++) {
        const y = top + ((priceBottom - top) / 4) * i;
        ctx.strokeStyle = "#eae7df"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w - right, Math.round(y) + .5); ctx.stroke();
        const label = max + pad - ((range + pad * 2) / 4) * i; ctx.fillStyle = "#97958f"; ctx.fillText(label.toFixed(2), w - right + 8, y + 4);
      }
      for (let i = 0; i <= 4; i++) {
        const x = ((w - right) / 4) * i; ctx.strokeStyle = "#f0ede7"; ctx.beginPath(); ctx.moveTo(x + .5, top); ctx.lineTo(x + .5, h - 22); ctx.stroke();
        if (i < 4) { ctx.fillStyle = "#aaa8a2"; ctx.fillText(`T${start + Math.round((shown.length / 4) * i) - data.length}`, x + 5, h - 7); }
      }
      ctx.strokeStyle = "#dedbd3"; ctx.beginPath(); ctx.moveTo(0, priceBottom + 17.5); ctx.lineTo(w - right, priceBottom + 17.5); ctx.stroke();
      const maxVolume = Math.max(...shown.map((d) => d.volume));
      shown.forEach((d, i) => {
        const x = slot * i + slot / 2, up = d.close >= d.open, color = up ? "#df4a56" : "#129a76";
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, priceY(d.high)); ctx.lineTo(Math.round(x) + .5, priceY(d.low)); ctx.stroke();
        const y = Math.min(priceY(d.open), priceY(d.close)), bh = Math.max(1.3, Math.abs(priceY(d.open) - priceY(d.close)));
        if (up) { ctx.strokeRect(x - bodyW / 2, y, bodyW, bh); ctx.fillStyle = "#fffdf9"; ctx.fillRect(x - bodyW / 2 + 1, y + 1, Math.max(0, bodyW - 2), Math.max(0, bh - 2)); } else ctx.fillRect(x - bodyW / 2, y, bodyW, bh);
        ctx.globalAlpha = .34; ctx.fillStyle = color; const vh = (d.volume / maxVolume) * (volumeH - 22); ctx.fillRect(x - bodyW / 2, h - 24 - vh, bodyW, vh); ctx.globalAlpha = 1;
      });
      ([{ p: 5, c: "#c9952f" }, { p: 10, c: "#6b79bd" }, { p: 20, c: "#a06999" }] as const).forEach(({ p, c }) => {
        ctx.strokeStyle = c; ctx.lineWidth = 1.15; ctx.globalAlpha = .92; ctx.beginPath(); let active = false;
        shown.forEach((_, i) => { const value = average(data, start + i, p); if (value == null) return; const x = slot * i + slot / 2, y = priceY(value); if (!active) { ctx.moveTo(x, y); active = true; } else ctx.lineTo(x, y); }); ctx.stroke(); ctx.globalAlpha = 1;
      });
      const last = shown[shown.length - 1], ly = priceY(last.close);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = last.close >= last.open ? "#df4a56" : "#129a76"; ctx.globalAlpha = .65; ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w - right, ly); ctx.stroke(); ctx.restore();
      ctx.fillStyle = last.close >= last.open ? "#df4a56" : "#129a76"; ctx.fillRect(w - right, ly - 10, right, 20); ctx.fillStyle = "white"; ctx.fillText(last.close.toFixed(2), w - right + 7, ly + 4);
      markers.filter((marker) => marker.index >= start && marker.index < data.length).forEach((marker) => {
        const localIndex = marker.index - start, candle = shown[localIndex]; if (!candle) return;
        const x = slot * localIndex + slot / 2, buy = marker.type === "B", color = buy ? "#df4a56" : "#129a76", wickY = priceY(buy ? candle.low : candle.high), markerY = buy ? Math.min(priceBottom - 11, wickY + 18) : Math.max(top + 13, wickY - 18);
        ctx.strokeStyle = color; ctx.globalAlpha = .72; ctx.beginPath(); ctx.moveTo(x, wickY); ctx.lineTo(x, markerY); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, markerY, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 10px Arial"; ctx.textAlign = "center"; ctx.fillText(marker.type, x, markerY + 3.5); ctx.textAlign = "left";
      });
      if (hover != null && hover >= 0 && hover < shown.length) {
        const d = shown[hover], x = slot * hover + slot / 2, y = priceY(d.close), trade = markers.find((marker) => marker.index === start + hover);
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = "#77766f"; ctx.globalAlpha = .55; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - 22); ctx.moveTo(0, y); ctx.lineTo(w - right, y); ctx.stroke(); ctx.restore();
        const label = `第 ${start + hover + 1} 日  开 ${d.open.toFixed(2)}  高 ${d.high.toFixed(2)}  低 ${d.low.toFixed(2)}  收 ${d.close.toFixed(2)}${trade ? ` · ${trade.type} ${trade.type === "B" ? "买入" : "卖出"}` : ""}`;
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace"; const tw = Math.min(w - right - 16, ctx.measureText(label).width + 18), tx = Math.min(Math.max(7, x - tw / 2), w - right - tw - 7); ctx.fillStyle = "rgba(32,33,29,.92)"; ctx.fillRect(tx, top + 4, tw, 25); ctx.fillStyle = "white"; ctx.fillText(label, tx + 9, top + 20);
      }
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(canvas); return () => observer.disconnect();
  }, [data, effectiveView, hover, markers]);

  return <div className="chart-area">
    <div className="chart-tools"><div className="trade-legend"><span className="buy-dot">B</span>买入点<span className="sell-dot">S</span>卖出点</div><div className="zoom-tools"><small>显示 {effectiveView} 根</small><button onClick={() => changeZoom(12)} disabled={effectiveView >= maxView} aria-label="缩小K线图">−</button><button onClick={() => changeZoom(-12)} disabled={effectiveView <= 24} aria-label="放大K线图">＋</button><button className="reset-zoom" onClick={() => changeZoom(INITIAL_BARS - viewSize)}>重置</button></div></div>
    <canvas ref={canvasRef} className="chart-canvas" aria-label="可缩放的真实历史日K线图" onWheel={(event) => { event.preventDefault(); changeZoom(event.deltaY > 0 ? 8 : -8); }} onMouseLeave={() => setHover(null)} onMouseMove={(event) => { const slot = (event.currentTarget.getBoundingClientRect().width - 62) / effectiveView; setHover(Math.max(0, Math.min(effectiveView - 1, Math.floor(event.nativeEvent.offsetX / slot)))); }} />
  </div>;
}

export default function Home() {
  const today = chinaDate(), daily = getChallenge(today);
  const [gameMode, setGameMode] = useState<GameMode>("daily");
  const [stockIndex, setStockIndex] = useState(daily.stockIndex), [windowStart, setWindowStart] = useState(daily.start);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BARS), [round, setRound] = useState(0);
  const [cash, setCash] = useState(INITIAL_CASH), [shares, setShares] = useState(0);
  const [mode, setMode] = useState<TradeMode>("buy"), [allocation, setAllocation] = useState(1);
  const [trades, setTrades] = useState(0), [tradeMarkers, setTradeMarkers] = useState<TradeMarker[]>([]);
  const [equityHistory, setEquityHistory] = useState([INITIAL_CASH]);
  const [finished, setFinished] = useState(false), [resultOpen, setResultOpen] = useState(false), [rulesOpen, setRulesOpen] = useState(false), [isRevealing, setIsRevealing] = useState(false);
  const [revealPulse, setRevealPulse] = useState(0), [shareStatus, setShareStatus] = useState("");
  const [actions, setActions] = useState<ReplayAction[]>([]), [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("盲盘客"), [duelId, setDuelId] = useState("");
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null), [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [scoreStatus, setScoreStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const submissionRef = useRef(false);
  const stock = STOCK_SAMPLES[stockIndex];
  const normalized = useMemo(() => { const factor = 100 / stock.candles[windowStart + INITIAL_BARS - 1].close; return stock.candles.map((candle) => ({ ...candle, open: candle.open * factor, close: candle.close * factor, high: candle.high * factor, low: candle.low * factor })); }, [stock, windowStart]);
  const data = normalized.slice(windowStart, windowStart + visibleCount), current = data[data.length - 1], previous = data[data.length - 2];
  const positionValue = shares * current.close, equity = cash + positionValue, returnRate = (equity / INITIAL_CASH - 1) * 100, dayChange = (current.close / previous.close - 1) * 100;
  const ma5 = average(data, data.length - 1, 5), ma10 = average(data, data.length - 1, 10), ma20 = average(data, data.length - 1, 20);
  const benchmark = (current.close / data[INITIAL_BARS - 1].close - 1) * 100, excess = returnRate - benchmark;
  const maxDrawdown = useMemo(() => { let peak = equityHistory[0], worst = 0; equityHistory.forEach((value) => { peak = Math.max(peak, value); worst = Math.min(worst, (value / peak - 1) * 100); }); return worst; }, [equityHistory]);
  const skillScore = Math.round(clamp(50 + excess * 2.5, 0, 100) * .5 + clamp(100 + maxDrawdown * 5, 0, 100) * .3 + clamp(100 - Math.max(0, trades - 4) * 12, 35, 100) * .2);
  const profile = useMemo(() => {
    if (benchmark < -6 && returnRate > benchmark + 5) return { title: "熊市守门员", text: "你在下跌环境里保护了本金，空仓和减仓是本局最有价值的决策。" };
    if (trades > 6) return { title: "高频试探者", text: "你的出手次数偏多。减少低确信度交易，可能比寻找更多机会更有效。" };
    if (maxDrawdown < -12) return { title: "高波动冒险家", text: "收益之外，你承受了较大的资金波动。下一局可以尝试分批建仓。" };
    if (excess > 5 && trades <= 4) return { title: "克制的波段手", text: "你的交易次数不多，却有效跑赢了持有基准，择时和耐心形成了配合。" };
    if (benchmark > 8 && returnRate < benchmark - 4) return { title: "谨慎的早退者", text: "你避开了部分波动，也错过了主要上涨阶段，可能存在过早止盈。" };
    return { title: "冷静的观察者", text: "你的决策相对克制。继续积累不同市场环境，才能看出稳定优势。" };
  }, [benchmark, excess, maxDrawdown, returnRate, trades]);

  useEffect(() => {
    let id = localStorage.getItem("mangpan-player-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("mangpan-player-id", id);
    }
    const storedNickname = localStorage.getItem("mangpan-player-name") || `盲盘客${id.slice(-4).toUpperCase()}`;
    const params = new URLSearchParams(location.search);
    const challenger = params.get("duel") || "";
    queueMicrotask(() => {
      if (params.get("date") === today && challenger !== id && /^[a-zA-Z0-9_-]{10,80}$/.test(challenger)) setDuelId(challenger);
      setPlayerId(id);
      setNickname(storedNickname);
    });
  }, [today]);

  useEffect(() => {
    if (!playerId) return;
    const query = new URLSearchParams({ date: today, playerId });
    if (duelId) query.set("opponentId", duelId);
    fetch(`/api/scores?${query}`).then(async (response) => {
      if (!response.ok) throw new Error("load failed");
      setScoreboard(await response.json() as Scoreboard);
    }).catch(() => undefined);
  }, [duelId, playerId, today]);

  useEffect(() => {
    if (!playerId || !finished || gameMode !== "daily" || scoreStatus !== "idle" || submissionRef.current) return;
    submissionRef.current = true;
    queueMicrotask(() => setScoreStatus("loading"));
    fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: today, playerId, nickname, actions }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("submit failed");
      const next = await response.json() as Scoreboard;
      if (duelId) {
        const query = new URLSearchParams({ date: today, playerId, opponentId: duelId });
        const duelResponse = await fetch(`/api/scores?${query}`);
        if (duelResponse.ok) setScoreboard(await duelResponse.json() as Scoreboard);
        else setScoreboard(next);
      } else setScoreboard(next);
      setScoreStatus("done");
    }).catch(() => { submissionRef.current = false; setScoreStatus("error"); });
  }, [actions, duelId, finished, gameMode, nickname, playerId, scoreStatus, today]);

  const resetGame = (nextMode: GameMode) => {
    let nextStock = daily.stockIndex, nextStart = daily.start;
    if (nextMode === "practice") { nextStock = Math.floor(Math.random() * STOCK_SAMPLES.length); nextStart = Math.floor(Math.random() * Math.max(1, STOCK_SAMPLES[nextStock].candles.length - TOTAL_BARS + 1)); }
    submissionRef.current = false; setGameMode(nextMode); setStockIndex(nextStock); setWindowStart(nextStart); setVisibleCount(INITIAL_BARS); setRound(0); setCash(INITIAL_CASH); setShares(0); setMode("buy"); setAllocation(1); setTrades(0); setTradeMarkers([]); setEquityHistory([INITIAL_CASH]); setActions([]); setFinished(false); setResultOpen(false); setRevealPulse(0); setShareStatus(""); setScoreStatus("idle");
  };

  const finishGame = () => { if (isRevealing) return; setFinished(true); setResultOpen(true); };
  const advance = async (action: "trade" | "hold") => {
    if (finished || isRevealing) return;
    setIsRevealing(true);
    const replayAction: ReplayAction = action === "hold" ? { kind: "hold" } : { kind: mode, allocation: allocation as 0.25 | 0.5 | 1 };
    setActions((value) => [...value, replayAction]);
    const executionIndex = visibleCount, execution = normalized[windowStart + executionIndex].open;
    let nextCash = cash, nextShares = shares, didTrade = false;
    if (action === "trade" && mode === "buy" && cash > .01) { const spend = cash * allocation; nextCash -= spend; nextShares += spend / execution; didTrade = spend > .01; }
    if (action === "trade" && mode === "sell" && shares > .000001) { const amount = shares * allocation; nextShares -= amount; nextCash += amount * execution; didTrade = amount > .000001; }
    if (didTrade) setTradeMarkers((value) => [...value, { index: executionIndex, type: mode === "buy" ? "B" : "S", price: execution, round }]);
    setCash(nextCash); setShares(nextShares);
    const pathEquities: number[] = [];
    for (let step = 1; step <= STEP; step++) { await delay(step === 1 ? 180 : 330); const stepPrice = normalized[windowStart + visibleCount + step - 1].close; pathEquities.push(nextCash + nextShares * stepPrice); setVisibleCount(visibleCount + step); }
    const nextEquity = pathEquities[pathEquities.length - 1], nextRound = round + 1;
    setRound(nextRound); setTrades((value) => value + (didTrade ? 1 : 0)); setEquityHistory((value) => [...value, ...pathEquities]); setRevealPulse((value) => value + 1); setIsRevealing(false);
    if (nextRound >= MAX_ROUNDS || nextEquity <= INITIAL_CASH * .2) { setFinished(true); setResultOpen(true); }
  };

  const shareResult = async () => {
    const sequence = Array.from({ length: Math.max(1, round) }, (_, index) => { const marker = tradeMarkers.find((item) => item.round === index); return marker?.type === "B" ? "🟥" : marker?.type === "S" ? "🟩" : "⬜"; }).join("");
    const text = `盲盘 #${today.replaceAll("-", "")}\n${sequence}\n收益 ${returnRate >= 0 ? "+" : ""}${returnRate.toFixed(1)}% · 操盘评分 ${skillScore}\n只看走势，不看答案`;
    const shareUrl = playerId ? `${location.origin}${location.pathname}?duel=${encodeURIComponent(playerId)}&date=${today}` : location.href;
    try { if (navigator.share) await navigator.share({ title: "盲盘｜真实历史K线挑战", text, url: shareUrl }); else { await navigator.clipboard.writeText(`${text}\n${shareUrl}`); setShareStatus("挑战链接已复制"); } } catch { setShareStatus(""); }
  };

  const tradeDisabled = isRevealing || finished || (mode === "buy" ? cash < .01 : shares < .000001);
  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">K</span><span>盲盘</span></div><div className="round-pill"><span>{gameMode === "daily" ? "今日盲盘" : "练习模式"}</span><i />第 {Math.min(round + 1, MAX_ROUNDS)}/{MAX_ROUNDS} 回合</div><div className="top-actions"><button className="player-chip" onClick={() => setScoreboardOpen(true)}><i>{nickname.slice(0, 1)}</i><span>{nickname}</span>{scoreboard?.stats?.streak ? <b>🔥 {scoreboard.stats.streak}</b> : null}</button><button className="text-button rank-button" onClick={() => setScoreboardOpen(true)}>今日排行</button><button className="text-button" onClick={() => setRulesOpen(true)}>游戏规则</button></div></header>
    {duelId && <div className="duel-banner"><span>⚔</span><b>好友向你发起了今日同图挑战</b><small>完成后立即对比分数，双方看到的 K 线完全相同</small></div>}
    <section className="portfolio-strip"><div><small>总资产</small><strong>¥{nf.format(equity)}</strong></div><div><small>持仓市值</small><strong>¥{nf.format(positionValue)}</strong></div><div><small>可用现金</small><strong>¥{nf.format(cash)}</strong></div><div><small>累计收益</small><strong className={returnRate > 0 ? "up" : returnRate < 0 ? "down" : "muted"}>{returnRate > 0 ? "+" : ""}{returnRate.toFixed(2)}%</strong></div><div className="challenge"><span>{gameMode === "daily" ? scoreboard?.playerScore ? `今日已上榜 · 第 ${scoreboard.playerScore.rank} 名` : `每日同题 · #${today.slice(5).replace("-", "")}` : "随机练习"}</span><small>{duelId ? "好友挑战进行中，结算后对比" : "价格已归一化，身份结算后揭晓"}</small></div></section>
    <section className="workspace">
      <div className="chart-panel">{revealPulse > 0 && <span key={revealPulse} className="reveal-toast">+{STEP} 个交易日</span>}<div className="chart-head"><div><span className="ticker-mask">••••••</span><span className="market-tag">日 K</span><span className="adjust-tag">归一化 · 前复权</span></div><div className="ohlc"><span>开 <b>{current.open.toFixed(2)}</b></span><span>高 <b>{current.high.toFixed(2)}</b></span><span>低 <b>{current.low.toFixed(2)}</b></span><span>收 <b>{current.close.toFixed(2)}</b></span><strong className={dayChange >= 0 ? "up" : "down"}>{dayChange >= 0 ? "+" : ""}{dayChange.toFixed(2)}%</strong></div></div><div className="ma-row"><span>MA5 {ma5?.toFixed(2)}</span><span>MA10 {ma10?.toFixed(2)}</span><span>MA20 {ma20?.toFixed(2)}</span><em>相对量 {current.volume ? (current.volume / (data.slice(-20).reduce((sum, candle) => sum + candle.volume, 0) / Math.min(20, data.length))).toFixed(2) : "0"}×</em></div><CandleChart data={data} markers={tradeMarkers} /></div>
      <aside className="trade-panel"><div className="decision-head"><span>做出决策</span><small>委托于次日开盘成交</small></div><div className="turn-track">{Array.from({ length: MAX_ROUNDS }, (_, index) => { const marker = tradeMarkers.find((item) => item.round === index); return <i key={index} className={index < round ? marker?.type === "B" ? "buy-turn" : marker?.type === "S" ? "sell-turn" : "done-turn" : index === round ? "current-turn" : ""} />; })}</div><div className="price-block"><small>归一化价格</small><strong>{current.close.toFixed(2)}</strong><span className={dayChange >= 0 ? "up" : "down"}>{dayChange >= 0 ? "+" : ""}{dayChange.toFixed(2)}%</span></div>
        {shares > .000001 ? <div className="position-card"><div><small>持仓数量</small><b>{nf.format(shares)} 份</b></div><div><small>当前市值</small><b>¥{nf.format(positionValue)}</b></div><div className="position-bar"><i style={{ width: `${Math.min(100, positionValue / equity * 100)}%` }} /></div><span>仓位 {((positionValue / equity) * 100).toFixed(1)}%</span></div> : <div className="position-empty"><span className="empty-ring" /><b>当前空仓</b><small>不操作也是一种有效决策</small></div>}
        {!finished ? <><div className="mode-tabs"><button className={mode === "buy" ? "active buy" : ""} onClick={() => setMode("buy")}>买入</button><button className={mode === "sell" ? "active sell" : ""} onClick={() => setMode("sell")} disabled={!shares}>卖出</button></div><label className="field-label">{mode === "buy" ? "使用可用现金" : "卖出当前持仓"}</label><div className="allocation-grid">{[.25, .5, 1].map((value) => <button key={value} className={allocation === value ? "selected" : ""} onClick={() => setAllocation(value)}>{value === 1 ? "全部" : `${value * 100}%`}</button>)}</div><button className={`primary-action ${mode}`} disabled={tradeDisabled} onClick={() => advance("trade")}>{isRevealing ? "行情揭晓中…" : `${mode === "buy" ? "委托买入" : "委托卖出"}并揭晓 ${STEP} 天`} {!isRevealing && <span>→</span>}</button><button className="hold-action" disabled={isRevealing} onClick={() => advance("hold")}>{isRevealing ? "逐根加载真实行情" : `${shares ? "保持仓位" : "保持空仓"}，揭晓 ${STEP} 天`}</button><button className="finish-action" onClick={finishGame}>结束本局并揭晓股票</button><p className="hint">决策后，未来 K 线将逐根出现</p></> : <div className="finished-panel"><small>本局已结束</small><b>{profile.title}</b><button className="primary-action" onClick={() => setResultOpen(true)}>查看完整结算</button></div>}
      </aside>
    </section><footer className="source-note">12 只 A 股真实前复权行情 · 价格归一化仅用于隐藏身份 · 不构成投资建议</footer>

    {rulesOpen && <dialog open className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRulesOpen(false); }}><section className="rules-modal"><button className="modal-close" onClick={() => setRulesOpen(false)}>×</button><small>HOW TO PLAY</small><h2>每天一张真实盲盘</h2><ol><li><b>观察</b><span>开局提供 60 根真实日 K，价格归一化为 100，股票和历史日期隐藏。</span></li><li><b>决策</b><span>买入、卖出或空仓，委托在下一交易日开盘成交并留下 B/S 点。</span></li><li><b>揭晓</b><span>每回合逐根展示未来 3 个交易日，共 10 回合。</span></li><li><b>评分</b><span>综合相对收益、最大回撤和交易纪律，而不是只奖励冒险。</span></li><li><b>复盘</b><span>结算后揭晓真实股票、日期和本局交易画像。</span></li></ol><button className="primary-action" onClick={() => setRulesOpen(false)}>继续挑战</button></section></dialog>}

    {scoreboardOpen && <dialog open className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setScoreboardOpen(false); }}><section className="leaderboard-modal"><button className="modal-close" onClick={() => setScoreboardOpen(false)}>×</button><small className="eyebrow">PLAYER PROFILE · 今日同题榜</small><div className="player-editor"><span>{nickname.slice(0, 1)}</span><div><small>我的盲盘名</small><input value={nickname} maxLength={12} onChange={(event) => setNickname(event.target.value)} onBlur={() => { const name = nickname.trim() || `盲盘客${playerId.slice(-4).toUpperCase()}`; setNickname(name); localStorage.setItem("mangpan-player-name", name); }} /></div></div>{scoreboard?.stats && <><div className="career-grid"><div><b>{scoreboard.stats.streak}</b><small>连续挑战</small></div><div><b>{scoreboard.stats.completedDays}</b><small>完成天数</small></div><div><b>{scoreboard.stats.averageScore}</b><small>平均评分</small></div><div><b>{scoreboard.stats.bestScore}</b><small>最佳评分</small></div></div><div className="profile-card career-profile"><small>近 7 局决策画像</small><b>{scoreboard.stats.profile.title}</b><p>{scoreboard.stats.profile.text}</p></div></>}<div className="board-head"><b>今日排行榜</b><span>{scoreboard?.total || 0} 人完成</span></div><div className="board-list">{scoreboard?.leaderboard.length ? scoreboard.leaderboard.map((item) => <div key={`${item.rank}-${item.nickname}`} className={item.isPlayer ? "me" : ""}><i>{item.rank <= 3 ? ["🥇", "🥈", "🥉"][item.rank - 1] : item.rank}</i><span>{item.nickname}{item.isPlayer && <em>我</em>}</span><b>{item.score}</b><small className={item.returnRate >= 0 ? "up" : "down"}>{item.returnRate >= 0 ? "+" : ""}{item.returnRate.toFixed(1)}%</small></div>) : <p className="board-empty">还没有人完成今日挑战，等你成为第一名。</p>}</div><p className="board-note">排名按服务器复算的首次正式成绩生成；股票身份在每位玩家结算前保持隐藏。</p></section></dialog>}

    {resultOpen && <div className="modal-backdrop result-backdrop"><section className="result-modal"><small className="eyebrow">{gameMode === "daily" ? `今日盲盘 #${today.slice(5).replace("-", "")}` : "随机练习"} · 股票揭晓</small><h1>{stock.name}</h1><p className="stock-code">{stock.market} · {stock.code}</p><div className={`result-hero ${returnRate >= 0 ? "positive" : "negative"}`}><span>最终收益</span><strong>{returnRate >= 0 ? "+" : ""}{returnRate.toFixed(2)}%</strong><small>¥{nf.format(INITIAL_CASH)} → ¥{nf.format(equity)}</small></div><div className="result-grid"><div><small>操盘评分</small><b>{skillScore}</b></div><div><small>股票同期</small><b className={benchmark >= 0 ? "up" : "down"}>{benchmark >= 0 ? "+" : ""}{benchmark.toFixed(2)}%</b></div><div><small>超额收益</small><b>{excess >= 0 ? "+" : ""}{excess.toFixed(2)}%</b></div><div><small>最大回撤</small><b>{maxDrawdown.toFixed(2)}%</b></div></div>{gameMode === "daily" && <div className="rank-result">{scoreStatus === "loading" ? <p>正在由服务器复算决策路径并生成排名…</p> : scoreStatus === "error" ? <button onClick={() => setScoreStatus("idle")}>成绩提交失败，点击重试</button> : scoreboard?.playerScore ? <><div><small>今日首次成绩</small><b>第 {scoreboard.playerScore.rank} 名</b><span>超过 {scoreboard.playerScore.percentile}% 玩家 · 共 {scoreboard.total} 人</span></div>{duelId && <div className="duel-result"><small>好友对决</small>{scoreboard.opponent ? <b className={scoreboard.playerScore.score >= scoreboard.opponent.score ? "win" : "lose"}>{scoreboard.playerScore.score} : {scoreboard.opponent.score}<em>{scoreboard.playerScore.score >= scoreboard.opponent.score ? "你领先" : "好友领先"}</em></b> : <span>好友尚未完成，稍后再来看</span>}</div>}</> : <p>完成校验后显示今日排名</p>}</div>}<div className="profile-card"><small>本局交易画像</small><b>{profile.title}</b><p>{profile.text}</p></div><div className="date-reveal">真实区间：{stock.candles[windowStart + INITIAL_BARS - 1].date} — {stock.candles[windowStart + visibleCount - 1].date} · 共 {trades} 次交易</div><div className="result-actions three"><button className="primary-action" onClick={shareResult}>{shareStatus || (gameMode === "daily" ? "发起好友同图挑战" : "分享战绩")}</button><button className="hold-action" onClick={() => resetGame(gameMode === "daily" ? "practice" : "daily")}>{gameMode === "daily" ? "随机练习" : "返回今日挑战"}</button><button className="review-action" onClick={() => setResultOpen(false)}>返回复盘 K 线</button></div></section></div>}
  </main>;
}
