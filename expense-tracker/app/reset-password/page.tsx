import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const instant = false;

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/error?code=invalid_recovery_session");
  }

  return (
    <AuthShell title="Choose a new password" description="Set a new password for your Expense Tracker account.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
