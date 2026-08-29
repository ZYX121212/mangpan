CREATE TABLE `daily_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_date` text NOT NULL,
	`player_id` text NOT NULL,
	`nickname` text NOT NULL,
	`score` integer NOT NULL,
	`return_rate` real NOT NULL,
	`benchmark` real NOT NULL,
	`excess` real NOT NULL,
	`max_drawdown` real NOT NULL,
	`trades` integer NOT NULL,
	`rounds` integer NOT NULL,
	`action_path` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_scores_date_player_unique` ON `daily_scores` (`challenge_date`,`player_id`);--> statement-breakpoint
CREATE INDEX `daily_scores_leaderboard_idx` ON `daily_scores` (`challenge_date`,`score`,`created_at`);--> statement-breakpoint
CREATE INDEX `daily_scores_player_history_idx` ON `daily_scores` (`player_id`,`challenge_date`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
