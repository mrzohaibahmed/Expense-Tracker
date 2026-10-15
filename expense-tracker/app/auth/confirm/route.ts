import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set<EmailOtpType>(["email", "signup", "recovery"]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const supabase = await createClient();

  // Supabase's PKCE flow returns an authorization code after it verifies the
  // email. Supporting it prevents a successfully confirmed account from being
  // followed by a misleading callback error when the default email template is
  // still active.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );

    if (!error) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.redirect(new URL("/auth/error?code=invalid_or_expired", request.url));
  }

  if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!error) {
      const destination = type === "recovery" ? "/reset-password" : "/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    }

    const { data } = await supabase.auth.getClaims();
    if (data?.claims && type !== "recovery") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.redirect(new URL("/auth/error?code=invalid_or_expired", request.url));
  }

  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.redirect(new URL("/auth/error?code=missing_verification", request.url));
}
