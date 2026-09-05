export type ActivationEventType =
  | "lobby_view"
  | "lobby_daily_cta"
  | "lobby_mode_daily"
  | "lobby_mode_sprint"
  | "lobby_mode_practice"
  | "lobby_mode_run"
  | "lobby_mode_endless"
  | "lobby_mode_training"
  | "lobby_mode_duel"
  | "lobby_mode_crew"
  | "duel_instant_create"
  | "guide_start"
  | "guide_forecast"
  | "guide_reveal"
  | "guide_complete"
  | "guide_daily_continue"
  | "session_three_minutes"
  | "keyboard_first_action"
  | "decision_continue"
  | "daily_first_move"
  | "daily_second_move"
  | "practice_second_move"
  | "run_start"
  | "run_stage_complete"
  | "run_complete"
  | "daily_complete"
  | "milestone_celebration"
  | "result_next_chart"
  | "daily_score_card_share"
  | "daily_style_card_share"
  | "crew_view"
  | "crew_create"
  | "crew_join"
  | "crew_first_invite_share"
  | "crew_invite_share"
  | "crew_daily_checkin"
  | "crew_result_return";
export type ActivationSource = "lobby" | "direct" | "duel" | "crew" | "run";

export function trackActivationEvent(
  playerId: string,
  eventType: ActivationEventType,
  source: ActivationSource,
) {
  if (!playerId) return;
  void fetch("/api/activation-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId, eventType, source }),
    keepalive: true,
  }).catch(() => undefined);
}
