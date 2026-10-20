begin;

-- Direct transaction writes remain revoked; deletion must pass the same
-- ownership boundary as create/update before cascading to its splits.
create function public.delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.transactions
  where id = p_transaction_id and user_id = v_user_id;

  if not found then
    raise exception 'The transaction does not belong to this user.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.delete_transaction(uuid) from public, anon, authenticated;
grant execute on function public.delete_transaction(uuid) to authenticated;

-- Aggregate inside PostgreSQL and return decimal text. An account balance can
-- exceed JavaScript's safe integer range even when each posted amount cannot.
create function public.get_account_balances(p_as_of date)
returns table(account_id uuid, balance_minor text)
language sql
security invoker
set search_path = ''
stable
as $$
  select a.id,
    (
      a.opening_balance_minor::numeric
      + coalesce((
          select sum(case when t.type = 'income' then t.amount_minor::numeric else -t.amount_minor::numeric end)
          from public.transactions t
          where t.user_id = a.user_id and t.account_id = a.id and t.occurred_on <= p_as_of
        ), 0)
      + coalesce((
          select sum(x.amount_minor::numeric)
          from public.transfers x
          where x.user_id = a.user_id and x.to_account_id = a.id and x.occurred_on <= p_as_of
        ), 0)
      - coalesce((
          select sum(x.amount_minor::numeric)
          from public.transfers x
          where x.user_id = a.user_id and x.from_account_id = a.id and x.occurred_on <= p_as_of
        ), 0)
    )::text as balance_minor
  from public.accounts a
  where a.user_id = (select auth.uid())
    and p_as_of is not null;
$$;

revoke all on function public.get_account_balances(date) from public, anon, authenticated;
grant execute on function public.get_account_balances(date) to authenticated;

commit;
