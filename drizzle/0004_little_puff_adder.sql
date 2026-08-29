CREATE TABLE `training_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`market` text NOT NULL,
	`scenario` text NOT NULL,
	`difficulty` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`passes` integer DEFAULT 0 NOT NULL,
	`best_score` integer DEFAULT 0 NOT NULL,
	`last_score` integer DEFAULT 0 NOT NULL,
	`total_days` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_progress_player_market_scenario_difficulty_unique` ON `training_progress` (`player_id`,`market`,`scenario`,`difficulty`);--> statement-breakpoint
CREATE TABLE `training_results` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`market` text NOT NULL,
	`scenario` text NOT NULL,
	`difficulty` text NOT NULL,
	`score` integer NOT NULL,
	`passed` integer NOT NULL,
	`return_rate` real NOT NULL,
	`excess` real NOT NULL,
	`max_drawdown` real NOT NULL,
	`direction_accuracy` real NOT NULL,
	`risk_score` real NOT NULL,
	`calibration_score` real NOT NULL,
	`execution_score` real NOT NULL,
	`discipline_score` real NOT NULL,
	`performance_score` real NOT NULL,
	`advanced_days` integer NOT NULL,
	`trades` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_results_player_market_created_idx` ON `training_results` (`player_id`,`market`,`created_at`);--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `scenario` text DEFAULT 'random' NOT NULL;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `difficulty` text DEFAULT 'standard' NOT NULL;