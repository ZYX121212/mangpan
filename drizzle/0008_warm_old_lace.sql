CREATE TABLE `duel_challenges` (
	`code` text PRIMARY KEY NOT NULL,
	`challenger_player_id` text NOT NULL,
	`challenge_date` text NOT NULL,
	`market` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duel_challenges_player_date_market_unique` ON `duel_challenges` (`challenger_player_id`,`challenge_date`,`market`);--> statement-breakpoint
CREATE INDEX `duel_challenges_date_market_idx` ON `duel_challenges` (`challenge_date`,`market`);