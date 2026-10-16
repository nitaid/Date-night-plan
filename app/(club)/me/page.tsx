import { History } from "@/components/History";
import { getClubStats, getMe } from "@/lib/data";

export default async function MyHistory() {
  const [stats, { user }] = await Promise.all([getClubStats(), getMe()]);
  const me = stats.find((m) => m.id === user?.id);
  return me ? <History m={me} /> : null;
}
