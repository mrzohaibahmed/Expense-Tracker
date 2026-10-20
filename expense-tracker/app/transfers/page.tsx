import { randomUUID } from "node:crypto";
import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, FinanceShell, PageError } from "@/components/finance/shell";
import { TransferForm } from "@/components/finance/transfer-form";
import { formatMinor } from "@/lib/finance/money";
import { requireFinancialUser, todayInTimezone } from "@/lib/finance/server";

export const instant = false;

export default async function TransfersPage() {
  await connection();
  const { supabase, user } = await requireFinancialUser();
  const [accountsResult, profileResult, transfersResult] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).order("name"),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
    supabase.from("transfers").select("*").eq("user_id", user.id).order("occurred_on", { ascending: false }).order("id", { ascending: false }).limit(50),
  ]);
  const accounts = accountsResult.data || [];
  const active = accounts.filter((account) => !account.archived_at);
  const names = new Map(accounts.map((account) => [account.id, account.name]));
  return <FinanceShell email={user.email} title="Transfers" description="Move money between your accounts without counting it as income or spending." actions={<Link href="/accounts" className="text-sm font-medium text-emerald-800">Manage accounts</Link>}>
    {(accountsResult.error || transfersResult.error) && <div className="mb-5"><PageError message="Transfers are unavailable. Apply the documented development migration, then reload." /></div>}
    <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-semibold">New transfer</h2><div className="mt-5">{active.length < 2 ? <PageError message="Add at least two active accounts before making a transfer." /> : <TransferForm accounts={active} today={todayInTimezone(profileResult.data?.timezone || "Asia/Karachi")} idempotencyKey={randomUUID()} />}</div></section>
    <section className="mt-8"><h2 className="mb-4 text-lg font-semibold">Recent transfers</h2>{!transfersResult.data?.length ? <EmptyState title="No transfers yet" description="Transfers you create will appear here." /> : <div className="space-y-3">{transfersResult.data.map((transfer) => <article key={transfer.id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-stone-500">{transfer.occurred_on}</p><h3 className="mt-1 font-semibold">{names.get(transfer.from_account_id) || "Archived account"} → {names.get(transfer.to_account_id) || "Archived account"}</h3></div><strong className="tabular-nums">{formatMinor(transfer.amount_minor)}</strong></div>{transfer.notes && <p className="mt-2 text-sm text-stone-600">{transfer.notes}</p>}</article>)}</div>}</section>
  </FinanceShell>;
}
