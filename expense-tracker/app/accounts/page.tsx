import { archiveAccountAction } from "@/app/finance-actions";
import { connection } from "next/server";
import { AccountForm } from "@/components/finance/account-form";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { EmptyState, FinanceShell, PageError } from "@/components/finance/shell";
import { formatMinor } from "@/lib/finance/money";
import { requireFinancialUser, todayInTimezone } from "@/lib/finance/server";

export const instant = false;

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const { supabase, user } = await requireFinancialUser();
  const [accountsResult, profileResult] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
  ]);
  const timezone = profileResult.data?.timezone || "Asia/Karachi";
  const balancesResult = accountsResult.error ? null : await supabase.rpc("get_account_balances", { p_as_of: todayInTimezone(timezone) });
  const balanceMap = new Map(balancesResult?.data?.map((row) => [row.account_id, row.balance_minor]) || []);
  const accounts = accountsResult.data || [];
  const active = accounts.filter((account) => !account.archived_at);
  const archived = accounts.filter((account) => account.archived_at);
  const params = await searchParams;
  return <FinanceShell email={user.email} title="Accounts" description="Keep your cash, bank, and wallet balances in one place.">
    {params.error && <div className="mb-5"><PageError message="This account could not be archived. Please try again." /></div>}
    {(accountsResult.error || balancesResult?.error) && <div className="mb-5"><PageError message="Financial tables or balance calculations are unavailable. Apply the documented development migrations, then reload." /></div>}
    <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Add an account</h2><div className="mt-5"><AccountForm /></div></section>
    <section className="mt-8"><h2 className="mb-4 text-lg font-semibold">Active accounts</h2>
      {active.length === 0 ? <EmptyState title="No accounts yet" description="Add your first account to start recording expenses and income." /> :
      <div className="grid gap-4 md:grid-cols-2">{active.map((account) => <article key={account.id} className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{account.name}</h3><p className="mt-1 text-xs capitalize text-stone-500">{account.type.replaceAll("_", " ")} · PKR</p></div><strong className="text-right text-lg tabular-nums">{formatMinor(balanceMap.get(account.id) || "0")}</strong></div>
        <details className="mt-5 border-t border-stone-100 pt-3"><summary className="cursor-pointer text-sm font-medium text-emerald-800">Edit account</summary><div className="mt-4"><AccountForm account={account} /></div></details>
        <form action={archiveAccountAction} className="mt-2"><input type="hidden" name="id" value={account.id} /><ConfirmSubmit question={`Archive ${account.name}? Its history and balance will remain available.`}>Archive account</ConfirmSubmit></form>
      </article>)}</div>}
    </section>
    {archived.length > 0 && <section className="mt-8"><h2 className="mb-4 text-lg font-semibold">Archived accounts</h2><div className="grid gap-3 md:grid-cols-2">{archived.map((account) => <div key={account.id} className="rounded-xl border border-stone-200 bg-white p-4"><span className="font-medium">{account.name}</span><span className="float-right tabular-nums text-stone-600">{formatMinor(balanceMap.get(account.id) || "0")}</span></div>)}</div></section>}
  </FinanceShell>;
}
