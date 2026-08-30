CREATE TABLE `duel_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`duel_code` text NOT NULL,
	`respondent_player_id` text NOT NULL,
	`nickname` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`duel_code`) REFERENCES `duel_challenges`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duel_responses_duel_player_unique` ON `duel_responses` (`duel_code`,`respondent_player_id`);--> statement-breakpoint
CREATE INDEX `duel_responses_duel_score_idx` ON `duel_responses` (`duel_code`,`score`);