import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, FinanceShell, PageError } from "@/components/finance/shell";
import { CategoryBreakdown, SpendingTrend } from "@/components/reports/sections";
import { formatMinor, sumMinor } from "@/lib/finance/money";
import { requireFinancialUser, todayInTimezone } from "@/lib/finance/server";
import { parseReport, type Report } from "@/lib/reports/data";
import { makeReportRange, type PeriodKind } from "@/lib/reports/dates";

export const instant = false;

const periods = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await connection();
  const { supabase, user } = await requireFinancialUser();
  const [profileResult, accountsResult, categoriesResult, recentResult] = await Promise.all([
    supabase.from("profiles").select("timezone,week_starts_on").eq("id", user.id).maybeSingle(),
    supabase.from("accounts").select("id,name,archived_at").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("id,name").eq("user_id", user.id),
    supabase.from("transactions").select("id,type,amount_minor,occurred_on,merchant,account_id").eq("user_id", user.id).order("occurred_on", { ascending: false }).order("id", { ascending: false }).limit(5),
  ]);
  const today = todayInTimezone(profileResult.data?.timezone || "Asia/Karachi");
  const weekStart = profileResult.data?.week_starts_on ?? 1;
  const requested = (await searchParams).period;
  const selected: PeriodKind = requested === "day" || requested === "week" ? requested : "month";
  const ranges = Object.fromEntries(periods.map(({ key }) => [key, makeReportRange(key, today, weekStart)])) as Record<"day" | "week" | "month", ReturnType<typeof makeReportRange>>;
  const [balancesResult, ...reportResults] = await Promise.all([
    supabase.rpc("get_account_balances", { p_as_of: today }),
    ...periods.map(({ key }) => supabase.rpc("get_financial_report", {
      p_start: ranges[key].start, p_end: ranges[key].end,
      p_previous_start: ranges[key].previousStart, p_previous_end: ranges[key].previousEnd,
    })),
  ]);
  const reports = {} as Record<"day" | "week" | "month", Report>;
  let reportError = reportResults.some((result) => result.error || !result.data);
  if (!reportError) {
    try { periods.forEach(({ key }, index) => { reports[key] = parseReport(reportResults[index].data!); }); }
    catch { reportError = true; }
  }
  const accounts = accountsResult.data || [];
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map((categoriesResult.data || []).map((category) => [category.id, category.name]));
  const totalBalance = sumMinor((balancesResult.data || []).map((row) => row.balance_minor));
  const recent = recentResult.data || [];
  const selectedReport = reportError ? null : reports[selected];

  return <FinanceShell email={user.email} title="Your finances" description={`Today is ${today} in ${profileResult.data?.timezone || "Asia/Karachi"}. Reports use purchase dates; future entries are excluded.`} actions={<Link href="/transactions/new" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">Add transaction</Link>}>
    {(profileResult.error || accountsResult.error || categoriesResult.error || recentResult.error || balancesResult.error || reportError) && <div className="mb-6"><PageError message="Some financial data is unavailable. Check the development migrations and reload this page." /></div>}
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <section className="rounded-3xl bg-emerald-900 p-6 text-white sm:p-8">
        <h2 className="text-sm font-medium text-emerald-100">Current total account balance</h2>
        <p className="mt-2 text-3xl font-semibold tabular-nums sm:text-4xl">{balancesResult.error ? "Unavailable" : formatMinor(totalBalance)}</p>
        <p className="mt-3 text-sm text-emerald-100">As of {today}. Includes opening balances and transfers; this is not period cash flow.</p>
        <Link href="/accounts" className="mt-5 inline-block text-sm font-semibold text-white underline underline-offset-4">View accounts</Link>
      </section>
      <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        <h2 className="text-sm font-medium text-stone-600">Selected period cash flow</h2>
        <p className="mt-1 text-xs text-stone-500">{ranges[selected].start} to {ranges[selected].end}</p>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{selectedReport ? formatMinor(selectedReport.net_minor) : "Unavailable"}</p>
        <p className="mt-3 text-sm text-stone-600">Income minus expenses during this period. Transfers and opening balances are excluded.</p>
      </section>
    </div>

    <div className="mt-7 grid gap-3 sm:grid-cols-3">{periods.map(({ key, label }) => <Link key={key} href={`/dashboard?period=${key}`} aria-current={selected === key ? "page" : undefined} className={`rounded-2xl border p-5 transition ${selected === key ? "border-emerald-700 bg-emerald-50" : "border-stone-200 bg-white hover:border-emerald-300"}`}>
      <span className="text-sm text-stone-600">{label} expenses</span><strong className="mt-2 block text-xl tabular-nums">{reportError ? "Unavailable" : formatMinor(reports[key].expense_minor)}</strong>
    </Link>)}</div>

    {selectedReport && <>
      <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Selected period totals">
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-600">Income</p><strong className="mt-2 block text-xl tabular-nums text-emerald-800">{formatMinor(selectedReport.income_minor)}</strong></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-600">Expenses</p><strong className="mt-2 block text-xl tabular-nums">{formatMinor(selectedReport.expense_minor)}</strong></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-600">Net cash flow</p><strong className="mt-2 block text-xl tabular-nums">{formatMinor(selectedReport.net_minor)}</strong></div>
      </section>
      <div className="mt-7 grid gap-5 lg:grid-cols-2"><SpendingTrend report={selectedReport} /><CategoryBreakdown report={selectedReport} names={categoryNames} /></div>
    </>}

    <section className="mt-8"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent transactions</h2><Link href="/transactions" className="text-sm font-medium text-emerald-800">View all</Link></div>
      {!recent.length ? <EmptyState title="No transactions yet" description="Expenses and income you record will appear here." action={<Link href="/transactions/new" className="font-semibold text-emerald-800">Add transaction</Link>} /> :
        <div className="grid gap-3 md:grid-cols-2">{recent.map((item) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4"><div><p className="font-medium">{item.merchant || (item.type === "expense" ? "Expense" : "Income")}</p><p className="mt-1 text-xs text-stone-500">{item.occurred_on} · {accountNames.get(item.account_id) || "Archived account"}</p>{item.occurred_on > today && <p className="mt-1 text-xs font-medium text-amber-800">Future-dated; excluded from today&apos;s totals</p>}</div><span className={`tabular-nums font-semibold ${item.type === "income" ? "text-emerald-800" : "text-stone-900"}`}>{item.type === "expense" ? "−" : "+"}{formatMinor(item.amount_minor)}</span></article>)}</div>}
    </section>
    <div className="mt-6"><Link href="/reports" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">Open detailed reports</Link></div>
  </FinanceShell>;
}
