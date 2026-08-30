function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nextCrewStreak(
  currentStreak: number,
  lastCompletedDate: string | null,
  today: string,
) {
  return lastCompletedDate === addDays(today, -1)
    ? Math.max(0, currentStreak) + 1
    : 1;
}

export function displayedCrewStreak(
  currentStreak: number,
  lastCompletedDate: string | null,
  today: string,
) {
  if (
    lastCompletedDate !== today &&
    lastCompletedDate !== addDays(today, -1)
  )
    return 0;
  return Math.max(0, currentStreak);
}
