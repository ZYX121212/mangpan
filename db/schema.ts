import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  nickname: text("nickname").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyScores = sqliteTable("daily_scores", {
  id: text("id").primaryKey(),
  challengeDate: text("challenge_date").notNull(),
  playerId: text("player_id").notNull().references(() => players.id),
  nickname: text("nickname").notNull(),
  score: integer("score").notNull(),
  returnRate: real("return_rate").notNull(),
  benchmark: real("benchmark").notNull(),
  excess: real("excess").notNull(),
  maxDrawdown: real("max_drawdown").notNull(),
  trades: integer("trades").notNull(),
  rounds: integer("rounds").notNull(),
  actionPath: text("action_path").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("daily_scores_date_player_unique").on(table.challengeDate, table.playerId),
  index("daily_scores_leaderboard_idx").on(table.challengeDate, table.score, table.createdAt),
  index("daily_scores_player_history_idx").on(table.playerId, table.challengeDate),
]);

export const dailyChallenges = sqliteTable("daily_challenges", {
  id: text("id").primaryKey(),
  challengeDate: text("challenge_date").notNull(),
  market: text("market").notNull(),
  payload: text("payload").notNull(),
  source: text("source").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
