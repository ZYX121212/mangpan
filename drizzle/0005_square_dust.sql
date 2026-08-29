CREATE TABLE `pattern_quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`player_id` text NOT NULL,
	`market` text NOT NULL,
	`difficulty` text NOT NULL,
	`correct_scenario` text NOT NULL,
	`answer_scenario` text,
	`confidence` integer,
	`correct` integer,
	`answered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pattern_quizzes_player_market_created_idx` ON `pattern_quizzes` (`player_id`,`market`,`created_at`);