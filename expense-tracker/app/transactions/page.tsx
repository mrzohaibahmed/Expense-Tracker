import Link from "next/link";
import { deleteTransactionAction } from "@/app/finance-actions";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { EmptyState, FinanceShell, PageError } from "@/components/finance/shell";
import { formatMinor } from "@/lib/finance/money";
import { requireFinancialUser } from "@/lib/finance/server";
import type { Tables } from "@/lib/supabase/database.types";

export const instant = false;

const PAGE_SIZE = 20;
const field = "min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm";

type Filters = { q?: string; type?: string; account?: string; category?: string; from?: string; to?: string; sort?: string; page?: string; error?: string };

function pageLink(filters: Filters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && key !== "page" && key !== "error") params.set(key, value);
  params.set("page", String(page));
  return `/transactions?${params}`;
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const { supabase, user } = await requireFinancialUser();
  const [accountsResult, categoriesResult] = await Promise.all([
    supabase.from("accounts").select("id,name").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("id,name,kind").eq("user_id", user.id).order("name"),
  ]);
  const accounts = accountsResult.data || [];
  const categories = categoriesResult.data || [];
  const page = Math.max(1, Math.min(100000, Number.parseInt(filters.page || "1", 10) || 1));
  const categoryFilter = categories.some((item) => item.id === filters.category) ? filters.category : undefined;
  const selection = categoryFilter ? "*,transaction_splits!inner(category_id)" : "*";
  let query = supabase.from("transactions").select(selection, { count: "exact" }).eq("user_id", user.id);
  if (filters.type === "expense" || filters.type === "income") query = query.eq("type", filters.type);
  if (filters.account && accounts.some((account) => account.id === filters.account)) query = query.eq("account_id", filters.account);
  if (categoryFilter) query = query.eq("transaction_splits.category_id", categoryFilter);
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) query = query.gte("occurred_on", filters.from);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) query = query.lte("occurred_on", filters.to);
  const search = (filters.q || "").replace(/[^\p{L}\p{N} ]/gu, "").trim().slice(0, 80);
  if (search) query = query.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`);
  const sort = filters.sort || "newest";
  if (sort === "oldest") query = query.order("occurred_on", { ascending: true }).order("id", { ascending: true });
  else if (sort === "amount_high") query = query.order("amount_minor", { ascending: false }).order("id", { ascending: false });
  else if (sort === "amount_low") query = query.order("amount_minor", { ascending: true }).order("id", { ascending: false });
  else query = query.order("occurred_on", { ascending: false }).order("id", { ascending: false });
  const result = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (result.data || []) as unknown as Tables<"transactions">[];
  const ids = rows.map((row) => row.id);
  const splitResult = ids.length ? await supabase.from("transaction_splits").select("transaction_id,category_id,amount_minor").eq("user_id", user.id).in("transaction_id", ids) : null;
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const splitMap = new Map<string, string[]>();
  for (const split of splitResult?.data || []) splitMap.set(split.transaction_id, [...(splitMap.get(split.transaction_id) || []), `${categoryNames.get(split.category_id) || "Archived category"} ${formatMinor(split.amount_minor)}`]);
  const total = result.count || 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <FinanceShell email={user.email} title="Transactions" description="Search and maintain your posted expenses and income." actions={<Link href="/transactions/new" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">Add transaction</Link>}>
    {filters.error && <div className="mb-5"><PageError message="That transaction could not be deleted. Please try again." /></div>}
    {(result.error || accountsResult.error || categoriesResult.error || splitResult?.error) && <div className="mb-5"><PageError message="Transaction history is unavailable. Apply the documented development migrations, then reload." /></div>}
    <form method="get" className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-4">
      <label className="text-xs font-medium text-stone-600">Search merchant or notes<input className={`${field} mt-1`} name="q" defaultValue={filters.q || ""} maxLength={80} placeholder="Search" /></label>
      <label className="text-xs font-medium text-stone-600">Type<select className={`${field} mt-1`} name="type" defaultValue={filters.type || ""}><option value="">All types</option><option value="expense">Expense</option><option value="income">Income</option></select></label>
      <label className="text-xs font-medium text-stone-600">Account<select className={`${field} mt-1`} name="account" defaultValue={filters.account || ""}><option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="text-xs font-medium text-stone-600">Category<select className={`${field} mt-1`} name="category" defaultValue={filters.category || ""}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.kind}</option>)}</select></label>
      <label className="text-xs font-medium text-stone-600">From<input className={`${field} mt-1`} type="date" name="from" defaultValue={filters.from || ""} /></label>
      <label className="text-xs font-medium text-stone-600">To<input className={`${field} mt-1`} type="date" name="to" defaultValue={filters.to || ""} /></label>
      <label className="text-xs font-medium text-stone-600">Sort<select className={`${field} mt-1`} name="sort" defaultValue={sort}><option value="newest">Newest date</option><option value="oldest">Oldest date</option><option value="amount_high">Highest amount</option><option value="amount_low">Lowest amount</option></select></label>
      <button className="min-h-11 self-end rounded-xl border border-emerald-700 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Apply filters</button>
    </form>
    <p className="my-4 text-sm text-stone-600">{total} {total === 1 ? "transaction" : "transactions"}</p>
    {rows.length === 0 ? <EmptyState title="No matching transactions" description="Add your first record or change the filters." action={<Link href="/transactions/new" className="font-semibold text-emerald-800">Add transaction</Link>} /> :
      <div className="space-y-3">{rows.map((row) => <article key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-stone-500">{row.occurred_on} · {row.type}</p><h2 className="mt-1 font-semibold">{row.merchant || (row.type === "income" ? "Income" : "Expense")}</h2><p className="mt-1 text-sm text-stone-600">{accountNames.get(row.account_id) || "Archived account"}</p></div><strong className={`text-lg tabular-nums ${row.type === "expense" ? "text-stone-900" : "text-emerald-800"}`}>{row.type === "expense" ? "−" : "+"}{formatMinor(row.amount_minor)}</strong></div>
        <p className="mt-3 text-xs leading-5 text-stone-600">{(splitMap.get(row.id) || []).join(" · ")}</p>{row.notes && <p className="mt-2 text-sm text-stone-600">{row.notes}</p>}
        <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-3">{row.source === "manual" && <><Link href={`/transactions/${row.id}/edit`} className="rounded-lg px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">Edit</Link><form action={deleteTransactionAction}><input type="hidden" name="id" value={row.id} /><ConfirmSubmit question="Delete this transaction and its category allocations? This cannot be undone.">Delete</ConfirmSubmit></form></>}</div>
      </article>)}</div>}
    <nav aria-label="Transaction pages" className="mt-6 flex items-center justify-between gap-3"><span className="text-sm text-stone-600">Page {page} of {pageCount}</span><div className="flex gap-2">{page > 1 && <Link className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm" href={pageLink(filters, page - 1)}>Previous</Link>}{page < pageCount && <Link className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm" href={pageLink(filters, page + 1)}>Next</Link>}</div></nav>
  </FinanceShell>;
}
