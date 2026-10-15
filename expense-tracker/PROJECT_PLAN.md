# Expense Tracker — Product and Implementation Plan

## 1. Product goal

Build a deployed, multi-user personal finance application that helps
users understand where their money goes.

Users must be able to:
- Create an account and sign in securely.
- Record expenses manually.
- Upload receipts for AI-assisted expense entry.
- Review and correct extracted information before saving.
- Categorize spending, including splitting one purchase across categories.
- Track daily, weekly, monthly, and custom-period spending.
- Manage income, payment accounts, and budgets.
- Access their own data privately across devices.
- Install the application on mobile as a PWA.

Initial audience: individual users, with PKR as the default currency.
Each user has private records. Shared family/group finances are outside
the initial scope.

## 2. Working principles

- Build financial records and reporting before AI receipt scanning.
- Route both manual entry and reviewed receipt data through the same validated,
  atomic transaction-writing logic so all reports follow identical accounting
  rules.
- Inspect the existing code before making changes.
- Implement one milestone at a time.
- Reuse working generated Supabase and shadcn files.
- Preserve the project's existing app/src directory convention.
- Prefer straightforward architecture over unnecessary abstractions.
- Build real database-backed behavior; do not present mock features as working.
- Do not fabricate financial records or AI results.
- Do not silently change the chosen stack.
- Document setup requirements and implementation decisions.
- Keep PROJECT_PLAN.md updated with milestone status.
- Keep credentials out of code, logs, documentation, and Git.
- Ask for missing external configuration only when needed.
- Do not claim checks passed unless they were actually run.

## 3. Chosen stack

Application:
- Next.js App Router
- React
- TypeScript
- Next.js server endpoints/actions on Node.js

Interface:
- Tailwind CSS
- Existing shadcn/ui setup using Base UI
- React Hook Form and Zod for forms and validation
- Recharts for financial charts

Backend services:
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage with private receipt buckets
- Supabase client libraries and versioned SQL migrations

AI:
- Gemini API with an image-capable model
- Model ID configured through a server environment variable
- Structured extraction output validated with Zod
- A small provider interface so the model/provider can be replaced later

Background work:
- Trigger.dev for receipt processing and retries
- Verify current integration documentation before implementation
- Persist job state in PostgreSQL

Deployment:
- Vercel for the Next.js application
- Supabase for database, authentication, and receipt storage

Quality:
- Vitest for important business logic
- Playwright for critical end-to-end flows
- Sentry for production error monitoring
- Git and GitHub for version control

Use mutually compatible, supported package versions and commit the lockfile.
Do not add a separate Python backend initially.

## 4. Application structure

Use clear boundaries:
- app: routes, layouts, server actions, and route handlers
- components: reusable interface components
- lib/supabase: browser/server clients and session helpers
- lib/auth: reusable verified-user checks
- lib/validation: input and AI response schemas
- lib/money: exact money conversion and formatting
- lib/reports: reporting/date-range logic
- lib/ai: provider adapter and extraction prompts
- trigger: background receipt tasks
- supabase/migrations: database schema, grants, policies, functions
- tests: business rules and integration/end-to-end coverage

Do not introduce folders without a concrete purpose.

## 5. Pages and navigation

Public:
- /login
- /signup
- /forgot-password
- /reset-password
- Authentication confirmation/callback and error routes

Protected:
- /dashboard
- /transactions
- /transactions/new
- /transactions/[id]/edit
- /accounts
- /categories
- /budgets
- /receipts
- /receipts/[id]/review
- /reports
- /settings

The root route redirects appropriately based on authentication.

Mobile:
- Compact bottom navigation for main destinations.
- Prominent Add Expense and Scan Receipt actions.

Desktop:
- Sidebar navigation and larger reporting layouts.

Provide loading, empty, error, and success states.
Do not show dead buttons or links for unfinished features.

## 6. Authentication and user isolation

Use Supabase Auth with cookie-based SSR sessions.

Implement:
- Email/password signup and login
- Email confirmation
- Logout
- Password reset
- Session refresh
- Protected pages and server operations

Follow current official Supabase/Next.js documentation.
Use proxy.ts for Next.js 16 where appropriate.
Avoid duplicate middleware/proxy implementations.

Verify authentication on the server using a supported verified-user/token
method. Do not authorize from getSession() alone.

Database:
- Enable RLS on every user-owned table.
- Create explicit authenticated-role grants because automatic table
  exposure was disabled during project setup.
- Create separate policies for SELECT, INSERT, UPDATE, and DELETE.
- Scope ownership to auth.uid().
- Enforce ownership of referenced records too.
- Prevent a user from attaching another user's account, category,
  receipt, or transaction to their records.

Storage:
- Private receipt bucket.
- Paths include the authenticated user's ID.
- Storage policies enforce ownership.
- Use authorized downloads or short-lived signed URLs.

Never expose service_role credentials to the browser.
Background jobs must validate ownership and use narrowly scoped operations.
Any privileged credentials must remain server-only.

Test isolation with two different users.

## 7. Financial data model

Use SQL migrations, foreign keys, constraints, and indexes.

Suggested tables:

### profiles
- id: references auth.users
- display_name
- default_currency: PKR initially
- timezone: Asia/Karachi initially, editable
- week_starts_on: configurable
- created_at, updated_at

### accounts
- id, user_id
- name
- type: cash, bank, mobile_wallet, other
- currency
- opening_balance_minor
- archived_at
- created_at, updated_at

Examples: Cash, Bank Account, Easypaisa, JazzCash.
These are manually managed accounts initially, not live integrations.

### categories
- id, user_id
- name
- kind: expense or income
- parent_id: optional
- icon, color
- archived_at
- created_at, updated_at

Seed default categories per user.
Prevent invalid parent relationships and category cycles.

### transactions
- id, user_id
- type: expense or income
- account_id
- amount_minor: positive integer
- currency
- occurred_on: purchase/income calendar date
- merchant: optional
- notes: optional
- source: manual or receipt
- receipt_id: optional
- idempotency_key: optional, unique per user
- created_at, updated_at

### transaction_splits
- id, user_id
- transaction_id
- category_id
- amount_minor: positive integer

Use a split row even for a single-category transaction.
Split totals must equal the transaction amount.
The category kind must match the transaction type.

### transfers
- id, user_id
- from_account_id
- to_account_id
- amount_minor
- occurred_on
- notes
- idempotency_key
- created_at, updated_at

Transfers are separate from income and expenses.
Initially support transfers only between accounts with the same currency.
Prevent transfers to the same account.

### budgets
- id, user_id
- name
- category_id: optional; null means overall budget
- amount_minor
- currency
- period_start, period_end
- created_at, updated_at

Start with monthly overall and category budgets.
Avoid accidental duplicate budgets for the same category and period.
Overall and category budgets can overlap, but must not be summed together
as though they were independent spending.

### receipts
- id, user_id
- storage_path
- original_filename
- content_type, file_size
- file_hash
- status: uploaded, queued, processing, needs_review, failed, saved
- extracted_data: JSONB
- extraction_version
- error_code: optional
- job_reference: optional
- created_at, updated_at

### receipt_items
- id, user_id
- receipt_id
- description
- quantity: optional decimal
- unit_price_minor: optional
- line_total_minor
- suggested_category_id: optional
- confirmed_category_id: optional
- position

Receipt items support item-level analysis.
They must not be counted again as additional expenses.

### categorization_rules
- id, user_id
- match_type
- match_value
- category_id
- priority
- enabled
- created_at, updated_at

Start with explicit merchant matching.
Ask users whether to remember a correction rather than silently creating
broad rules.

### receipt_processing_attempts / usage records
Store sufficient information to enforce scan quotas and diagnose failures.
Avoid storing unnecessary sensitive model inputs in logs.

Finalize exact column types and constraints before migrations.
Use indexes for user/date, user/category, user/account, and job status queries.

## 8. Money and accounting rules

Initial release:
- Support PKR as the transaction currency.
- Keep currency fields to allow future extension.
- Do not implement foreign exchange conversion yet.

Money:
- Store money as integer minor units: paisa for PKR.
- Rs. 1,250.50 becomes 125050.
- Use BIGINT or a justified bounded integer type.
- Parse decimal input exactly; avoid floating-point rounding.
- Define safe serialization/range handling for JavaScript.
- Reject invalid, zero, negative, or out-of-range transaction amounts.

Balances:
- Opening balance + income - expenses
  + incoming transfers - outgoing transfers.
- Opening balances do not count as income.
- Transfers do not count as income or spending.
- Calculate from records initially rather than maintaining an easily
  desynchronized balance field.

Atomic writes:
- Save transactions and category splits in one database transaction,
  preferably through a carefully secured database function.
- Apply the same rule to multi-record edits.
- Enforce split equality at the database write boundary.
- Prefer SECURITY INVOKER functions.
- If SECURITY DEFINER is required, restrict privileges, set search_path,
  and explicitly verify ownership.

Prevent duplicate submissions through idempotency keys and constraints.

Historical accuracy:
- Archive referenced accounts/categories rather than deleting them.
- Define how category changes affect historical reports.
- Treat refunds as a later feature with explicit accounting rules;
  do not use undocumented negative-expense behavior.

## 9. Dates and reporting

Keep purchase dates separate from record creation timestamps.

- occurred_on represents the user's chosen purchase date.
- created_at records when the record was saved.
- Use the user's timezone to derive "today."
- Use the configured week start for weekly reporting.
- Do not hard-code a Pakistan weekend assumption.
- Future-dated planned expenses must not silently count as already spent.

Reports:
- Today, this week, this month, and custom dates
- Total expenses and income
- Net cash flow
- Category/subcategory breakdown
- Spending trend by day/week/month
- Top merchants
- Largest expenses
- Account filters
- Previous equivalent-period comparisons
- Budget used and remaining

Use SQL/database aggregation where practical.
Do not download all lifetime transactions to calculate totals in the browser.

For partial-period comparisons, compare equivalent elapsed periods
and label the comparison clearly.

## 10. Manual expense and income entry

This milestone establishes the canonical validated transaction-writing path.
Receipt review must reuse this path later rather than implementing separate
posting logic.

Fields:
- Amount
- Date
- Account
- Category or category splits
- Merchant, optional
- Notes, optional

Implement:
- Create, read, update, delete
- Search, filtering, sorting, and pagination
- Confirmation before deletion
- Exact amount validation
- Ownership checks on every operation
- Dashboard refresh after successful changes

Income follows the same core transaction structure with income categories.

Default expense categories:
- Groceries
- Dining out
- Transport
- Utilities
- Shopping
- Health
- Education
- Entertainment
- Personal care
- Household
- Other

Default income categories:
- Salary
- Freelance
- Gift
- Other income

## 11. AI receipt workflow

The AI helps prepare records; database code remains responsible for totals
and accounting rules. Receipt review produces input for the same validated,
atomic transaction-writing logic used by manual entry; it must not maintain a
parallel save path.

Workflow:
1. User uploads an image or PDF.
2. Backend verifies authentication, quota, size, and file type.
3. Store the receipt privately and create its database record.
4. Queue an idempotent processing job.
5. Job loads the authorized receipt.
6. AI extracts structured data.
7. Validate output and reconcile amounts.
8. Save extraction results as needs_review.
9. User reviews/corrects the details.
10. Save the final transaction and splits atomically.
11. Mark the receipt as saved.

Extraction fields:
- Merchant
- Purchase date
- Currency
- Receipt number, if present
- Subtotal
- Tax
- Discount
- Final total
- Purchased items and line totals, when readable
- Suggested categories
- Explicit unreadable/missing fields

Rules:
- Never invent unreadable amounts or dates.
- Separate extracted facts from inferred categories.
- Restrict suggested categories to the user's allowed categories.
- Treat receipt contents as untrusted input, not instructions.
- Model output must pass schema and business validation.
- Do not treat model-reported confidence as a calibrated probability.
- Check item/split totals against the final amount.
- Avoid double-counting tax/discount already included in prices.
- Flag unresolved reconciliation differences for user correction.
- Support a fallback single-category expense when item extraction fails.
- The initial release always requires review before posting an expense.

Mixed receipts:
- One purchase can create multiple category allocations.
- Allocate tax/discount using an explicit, deterministic rule.
- Ensure the final allocations equal the receipt total exactly.
- Document rounding and remainder allocation.

Reliability:
- Retry transient errors with limits and backoff.
- Do not retry permanent validation failures indefinitely.
- Prevent duplicate jobs and duplicate expense creation.
- Allow users to retry failed scans safely.
- Flag likely duplicate receipts using file hash and purchase details.
- Similar purchases are warnings, not automatic deletions.

Privacy and cost:
- Explain external AI processing before the first scan.
- Select provider data terms suitable for users' financial receipts.
- Free-tier testing must not be presented as a permanent production plan.
- Enforce per-user quotas server-side.
- Do not log receipt contents or sensitive URLs by default.

## 12. Budgets

Support:
- Monthly overall spending limit
- Monthly category limits
- Used, remaining, and percentage
- Clear over-budget state
- In-app threshold alerts
- Month selection

Calculate usage from posted expenses/category splits.
Exclude transfers and opening balances.
Do not double-count parent/child categories.
Define budget behavior for archived categories.

Email/push alerts and rollover budgets are later enhancements.

## 13. Export and user settings

Settings:
- Display name
- Timezone
- Week start
- Default account
- Theme, if implemented
- Receipt retention preference, if implemented

Data:
- CSV export of filtered transactions
- Escape CSV formula prefixes
- User data export
- Account deletion workflow covering auth, database records, storage,
  and queued jobs
- Document any backup retention limits that affect deletion

## 14. PWA and offline behavior

Build a mobile-first web application, then add PWA support.

Include:
- Web app manifest
- Proper icons
- Standalone display
- Theme/background colors
- HTTPS deployment
- Platform-specific installation guidance

Offline scope for initial PWA:
- Cache the application shell and static assets only.
- Show a clear offline state.
- Allow optional device-local expense drafts.
- Require connectivity for authentication, saving to the server,
  receipt uploads, and AI processing.

Do not cache authenticated financial responses or receipts by default.
Local drafts must be scoped to the user, clearly labeled as unsynced,
and cleared appropriately on logout.

Full offline synchronization is a later milestone requiring conflict
handling and duplicate prevention. Installation alone is not offline support.

## 15. Deployment and operations

Maintain separate local/development and production configuration.

Before production:
- Apply reviewed migrations.
- Configure production auth URLs and email templates.
- Configure reliable email delivery for confirmation/password reset.
- Configure private storage policies.
- Configure background worker environments.
- Configure AI quotas and provider data terms.
- Add error monitoring with sensitive-data filtering.
- Choose backup and restore arrangements.
- Verify restoration procedures appropriate to the chosen plan.
- Verify Vercel, Supabase, and job-service plans suit intended usage.
- Avoid promising free hosting indefinitely.

Use deployment previews with a non-production database.
Do not run destructive database changes automatically during builds.
Require deliberate execution of destructive migrations.

## 16. Testing requirements

Prioritize meaningful tests:

Financial logic:
- Exact decimal-to-paisa conversion
- Split totals
- Transfer accounting
- Balance calculations
- Budget calculations
- Tax/discount allocation
- Date boundaries and timezone handling
- Equivalent-period comparisons

Authorization:
- User A cannot read, create references to, update, or delete User B's data.
- Receipt storage/download access is isolated.
- API/server actions reject unauthorized requests.
- Background jobs cannot process another user's receipt through a forged ID.

Authentication:
- Signup and email confirmation
- Login and refresh
- Logout
- Protected direct navigation
- Password reset
- Invalid/expired confirmation links

Receipt processing:
- Valid extraction
- Missing/unreadable fields
- Wrong totals
- Duplicate upload
- Job retries
- Repeated save clicks
- Provider failures

End-to-end:
- Sign in → add expense → dashboard updates
- Edit/delete expense → totals update
- Create transfer → spending total unchanged
- Upload → review → save → report updated
- Budget usage changes correctly
- Mobile navigation and forms

Run type checks and a production build at relevant milestones.
Report any verification that requires live credentials or manual interaction.

## 17. Implementation milestones

Complete the financial records and reporting milestones before beginning AI
receipt scanning. The receipt workflow must build on the established
transaction-validation and reporting foundation.

### Milestone 1 — Foundation and authentication
- Inspect existing setup.
- Environment configuration.
- Browser/server Supabase clients.
- Session refresh.
- Signup, confirmation, login, logout, password reset.
- Protected dashboard shell.

Done when:
- Authentication works across refreshes.
- Logged-out visitors cannot access protected content.
- No secrets are exposed.

Status (2026-10-15): authentication implementation complete; live Supabase
configuration and end-to-end manual verification remain before Milestone 1 can
be marked complete.

Completed:
- Consolidated browser, per-request server, and session-refresh clients under
  `lib/supabase` using `@supabase/ssr` and async `cookies()`.
- Added the Next.js 16 root `proxy.ts`, verified-token session refresh, refreshed
  cookie forwarding, private/no-store cache headers, and a static-asset matcher.
- Added server-validated signup, login, logout, email confirmation,
  forgot-password, and reset-password flows with accessible pending/error states.
- Added server-side `token_hash` verification with fixed internal destinations
  for signup confirmation and password recovery.
- Added a server-side PKCE authorization-code fallback for signup links sent by
  Supabase's default confirmation template, avoiding a false verification error
  after Supabase has already confirmed the address.
- Added a server-rendered dashboard that independently verifies the user with
  `getUser()`, displays the authenticated email, and contains no fabricated
  financial data or unfinished feature controls.
- Added `.env.example`, Supabase URL/template configuration, and a complete
  manual authentication checklist to `README.md`.
- Added automated authentication validation and proxy-matcher tests.

Verification completed:
- `npm run typecheck`
- `npm run lint`
- `npm test` (4 tests passed)
- `npm run build` (production build passed)
- Production-server route smoke checks (public auth pages loaded, signed-out
  dashboard redirected to `/login`, and an invalid confirmation link redirected
  to the safe auth error page).
- `npm audit --omit=dev --audit-level=high` (no production vulnerabilities).

Remaining external configuration:
- Set the Supabase Site URL and exact allowed `/auth/confirm` redirect for each
  environment.
- Apply the documented signup-confirmation and password-recovery email templates.
- Confirm the hosted project password policy and configure production SMTP
  before deployment.

Manual tests still required with the target Supabase project:
- Signup with both immediate-session and confirmation-required configurations.
- Email delivery, valid/expired confirmation links, login, session refresh, and
  logout.
- Forgot-password non-enumerating behavior, recovery link handling, password
  update, old-password rejection, and new-password login.
- Direct unauthenticated dashboard access and authenticated email display in a
  real browser.

### Milestone 2 — Database and access policies
- Profiles, accounts, categories, transactions, splits, transfers.
- SQL constraints, grants, RLS, indexes.
- Safe per-user category/account initialization.
- Ownership/isolation tests.

Done when:
- Two test users are isolated at database level.
- Cross-user foreign references are rejected.
- Atomic transaction writes are available.

### Milestone 3 — Manual tracking
- Account/category management.
- Expense and income CRUD.
- Search/filter/pagination.
- Transfers and balances.

Done when:
- Users can maintain real financial records.
- Totals remain correct after edits/deletions.
- Transfers do not inflate spending.

### Milestone 4 — Dashboard and reports
- Daily/weekly/monthly/custom totals.
- Category chart and trends.
- Previous-period comparison.
- Merchant and account analysis.

Done when:
- Report values reconcile with underlying transactions.
- Date filters respect user preferences.

### Milestone 5 — Budgets
- Overall/category monthly budgets.
- Used/remaining indicators and in-app alerts.

Done when:
- Usage matches category allocations without double-counting.

### Milestone 6 — AI receipt scanning
- Private uploads.
- Background jobs.
- Structured extraction.
- Review/correction.
- Category splitting and duplicate protection.
- Per-user quotas.

Done when:
- Receipt upload becomes one reviewed, correctly totaled transaction.
- Failed/retried processing cannot duplicate financial records.

### Milestone 7 — PWA and data controls
- Installable experience.
- Offline state and optional local drafts.
- CSV/data export.
- Account deletion.
- Mobile/accessibility improvements.

### Milestone 8 — Production deployment
- Production configuration and email delivery.
- Monitoring, backups, usage limits.
- Security and end-to-end checks.
- Deploy to Vercel.
- Verify deployed authentication, uploads, jobs, and reports.

## 18. Out of scope initially

- Live bank, Easypaisa, or JazzCash connections
- SMS/inbox scraping
- FBR invoicing or POS features
- Shared household accounts
- Native Android/iOS apps
- Multi-currency conversion
- Investment tracking
- Loan amortization
- Automatic unreviewed AI posting
- Training custom AI models
- Voice entry and conversational finance assistant
- Full offline synchronization
- Recurring transaction generation and push notifications

These can be evaluated after the core product is reliable.

## 19. Agent instructions for starting work

First:
1. Read this plan.
2. Inspect the existing repository.
3. Summarize what already exists.
4. Identify missing configuration without exposing its values.
5. Implement Milestone 1 only.
6. Run appropriate checks.
7. Update milestone status and report remaining manual setup.

Do not attempt the entire application in one uncontrolled pass.
Do not redesign unrelated working code.
Carry this plan forward as the reference for later milestones.
