"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton, inputClassName } from "@/components/auth/form-fields";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <div>
        <label htmlFor="email" className="text-sm font-medium text-stone-800">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required aria-describedby={state.fieldErrors?.email ? "email-error" : undefined} aria-invalid={Boolean(state.fieldErrors?.email)} className={inputClassName} />
        <FieldError id="email-error" message={state.fieldErrors?.email} />
      </div>
      <div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="password" className="text-sm font-medium text-stone-800">Password</label>
          <Link href="/forgot-password" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Forgot password?</Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required aria-describedby={state.fieldErrors?.password ? "password-error" : undefined} aria-invalid={Boolean(state.fieldErrors?.password)} className={inputClassName} />
        <FieldError id="password-error" message={state.fieldErrors?.password} />
      </div>
      <SubmitButton idleLabel="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}
