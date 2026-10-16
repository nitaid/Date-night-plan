import type { Streak } from "@/lib/streaks";

// Running streaks burn; ended ones are grey.
export function StreakBadge({ streak, size = "md" }: { streak: Streak; size?: "md" | "lg" }) {
  const running = streak.end === null;
  const big = size === "lg";
  return (
    <span className={`inline-flex items-baseline gap-1 font-bold ${running ? "text-fire" : "text-muted"}`}>
      {running && streak.days > 0 && <span className={big ? "text-3xl" : "text-base"}>🔥</span>}
      <span className={big ? "text-5xl tabular-nums" : "text-2xl tabular-nums"}>{streak.days}</span>
      <span className={big ? "text-lg" : "text-sm"}>{streak.days === 1 ? "יום" : "ימים"}</span>
    </span>
  );
}
