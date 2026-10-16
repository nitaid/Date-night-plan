import type { MemberStats } from "@/lib/data";
import { fmtDay, fmtDays } from "@/lib/format";
import { Heatmap } from "./Heatmap";
import { StreakBadge } from "./StreakBadge";

export function History({ m }: { m: MemberStats }) {
  const { current, best, streaks, resetCount } = m.summary;
  const bestIsCurrent = best === current && current.days > 0;
  const longest = Math.max(...streaks.map((s) => s.days), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-5xl">{m.emoji}</span>
        <div>
          <h1 className="text-2xl font-bold">{m.display_name}</h1>
          <p className="text-sm text-muted">בתחרות מ-{fmtDay(m.joinedDay, true)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm text-muted">רצף נוכחי</h2>
          <StreakBadge streak={current} size="lg" />
          <p className="mt-1 text-xs text-muted">{current.days === 0 ? "התאפס היום" : `מאז ${fmtDay(current.start)}`}</p>
        </section>
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm text-muted">השיא</h2>
          <StreakBadge streak={best} size="lg" />
          <p className="mt-1 text-xs text-muted">
            {bestIsCurrent ? "השיא עדיין רץ 🔥" : best.end ? <DateRange from={best.start} to={best.end} /> : "—"}
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 text-sm text-muted">15 השבועות האחרונים · {resetCount} איפוסים</h2>
        <Heatmap joinedDay={m.joinedDay} resetDays={m.resetDays} today={m.today} />
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 text-sm text-muted">כל הרצפים</h2>
        <ul className="space-y-3">
          {streaks.map((s) => {
            const running = s.end === null;
            return (
              <li key={s.start}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className={running ? "font-bold text-fire" : "text-muted"}>
                    {running ? "🔥 ממשיך" : "✓ נגמר"} · {fmtDays(s.days)}
                    {s === best && s.days > 0 && " 👑"}
                  </span>
                  <span className="text-xs text-muted">
                    <DateRange from={s.start} to={s.end} />
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line/50">
                  <div
                    className={`h-full rounded-full ${running ? "bg-fire" : "bg-muted/60"}`}
                    style={{ width: `${Math.max((s.days / longest) * 100, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// <bdi> keeps each date's digits from reordering the range in RTL.
function DateRange({ from, to }: { from: string; to: string | null }) {
  return (
    <>
      <bdi>{fmtDay(from)}</bdi> – <bdi>{to ? fmtDay(to) : "היום"}</bdi>
    </>
  );
}
