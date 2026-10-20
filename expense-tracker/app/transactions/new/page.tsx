import { randomUUID } from "node:crypto";
import Link from "next/link";
import { connection } from "next/server";
import { TransactionForm } from "@/components/finance/transaction-form";
import { FinanceShell, PageError } from "@/components/finance/shell";
import { requireFinancialUser, todayInTimezone } from "@/lib/finance/server";

export const instant = false;

export default async function NewTransactionPage() {
  await connection();
  const { supabase, user } = await requireFinancialUser();
  const [accounts, categories, profile] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).is("archived_at", null).order("name"),
    supabase.from("categories").select("*").eq("user_id", user.id).is("archived_at", null).order("name"),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
  ]);
  return <FinanceShell email={user.email} title="New transaction" description="Record an expense or income in PKR." actions={<Link href="/transactions" className="text-sm font-medium text-emerald-800">Back to history</Link>}>
    {(accounts.error || categories.error) ? <PageError message="Financial records are unavailable. Apply the documented development migrations, then reload." /> :
      !accounts.data?.length || !categories.data?.length ? <PageError message="Add an active account and category before recording a transaction." /> :
      <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7"><TransactionForm accounts={accounts.data} categories={categories.data} today={todayInTimezone(profile.data?.timezone || "Asia/Karachi")} idempotencyKey={randomUUID()} /></div>}
  </FinanceShell>;
}
