"use server";

import { redirect } from "next/navigation";
import type { AuthActionState } from "@/lib/auth/action-state";
import { getRequestOrigin } from "@/lib/auth/request-origin";
import { readPassword, readText, validateEmail, validatePassword } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readText(formData, "email").toLowerCase();
  const password = readPassword(formData, "password");
  const confirmPassword = readPassword(formData, "confirmPassword");
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const confirmationError = password === confirmPassword ? undefined : "Passwords do not match.";

  if (emailError || passwordError || confirmationError) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        email: emailError,
        password: passwordError,
        confirmPassword: confirmationError,
      },
    };
  }

  const origin = await getRequestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    const message = error.code === "weak_password"
      ? "That password does not meet this project's password policy. Try a stronger password."
      : error.code === "over_email_send_rate_limit"
        ? "Too many emails were requested. Wait a little, then try again."
        : "We could not create your account right now. Please try again.";
    return { status: "error", message };
  }

  if (data.session) redirect("/dashboard");

  return {
    status: "success",
    message: "Check your email to confirm your account, then return here to sign in.",
  };
}
