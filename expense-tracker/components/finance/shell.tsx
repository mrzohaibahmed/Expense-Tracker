import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/dashboard/actions";
import { LogoutButton } from "@/app/dashboard/logout-button";

const links = [
  ["Dashboard", "/dashboard", "Home"],
  ["Transactions", "/transactions", "History"],
  ["Reports", "/reports", "Reports"],
  ["Transfers", "/transfers", "Move"],
  ["Accounts", "/accounts", "Accounts"],
  ["Categories", "/categories", "Categories"],
] as const;

export function FinanceShell({ email, title, description, children, actions }: {
  email: string | undefined;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-stone-50 pb-16 text-stone-950 sm:pb-0">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3 font-semibold text-stone-950">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white">₨</span>
            <span className="min-w-0"><span className="block">Expense Tracker</span><span className="block truncate text-xs font-normal text-stone-500">{email}</span></span>
          </Link>
          <form action={logoutAction}><LogoutButton /></form>
        </div>
        <nav aria-label="Financial navigation" className="mx-auto hidden max-w-6xl gap-1 px-6 pb-3 sm:flex">
          {links.map(([label, href]) => <Link key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700">{label}</Link>)}
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{description}</p>}</div>
          {actions}
        </div>
        <div className="mt-7">{children}</div>
      </div>
      <nav aria-label="Financial navigation" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-stone-200 bg-white/95 px-1 py-2 backdrop-blur sm:hidden">
        {links.map(([label, href, mobileLabel]) => <Link key={href} href={href} aria-label={label} className="truncate rounded-lg px-1 py-2 text-center text-[11px] font-medium text-stone-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">{mobileLabel}</Link>)}
      </nav>
    </main>
  );
}

export function PageError({ message }: { message: string }) {
  return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">{message}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center"><h2 className="font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-stone-600">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
