ALTER TABLE `duel_challenges` ADD `target_return_rate` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `duel_challenges` ADD `target_excess` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `duel_challenges` ADD `target_max_drawdown` real DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `duel_challenges`
SET `target_return_rate` = COALESCE((
      SELECT `return_rate` FROM `daily_scores`
      WHERE `challenge_date` = `duel_challenges`.`challenge_id`
        AND `player_id` = `duel_challenges`.`challenger_player_id`
      LIMIT 1
    ), `target_return_rate`),
    `target_excess` = COALESCE((
      SELECT `excess` FROM `daily_scores`
      WHERE `challenge_date` = `duel_challenges`.`challenge_id`
        AND `player_id` = `duel_challenges`.`challenger_player_id`
      LIMIT 1
    ), `target_excess`),
    `target_max_drawdown` = COALESCE((
      SELECT `max_drawdown` FROM `daily_scores`
      WHERE `challenge_date` = `duel_challenges`.`challenge_id`
        AND `player_id` = `duel_challenges`.`challenger_player_id`
      LIMIT 1
    ), `target_max_drawdown`);
