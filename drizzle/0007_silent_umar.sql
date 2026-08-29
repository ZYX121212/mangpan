CREATE TABLE `daily_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`market` text NOT NULL,
	`progress_date` text NOT NULL,
	`advanced_days` integer DEFAULT 0 NOT NULL,
	`quiz_attempts` integer DEFAULT 0 NOT NULL,
	`quiz_correct` integer DEFAULT 0 NOT NULL,
	`training_completions` integer DEFAULT 0 NOT NULL,
	`reward_xp` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_progress_player_market_date_unique` ON `daily_progress` (`player_id`,`market`,`progress_date`);