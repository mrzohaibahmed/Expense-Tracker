# Expense Tracker

A mobile-first personal finance application built with Next.js, TypeScript,
Tailwind CSS, and Supabase. Authentication, financial records, and local
dashboard/reporting implementation are present. Receipt AI remains deferred.

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

## Core financial database

Milestone 2 is defined by the versioned migration at
`supabase/migrations/202610150001_core_financial_schema.sql`. It creates only
profiles, accounts, categories, transactions, transaction splits, and transfers.
Budgets and receipt-processing tables are intentionally deferred.

Money uses PostgreSQL `BIGINT` minor units and is constrained to JavaScript's
safe-integer range (`±9,007,199,254,740,991`; transactions, splits, and transfers
must also be positive). The checked-in TypeScript types therefore expose these
columns as `number`; `lib/money/minor-units.ts` validates the serialization
boundary. Only PKR is accepted in this release.

Authenticated users can read their own financial rows. Profiles, accounts, and
categories expose only the table operations needed for self-service management.
Transactions, splits, and transfers cannot be mutated directly: clients must use
the `create_transaction`, `update_transaction`, and `create_transfer` RPCs so
ownership, split totals, category kinds, idempotency, and atomicity cannot be
bypassed. Referenced accounts and categories are protected by restrictive
foreign keys and should be archived by setting `archived_at`.

### Optional container-based database testing

This optional workflow uses Docker Desktop (or another Docker-compatible
container runtime). The hosted development workflow below does not require it.
These commands affect only the local stack unless `--linked` or a remote
database URL is explicitly added.

```bash
npx supabase init
npx supabase start
npm run db:reset
npm run db:test
npm run db:lint
npm run db:types
```

`db:reset` rebuilds the disposable local database from all migrations. The
pgTAP suite under `supabase/tests/database` verifies initialization, RLS
isolation, cross-user reference rejection, atomic rollback, split totals,
idempotency, transfer behavior, direct-write denial, and category-cycle guards.
Review the generated type diff after `db:types`; it should match
`lib/supabase/database.types.ts`.

### Apply to the hosted development project without resetting data

The values in `.env.local` are the application URL and publishable key. They do
not grant migration access. Use a Supabase CLI login with access to the **same
development project**. The CLI is installed in this repository, so use `npx`
from the repository root. No Docker runtime is needed for a hosted database.

1. Run `npx supabase init` once if `supabase/config.toml` does not exist. This
   creates local CLI configuration; it does not start a database.
2. Run `npx supabase login` and complete authentication yourself. Find the
   project reference in the Supabase dashboard URL and verify it matches the
   project reference in `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`. Do not put
   an access token or database password in this repository.
3. Run `npx supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF` and enter
   the development database password when prompted. Confirm the CLI's linked
   project is the intended development project before continuing.
4. Run `npx supabase migration list --linked` and inspect the remote migration history.
   If the existing financial tables were created outside these migrations,
   reconcile that schema first; do not force this migration over it.
5. Run `npx supabase db push --linked --dry-run`. Review the pending migration
   names and stop if anything unexpected appears. Then run
   `npx supabase db push --linked` to
   apply only pending migrations. This preserves existing rows and records the
   migration versions. Never run `db:reset` or `db reset --linked` here.
6. Run `npx supabase db lint --linked --schema public --level warning --fail-on error` and
   `npx supabase gen types typescript --linked --schema public` after the push.
   Review the generated diff before replacing the checked-in types.

Apply later versioned migrations by repeating steps 4–6. The existing
`db:reset`, `db:test`, `db:lint`, and `db:types` scripts target a local container
stack and are **not** the hosted development verification procedure. For hosted
verification, run the two-user API checks described below using separate real
authenticated sessions; administrator-only SQL checks do not establish RLS.

### Verify the hosted development database with two users

Create two **disposable, email-confirmed** users in the development project.
Place their credentials in a local file named `.supabase-test-users.local.json`:

```json
{
  "userA": { "email": "first-test-user@example.com", "password": "replace-me" },
  "userB": { "email": "second-test-user@example.com", "password": "replace-me" }
}
```

The file is ignored by Git. Run `npm run db:verify:hosted` after pushing the
migrations. This script signs in both users through the public Auth API with
the publishable key, then makes separate authenticated and anonymous Data API
requests. It checks RLS isolation, cross-user references, split totals, atomic
create/update/delete, direct-write denial, transfer behavior, exact balance
deltas, idempotency, category archive hierarchy, 21-record history pagination,
and known-record reporting totals. The balance checks
use a pre-test baseline, so the suite can be rerun with the same disposable
users. It creates clearly named test-only records under those users; delete the
two users in the development dashboard after testing to cascade their financial
rows. A passing administrator SQL query alone is not an RLS test.

## Manual financial tracking

After the hosted development migrations are applied and the two-user database
check passes, sign in and use the navigation to manage accounts, categories,
transactions, and transfers. All manual transactions save through the atomic
`create_transaction` / `update_transaction` RPCs. Deletion uses the new
ownership-checked `delete_transaction` RPC. Account balances use
`get_account_balances` as of the user's current date; future-dated records do
not change today's balance. The new operations are in
`202610150002_manual_tracking_operations.sql` and must be pushed after the core
schema migration. `202610190001_fix_deferred_split_trigger_security.sql` keeps
the deferred split-total check inside its private schema after an RPC returns;
it grants no new private-schema access to authenticated users.
`202610190002_category_archive_hierarchy.sql` prevents an active parent from
being archived before its active children and prevents a child from being
restored beneath an archived parent.

Check these flows with real development users before treating Milestone 3 as
complete:

1. Add, edit, and archive an account; confirm archived accounts remain visible
   for history but cannot receive new transactions or transfers.
2. Add, edit, and archive expense and income categories; confirm archived
   categories remain named on historical transactions. Create a parent and
   child category and confirm the parent cannot be archived before the child.
3. Add an expense with one category, an income item, and an expense with two
   category allocations. Confirm invalid amount formats and mismatched split
   totals are rejected.
4. Search transaction merchant/notes; filter by type, account, category, and
   date; try each sort and multiple pages.
5. Edit and delete a manual transaction. Confirm category allocations and
   balances change together, and a user cannot edit another user's record.
6. Transfer between two accounts. Confirm one balance falls, the other rises,
   and transaction spending/income totals do not change.
7. Try direct URLs while signed out and repeat the financial actions after
   signing back in. Check narrow mobile screens and keyboard labels/errors.

## Dashboard and reports

`202610200001_financial_reports.sql` adds `get_financial_report`. Apply it with
the reviewed, no-reset `npx supabase db push --linked --dry-run` then
`npx supabase db push --linked` workflow above. Regenerate public database types
afterward. The RPC runs with the signed-in user's privileges, checks ownership
of optional account/category filters, and remains subject to table RLS. Anonymous
users have no execute grant.

Reports aggregate transaction splits in PostgreSQL as exact `NUMERIC` minor
units and return totals as decimal strings. This keeps totals exact even when
a sum exceeds JavaScript's safe integer range. A parent-category filter includes
its descendants; the breakdown lists direct allocations per category so parent
and child amounts are never counted twice. Archived accounts and categories
remain available for history. Transfers and opening balances affect the current
account balance, but never report income, expense, or cash-flow totals.
Renaming a category changes its label in historical reports; archiving keeps
the category and its allocations intact.

The dashboard shows today's, this week's, and this month's expenses, a selected
period's income/expenses/net cash flow, current balances, recent transactions,
category spending, and a daily trend. `/reports` supports daily, weekly,
monthly, and custom ranges (up to 366 days), account/category filters, merchant
and account analysis, largest expenses, and previous-period comparisons. Dates
use the profile timezone and configured week start. A current incomplete period
is compared with the same elapsed portion of the previous period. When the
previous calendar month is shorter, the label states the unequal day counts.
When the previous total is zero, no percentage is shown.

The database verification script creates known test transactions under two
disposable confirmed users, checks exact report totals and cross-user denial,
then removes its temporary pagination fixtures. Other clearly named test rows
remain for repeat verification. Browser acceptance for authenticated forms and
protected mobile layouts must still be completed with an isolated test browser
session; API checks do not prove those UI flows.

Manual report acceptance should include changing the date/period, filtering an
archived account and category, opening the chart's exact amount summaries,
confirming an edit/delete updates totals, and verifying mobile layout and
keyboard navigation with an authenticated disposable user.

### Apply to another remote Supabase project

Do this deliberately from an authenticated developer machine. No remote
migration is run automatically by the application or its build.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > lib/supabase/database.types.ts
```

Before the final `db push`, review the dry run and confirm the linked project is
the intended development/staging environment. Do not use `db reset --linked` on
production: it is destructive. For production, apply the reviewed migration in
a controlled release and take the backup/restore precautions required by the
project plan.

The migration itself handles existing Auth users and installs a best-effort
new-user trigger. It creates a profile, the documented default categories, and
a Cash account idempotently, without inserting transactions. If initialization
ever needs to be retried for a signed-in user, call the
`initialize_current_user` RPC. Trigger failures emit a database warning rather
than rolling back account creation.

No additional anonymous grants or dashboard toggles are required. Automatic
Data API table privileges remain revoked; the migration explicitly grants the
minimal authenticated access and function execution privileges.
