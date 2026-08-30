CREATE TABLE `crew_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`crew_code` text NOT NULL,
	`player_id` text NOT NULL,
	`checkin_date` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`crew_code`) REFERENCES `crews`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crew_checkins_crew_player_date_unique` ON `crew_checkins` (`crew_code`,`player_id`,`checkin_date`);--> statement-breakpoint
CREATE INDEX `crew_checkins_crew_date_idx` ON `crew_checkins` (`crew_code`,`checkin_date`);--> statement-breakpoint
CREATE TABLE `crew_members` (
	`id` text PRIMARY KEY NOT NULL,
	`crew_code` text NOT NULL,
	`player_id` text NOT NULL,
	`nickname` text NOT NULL,
	`slot` integer NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`crew_code`) REFERENCES `crews`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crew_members_crew_player_unique` ON `crew_members` (`crew_code`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `crew_members_crew_slot_unique` ON `crew_members` (`crew_code`,`slot`);--> statement-breakpoint
CREATE INDEX `crew_members_player_joined_idx` ON `crew_members` (`player_id`,`joined_at`);--> statement-breakpoint
CREATE TABLE `crews` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_player_id` text NOT NULL,
	`market` text NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`last_completed_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
