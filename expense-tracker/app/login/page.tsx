import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export const instant = false;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { status } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to view your private financial records."
      footer={<>New here? <Link href="/signup" className="font-semibold text-emerald-700 hover:text-emerald-800">Create an account</Link></>}
    >
      {status === "password-updated" ? (
        <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Your password has been updated. Sign in with the new password.</p>
      ) : null}
      <LoginForm />
    </AuthShell>
  );
}
