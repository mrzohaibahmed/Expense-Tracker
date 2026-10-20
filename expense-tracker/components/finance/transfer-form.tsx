"use client";

import { useActionState } from "react";
import { createTransferAction } from "@/app/finance-actions";
import { initialFinanceState } from "@/lib/finance/validation";
import type { Tables } from "@/lib/supabase/database.types";
import { SubmitButton } from "./submit-button";

const field = "mt-1 block w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

export function TransferForm({ accounts, today, idempotencyKey }: { accounts: Tables<"accounts">[]; today: string; idempotencyKey: string }) {
  const [state, action] = useActionState(createTransferAction, initialFinanceState);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="idempotency_key" value={idempotencyKey} />
    <label className="text-sm font-medium">From account<select className={field} name="from_account_id" required defaultValue=""><option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
    <label className="text-sm font-medium">To account<select className={field} name="to_account_id" required defaultValue=""><option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
    <label className="text-sm font-medium">Amount (PKR)<input className={field} name="amount" inputMode="decimal" required placeholder="0.00" /></label>
    <label className="text-sm font-medium">Date<input className={field} type="date" name="occurred_on" required defaultValue={today} /></label>
    <label className="text-sm font-medium sm:col-span-2">Notes (optional)<input className={field} name="notes" maxLength={2000} /></label>
    {state.status === "error" && <p role="alert" className="sm:col-span-2 text-sm text-rose-700">{state.message}</p>}
    <div className="sm:col-span-2"><SubmitButton>Create transfer</SubmitButton></div>
  </form>;
}
