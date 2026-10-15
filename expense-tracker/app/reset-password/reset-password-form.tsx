"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton, inputClassName } from "@/components/auth/form-fields";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <div>
        <label htmlFor="password" className="text-sm font-medium text-stone-800">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-describedby="password-help password-error" aria-invalid={Boolean(state.fieldErrors?.password)} className={inputClassName} />
        <p id="password-help" className="mt-1 text-xs text-stone-500">Use at least 8 characters. Additional project password rules also apply.</p>
        <FieldError id="password-error" message={state.fieldErrors?.password} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="text-sm font-medium text-stone-800">Confirm new password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required aria-describedby={state.fieldErrors?.confirmPassword ? "confirm-password-error" : undefined} aria-invalid={Boolean(state.fieldErrors?.confirmPassword)} className={inputClassName} />
        <FieldError id="confirm-password-error" message={state.fieldErrors?.confirmPassword} />
      </div>
      <SubmitButton idleLabel="Update password" pendingLabel="Updating password…" />
    </form>
  );
}
