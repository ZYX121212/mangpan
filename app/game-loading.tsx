type LoadingMode = "daily" | "practice" | "training" | "duel";

const COPY = {
  daily: ["DAILY CHALLENGE", "Loading today’s shared mystery…"],
  practice: ["ENDLESS PRACTICE", "Drawing a random real chart…"],
  training: ["TRAINING LAB", "Preparing your lesson picker…"],
  duel: ["FRIEND DUEL", "Verifying the same-chart challenge…"],
} as const;

export default function GameLoading({ mode }: { mode: LoadingMode }) {
  return (
    <main className="game-loading-shell" aria-live="polite" aria-busy="true">
      <header>
        <span>B</span>
        <b>BLIND TRADING</b>
        <small>{COPY[mode][0]}</small>
      </header>
      <section>
        <div className="game-loading-chart">
          <div className="loading-chart-head" />
          <div className="loading-candles" aria-hidden="true">
            {Array.from({ length: 28 }, (_, index) => (
              <i
                key={index}
                style={{
                  height: `${24 + ((index * 17) % 61)}%`,
                  transform: `translateY(${(index * 11) % 23}%)`,
                }}
              />
            ))}
          </div>
        </div>
        <aside>
          <small>{COPY[mode][0]}</small>
          <h1>{COPY[mode][1]}</h1>
          <div className="loading-line wide" />
          <div className="loading-line" />
          <div className="loading-actions">
            <i />
            <i />
            <i />
          </div>
          <div className="loading-button" />
        </aside>
      </section>
    </main>
  );
}
