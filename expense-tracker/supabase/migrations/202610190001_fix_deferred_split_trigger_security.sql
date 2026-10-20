begin;

-- Deferred constraint triggers fire after the public RPC's SECURITY DEFINER
-- context has ended. Execute the trigger entry point as its postgres owner so
-- it can resolve the private helper without granting authenticated users usage
-- on the private schema. The function accepts no client arguments, reads only
-- the row identifiers supplied by PostgreSQL's trigger context, and retains an
-- empty search_path.
alter function private.enforce_transaction_split_total() security definer;
revoke all on function private.enforce_transaction_split_total()
  from public, anon, authenticated;

commit;
