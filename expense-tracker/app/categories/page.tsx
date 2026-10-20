import { archiveCategoryAction } from "@/app/finance-actions";
import { CategoryForm } from "@/components/finance/category-form";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { EmptyState, FinanceShell, PageError } from "@/components/finance/shell";
import { requireFinancialUser } from "@/lib/finance/server";

export const instant = false;

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, user } = await requireFinancialUser();
  const result = await supabase.from("categories").select("*").eq("user_id", user.id).order("kind").order("name");
  const categories = result.data || [];
  const active = categories.filter((category) => !category.archived_at);
  const archived = categories.filter((category) => category.archived_at);
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const params = await searchParams;
  return <FinanceShell email={user.email} title="Categories" description="Organize expenses and income. Archived categories stay attached to historical records.">
    {params.error && <div className="mb-5"><PageError message="This category could not be archived. Please try again." /></div>}
    {result.error && <div className="mb-5"><PageError message="Categories are unavailable. Apply the documented development migration, then reload." /></div>}
    <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Add a category</h2><div className="mt-5"><CategoryForm categories={categories} /></div></section>
    {(["expense", "income"] as const).map((kind) => <section key={kind} className="mt-8"><h2 className="mb-4 text-lg font-semibold capitalize">{kind} categories</h2>
      {active.filter((category) => category.kind === kind).length === 0 ? <EmptyState title={`No ${kind} categories`} description="Add one using the form above." /> :
        <div className="grid gap-3 md:grid-cols-2">{active.filter((category) => category.kind === kind).map((category) => <article key={category.id} className="rounded-2xl border border-stone-200 bg-white p-4">
          <h3 className="font-semibold">{category.name}</h3>{category.parent_id && <p className="mt-1 text-xs text-stone-500">Under {names.get(category.parent_id) || "Archived category"}</p>}
          <details className="mt-3 border-t border-stone-100 pt-3"><summary className="cursor-pointer text-sm font-medium text-emerald-800">Edit category</summary><div className="mt-4"><CategoryForm category={category} categories={categories} /></div></details>
          <form action={archiveCategoryAction} className="mt-2"><input type="hidden" name="id" value={category.id} /><ConfirmSubmit question={`Archive ${category.name}? Existing transactions keep this category.`}>Archive category</ConfirmSubmit></form>
        </article>)}</div>}
    </section>)}
    {archived.length > 0 && <section className="mt-8"><h2 className="mb-4 text-lg font-semibold">Archived categories</h2><div className="flex flex-wrap gap-2">{archived.map((category) => <span key={category.id} className="rounded-full border border-stone-200 bg-white px-3 py-1 text-sm text-stone-600">{category.name} · {category.kind}</span>)}</div></section>}
  </FinanceShell>;
}
