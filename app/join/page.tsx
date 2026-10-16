"use client";

import { useActionState } from "react";
import { joinClub } from "@/app/actions";

const EMOJIS = ["😎", "🦄", "🐻", "🦊", "🐸", "👑", "🌈", "🍑", "🧿", "🚀", "🐙", "🌵"];

export default function Join() {
  const [error, action, pending] = useActionState(joinClub, null);
  return (
    <form action={action} className="flex min-h-[80dvh] flex-col justify-center gap-4">
      <h1 className="text-center text-3xl font-bold">הצטרפות למועדון</h1>
      <input
        name="name"
        required
        maxLength={30}
        placeholder="איך יקראו לך בלוח?"
        className="rounded-xl border border-line bg-card p-3 text-center"
      />
      <fieldset className="grid grid-cols-6 gap-2">
        {EMOJIS.map((e, i) => (
          <label key={e} className="cursor-pointer">
            <input type="radio" name="emoji" value={e} defaultChecked={i === 0} className="peer sr-only" />
            <span className="flex aspect-square items-center justify-center rounded-xl border border-line bg-card text-2xl peer-checked:border-fire peer-checked:bg-fire/20">
              {e}
            </span>
          </label>
        ))}
      </fieldset>
      <input
        name="code"
        required
        dir="ltr"
        autoCapitalize="characters"
        placeholder="קוד הזמנה"
        className="rounded-xl border border-line bg-card p-3 text-center"
      />
      {error && <p className="text-center text-sm text-reset">{error}</p>}
      <button disabled={pending} className="rounded-xl bg-fire py-3 font-bold text-white disabled:opacity-50">
        {pending ? "..." : "יאללה"}
      </button>
    </form>
  );
}
