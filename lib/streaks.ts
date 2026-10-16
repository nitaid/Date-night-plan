// Streak math. All days are local calendar dates as "YYYY-MM-DD".
// A reset on day X ends the running streak and starts a new one at X,
// so a streak's length is the number of clean days since its start.

export type Streak = {
  start: string;
  end: string | null; // null = still running
  days: number;
};

export type StreakSummary = {
  streaks: Streak[]; // newest first, zero-length ended streaks dropped
  current: Streak;
  best: Streak;
  resetCount: number;
};

export type DayStatus = "before" | "clean" | "reset" | "future";

const DAY_MS = 86_400_000;

export function toDayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function localDay(date: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function summarize(joinedDay: string, resetDays: string[], today: string): StreakSummary {
  const resets = [...new Set(resetDays)].filter((d) => d >= joinedDay && d <= today).sort();
  const starts = [joinedDay, ...resets.filter((d) => d !== joinedDay)];

  const all: Streak[] = starts.map((start, i) => {
    const end = starts[i + 1] ?? null;
    return { start, end, days: daysBetween(start, end ?? today) };
  });

  const current = all[all.length - 1];
  const best = all.reduce((a, b) => (b.days > a.days || (b.days === a.days && b.end === null) ? b : a));
  const streaks = all.filter((s) => s.end === null || s.days > 0).reverse();

  return { streaks, current, best, resetCount: resets.length };
}

export function dayStatuses(
  joinedDay: string,
  resetDays: string[],
  today: string,
  from: string,
  to: string,
): { day: string; status: DayStatus }[] {
  const resets = new Set(resetDays);
  const out: { day: string; status: DayStatus }[] = [];
  for (let n = toDayNumber(from); n <= toDayNumber(to); n++) {
    const day = fromDayNumber(n);
    const status: DayStatus =
      day > today ? "future" : day < joinedDay ? "before" : resets.has(day) ? "reset" : "clean";
    out.push({ day, status });
  }
  return out;
}
