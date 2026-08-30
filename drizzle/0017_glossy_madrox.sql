CREATE TABLE `duel_events` (
	`id` text PRIMARY KEY NOT NULL,
	`duel_code` text NOT NULL,
	`player_id` text NOT NULL,
	`event_type` text NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`duel_code`) REFERENCES `duel_challenges`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duel_events_room_player_event_source_unique` ON `duel_events` (`duel_code`,`player_id`,`event_type`,`source`);--> statement-breakpoint
CREATE INDEX `duel_events_room_event_idx` ON `duel_events` (`duel_code`,`event_type`);