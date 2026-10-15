import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we’ll send a secure password reset link."
      footer={<Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
