import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getD1Database() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.",
    );
  }

  return env.DB;
}

export function getDb() {
  const database = getD1Database();

  return drizzle(database, { schema });
}

let initialization: Promise<unknown> | null = null;

export function ensureDatabase() {
  if (initialization) return initialization;

  const database = getD1Database();
  initialization = database
    .batch([
      database.prepare(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY NOT NULL,
      nickname TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
      database.prepare(`CREATE TABLE IF NOT EXISTS daily_scores (
      id TEXT PRIMARY KEY NOT NULL,
      challenge_date TEXT NOT NULL,
      player_id TEXT NOT NULL REFERENCES players(id),
      nickname TEXT NOT NULL,
      score INTEGER NOT NULL,
      return_rate REAL NOT NULL,
      benchmark REAL NOT NULL,
      excess REAL NOT NULL,
      max_drawdown REAL NOT NULL,
      trades INTEGER NOT NULL,
      rounds INTEGER NOT NULL,
      action_path TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS daily_scores_date_player_unique ON daily_scores (challenge_date, player_id)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS daily_scores_leaderboard_idx ON daily_scores (challenge_date, score, created_at)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS daily_scores_player_history_idx ON daily_scores (player_id, challenge_date)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS daily_challenges (
      id TEXT PRIMARY KEY NOT NULL,
      challenge_date TEXT NOT NULL,
      market TEXT NOT NULL,
      payload TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
      database.prepare(`CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      challenge_id TEXT NOT NULL,
      challenge_date TEXT NOT NULL,
      player_id TEXT,
      market TEXT NOT NULL,
      mode TEXT NOT NULL,
      visible_count INTEGER NOT NULL,
      actions TEXT DEFAULT '[]' NOT NULL,
      finished INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS game_sessions_challenge_idx ON game_sessions (challenge_id)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS game_sessions_created_idx ON game_sessions (created_at)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS game_sessions_player_active_idx ON game_sessions (player_id, market, finished, updated_at)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS training_results (
      id TEXT PRIMARY KEY NOT NULL,
      player_id TEXT NOT NULL,
      market TEXT NOT NULL,
      scenario TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      score INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      return_rate REAL NOT NULL,
      excess REAL NOT NULL,
      max_drawdown REAL NOT NULL,
      direction_accuracy REAL NOT NULL,
      risk_score REAL NOT NULL,
      calibration_score REAL NOT NULL,
      execution_score REAL NOT NULL,
      discipline_score REAL NOT NULL,
      performance_score REAL NOT NULL,
      advanced_days INTEGER NOT NULL,
      trades INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS training_results_player_market_created_idx ON training_results (player_id, market, created_at)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS training_progress (
      id TEXT PRIMARY KEY NOT NULL,
      player_id TEXT NOT NULL,
      market TEXT NOT NULL,
      scenario TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      attempts INTEGER DEFAULT 0 NOT NULL,
      passes INTEGER DEFAULT 0 NOT NULL,
      best_score INTEGER DEFAULT 0 NOT NULL,
      last_score INTEGER DEFAULT 0 NOT NULL,
      total_days INTEGER DEFAULT 0 NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS training_progress_player_market_scenario_difficulty_unique ON training_progress (player_id, market, scenario, difficulty)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS pattern_quizzes (
        id TEXT PRIMARY KEY NOT NULL,
        challenge_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        market TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        correct_scenario TEXT NOT NULL,
        answer_scenario TEXT,
        confidence INTEGER,
        correct INTEGER,
        answered_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS pattern_quizzes_player_market_created_idx ON pattern_quizzes (player_id, market, created_at)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS daily_progress (
        id TEXT PRIMARY KEY NOT NULL,
        player_id TEXT NOT NULL,
        market TEXT NOT NULL,
        progress_date TEXT NOT NULL,
        advanced_days INTEGER NOT NULL DEFAULT 0,
        quiz_attempts INTEGER NOT NULL DEFAULT 0,
        quiz_correct INTEGER NOT NULL DEFAULT 0,
        training_completions INTEGER NOT NULL DEFAULT 0,
        reward_xp INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS daily_progress_player_market_date_unique ON daily_progress (player_id, market, progress_date)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS duel_challenges (
        code TEXT PRIMARY KEY NOT NULL,
        challenger_player_id TEXT NOT NULL,
        challenge_date TEXT NOT NULL,
        market TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS duel_challenges_player_date_market_unique ON duel_challenges (challenger_player_id, challenge_date, market)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS duel_challenges_date_market_idx ON duel_challenges (challenge_date, market)",
      ),
      database.prepare(
        "DROP INDEX IF EXISTS daily_challenges_date_market_unique",
      ),
      database.prepare("PRAGMA optimize"),
    ])
    .then(async (result: unknown) => {
      const columns = (await database
        .prepare("PRAGMA table_info(game_sessions)")
        .all()) as { results: { name: string }[] };
      if (!columns.results.some((column) => column.name === "player_id")) {
        await database.prepare("ALTER TABLE game_sessions ADD COLUMN player_id TEXT").run();
      }
      if (!columns.results.some((column) => column.name === "scenario")) {
        await database.prepare("ALTER TABLE game_sessions ADD COLUMN scenario TEXT NOT NULL DEFAULT 'random'").run();
      }
      if (!columns.results.some((column) => column.name === "difficulty")) {
        await database.prepare("ALTER TABLE game_sessions ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'standard'").run();
      }
      return result;
    })
    .catch((error: unknown) => {
      initialization = null;
      throw error;
    });

  return initialization;
}
