import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "@/components/History";
import { getClubStats } from "@/lib/data";

export default async function MemberHistory({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  const m = (await getClubStats()).find((x) => x.id === id);
  if (!m) notFound();
  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted">→ חזרה ללוח</Link>
      <History m={m} />
    </div>
  );
}
