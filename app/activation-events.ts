export type ActivationEventType =
  | "lobby_view"
  | "guide_start"
  | "guide_forecast"
  | "guide_reveal"
  | "daily_first_move"
  | "daily_second_move"
  | "practice_second_move"
  | "daily_complete"
  | "daily_score_card_share"
  | "daily_style_card_share";
export type ActivationSource = "lobby" | "direct" | "duel";

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
