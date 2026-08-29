import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  nickname: text("nickname").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const dailyScores = sqliteTable(
  "daily_scores",
  {
    id: text("id").primaryKey(),
    challengeDate: text("challenge_date").notNull(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    nickname: text("nickname").notNull(),
    score: integer("score").notNull(),
    returnRate: real("return_rate").notNull(),
    benchmark: real("benchmark").notNull(),
    excess: real("excess").notNull(),
    maxDrawdown: real("max_drawdown").notNull(),
    trades: integer("trades").notNull(),
    rounds: integer("rounds").notNull(),
    actionPath: text("action_path").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("daily_scores_date_player_unique").on(
      table.challengeDate,
      table.playerId,
    ),
    index("daily_scores_leaderboard_idx").on(
      table.challengeDate,
      table.score,
      table.createdAt,
    ),
    index("daily_scores_player_history_idx").on(
      table.playerId,
      table.challengeDate,
    ),
  ],
);

export const dailyChallenges = sqliteTable("daily_challenges", {
  id: text("id").primaryKey(),
  challengeDate: text("challenge_date").notNull(),
  market: text("market").notNull(),
  payload: text("payload").notNull(),
  source: text("source").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const gameSessions = sqliteTable(
  "game_sessions",
  {
    id: text("id").primaryKey(),
    challengeId: text("challenge_id").notNull(),
    challengeDate: text("challenge_date").notNull(),
    playerId: text("player_id"),
    market: text("market").notNull(),
    mode: text("mode").notNull(),
    scenario: text("scenario").notNull().default("random"),
    difficulty: text("difficulty").notNull().default("standard"),
    visibleCount: integer("visible_count").notNull(),
    actions: text("actions").notNull().default("[]"),
    finished: integer("finished", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("game_sessions_challenge_idx").on(table.challengeId),
    index("game_sessions_created_idx").on(table.createdAt),
    index("game_sessions_player_active_idx").on(
      table.playerId,
      table.market,
      table.finished,
      table.updatedAt,
    ),
  ],
);

export const trainingResults = sqliteTable(
  "training_results",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id").notNull(),
    market: text("market").notNull(),
    scenario: text("scenario").notNull(),
    difficulty: text("difficulty").notNull(),
    score: integer("score").notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    returnRate: real("return_rate").notNull(),
    excess: real("excess").notNull(),
    maxDrawdown: real("max_drawdown").notNull(),
    directionAccuracy: real("direction_accuracy").notNull(),
    riskScore: real("risk_score").notNull(),
    calibrationScore: real("calibration_score").notNull(),
    executionScore: real("execution_score").notNull(),
    disciplineScore: real("discipline_score").notNull(),
    performanceScore: real("performance_score").notNull(),
    advancedDays: integer("advanced_days").notNull(),
    trades: integer("trades").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("training_results_player_market_created_idx").on(
      table.playerId,
      table.market,
      table.createdAt,
    ),
  ],
);

export const trainingProgress = sqliteTable(
  "training_progress",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id").notNull(),
    market: text("market").notNull(),
    scenario: text("scenario").notNull(),
    difficulty: text("difficulty").notNull(),
    attempts: integer("attempts").notNull().default(0),
    passes: integer("passes").notNull().default(0),
    bestScore: integer("best_score").notNull().default(0),
    lastScore: integer("last_score").notNull().default(0),
    totalDays: integer("total_days").notNull().default(0),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("training_progress_player_market_scenario_difficulty_unique").on(
      table.playerId,
      table.market,
      table.scenario,
      table.difficulty,
    ),
  ],
);

export const patternQuizzes = sqliteTable(
  "pattern_quizzes",
  {
    id: text("id").primaryKey(),
    challengeId: text("challenge_id").notNull(),
    playerId: text("player_id").notNull(),
    market: text("market").notNull(),
    difficulty: text("difficulty").notNull(),
    correctScenario: text("correct_scenario").notNull(),
    answerScenario: text("answer_scenario"),
    confidence: integer("confidence"),
    correct: integer("correct", { mode: "boolean" }),
    answeredAt: text("answered_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("pattern_quizzes_player_market_created_idx").on(
      table.playerId,
      table.market,
      table.createdAt,
    ),
  ],
);
