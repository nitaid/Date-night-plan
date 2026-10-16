import { headers } from "next/headers";
import { reportSelf, rotateToken, signOut } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createClient } from "@/lib/supabase/server";

export default async function Settings({ searchParams }: PageProps<"/settings">) {
  const { welcome } = await searchParams;
  const supabase = await createClient();
  const { data: token } = await supabase.rpc("my_report_token");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const url = `${origin}/api/report/${token}`;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">⚙️ הגדרות</h1>

      {welcome && (
        <p className="rounded-2xl border border-clean/50 bg-clean/10 p-4">
          ברוך הבא למועדון! 👋 נשאר שלב אחד: לחבר את האייפון לפי ההוראות כאן למטה.
        </p>
      )}

      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-lg font-bold">📱 חיבור לאייפון</h2>
        <p className="text-sm text-muted">כל פתיחה של האפליקציה תאפס לך את הרצף אוטומטית.</p>
        <div className="flex items-center gap-2 rounded-xl bg-bg p-2">
          <code dir="ltr" className="min-w-0 flex-1 truncate text-xs">{url}</code>
          <CopyButton text={url} />
        </div>
        <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-relaxed">
          <li>פותחים את <b>קיצורים</b> (Shortcuts) ← לשונית <b>אוטומציה</b> ← <b>+</b></li>
          <li>בוחרים <b>יישום</b> (App) ← בוחרים את האפליקציה ← מסמנים <b>נפתח</b> (Is Opened)</li>
          <li>מסמנים <b>להפעיל מיד</b> (Run Immediately) ומכבים את <b>הודע כשמופעל</b></li>
          <li>אוטומציה חדשה ריקה ← מוסיפים פעולה <b>קבל תוכן של URL</b> (Get Contents of URL)</li>
          <li>מדביקים את הקישור למעלה ← לוחצים על החץ ← <b>שיטה: POST</b></li>
          <li>שומרים. זהו ✅</li>
        </ol>
        <p className="text-xs text-muted">הקישור הוא סודי ומזהה רק אותך. אם הוא דלף, ייצר קישור חדש ועדכן את הקיצור.</p>
        <form action={rotateToken}>
          <button className="text-sm text-muted underline">ייצר קישור חדש</button>
        </form>
      </section>

      <section className="space-y-2 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-lg font-bold">😬 נפלתי</h2>
        <p className="text-sm text-muted">נכנסת ממכשיר אחר או שהקיצור לא עבד? דיווח ידני על איפוס להיום.</p>
        <ConfirmButton action={reportSelf} confirmText="בטוח? הרצף יתאפס.">
          לאפס לי את הרצף
        </ConfirmButton>
      </section>

      <form action={signOut}>
        <button className="w-full rounded-xl border border-line py-3 text-muted">התנתקות</button>
      </form>
    </div>
  );
}
