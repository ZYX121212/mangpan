CREATE TABLE `activation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`event_type` text NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activation_events_player_event_source_unique` ON `activation_events` (`player_id`,`event_type`,`source`);--> statement-breakpoint
CREATE INDEX `activation_events_event_created_idx` ON `activation_events` (`event_type`,`created_at`);