"use client";

import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/lib/auth/action-state";

export function FormMessage({ state }: { state: AuthActionState }) {
  if (!state.message) return null;

  return (
    <p
      className={state.status === "error" ? "rounded-xl bg-red-50 p-3 text-sm text-red-800" : "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-sm text-red-700">{message}</p>;
}

export function SubmitButton({ idleLabel, pendingLabel }: { idleLabel: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export const inputClassName = "mt-2 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-3 focus:ring-emerald-100";
