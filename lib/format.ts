export function fmtDays(n: number): string {
  if (n === 1) return "יום אחד";
  if (n === 2) return "יומיים";
  return `${n} ימים`;
}

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: "UTC" });
const dateYearFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// day is "YYYY-MM-DD"; formatted in UTC so the calendar date never shifts.
export function fmtDay(day: string, withYear = false): string {
  return (withYear ? dateYearFmt : dateFmt).format(new Date(`${day}T00:00:00Z`));
}
