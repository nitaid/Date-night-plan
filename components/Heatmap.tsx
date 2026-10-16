import { dayStatuses, fromDayNumber, toDayNumber, type DayStatus } from "@/lib/streaks";
import { fmtDay } from "@/lib/format";

const WEEKS = 15;

const colors: Record<DayStatus, string> = {
  before: "bg-line/40",
  clean: "bg-clean",
  reset: "bg-reset",
  future: "bg-transparent",
};

// GitHub-style grid: columns are weeks (Sun→Sat), newest week on the left (RTL).
export function Heatmap({ joinedDay, resetDays, today }: { joinedDay: string; resetDays: string[]; today: string }) {
  const todayN = toDayNumber(today);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const end = fromDayNumber(todayN + (6 - weekday));
  const start = fromDayNumber(todayN + (6 - weekday) - WEEKS * 7 + 1);
  const days = dayStatuses(joinedDay, resetDays, today, start, end);
  const weeks = Array.from({ length: WEEKS }, (_, i) => days.slice(i * 7, i * 7 + 7));

  return (
    <div>
      <div className="flex justify-between gap-[3px]">
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-1 flex-col gap-[3px]">
            {week.map(({ day, status }) => (
              <div
                key={day}
                title={fmtDay(day)}
                className={`aspect-square rounded-[3px] ${colors[status]} ${day === today ? "ring-2 ring-text" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <Legend className="bg-clean" label="יום נקי" />
        <Legend className="bg-reset" label="איפוס" />
        <Legend className="bg-line/40" label="לפני ההצטרפות" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-3 rounded-[3px] ${className}`} />
      {label}
    </span>
  );
}
