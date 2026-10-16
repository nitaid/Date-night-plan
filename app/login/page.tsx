"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Email + 6-digit code (not a magic link): links open in Safari, whose
// cookies aren't shared with the home-screen app.
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (!sent) {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) setError("לא הצלחנו לשלוח קוד. נסה שוב בעוד דקה.");
      else setSent(true);
    } else {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) setError("קוד שגוי או שפג תוקפו");
      else router.replace("/");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex min-h-[80dvh] flex-col justify-center gap-4">
      <div className="text-center">
        <p className="text-6xl">🔥</p>
        <h1 className="mt-2 text-3xl font-bold">Streak Club</h1>
        <p className="text-muted">מי מחזיק הכי הרבה ימים</p>
      </div>

      <input
        type="email"
        dir="ltr"
        required
        disabled={sent}
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-xl border border-line bg-card p-3 text-center disabled:opacity-60"
      />
      {sent && (
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          required
          autoFocus
          placeholder="קוד מהמייל"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-xl border border-line bg-card p-3 text-center text-2xl tracking-[0.4em]"
        />
      )}
      {error && <p className="text-center text-sm text-reset">{error}</p>}
      <button disabled={busy} className="rounded-xl bg-fire py-3 font-bold text-white disabled:opacity-50">
        {busy ? "..." : sent ? "כניסה" : "שלחו לי קוד"}
      </button>
      {sent && (
        <button type="button" onClick={() => setSent(false)} className="text-sm text-muted">
          שינוי מייל
        </button>
      )}
    </form>
  );
}
