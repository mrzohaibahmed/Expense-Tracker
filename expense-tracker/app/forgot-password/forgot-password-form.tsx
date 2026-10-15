"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton, inputClassName } from "@/components/auth/form-fields";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { forgotPasswordAction } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <div>
        <label htmlFor="email" className="text-sm font-medium text-stone-800">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required aria-describedby={state.fieldErrors?.email ? "email-error" : undefined} aria-invalid={Boolean(state.fieldErrors?.email)} className={inputClassName} />
        <FieldError id="email-error" message={state.fieldErrors?.email} />
      </div>
      <SubmitButton idleLabel="Send reset link" pendingLabel="Sending reset link…" />
    </form>
  );
}
