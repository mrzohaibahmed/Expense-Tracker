import Link from "next/link";
import { connection } from "next/server";
import { FinanceShell, PageError, EmptyState } from "@/components/finance/shell";
import { CategoryBreakdown, SpendingTrend } from "@/components/reports/sections";
import { formatMinor } from "@/lib/finance/money";
import { requireFinancialUser, todayInTimezone } from "@/lib/finance/server";
import { parseReport, type Report } from "@/lib/reports/data";
import { comparisonText, makeReportRange, type PeriodKind, type ReportRange } from "@/lib/reports/dates";

export const instant = false;

type Filters = { period?: string; date?: string; from?: string; to?: string; account?: string; category?: string };
const field = "mt-1 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await connection();
  const filters = await searchParams;
  const { supabase, user } = await requireFinancialUser();
  const [profileResult, accountsResult, categoriesResult] = await Promise.all([
    supabase.from("profiles").select("timezone,week_starts_on").eq("id", user.id).maybeSingle(),
    supabase.from("accounts").select("id,name,archived_at").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("id,name,kind,parent_id,archived_at").eq("user_id", user.id).order("name"),
  ]);
  const accounts = accountsResult.data || [];
  const categories = categoriesResult.data || [];
  const today = todayInTimezone(profileResult.data?.timezone || "Asia/Karachi");
  const period: PeriodKind = filters.period === "day" || filters.period === "week" || filters.period === "custom" ? filters.period : "month";
  let range: ReportRange | null = null;
  let inputError: string | null = null;
  try { range = makeReportRange(period, today, profileResult.data?.week_starts_on ?? 1, filters.date, filters.from, filters.to); }
  catch (error) { inputError = error instanceof Error ? error.message : "Choose a valid report period."; }
  const accountId = filters.account && accounts.some((item) => item.id === filters.account) ? filters.account : undefined;
  const categoryId = filters.category && categories.some((item) => item.id === filters.category) ? filters.category : undefined;
  if (filters.account && !accountId || filters.category && !categoryId) inputError = "One of the selected filters is unavailable.";

  let report: Report | null = null;
  let reportError = false;
  if (range && !inputError && !profileResult.error && !accountsResult.error && !categoriesResult.error) {
    const result = await supabase.rpc("get_financial_report", {
      p_start: range.start, p_end: range.end,
      p_previous_start: range.previousStart, p_previous_end: range.previousEnd,
      p_account_id: accountId, p_category_id: categoryId,
    });
    if (result.error || !result.data) reportError = true;
    else {
      try { report = parseReport(result.data); }
      catch { reportError = true; }
    }
  }
  const names = new Map(categories.map((item) => [item.id, item.name]));
  const accountNames = new Map(accounts.map((item) => [item.id, item.name]));
  const dateValue = filters.date || today;

  return <FinanceShell email={user.email} title="Reports" description={`Income and spending by purchase date in ${profileResult.data?.timezone || "Asia/Karachi"}. Weeks start ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][profileResult.data?.week_starts_on ?? 1]}.`}>
    <form method="get" className="grid gap-3 rounded-3xl border border-stone-200 bg-white p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
      <label className="text-sm font-medium">Period<select className={field} name="period" defaultValue={period}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="custom">Custom dates</option></select></label>
      <label className="text-sm font-medium">Date within period<input className={field} type="date" name="date" max={today} defaultValue={dateValue} /></label>
      <label className="text-sm font-medium">From (custom)<input className={field} type="date" name="from" defaultValue={filters.from || today} /></label>
      <label className="text-sm font-medium">To (custom)<input className={field} type="date" name="to" defaultValue={filters.to || today} /></label>
      <label className="text-sm font-medium">Account<select className={field} name="account" defaultValue={accountId || ""}><option value="">All accounts</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.archived_at ? " (archived)" : ""}</option>)}</select></label>
      <label className="text-sm font-medium">Category<select className={field} name="category" defaultValue={categoryId || ""}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.kind}{item.archived_at ? " (archived)" : ""}</option>)}</select></label>
      <button className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 sm:col-span-2 lg:col-span-3">Show report</button>
    </form>
    <p className="mt-2 text-xs text-stone-500">Custom ranges can cover up to 366 days. Choosing a parent category includes its descendants.</p>
    {(inputError || profileResult.error || accountsResult.error || categoriesResult.error || reportError) && <div className="mt-6"><PageError message={inputError || "The report is unavailable. Check the development migration and try again."} /></div>}
    {report && range && <>
      <section className="mt-7 rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{range.label}: {range.start} to {range.end}</h2>
        {range.partial && <p className="mt-1 text-sm font-medium text-amber-800">Partial period through today; future dates are excluded.</p>}
        <p className="mt-1 text-sm text-stone-600">{report.transaction_count} {report.transaction_count === 1 ? "transaction" : "transactions"} · Transfers and opening balances excluded.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-stone-50 p-4"><p className="text-sm text-stone-600">Income</p><strong className="mt-1 block text-xl tabular-nums text-emerald-800">{formatMinor(report.income_minor)}</strong></div>
          <div className="rounded-2xl bg-stone-50 p-4"><p className="text-sm text-stone-600">Expenses</p><strong className="mt-1 block text-xl tabular-nums">{formatMinor(report.expense_minor)}</strong></div>
          <div className="rounded-2xl bg-stone-50 p-4"><p className="text-sm text-stone-600">Net cash flow</p><strong className="mt-1 block text-xl tabular-nums">{formatMinor(report.net_minor)}</strong></div>
        </div>
        <div className="mt-5 border-t border-stone-100 pt-4"><h3 className="font-semibold">Previous period comparison</h3><p className="mt-1 text-sm text-stone-600">{range.comparisonLabel}</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p>Expenses: {formatMinor(report.previous.expense_minor)}. {comparisonText(report.expense_minor, report.previous.expense_minor)}</p><p>Income: {formatMinor(report.previous.income_minor)}. {comparisonText(report.income_minor, report.previous.income_minor)}</p></div></div>
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-2"><SpendingTrend report={report} /><CategoryBreakdown report={report} names={names} /></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Top merchants</h2>{!report.merchants.length ? <div className="mt-4"><EmptyState title="No merchants yet" description="Merchants on expenses will appear here." /></div> : <ol className="mt-3 divide-y divide-stone-100">{report.merchants.map((item) => <li key={item.merchant} className="flex justify-between gap-3 py-3 text-sm"><span>{item.merchant} <span className="text-stone-500">({item.transaction_count})</span></span><strong className="tabular-nums">{formatMinor(item.expense_minor)}</strong></li>)}</ol>}</section>
        <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Largest expenses</h2>{!report.largest.length ? <div className="mt-4"><EmptyState title="No expenses yet" description="Largest expenses in this period will appear here." /></div> : <ol className="mt-3 divide-y divide-stone-100">{report.largest.map((item) => <li key={item.transaction_id} className="flex justify-between gap-3 py-3 text-sm"><span>{item.merchant || "Expense"}<span className="block text-xs text-stone-500">{item.date} · {accountNames.get(item.account_id) || "Archived account"}</span></span><strong className="tabular-nums">{formatMinor(item.expense_minor)}</strong></li>)}</ol>}</section>
      </div>
      <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">By account</h2>{!report.accounts.length ? <p className="mt-3 text-sm text-stone-600">No account activity in this period.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-sm"><thead><tr className="border-b border-stone-200 text-stone-600"><th className="py-2 font-medium">Account</th><th className="py-2 text-right font-medium">Income</th><th className="py-2 text-right font-medium">Expenses</th></tr></thead><tbody>{report.accounts.map((item) => <tr key={item.account_id} className="border-b border-stone-100"><th className="py-3 font-medium">{item.name}{item.archived && <span className="ml-1 text-xs text-stone-500">(archived)</span>}</th><td className="py-3 text-right tabular-nums">{formatMinor(item.income_minor)}</td><td className="py-3 text-right tabular-nums">{formatMinor(item.expense_minor)}</td></tr>)}</tbody></table></div>}</section>
      <p className="mt-6 text-sm text-stone-600">Need the source records? <Link href="/transactions" className="font-medium text-emerald-800 underline underline-offset-4">Open transaction history</Link>.</p>
    </>}
  </FinanceShell>;
}
