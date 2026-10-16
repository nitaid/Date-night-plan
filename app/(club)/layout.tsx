import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { getMe } from "@/lib/data";

export default function ClubLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<Loading />}>
        <MembersOnly>{children}</MembersOnly>
      </Suspense>
      <Suspense>
        <Nav />
      </Suspense>
    </>
  );
}

async function MembersOnly({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getMe();
  if (!user) redirect("/login");
  if (!profile) redirect("/join");
  return children;
}

function Loading() {
  return <p className="animate-pulse pt-20 text-center text-4xl">🔥</p>;
}
