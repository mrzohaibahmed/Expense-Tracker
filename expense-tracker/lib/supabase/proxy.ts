import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          const previousResponse = supabaseResponse;
          supabaseResponse = NextResponse.next({ request });
          previousResponse.cookies.getAll().forEach((cookie) => {
            supabaseResponse.cookies.set(cookie);
          });

          for (const header of CACHE_HEADERS) {
            const value = previousResponse.headers.get(header);
            if (value) supabaseResponse.headers.set(header, value);
          }

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Keep this immediately after client creation. It validates the access token
  // and refreshes near-expiry sessions when needed.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && request.nextUrl.pathname.startsWith("/dashboard")) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    for (const header of CACHE_HEADERS) {
      const value = supabaseResponse.headers.get(header);
      if (value) redirectResponse.headers.set(header, value);
    }

    redirectResponse.headers.set("Cache-Control", "private, no-store");
    redirectResponse.headers.set("Pragma", "no-cache");
    redirectResponse.headers.set("Expires", "0");
    return redirectResponse;
  }

  supabaseResponse.headers.set("Cache-Control", "private, no-store");
  supabaseResponse.headers.set("Pragma", "no-cache");
  supabaseResponse.headers.set("Expires", "0");

  return supabaseResponse;
}
