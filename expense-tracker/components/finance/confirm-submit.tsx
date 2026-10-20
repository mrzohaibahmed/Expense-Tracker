"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmSubmit({ children, question }: { children: ReactNode; question: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} onClick={(event) => { if (!window.confirm(question)) event.preventDefault(); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{pending ? "Working…" : children}</button>;
}
