"use client";

import { useTransition } from "react";

export function ConfirmButton({
  action,
  confirmText,
  children,
}: {
  action: () => Promise<void>;
  confirmText: string;
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm(confirmText) && start(action)}
      className="w-full rounded-xl bg-reset py-3 font-bold text-white disabled:opacity-50"
    >
      {pending ? "..." : children}
    </button>
  );
}
