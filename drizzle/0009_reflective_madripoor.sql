CREATE TABLE `weekly_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`market` text NOT NULL,
	`week_start` text NOT NULL,
	`reward_xp` integer DEFAULT 120 NOT NULL,
	`awarded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_rewards_player_market_week_unique` ON `weekly_rewards` (`player_id`,`market`,`week_start`);--> statement-breakpoint
CREATE INDEX `weekly_rewards_player_market_idx` ON `weekly_rewards` (`player_id`,`market`);