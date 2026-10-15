"use server";

import type { AuthActionState } from "@/lib/auth/action-state";
import { getRequestOrigin } from "@/lib/auth/request-origin";
import { readText, validateEmail } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readText(formData, "email").toLowerCase();
  const emailError = validateEmail(email);

  if (emailError) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: { email: emailError },
    };
  }

  const origin = await getRequestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });

  if (error) {
    return {
      status: "error",
      message: error.code === "over_email_send_rate_limit"
        ? "Too many emails were requested. Wait a little, then try again."
        : "We could not send a reset email right now. Please try again.",
    };
  }

  return {
    status: "success",
    message: "If an account exists for that address, a password reset link is on its way.",
  };
}
