# Expense Tracker

A mobile-first personal finance application built with Next.js, TypeScript,
Tailwind CSS, and Supabase. The current implementation covers the authentication
portion of Milestone 1. Financial records and reporting come next; receipt AI is
intentionally deferred.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Fill in these public Supabase project values:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

   Use the publishable key, never a `service_role` or secret key. `.env.local`
   is ignored by Git.

4. Configure Supabase Auth as described below.
5. Start the application with `npm run dev` and open
   `http://localhost:3000`.

## Supabase Auth configuration

In the Supabase dashboard, open **Authentication → URL Configuration**.

- Local Site URL: `http://localhost:3000`
- Local allowed Redirect URL: `http://localhost:3000/auth/confirm`

For production, set the Site URL to the canonical HTTPS application origin and
add the exact production confirmation URL, for example
`https://expense.example.com/auth/confirm`. Add preview URLs separately only if
preview deployments must send auth emails.

Email confirmation and password recovery use server-side `token_hash`
verification. In **Authentication → Email Templates**, set these links exactly.

### Confirm signup template

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">
  Confirm email address
</a>
```

### Reset password template

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">
  Reset password
</a>
```

The app supplies `/auth/confirm` as `RedirectTo`. That endpoint verifies the
token with Supabase `verifyOtp`. Successful signup confirmation always goes to
`/dashboard`; successful recovery always goes to `/reset-password`. These are
fixed internal destinations and are not taken from query-string input.

The confirmation endpoint also accepts Supabase's PKCE `code` callback for
compatibility with confirmation emails sent before the custom token-hash
template was applied. New emails should use the templates above. A PKCE code is
exchanged server-side with `exchangeCodeForSession` and still uses the fixed
`/dashboard` destination.

Hosted Supabase projects require working email delivery for both flows. The
built-in sender is suitable only for limited testing; configure custom SMTP
before production use. If the Supabase password policy is stricter than the
app's eight-character minimum, Supabase rejects the password and the form shows
a safe policy error.

## Manual authentication checks

Run these checks against the intended Supabase project after applying the URL
and email-template settings:

1. Open `/dashboard` in a signed-out browser and confirm it redirects to
   `/login`.
2. Create an account with mismatched passwords and with fewer than eight
   characters; confirm both are rejected locally.
3. Create a valid account. If email confirmation is enabled, confirm the UI says
   to check email and does not show the dashboard.
4. Open the confirmation email. Confirm its link reaches `/auth/confirm`, then
   `/dashboard`, and that the dashboard shows the signed-in email.
5. Reload `/dashboard` and restart the dev server if desired; confirm the
   cookie-backed session remains signed in and refreshes.
6. Sign out. Confirm the browser returns to `/login` and `/dashboard` is no
   longer accessible.
7. On `/forgot-password`, submit an existing and a non-existing email. Confirm
   both receive the same non-enumerating response.
8. Open the recovery email. Confirm the link reaches `/reset-password`, rejects
   mismatched/short passwords, accepts a valid policy-compliant password, signs
   the recovery session out, and returns to `/login`.
9. Confirm the old password fails and the new password signs in.
10. Confirm reused, malformed, and expired confirmation/recovery links show the
    safe `/auth/error` screen.

Do not report email delivery or these live flows as verified until they have
been exercised with the target Supabase project.

## Development checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The authentication tests cover server-side input rules and the proxy matcher.
Live Supabase behavior still requires the manual checks above.
