"use server";

import { redirect } from "next/navigation";
import type { AuthActionState } from "@/lib/auth/action-state";
import { readPassword, readText, validateEmail } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readText(formData, "email").toLowerCase();
  const password = readPassword(formData, "password");
  const emailError = validateEmail(email);

  if (emailError || !password) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        email: emailError,
        password: password ? undefined : "Password is required.",
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = error.code === "email_not_confirmed"
      ? "Confirm your email address before signing in."
      : error.code === "invalid_credentials"
        ? "Email or password is incorrect."
        : "We could not sign you in right now. Please try again.";

    return { status: "error", message };
  }

  redirect("/dashboard");
}
