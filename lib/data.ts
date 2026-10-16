import { createClient } from "@/lib/supabase/server";
import { localDay, summarize, type StreakSummary } from "@/lib/streaks";

export type Member = {
  id: string;
  display_name: string;
  emoji: string;
  timezone: string;
  joined_at: string;
};

export type MemberStats = Member & {
  joinedDay: string;
  today: string;
  resetDays: string[];
  summary: StreakSummary;
};

export async function getMe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, emoji, timezone, joined_at")
    .eq("id", user.id)
    .maybeSingle<Member>();
  return { user, profile };
}

export async function getClubStats(): Promise<MemberStats[]> {
  const supabase = await createClient();
  const [{ data: members }, { data: resets }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, emoji, timezone, joined_at").returns<Member[]>(),
    supabase.from("resets").select("user_id, day").returns<{ user_id: string; day: string }[]>(),
  ]);

  const now = new Date();
  return (members ?? [])
    .map((m) => {
      const joinedDay = localDay(m.joined_at, m.timezone);
      const today = localDay(now, m.timezone);
      const resetDays = (resets ?? []).filter((r) => r.user_id === m.id).map((r) => r.day);
      return { ...m, joinedDay, today, resetDays, summary: summarize(joinedDay, resetDays, today) };
    })
    .sort((a, b) => b.summary.current.days - a.summary.current.days || b.summary.best.days - a.summary.best.days);
}
