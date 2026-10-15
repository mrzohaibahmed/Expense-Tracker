import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

const messages: Record<string, string> = {
  invalid_link: "This authentication link is incomplete or invalid.",
  invalid_or_expired: "This authentication link is invalid or has expired.",
  invalid_recovery_session: "This password reset session is invalid or has expired.",
  missing_verification: "The link did not include verification details. Your email may already be confirmed, so try signing in.",
};

type AuthErrorPageProps = {
  searchParams: Promise<{ code?: string }>;
};

export const instant = false;

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { code } = await searchParams;
  const message = code ? messages[code] : undefined;

  return (
    <AuthShell
      title="We couldn’t complete that request"
      description={message ?? "The authentication request could not be completed safely."}
      footer={<Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">Back to sign in</Link>}
    >
      <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Request a new email if the link has expired. For password recovery, start again from the forgot-password page.
      </div>
      <Link href="/forgot-password" className="mt-5 flex h-11 w-full items-center justify-center rounded-xl border border-stone-300 text-sm font-semibold text-stone-800 hover:bg-stone-50">
        Request a password reset
      </Link>
    </AuthShell>
  );
}
