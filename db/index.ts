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
        "DROP INDEX IF EXISTS daily_challenges_date_market_unique",
      ),
      database.prepare("PRAGMA optimize"),
    ])
    .then(async (result) => {
      const columns = await database.prepare("PRAGMA table_info(game_sessions)").all<{ name: string }>();
      if (!columns.results.some((column) => column.name === "player_id")) {
        await database.prepare("ALTER TABLE game_sessions ADD COLUMN player_id TEXT").run();
      }
      return result;
    })
    .catch((error) => {
      initialization = null;
      throw error;
    });

  return initialization;
}
