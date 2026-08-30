ALTER TABLE `duel_challenges` ADD `parent_code` text;--> statement-breakpoint
ALTER TABLE `duel_challenges` ADD `chain_depth` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `duel_challenges_parent_idx` ON `duel_challenges` (`parent_code`);