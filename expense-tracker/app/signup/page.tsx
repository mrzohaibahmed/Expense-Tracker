import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Your records stay private to your account."
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">Sign in</Link></>}
    >
      <SignupForm />
    </AuthShell>
  );
}
