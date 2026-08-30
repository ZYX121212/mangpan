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
        challenge_id TEXT NOT NULL DEFAULT '',
        challenger_nickname TEXT NOT NULL DEFAULT '',
        target_score INTEGER NOT NULL DEFAULT 0,
        target_return_rate REAL NOT NULL DEFAULT 0,
        target_excess REAL NOT NULL DEFAULT 0,
        target_max_drawdown REAL NOT NULL DEFAULT 0,
        parent_code TEXT,
        chain_depth INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS duel_challenges_date_market_idx ON duel_challenges (challenge_date, market)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS duel_responses (
        id TEXT PRIMARY KEY NOT NULL,
        duel_code TEXT NOT NULL REFERENCES duel_challenges(code),
        respondent_player_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        score INTEGER NOT NULL,
        return_rate REAL NOT NULL DEFAULT 0,
        excess REAL NOT NULL DEFAULT 0,
        max_drawdown REAL NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'direct',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS duel_responses_duel_player_unique ON duel_responses (duel_code, respondent_player_id)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS duel_responses_duel_score_idx ON duel_responses (duel_code, score)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS duel_events (
        id TEXT PRIMARY KEY NOT NULL,
        duel_code TEXT NOT NULL REFERENCES duel_challenges(code),
        player_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'direct',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS duel_events_room_player_event_source_unique ON duel_events (duel_code, player_id, event_type, source)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS duel_events_room_event_idx ON duel_events (duel_code, event_type)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS activation_events (
        id TEXT PRIMARY KEY NOT NULL,
        player_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'direct',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS activation_events_player_event_source_unique ON activation_events (player_id, event_type, source)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS activation_events_event_created_idx ON activation_events (event_type, created_at)",
      ),
      database.prepare(`CREATE TABLE IF NOT EXISTS weekly_rewards (
        id TEXT PRIMARY KEY NOT NULL,
        player_id TEXT NOT NULL,
        market TEXT NOT NULL,
        week_start TEXT NOT NULL,
        reward_xp INTEGER NOT NULL DEFAULT 120,
        awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      database.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS weekly_rewards_player_market_week_unique ON weekly_rewards (player_id, market, week_start)",
      ),
      database.prepare(
        "CREATE INDEX IF NOT EXISTS weekly_rewards_player_market_idx ON weekly_rewards (player_id, market)",
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
      const duelResponseColumns = (await database
        .prepare("PRAGMA table_info(duel_responses)")
        .all()) as { results: { name: string }[] };
      if (!duelResponseColumns.results.some((column) => column.name === "source")) {
        await database
          .prepare("ALTER TABLE duel_responses ADD COLUMN source TEXT NOT NULL DEFAULT 'direct'")
          .run();
      }
      for (const [name, sql] of [
        ["return_rate", "ALTER TABLE duel_responses ADD COLUMN return_rate REAL NOT NULL DEFAULT 0"],
        ["excess", "ALTER TABLE duel_responses ADD COLUMN excess REAL NOT NULL DEFAULT 0"],
        ["max_drawdown", "ALTER TABLE duel_responses ADD COLUMN max_drawdown REAL NOT NULL DEFAULT 0"],
      ] as const) {
        if (!duelResponseColumns.results.some((column) => column.name === name)) {
          await database.prepare(sql).run();
        }
      }
      const duelChallengeColumns = (await database
        .prepare("PRAGMA table_info(duel_challenges)")
        .all()) as { results: { name: string }[] };
      for (const [name, sql] of [
        [
          "challenge_id",
          "ALTER TABLE duel_challenges ADD COLUMN challenge_id TEXT NOT NULL DEFAULT ''",
        ],
        [
          "challenger_nickname",
          "ALTER TABLE duel_challenges ADD COLUMN challenger_nickname TEXT NOT NULL DEFAULT ''",
        ],
        [
          "target_score",
          "ALTER TABLE duel_challenges ADD COLUMN target_score INTEGER NOT NULL DEFAULT 0",
        ],
        [
          "target_return_rate",
          "ALTER TABLE duel_challenges ADD COLUMN target_return_rate REAL NOT NULL DEFAULT 0",
        ],
        [
          "target_excess",
          "ALTER TABLE duel_challenges ADD COLUMN target_excess REAL NOT NULL DEFAULT 0",
        ],
        [
          "target_max_drawdown",
          "ALTER TABLE duel_challenges ADD COLUMN target_max_drawdown REAL NOT NULL DEFAULT 0",
        ],
        [
          "parent_code",
          "ALTER TABLE duel_challenges ADD COLUMN parent_code TEXT",
        ],
        [
          "chain_depth",
          "ALTER TABLE duel_challenges ADD COLUMN chain_depth INTEGER NOT NULL DEFAULT 0",
        ],
      ] as const) {
        if (
          !duelChallengeColumns.results.some((column) => column.name === name)
        ) {
          await database.prepare(sql).run();
        }
      }
      await database
        .prepare(`UPDATE duel_challenges
          SET challenge_id = challenge_date || '@focused-daily-v18@' || market
          WHERE challenge_id = ''`)
        .run();
      await database
        .prepare(`UPDATE duel_challenges
          SET target_return_rate = COALESCE((
                SELECT return_rate FROM daily_scores
                WHERE challenge_date = duel_challenges.challenge_id
                  AND player_id = duel_challenges.challenger_player_id
                LIMIT 1
              ), target_return_rate),
              target_excess = COALESCE((
                SELECT excess FROM daily_scores
                WHERE challenge_date = duel_challenges.challenge_id
                  AND player_id = duel_challenges.challenger_player_id
                LIMIT 1
              ), target_excess),
              target_max_drawdown = COALESCE((
                SELECT max_drawdown FROM daily_scores
                WHERE challenge_date = duel_challenges.challenge_id
                  AND player_id = duel_challenges.challenger_player_id
                LIMIT 1
              ), target_max_drawdown)`)
        .run();
      await database
        .prepare(`UPDATE duel_challenges
          SET challenger_nickname = COALESCE((
                SELECT nickname FROM daily_scores
                WHERE challenge_date = duel_challenges.challenge_id
                  AND player_id = duel_challenges.challenger_player_id
                LIMIT 1
              ), challenger_nickname),
              target_score = COALESCE((
                SELECT score FROM daily_scores
                WHERE challenge_date = duel_challenges.challenge_id
                  AND player_id = duel_challenges.challenger_player_id
                LIMIT 1
              ), target_score)
          WHERE challenger_nickname = ''`)
        .run();
      await database
        .prepare("DROP INDEX IF EXISTS duel_challenges_player_date_market_unique")
        .run();
      await database
        .prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS duel_challenges_player_challenge_unique ON duel_challenges (challenger_player_id, challenge_id)",
        )
        .run();
      await database
        .prepare(
          "CREATE INDEX IF NOT EXISTS duel_challenges_parent_idx ON duel_challenges (parent_code)",
        )
        .run();
      return result;
    })
    .catch((error: unknown) => {
      initialization = null;
      throw error;
    });

  return initialization;
}
