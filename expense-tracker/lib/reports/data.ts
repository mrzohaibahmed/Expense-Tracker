import type { Json } from "@/lib/supabase/database.types";

export type Report = {
  expense_minor: string;
  income_minor: string;
  net_minor: string;
  transaction_count: number;
  previous: { expense_minor: string; income_minor: string; net_minor: string };
  trend: { date: string; expense_minor: string; income_minor: string }[];
  categories: { category_id: string; name: string; parent_id: string | null; archived: boolean; expense_minor: string }[];
  merchants: { merchant: string; expense_minor: string; transaction_count: number }[];
  largest: { transaction_id: string; date: string; merchant: string | null; account_id: string; expense_minor: string }[];
  accounts: { account_id: string; name: string; archived: boolean; expense_minor: string; income_minor: string }[];
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Report data is unavailable.");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Report data is unavailable.");
  return value;
}
function money(value: unknown): string {
  const result = string(value);
  if (!/^-?\d+$/.test(result)) throw new Error("Report amount is invalid.");
  return result;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Report count is invalid.");
  return value;
}
function rows(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Report data is unavailable.");
  return value;
}

export function parseReport(value: Json): Report {
  const data = record(value);
  const previous = record(data.previous);
  return {
    expense_minor: money(data.expense_minor),
    income_minor: money(data.income_minor),
    net_minor: money(data.net_minor),
    transaction_count: number(data.transaction_count),
    previous: {
      expense_minor: money(previous.expense_minor),
      income_minor: money(previous.income_minor),
      net_minor: money(previous.net_minor),
    },
    trend: rows(data.trend).map((value) => { const row = record(value); return { date: string(row.date), expense_minor: money(row.expense_minor), income_minor: money(row.income_minor) }; }),
    categories: rows(data.categories).map((value) => { const row = record(value); return { category_id: string(row.category_id), name: string(row.name), parent_id: row.parent_id === null ? null : string(row.parent_id), archived: row.archived === true, expense_minor: money(row.expense_minor) }; }),
    merchants: rows(data.merchants).map((value) => { const row = record(value); return { merchant: string(row.merchant), expense_minor: money(row.expense_minor), transaction_count: number(row.transaction_count) }; }),
    largest: rows(data.largest).map((value) => { const row = record(value); return { transaction_id: string(row.transaction_id), date: string(row.date), merchant: row.merchant === null ? null : string(row.merchant), account_id: string(row.account_id), expense_minor: money(row.expense_minor) }; }),
    accounts: rows(data.accounts).map((value) => { const row = record(value); return { account_id: string(row.account_id), name: string(row.name), archived: row.archived === true, expense_minor: money(row.expense_minor), income_minor: money(row.income_minor) }; }),
  };
}
