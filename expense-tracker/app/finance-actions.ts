"use server";

import { parseOpeningBalance, parseAmount } from "@/lib/finance/money";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFinancialUser } from "@/lib/finance/server";
import {
  databaseFailure, formString, optionalText, requiredAmount, requiredDate,
  requiredName, requiredUuid, safeFailure, type FinanceActionState,
} from "@/lib/finance/validation";

const accountTypes = new Set(["cash", "bank", "mobile_wallet", "other"]);
const transactionKinds = new Set(["expense", "income"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refreshFinancialPages() {
  for (const path of ["/dashboard", "/reports", "/accounts", "/categories", "/transactions", "/transfers"]) {
    revalidatePath(path);
  }
}

export async function saveAccountAction(_state: FinanceActionState, form: FormData): Promise<FinanceActionState> {
  const { supabase, user } = await requireFinancialUser();
  try {
    const name = requiredName(form);
    const type = formString(form, "type") as "cash" | "bank" | "mobile_wallet" | "other";
    if (!accountTypes.has(type)) throw new Error("Choose an account type.");
    const opening_balance_minor = formString(form, "opening_balance")
      ? parseOpeningBalance(formString(form, "opening_balance"))
      : 0;
    const id = formString(form, "id");
    if (id) {
      requiredUuid(form, "id");
      const owned = await supabase.from("accounts").select("id").eq("id", id).eq("user_id", user.id).is("archived_at", null).maybeSingle();
      if (owned.error || !owned.data) throw new Error("This account is unavailable.");
      const result = await supabase.from("accounts").update({ name, type, opening_balance_minor }).eq("id", id).eq("user_id", user.id).select("id");
      if (result.error) return databaseFailure(result.error.code);
      if (!result.data?.length) throw new Error("This account is unavailable.");
    } else {
      const result = await supabase.from("accounts").insert({ user_id: user.id, name, type, currency: "PKR", opening_balance_minor });
      if (result.error) return databaseFailure(result.error.code);
    }
  } catch (error) { return safeFailure(error); }
  refreshFinancialPages();
  redirect("/accounts");
}

export async function archiveAccountAction(form: FormData) {
  const { supabase, user } = await requireFinancialUser();
  const id = requiredUuid(form, "id");
  const result = await supabase.from("accounts").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("archived_at", null).select("id");
  if (result.error || !result.data?.length) redirect("/accounts?error=archive");
  refreshFinancialPages();
  redirect("/accounts");
}

export async function saveCategoryAction(_state: FinanceActionState, form: FormData): Promise<FinanceActionState> {
  const { supabase, user } = await requireFinancialUser();
  try {
    const name = requiredName(form);
    const kind = formString(form, "kind") as "expense" | "income";
    if (!transactionKinds.has(kind)) throw new Error("Choose expense or income.");
    const id = formString(form, "id");
    const parent_id = formString(form, "parent_id") || null;
    if (parent_id) {
      requiredUuid(form, "parent_id");
      if (parent_id === id) throw new Error("A category cannot be its own parent.");
      const parent = await supabase.from("categories").select("id").eq("id", parent_id).eq("user_id", user.id).eq("kind", kind).is("archived_at", null).maybeSingle();
      if (parent.error || !parent.data) throw new Error("Choose an active parent of the same kind.");
    }
    if (id) {
      requiredUuid(form, "id");
      const owned = await supabase.from("categories").select("id").eq("id", id).eq("user_id", user.id).is("archived_at", null).maybeSingle();
      if (owned.error || !owned.data) throw new Error("This category is unavailable.");
      const result = await supabase.from("categories").update({ name, kind, parent_id }).eq("id", id).eq("user_id", user.id).select("id");
      if (result.error) return databaseFailure(result.error.code);
      if (!result.data?.length) throw new Error("This category is unavailable.");
    } else {
      const result = await supabase.from("categories").insert({ user_id: user.id, name, kind, parent_id });
      if (result.error) return databaseFailure(result.error.code);
    }
  } catch (error) { return safeFailure(error); }
  refreshFinancialPages();
  redirect("/categories");
}

export async function archiveCategoryAction(form: FormData) {
  const { supabase, user } = await requireFinancialUser();
  const id = requiredUuid(form, "id");
  const result = await supabase.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("archived_at", null).select("id");
  if (result.error || !result.data?.length) redirect("/categories?error=archive");
  refreshFinancialPages();
  redirect("/categories");
}

async function transactionInput(form: FormData, userId: string, supabase: Awaited<ReturnType<typeof requireFinancialUser>>["supabase"]) {
  const p_type = formString(form, "type") as "expense" | "income";
  if (!transactionKinds.has(p_type)) throw new Error("Choose expense or income.");
  const p_account_id = requiredUuid(form, "account_id");
  const p_amount_minor = requiredAmount(form);
  const p_occurred_on = requiredDate(form);
  const p_merchant = optionalText(form, "merchant", 200);
  const p_notes = optionalText(form, "notes", 2000);
  const categoryIds = form.getAll("split_category_id");
  const amounts = form.getAll("split_amount");
  if (!categoryIds.length || categoryIds.length !== amounts.length || categoryIds.length > 100) {
    throw new Error("Add one to one hundred category allocations.");
  }
  const p_splits = categoryIds.map((category, index) => {
    if (typeof category !== "string" || typeof amounts[index] !== "string") throw new Error("Choose a category and amount for every split.");
    const amount = amounts[index] as string;
    const category_id = category.trim();
    if (!uuidPattern.test(category_id)) throw new Error("Choose a category for every split.");
    return { category_id, amount_minor: parseAmount(amount) };
  });
  if (new Set(p_splits.map((split) => split.category_id)).size !== p_splits.length) throw new Error("Each category can appear only once.");
  if (p_splits.reduce((sum, split) => sum + BigInt(split.amount_minor), 0n) !== BigInt(p_amount_minor)) {
    throw new Error("Category allocations must equal the total amount.");
  }
  const account = await supabase.from("accounts").select("id").eq("id", p_account_id).eq("user_id", userId).is("archived_at", null).maybeSingle();
  if (account.error || !account.data) throw new Error("Choose an active account you own.");
  const categories = await supabase.from("categories").select("id").in("id", p_splits.map((split) => split.category_id)).eq("user_id", userId).eq("kind", p_type).is("archived_at", null);
  if (categories.error || categories.data?.length !== p_splits.length) throw new Error("Choose active categories of the selected type.");
  return {
    p_type,
    p_account_id,
    p_amount_minor,
    p_currency: "PKR",
    p_occurred_on,
    p_splits,
    p_merchant: p_merchant ?? undefined,
    p_notes: p_notes ?? undefined,
    p_source: "manual",
  };
}

export async function saveTransactionAction(_state: FinanceActionState, form: FormData): Promise<FinanceActionState> {
  const { supabase, user } = await requireFinancialUser();
  try {
    const input = await transactionInput(form, user.id, supabase);
    const id = formString(form, "id");
    if (id) {
      requiredUuid(form, "id");
      const existing = await supabase.from("transactions").select("id,idempotency_key").eq("id", id).eq("user_id", user.id).eq("source", "manual").maybeSingle();
      if (existing.error || !existing.data) throw new Error("This manual transaction is unavailable.");
      const result = await supabase.rpc("update_transaction", {
        ...input,
        p_transaction_id: id,
        p_idempotency_key: existing.data.idempotency_key ?? undefined,
      });
      if (result.error) return databaseFailure(result.error.code);
    } else {
      const idempotencyKey = formString(form, "idempotency_key");
      if (!uuidPattern.test(idempotencyKey)) throw new Error("This form expired. Reload and try again.");
      const result = await supabase.rpc("create_transaction", { ...input, p_idempotency_key: idempotencyKey });
      if (result.error) return databaseFailure(result.error.code);
    }
  } catch (error) { return safeFailure(error); }
  refreshFinancialPages();
  redirect("/transactions");
}

export async function deleteTransactionAction(form: FormData) {
  const { supabase, user } = await requireFinancialUser();
  const id = requiredUuid(form, "id");
  const existing = await supabase.from("transactions").select("id").eq("id", id).eq("user_id", user.id).eq("source", "manual").maybeSingle();
  if (existing.error || !existing.data) redirect("/transactions?error=delete");
  const result = await supabase.rpc("delete_transaction", { p_transaction_id: id });
  if (result.error) redirect("/transactions?error=delete");
  refreshFinancialPages();
  redirect("/transactions");
}

export async function createTransferAction(_state: FinanceActionState, form: FormData): Promise<FinanceActionState> {
  const { supabase, user } = await requireFinancialUser();
  try {
    const p_from_account_id = requiredUuid(form, "from_account_id");
    const p_to_account_id = requiredUuid(form, "to_account_id");
    if (p_from_account_id === p_to_account_id) throw new Error("Choose two different accounts.");
    const p_amount_minor = requiredAmount(form);
    const p_occurred_on = requiredDate(form);
    const p_notes = optionalText(form, "notes", 2000);
    const key = formString(form, "idempotency_key");
    if (!uuidPattern.test(key)) throw new Error("This form expired. Reload and try again.");
    const accounts = await supabase.from("accounts").select("id").in("id", [p_from_account_id, p_to_account_id]).eq("user_id", user.id).eq("currency", "PKR").is("archived_at", null);
    if (accounts.error || accounts.data?.length !== 2) throw new Error("Choose two active PKR accounts you own.");
    const result = await supabase.rpc("create_transfer", {
      p_from_account_id,
      p_to_account_id,
      p_amount_minor,
      p_currency: "PKR",
      p_occurred_on,
      p_notes: p_notes ?? undefined,
      p_idempotency_key: key,
    });
    if (result.error) return databaseFailure(result.error.code);
  } catch (error) { return safeFailure(error); }
  refreshFinancialPages();
  redirect("/transfers");
}

