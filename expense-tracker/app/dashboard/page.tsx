import { WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "./actions";
import { LogoutButton } from "./logout-button";

export const instant = false;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-emerald-700 font-semibold text-white">₨</span>
            <div>
              <p className="font-semibold text-stone-950">Expense Tracker</p>
              <p className="max-w-[13rem] truncate text-xs text-stone-500 sm:max-w-none">{data.user.email}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <LogoutButton />
          </form>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div>
          <p className="text-sm font-medium text-emerald-700">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">Your finances, clearly.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Financial records and reporting will be built in the next milestones. Your account is ready.</p>
        </div>

        <section className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white px-5 py-14 text-center sm:px-10">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <WalletCards aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-stone-950">No financial records yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">Expense and income entry is intentionally not enabled in this authentication milestone.</p>
        </section>
      </div>
    </main>
  );
}
