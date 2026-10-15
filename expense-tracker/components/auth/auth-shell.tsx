import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-xl bg-emerald-700 text-white">
            ₨
          </span>
          Expense Tracker
        </Link>
        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
        </div>
        <div className="mt-7">{children}</div>
        {footer ? <div className="mt-6 border-t border-stone-100 pt-5 text-center text-sm text-stone-600">{footer}</div> : null}
      </section>
    </main>
  );
}
