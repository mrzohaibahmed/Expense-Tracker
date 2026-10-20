"use client";

import { useActionState, useState } from "react";
import { saveCategoryAction } from "@/app/finance-actions";
import { initialFinanceState } from "@/lib/finance/validation";
import type { Tables } from "@/lib/supabase/database.types";
import { SubmitButton } from "./submit-button";

const field = "mt-1 block w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

export function CategoryForm({ category, categories }: { category?: Tables<"categories">; categories: Tables<"categories">[] }) {
  const [state, action] = useActionState(saveCategoryAction, initialFinanceState);
  const [kind, setKind] = useState(category?.kind || "expense");
  const parents = categories.filter((item) => !item.archived_at && item.kind === kind && item.id !== category?.id);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    {category && <input type="hidden" name="id" value={category.id} />}
    <label className="text-sm font-medium">Category name<input className={field} name="name" maxLength={100} required defaultValue={category?.name} placeholder="e.g. Groceries" /></label>
    <label className="text-sm font-medium">Kind<select className={field} name="kind" value={kind} onChange={(event) => setKind(event.target.value as "expense" | "income")}><option value="expense">Expense</option><option value="income">Income</option></select></label>
    <label className="text-sm font-medium sm:col-span-2">Parent category (optional)<select className={field} name="parent_id" defaultValue={category?.parent_id || ""} key={kind}><option value="">None — top level</option>{parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}</select></label>
    {state.status === "error" && <p role="alert" className="sm:col-span-2 text-sm text-rose-700">{state.message}</p>}
    <div className="sm:col-span-2"><SubmitButton>{category ? "Save category" : "Add category"}</SubmitButton></div>
  </form>;
}
