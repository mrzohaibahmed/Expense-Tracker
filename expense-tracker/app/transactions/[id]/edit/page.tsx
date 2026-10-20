import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FinanceShell, PageError } from "@/components/finance/shell";
import { TransactionForm } from "@/components/finance/transaction-form";
import { requireFinancialUser, todayInTimezone } from "@/lib/finance/server";

export const instant = false;

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const { supabase, user } = await requireFinancialUser();
  const [transaction, splits, accounts, categories, profile] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", id).eq("user_id", user.id).eq("source", "manual").maybeSingle(),
    supabase.from("transaction_splits").select("*").eq("transaction_id", id).eq("user_id", user.id),
    supabase.from("accounts").select("*").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
  ]);
  if (!transaction.data && !transaction.error) notFound();
  return <FinanceShell email={user.email} title="Edit transaction" description="Changes to the total and category allocations are saved together." actions={<Link href="/transactions" className="text-sm font-medium text-emerald-800">Back to history</Link>}>
    {(transaction.error || splits.error || accounts.error || categories.error || !transaction.data) ? <PageError message="This transaction is unavailable." /> :
      <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7"><TransactionForm transaction={transaction.data} existingSplits={splits.data || []} accounts={accounts.data || []} categories={categories.data || []} today={todayInTimezone(profile.data?.timezone || "Asia/Karachi")} idempotencyKey="" /></div>}
  </FinanceShell>;
}
