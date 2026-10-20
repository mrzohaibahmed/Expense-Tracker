import { CategorySpendingChart, SpendingTrendChart } from "./charts";
import { formatMinor } from "@/lib/finance/money";
import type { Report } from "@/lib/reports/data";
import { EmptyState } from "@/components/finance/shell";

export function CategoryBreakdown({ report, names }: { report: Report; names: Map<string, string> }) {
  const categories = report.categories.map((item) => ({
    ...item,
    label: item.parent_id ? `${names.get(item.parent_id) || "Archived parent"} › ${item.name}` : item.name,
  }));
  return <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
    <h2 className="text-lg font-semibold">Category spending</h2>
    <p className="mt-1 text-sm text-stone-600">Direct allocations to each category. Parent and child rows are never added twice.</p>
    {!categories.length ? <div className="mt-5"><EmptyState title="No category spending" description="Expenses in this period will appear here." /></div> : <>
      <CategorySpendingChart points={categories} />
      <ul className="mt-4 divide-y divide-stone-100" aria-label="Exact category spending amounts">
        {categories.map((item) => <li key={item.category_id} className="flex items-start justify-between gap-3 py-2 text-sm"><span>{item.label}{item.archived && <span className="ml-1 text-xs text-stone-500">(archived)</span>}</span><strong className="tabular-nums">{formatMinor(item.expense_minor)}</strong></li>)}
      </ul>
    </>}
  </section>;
}

export function SpendingTrend({ report }: { report: Report }) {
  const days = report.trend.filter((item) => BigInt(item.expense_minor) !== 0n);
  return <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
    <h2 className="text-lg font-semibold">Spending trend</h2>
    <p className="mt-1 text-sm text-stone-600">By purchase date, using your selected period.</p>
    {!days.length ? <div className="mt-5"><EmptyState title="No spending trend yet" description="Recorded expenses will appear on their purchase dates." /></div> : <>
      <SpendingTrendChart points={report.trend} />
      <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-emerald-800">Exact daily amounts</summary><ul className="mt-2 max-h-48 divide-y divide-stone-100 overflow-y-auto" aria-label="Exact daily expenses">{report.trend.map((item) => <li key={item.date} className="flex justify-between gap-3 py-1"><span>{item.date}</span><span className="tabular-nums">{formatMinor(item.expense_minor)}</span></li>)}</ul></details>
    </>}
  </section>;
}
