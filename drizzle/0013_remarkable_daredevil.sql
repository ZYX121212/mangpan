ALTER TABLE `duel_challenges` ADD `challenge_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `duel_challenges` ADD `challenger_nickname` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `duel_challenges` ADD `target_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `duel_challenges`
SET `challenge_id` = `challenge_date` || '@focused-daily-v18@' || `market`
WHERE `challenge_id` = '';--> statement-breakpoint
UPDATE `duel_challenges`
SET `challenger_nickname` = COALESCE((
      SELECT `nickname` FROM `daily_scores`
      WHERE `challenge_date` = `duel_challenges`.`challenge_id`
        AND `player_id` = `duel_challenges`.`challenger_player_id`
      LIMIT 1
    ), `challenger_nickname`),
    `target_score` = COALESCE((
      SELECT `score` FROM `daily_scores`
      WHERE `challenge_date` = `duel_challenges`.`challenge_id`
        AND `player_id` = `duel_challenges`.`challenger_player_id`
      LIMIT 1
    ), `target_score`)
WHERE `challenger_nickname` = '';
