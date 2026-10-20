"use client";

import { useActionState, useState } from "react";
import { saveTransactionAction } from "@/app/finance-actions";
import { amountInputValue, parseAmount, formatMinor } from "@/lib/finance/money";
import { initialFinanceState } from "@/lib/finance/validation";
import type { Tables } from "@/lib/supabase/database.types";
import { SubmitButton } from "./submit-button";

const field = "mt-1 block w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

type Split = { key: string; category_id: string; amount: string };

export function TransactionForm({ accounts, categories, today, idempotencyKey, transaction, existingSplits = [] }: {
  accounts: Tables<"accounts">[];
  categories: Tables<"categories">[];
  today: string;
  idempotencyKey: string;
  transaction?: Tables<"transactions">;
  existingSplits?: Tables<"transaction_splits">[];
}) {
  const [state, action] = useActionState(saveTransactionAction, initialFinanceState);
  const [kind, setKind] = useState<"expense" | "income">(
    transaction?.type === "income" ? "income" : "expense",
  );
  const [amount, setAmount] = useState(transaction ? amountInputValue(transaction.amount_minor) : "");
  const [splits, setSplits] = useState<Split[]>(existingSplits.length
    ? existingSplits.map((split) => ({ key: split.id, category_id: split.category_id, amount: amountInputValue(split.amount_minor) }))
    : [{ key: "first", category_id: "", amount: "" }]);
  const options = categories.filter((category) => !category.archived_at && category.kind === kind);
  let allocation = "Enter an amount and category allocations.";
  try {
    const total = amount ? parseAmount(amount) : 0;
    const splitTotal = splits.reduce((sum, split) => sum + (split.amount ? parseAmount(split.amount) : 0), 0);
    allocation = total ? `${formatMinor(splitTotal)} allocated of ${formatMinor(total)}` : allocation;
  } catch { allocation = "Check the amount format."; }
  function updateSplit(key: string, change: Partial<Split>) { setSplits((current) => current.map((split) => split.key === key ? { ...split, ...change } : split)); }

  return <form action={action} className="space-y-5">
    {transaction && <input type="hidden" name="id" value={transaction.id} />}
    {!transaction && <input type="hidden" name="idempotency_key" value={idempotencyKey} />}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Type<select className={field} name="type" value={kind} onChange={(event) => { setKind(event.target.value as "expense" | "income"); setSplits([{ key: crypto.randomUUID(), category_id: "", amount: "" }]); }}><option value="expense">Expense</option><option value="income">Income</option></select></label>
      <label className="text-sm font-medium">Amount (PKR)<input className={field} name="amount" inputMode="decimal" autoComplete="off" required value={amount} onChange={(event) => { const next = event.target.value; setAmount(next); if (splits.length === 1) setSplits((current) => [{ ...current[0], amount: next }]); }} placeholder="0.00" /></label>
      <label className="text-sm font-medium">Account<select className={field} name="account_id" required defaultValue={transaction?.account_id || ""}><option value="">Choose account</option>{accounts.filter((account) => !account.archived_at).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="text-sm font-medium">Date<input className={field} type="date" name="occurred_on" required defaultValue={transaction?.occurred_on || today} /></label>
      <label className="text-sm font-medium">Merchant or source (optional)<input className={field} name="merchant" maxLength={200} defaultValue={transaction?.merchant || ""} placeholder="e.g. Local shop" /></label>
      <label className="text-sm font-medium">Notes (optional)<input className={field} name="notes" maxLength={2000} defaultValue={transaction?.notes || ""} /></label>
    </div>
    <fieldset className="rounded-2xl border border-stone-200 p-4 sm:p-5"><legend className="px-2 text-sm font-semibold">Category allocations</legend>
      <p className="mb-4 text-sm text-stone-600">Use one category or split this record across several. The amounts must add up exactly.</p>
      <div className="space-y-3">{splits.map((split, index) => <div key={split.key} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <label className="text-sm font-medium">Category {index + 1}<select className={field} name="split_category_id" required value={split.category_id} onChange={(event) => updateSplit(split.key, { category_id: event.target.value })}><option value="">Choose category</option>{options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="text-sm font-medium">Amount (PKR)<input className={field} name="split_amount" inputMode="decimal" required value={split.amount} onChange={(event) => updateSplit(split.key, { amount: event.target.value })} placeholder="0.00" /></label>
        <button type="button" disabled={splits.length === 1} onClick={() => setSplits((current) => current.filter((item) => item.key !== split.key))} className="min-h-11 rounded-xl px-3 text-sm font-medium text-rose-700 disabled:opacity-30">Remove</button>
      </div>)}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => setSplits((current) => [...current, { key: crypto.randomUUID(), category_id: "", amount: "" }])} className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Add split</button><p className="text-sm tabular-nums text-stone-600" aria-live="polite">{allocation}</p></div>
    </fieldset>
    {state.status === "error" && <p role="alert" className="text-sm text-rose-700">{state.message}</p>}
    <SubmitButton>{transaction ? "Save changes" : `Add ${kind}`}</SubmitButton>
  </form>;
}
