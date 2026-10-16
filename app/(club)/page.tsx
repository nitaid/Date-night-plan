import Link from "next/link";
import { StreakBadge } from "@/components/StreakBadge";
import { getClubStats, getMe } from "@/lib/data";
import { fmtDays } from "@/lib/format";

export default async function Leaderboard() {
  const [stats, { user }] = await Promise.all([getClubStats(), getMe()]);
  const record = stats.reduce<(typeof stats)[number] | null>(
    (a, b) => (!a || b.summary.best.days > a.summary.best.days ? b : a),
    null,
  );

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">🏆 Streak Club</h1>

      {record && record.summary.best.days > 0 && (
        <div className="rounded-2xl bg-gradient-to-l from-fire to-rose-600 p-4 text-white">
          <p className="text-sm opacity-90">שיא הקבוצה</p>
          <p className="text-2xl font-bold">
            {record.emoji} {record.display_name} · {fmtDays(record.summary.best.days)}
          </p>
          <p className="text-sm opacity-90">
            {record.summary.best.end === null ? "🔥 והשיא עדיין רץ" : "רצף שנגמר"}
          </p>
        </div>
      )}

      <ol className="space-y-2">
        {stats.map((m, i) => {
          const { current, best } = m.summary;
          const bestIsCurrent = best === current && current.days > 0;
          return (
            <li key={m.id}>
              <Link
                href={m.id === user?.id ? "/me" : `/u/${m.id}`}
                className={`flex items-center gap-3 rounded-2xl border bg-card p-3 ${m.id === user?.id ? "border-fire/60" : "border-line"}`}
              >
                <span className="w-6 text-center text-lg text-muted tabular-nums">{i + 1}</span>
                <span className="text-3xl">{m.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{m.display_name}</p>
                  <p className="text-xs text-muted">
                    שיא: {fmtDays(best.days)}
                    {bestIsCurrent && <span className="text-fire"> · שיא אישי רץ 🔥</span>}
                  </p>
                </div>
                <StreakBadge streak={current} />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
