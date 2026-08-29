CREATE TABLE `daily_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_date` text NOT NULL,
	`market` text NOT NULL,
	`payload` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
