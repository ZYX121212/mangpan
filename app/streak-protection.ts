const DAY_MS = 24 * 60 * 60 * 1000;

function dayDistance(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      DAY_MS,
  );
}

export type StreakProtection = {
  streak: number;
  availableFreezes: number;
  nextFreezeIn: number;
  freezeUsedToday: boolean;
  freezeEarnedToday: boolean;
  protectedMissedDays: number;
};

export function calculateStreakProtection(
  rawDates: string[],
  today: string,
): StreakProtection {
  const dates = [...new Set(rawDates)]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today)
    .sort();
  let previous = "";
  let streak = 0;
  let availableFreezes = 0;
  let progressToFreeze = 0;
  let lastFreezeUse = 0;
  let lastFreezeEarned = false;

  for (const date of dates) {
    const missedDays = previous
      ? Math.max(0, dayDistance(previous, date) - 1)
      : 0;
    lastFreezeUse = 0;
    lastFreezeEarned = false;

    if (!previous) {
      streak = 1;
      progressToFreeze = 1;
    } else if (missedDays === 0) {
      streak += 1;
      progressToFreeze += 1;
    } else if (missedDays <= availableFreezes) {
      availableFreezes -= missedDays;
      lastFreezeUse = missedDays;
      streak += 1;
      progressToFreeze += 1;
    } else {
      availableFreezes = 0;
      streak = 1;
      progressToFreeze = 1;
    }

    if (progressToFreeze >= 5) {
      if (availableFreezes < 2) {
        availableFreezes += 1;
        lastFreezeEarned = true;
      }
      progressToFreeze = 0;
    }
    previous = date;
  }

  if (!previous) {
    return {
      streak: 0,
      availableFreezes: 0,
      nextFreezeIn: 5,
      freezeUsedToday: false,
      freezeEarnedToday: false,
      protectedMissedDays: 0,
    };
  }

  const trailingMissedDays = Math.max(0, dayDistance(previous, today) - 1);
  let protectedMissedDays = 0;
  if (trailingMissedDays) {
    if (trailingMissedDays <= availableFreezes) {
      availableFreezes -= trailingMissedDays;
      protectedMissedDays = trailingMissedDays;
    } else {
      availableFreezes = 0;
      progressToFreeze = 0;
      streak = 0;
    }
  }

  return {
    streak,
    availableFreezes,
    nextFreezeIn: availableFreezes >= 2 ? 0 : 5 - progressToFreeze,
    freezeUsedToday: previous === today && lastFreezeUse > 0,
    freezeEarnedToday: previous === today && lastFreezeEarned,
    protectedMissedDays,
  };
}
