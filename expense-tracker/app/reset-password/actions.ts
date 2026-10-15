"use server";

import { redirect } from "next/navigation";
import type { AuthActionState } from "@/lib/auth/action-state";
import { readPassword, validatePassword } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = readPassword(formData, "password");
  const confirmPassword = readPassword(formData, "confirmPassword");
  const passwordError = validatePassword(password);
  const confirmationError = password === confirmPassword ? undefined : "Passwords do not match.";

  if (passwordError || confirmationError) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        password: passwordError,
        confirmPassword: confirmationError,
      },
    };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return {
      status: "error",
      message: "This password reset session is invalid or has expired. Request a new reset link.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      status: "error",
      message: error.code === "weak_password"
        ? "That password does not meet this project's password policy. Try a stronger password."
        : "We could not update your password right now. Please try again.",
    };
  }

  await supabase.auth.signOut();
  redirect("/login?status=password-updated");
}
