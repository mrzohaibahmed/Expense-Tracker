import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function readEnvironment() {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const result = {};
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)=(.*)\s*$/);
    if (match) result[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  assert.ok(result.NEXT_PUBLIC_SUPABASE_URL, "Missing Supabase URL in .env.local");
  assert.ok(result.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Missing publishable key in .env.local");
  return result;
}

function client(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function checkNoError(result, label) {
  assert.ifError(result.error, `${label}: ${result.error?.message}`);
  return result.data;
}

function expectDenied(result, label) {
  assert.ok(result.error, `${label} unexpectedly succeeded`);
}

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = readEnvironment();
const credentials = JSON.parse(readFileSync(new URL("../.supabase-test-users.local.json", import.meta.url), "utf8"));
for (const name of ["userA", "userB"]) {
  assert.ok(credentials[name]?.email && credentials[name]?.password, `${name} credentials are required`);
}
assert.notEqual(credentials.userA.email, credentials.userB.email, "Use two different test accounts");

const a = client(url, key);
const b = client(url, key);
const anon = client(url, key);
const aLogin = await a.auth.signInWithPassword(credentials.userA);
const bLogin = await b.auth.signInWithPassword(credentials.userB);
checkNoError(aLogin, "User A sign in");
checkNoError(bLogin, "User B sign in");
const aId = aLogin.data.user?.id;
const bId = bLogin.data.user?.id;
assert.ok(aId && bId && aId !== bId, "Two distinct authenticated sessions are required");
console.log("PASS: two distinct password-authenticated user sessions");

expectDenied(await anon.from("accounts").select("id").limit(1), "anonymous accounts read");
expectDenied(await anon.rpc("initialize_current_user"), "anonymous initialization RPC");
expectDenied(await anon.rpc("get_account_balances", { p_as_of: "2026-10-15" }), "anonymous balances RPC");
console.log("PASS: anonymous financial access denied");

checkNoError(await a.rpc("initialize_current_user"), "User A initialization");
checkNoError(await b.rpc("initialize_current_user"), "User B initialization");
checkNoError(await a.rpc("initialize_current_user"), "User A repeated initialization");
const defaultCash = checkNoError(await a.from("accounts").select("id").eq("name", "Cash"), "Idempotent Cash initialization");
assert.equal(defaultCash.length, 1);
const cash = defaultCash[0];
const ownProfile = checkNoError(await a.from("profiles").select("id").eq("id", aId), "Own profile");
assert.equal(ownProfile.length, 1);
const marker = randomUUID().slice(0, 8);
const accountA = checkNoError(await a.from("accounts").insert({ user_id: aId, name: `Verification A ${marker}`, type: "bank", currency: "PKR" }).select("id").single(), "User A account");
const accountB = checkNoError(await b.from("accounts").insert({ user_id: bId, name: `Verification B ${marker}`, type: "bank", currency: "PKR" }).select("id").single(), "User B account");
const categoryA = checkNoError(await a.from("categories").insert({ user_id: aId, name: `Verification expense A ${marker}`, kind: "expense" }).select("id").single(), "User A expense category");
const secondCategoryA = checkNoError(await a.from("categories").insert({ user_id: aId, name: `Verification split A ${marker}`, kind: "expense" }).select("id").single(), "User A second expense category");
const categoryB = checkNoError(await b.from("categories").insert({ user_id: bId, name: `Verification expense B ${marker}`, kind: "expense" }).select("id").single(), "User B expense category");
const parentCategory = checkNoError(await a.from("categories").insert({ user_id: aId, name: `Verification parent ${marker}`, kind: "expense" }).select("id").single(), "Parent category");
const childCategory = checkNoError(await a.from("categories").insert({ user_id: aId, name: `Verification child ${marker}`, kind: "expense", parent_id: parentCategory.id }).select("id").single(), "Child category");

const hidden = checkNoError(await a.from("accounts").select("id").eq("id", accountB.id), "Cross-user account select");
assert.equal(hidden.length, 0);
assert.equal(checkNoError(await a.from("categories").select("id").eq("id", categoryB.id), "Cross-user category select").length, 0);
const changed = checkNoError(await a.from("accounts").update({ name: "Unauthorized" }).eq("id", accountB.id).select("id"), "Cross-user account update");
assert.equal(changed.length, 0);
assert.equal(checkNoError(await a.from("categories").update({ name: "Unauthorized" }).eq("id", categoryB.id).select("id"), "Cross-user category update").length, 0);
expectDenied(await a.from("accounts").insert({ user_id: bId, name: `Forged ${marker}`, type: "cash" }), "Cross-user account insert");
expectDenied(await a.from("categories").insert({ user_id: aId, name: `Forged parent ${marker}`, kind: "expense", parent_id: categoryB.id }), "Cross-user category parent");
console.log("PASS: user isolation on reads, updates, and inserts");

const archiveAccount = checkNoError(await a.from("accounts").insert({ user_id: aId, name: `Verification archive account ${marker}`, type: "cash", currency: "PKR" }).select("id").single(), "Create archive test account");
checkNoError(await a.from("accounts").update({ name: `Verification edited account ${marker}` }).eq("id", archiveAccount.id), "Edit own account");
checkNoError(await a.from("accounts").update({ archived_at: new Date().toISOString() }).eq("id", archiveAccount.id), "Archive own account");
const editedAccount = checkNoError(await a.from("accounts").select("name,archived_at").eq("id", archiveAccount.id).single(), "Archived account state");
assert.equal(editedAccount.name, `Verification edited account ${marker}`);
assert.ok(editedAccount.archived_at);
const editCategory = checkNoError(await a.from("categories").insert({ user_id: aId, name: `Verification edit category ${marker}`, kind: "expense" }).select("id").single(), "Create editable category");
checkNoError(await a.from("categories").update({ name: `Verification edited category ${marker}` }).eq("id", editCategory.id), "Edit own category");
checkNoError(await a.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", editCategory.id), "Archive own category");
assert.ok(checkNoError(await a.from("categories").select("name,archived_at").eq("id", editCategory.id).single(), "Archived category state").archived_at);
console.log("PASS: own account/category creation, editing, and archiving");

const archivedAt = new Date().toISOString();
expectDenied(await a.from("categories").update({ archived_at: archivedAt }).eq("id", parentCategory.id), "Parent archive with active child");
checkNoError(await a.from("categories").update({ archived_at: archivedAt }).eq("id", childCategory.id), "Child category archive");
checkNoError(await a.from("categories").update({ archived_at: archivedAt }).eq("id", parentCategory.id), "Parent category archive");
expectDenied(await a.from("categories").update({ archived_at: null }).eq("id", childCategory.id), "Child restore under archived parent");
console.log("PASS: category archive hierarchy remains valid");

const startingBalances = checkNoError(await a.rpc("get_account_balances", { p_as_of: "2026-10-15" }), "Starting account balances");
const accountAStart = BigInt(startingBalances.find((row) => row.account_id === accountA.id)?.balance_minor ?? "0");
const cashStart = BigInt(startingBalances.find((row) => row.account_id === cash.id)?.balance_minor ?? "0");

const baseTransaction = {
  p_type: "expense", p_account_id: accountA.id, p_amount_minor: 12550,
  p_currency: "PKR", p_occurred_on: "2026-10-15", p_source: "manual",
  p_merchant: "Verification", p_notes: null,
  p_splits: [{ category_id: categoryA.id, amount_minor: 10000 }, { category_id: secondCategoryA.id, amount_minor: 2550 }],
};
expectDenied(await a.rpc("create_transaction", { ...baseTransaction, p_account_id: accountB.id, p_idempotency_key: `${marker}-cross-account` }), "Cross-user account RPC");
expectDenied(await a.rpc("create_transaction", { ...baseTransaction, p_splits: [{ category_id: categoryB.id, amount_minor: 12550 }], p_idempotency_key: `${marker}-cross-category` }), "Cross-user category RPC");
expectDenied(await a.rpc("create_transaction", { ...baseTransaction, p_splits: [{ category_id: categoryA.id, amount_minor: 1 }], p_idempotency_key: `${marker}-bad-split` }), "Invalid split total");
const absent = checkNoError(await a.from("transactions").select("id").eq("idempotency_key", `${marker}-bad-split`), "Failed transaction rollback check");
assert.equal(absent.length, 0);
expectDenied(await a.from("transactions").insert({ user_id: aId, type: "expense", account_id: accountA.id, amount_minor: 1, currency: "PKR", occurred_on: "2026-10-15", source: "manual" }), "Direct transaction insert");
console.log("PASS: cross-user references, split equality, rollback, direct-write denial");

const transactionArgs = { ...baseTransaction, p_idempotency_key: `${marker}-transaction` };
const first = checkNoError(await a.rpc("create_transaction", transactionArgs), "Create transaction");
const retry = checkNoError(await a.rpc("create_transaction", transactionArgs), "Retry transaction");
assert.equal(first, retry);
const splits = checkNoError(await a.from("transaction_splits").select("id,amount_minor").eq("transaction_id", first), "Split read");
assert.equal(splits.length, 2);
assert.equal(splits.reduce((sum, split) => sum + split.amount_minor, 0), 12550);
expectDenied(await b.rpc("update_transaction", { p_transaction_id: first, ...baseTransaction, p_account_id: accountB.id, p_splits: [{ category_id: categoryB.id, amount_minor: 12550 }] }), "Cross-user transaction update");
const updated = checkNoError(await a.rpc("update_transaction", { ...transactionArgs, p_transaction_id: first, p_amount_minor: 13000, p_splits: [{ category_id: categoryA.id, amount_minor: 13000 }] }), "Update transaction");
assert.equal(updated, first);
expectDenied(await a.rpc("update_transaction", { ...transactionArgs, p_transaction_id: first, p_notes: "x".repeat(2001), p_amount_minor: 14000, p_splits: [{ category_id: categoryA.id, amount_minor: 14000 }] }), "Failed atomic update");
const retained = checkNoError(await a.from("transactions").select("amount_minor").eq("id", first).single(), "Transaction after failed update");
assert.equal(retained.amount_minor, 13000);
const retainedSplits = checkNoError(await a.from("transaction_splits").select("amount_minor").eq("transaction_id", first), "Splits after failed update");
assert.deepEqual(retainedSplits.map((row) => row.amount_minor), [13000]);
console.log("PASS: atomic create/update and transaction idempotency");

const transferArgs = { p_from_account_id: cash.id, p_to_account_id: accountA.id, p_amount_minor: 500, p_currency: "PKR", p_occurred_on: "2026-10-15", p_notes: null, p_idempotency_key: `${marker}-transfer` };
const transfer = checkNoError(await a.rpc("create_transfer", transferArgs), "Create transfer");
assert.equal(checkNoError(await a.rpc("create_transfer", transferArgs), "Retry transfer"), transfer);
const transferTransaction = checkNoError(await a.from("transactions").select("id").eq("id", transfer), "Transfer transaction check");
assert.equal(transferTransaction.length, 0);
expectDenied(await a.rpc("create_transfer", { ...transferArgs, p_from_account_id: accountB.id, p_idempotency_key: `${marker}-cross-transfer` }), "Cross-user transfer");
const balances = checkNoError(await a.rpc("get_account_balances", { p_as_of: "2026-10-15" }), "Account balances");
assert.ok(!balances.some((row) => row.account_id === accountB.id));
assert.equal(balances.find((row) => row.account_id === accountA.id)?.balance_minor, String(accountAStart - 12500n));
assert.equal(balances.find((row) => row.account_id === cash.id)?.balance_minor, String(cashStart - 500n));
console.log("PASS: transfer isolation, non-transaction accounting, idempotency, exact balances");

expectDenied(await b.rpc("delete_transaction", { p_transaction_id: first }), "Cross-user transaction delete");
checkNoError(await a.rpc("delete_transaction", { p_transaction_id: first }), "Delete transaction");
assert.equal(checkNoError(await a.from("transactions").select("id").eq("id", first), "Deleted transaction check").length, 0);
assert.equal(checkNoError(await a.from("transaction_splits").select("id").eq("transaction_id", first), "Deleted splits check").length, 0);
const afterDelete = checkNoError(await a.rpc("get_account_balances", { p_as_of: "2026-10-15" }), "Balances after deletion");
assert.equal(afterDelete.find((row) => row.account_id === accountA.id)?.balance_minor, String(accountAStart + 500n));
console.log("PASS: ownership-checked deletion cascades splits and refreshes balances");

const reportChild = checkNoError(await a.from("categories").insert({ user_id: aId, name: `Verification report child ${marker}`, kind: "expense", parent_id: categoryA.id }).select("id").single(), "Report child category");
const reportIncome = checkNoError(await a.from("categories").insert({ user_id: aId, name: `Verification report income ${marker}`, kind: "income" }).select("id").single(), "Report income category");
const reportExpense = { ...baseTransaction, p_occurred_on: "2026-10-20", p_merchant: `Verification report merchant ${marker}`, p_splits: [{ category_id: categoryA.id, amount_minor: 10000 }, { category_id: reportChild.id, amount_minor: 2550 }], p_idempotency_key: `${marker}-report-expense` };
checkNoError(await a.rpc("create_transaction", reportExpense), "Create report expense");
checkNoError(await a.rpc("create_transaction", { ...reportExpense, p_occurred_on: "2026-10-19", p_amount_minor: 3000, p_splits: [{ category_id: categoryA.id, amount_minor: 3000 }], p_idempotency_key: `${marker}-report-prior` }), "Create prior-day expense");
checkNoError(await a.rpc("create_transaction", { ...reportExpense, p_occurred_on: "2026-10-21", p_amount_minor: 7000, p_splits: [{ category_id: categoryA.id, amount_minor: 7000 }], p_idempotency_key: `${marker}-report-future` }), "Create future expense");
checkNoError(await a.rpc("create_transaction", { ...reportExpense, p_type: "income", p_amount_minor: 20000, p_splits: [{ category_id: reportIncome.id, amount_minor: 20000 }], p_idempotency_key: `${marker}-report-income` }), "Create report income");
checkNoError(await b.rpc("create_transaction", { ...reportExpense, p_account_id: accountB.id, p_amount_minor: 99999, p_splits: [{ category_id: categoryB.id, amount_minor: 99999 }], p_idempotency_key: `${marker}-report-user-b` }), "Create user B report expense");
checkNoError(await a.rpc("create_transfer", { ...transferArgs, p_occurred_on: "2026-10-20", p_idempotency_key: `${marker}-report-transfer` }), "Create report-period transfer");
checkNoError(await a.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", reportChild.id), "Archive report child category");

const reportArgs = { p_start: "2026-10-20", p_end: "2026-10-20", p_previous_start: "2026-10-19", p_previous_end: "2026-10-19", p_account_id: accountA.id };
const report = checkNoError(await a.rpc("get_financial_report", reportArgs), "Known-record report");
assert.equal(report.expense_minor, "12550");
assert.equal(report.income_minor, "20000");
assert.equal(report.net_minor, "7450");
assert.equal(report.previous.expense_minor, "3000");
assert.equal(report.transaction_count, 2);
assert.equal(report.trend[0].expense_minor, "12550");
assert.equal(report.categories.reduce((sum, row) => sum + BigInt(row.expense_minor), 0n), 12550n);
assert.ok(report.categories.some((row) => row.category_id === reportChild.id && row.archived && row.expense_minor === "2550"));
assert.equal(report.merchants[0].expense_minor, "12550");
assert.equal(report.largest[0].expense_minor, "12550");
const parentReport = checkNoError(await a.rpc("get_financial_report", { ...reportArgs, p_category_id: categoryA.id }), "Parent category report");
assert.equal(parentReport.expense_minor, "12550");
assert.equal(parentReport.categories.length, 2);
const childReport = checkNoError(await a.rpc("get_financial_report", { ...reportArgs, p_category_id: reportChild.id }), "Archived child category report");
assert.equal(childReport.expense_minor, "2550");
assert.equal(childReport.income_minor, "0");
expectDenied(await a.rpc("get_financial_report", { ...reportArgs, p_account_id: accountB.id }), "Cross-user report filter");
expectDenied(await anon.rpc("get_financial_report", reportArgs), "Anonymous report");
const bReport = checkNoError(await b.rpc("get_financial_report", { ...reportArgs, p_account_id: accountB.id }), "User B report");
assert.equal(bReport.expense_minor, "99999");
assert.equal(bReport.income_minor, "0");
console.log("PASS: known-record report totals, splits, archive history, filters, dates, transfers, comparisons, and user isolation");

const pageRecords = await Promise.all(Array.from({ length: 21 }, (_, index) => a.rpc("create_transaction", {
  ...baseTransaction,
  p_occurred_on: "2026-10-18",
  p_amount_minor: 101 + index,
  p_merchant: `Verification page ${marker} ${String(index + 1).padStart(2, "0")}`,
  p_splits: [{ category_id: categoryA.id, amount_minor: 101 + index }],
  p_idempotency_key: `${marker}-page-${index + 1}`,
})));
const pageIds = pageRecords.map((result, index) => checkNoError(result, `Pagination fixture ${index + 1}`));
assert.equal(new Set(pageIds).size, 21);
const historyQuery = () => a.from("transactions")
  .select("id,amount_minor,merchant,transaction_splits!inner(category_id)", { count: "exact" })
  .eq("user_id", aId).eq("account_id", accountA.id).eq("type", "expense")
  .eq("transaction_splits.category_id", categoryA.id)
  .gte("occurred_on", "2026-10-18").lte("occurred_on", "2026-10-18")
  .or(`merchant.ilike.%Verification page ${marker}%,notes.ilike.%Verification page ${marker}%`);
const firstPage = await historyQuery().order("amount_minor", { ascending: false }).order("id", { ascending: false }).range(0, 19);
checkNoError(firstPage, "History first page");
assert.equal(firstPage.count, 21);
assert.equal(firstPage.data.length, 20);
assert.equal(firstPage.data[0].amount_minor, 121);
const secondPage = await historyQuery().order("amount_minor", { ascending: false }).order("id", { ascending: false }).range(20, 39);
checkNoError(secondPage, "History second page");
assert.equal(secondPage.data.length, 1);
assert.equal(secondPage.data[0].amount_minor, 101);
const ascending = await historyQuery().order("amount_minor", { ascending: true }).order("id", { ascending: false }).range(0, 0);
checkNoError(ascending, "History ascending sort");
assert.equal(ascending.data[0].amount_minor, 101);
for (const [index, id] of pageIds.entries()) checkNoError(await a.rpc("delete_transaction", { p_transaction_id: id }), `Remove page fixture ${index + 1}`);
assert.equal(checkNoError(await historyQuery().range(0, 19), "History cleanup check").length, 0);
console.log("PASS: 21-record history search, filters, sorting, and pagination through the authenticated API");
checkNoError(await a.from("accounts").update({ archived_at: new Date().toISOString() }).eq("id", accountA.id), "Archive referenced account");
const archivedAccountReport = checkNoError(await a.rpc("get_financial_report", reportArgs), "Archived account history report");
assert.equal(archivedAccountReport.expense_minor, "12550");
assert.ok(archivedAccountReport.accounts.some((row) => row.account_id === accountA.id && row.archived));
expectDenied(await a.rpc("create_transaction", { ...reportExpense, p_idempotency_key: `${marker}-archived-account-denied` }), "New expense on archived account");
console.log("PASS: archived account history remains reportable while new postings are denied");

console.log("PASS: hosted verification completed through real anon/authenticated API sessions");
console.log("Test-only records remain under the two disposable users; remove those users in the development dashboard when finished.");
