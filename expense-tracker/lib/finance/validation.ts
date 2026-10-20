import { parseAmount } from "./money";

export type FinanceActionState = {
  status: "idle" | "error";
  message: string;
};

export const initialFinanceState: FinanceActionState = { status: "idle", message: "" };

export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalText(form: FormData, key: string, max: number): string | null {
  const value = formString(form, key);
  if (value.length > max) throw new Error(`${key} is too long.`);
  return value || null;
}

export function requiredName(form: FormData): string {
  const name = formString(form, "name");
  if (!name || name.length > 100) throw new Error("Enter a name up to 100 characters.");
  return name;
}

export function requiredUuid(form: FormData, key: string): string {
  const value = formString(form, key);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Choose a valid ${key.replace(/_/g, " ")}.`);
  }
  return value;
}

export function requiredDate(form: FormData): string {
  const value = formString(form, "occurred_on");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a valid date.");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Choose a valid date.");
  }
  return value;
}

export function requiredAmount(form: FormData, key = "amount"): number {
  return parseAmount(formString(form, key));
}

export function safeFailure(error: unknown): FinanceActionState {
  if (error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Unable to save. Please try again." };
}

export function databaseFailure(code: string | undefined): FinanceActionState {
  const message = code === "23505"
    ? "That name or request has already been used. Check your entries and try again."
    : code === "23503" || code === "42501"
      ? "One of the selected records is unavailable or does not belong to you."
      : code === "23514" || code === "22003"
        ? "The financial details are invalid. Check the amount, categories, and accounts."
        : "Unable to save right now. Please try again.";
  return { status: "error", message };
}
