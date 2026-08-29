CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`challenge_date` text NOT NULL,
	`market` text NOT NULL,
	`mode` text NOT NULL,
	`visible_count` integer NOT NULL,
	`actions` text DEFAULT '[]' NOT NULL,
	`finished` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_sessions_challenge_idx` ON `game_sessions` (`challenge_id`);--> statement-breakpoint
CREATE INDEX `game_sessions_created_idx` ON `game_sessions` (`created_at`);