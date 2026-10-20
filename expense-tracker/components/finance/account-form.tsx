"use client";

import { useActionState } from "react";
import { saveAccountAction } from "@/app/finance-actions";
import { amountInputValue } from "@/lib/finance/money";
import { initialFinanceState } from "@/lib/finance/validation";
import type { Tables } from "@/lib/supabase/database.types";
import { SubmitButton } from "./submit-button";

const field = "mt-1 block w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

export function AccountForm({ account }: { account?: Tables<"accounts"> }) {
  const [state, action] = useActionState(saveAccountAction, initialFinanceState);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    {account && <input type="hidden" name="id" value={account.id} />}
    <label className="text-sm font-medium">Account name<input className={field} name="name" maxLength={100} required defaultValue={account?.name} placeholder="e.g. Checking" /></label>
    <label className="text-sm font-medium">Type<select className={field} name="type" defaultValue={account?.type || "bank"}><option value="cash">Cash</option><option value="bank">Bank</option><option value="mobile_wallet">Mobile wallet</option><option value="other">Other</option></select></label>
    <label className="text-sm font-medium">Opening balance (PKR)<input className={field} name="opening_balance" inputMode="decimal" defaultValue={account ? amountInputValue(account.opening_balance_minor) : "0.00"} aria-describedby="opening-help" /></label>
    <div className="flex items-end"><p id="opening-help" className="text-xs leading-5 text-stone-500">A starting balance is not counted as income. Use a negative amount for an overdraft.</p></div>
    {state.status === "error" && <p role="alert" className="sm:col-span-2 text-sm text-rose-700">{state.message}</p>}
    <div className="sm:col-span-2"><SubmitButton>{account ? "Save account" : "Add account"}</SubmitButton></div>
  </form>;
}
