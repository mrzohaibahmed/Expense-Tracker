begin;

-- The invoker's RLS policies still apply. Every amount is aggregated as
-- NUMERIC and returned as decimal text so totals cannot lose paisa in JSON.
create function public.get_financial_report(
  p_start date,
  p_end date,
  p_previous_start date,
  p_previous_end date,
  p_account_id uuid default null,
  p_category_id uuid default null
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_start is null or p_end is null or p_previous_start is null or p_previous_end is null
    or p_start > p_end or p_previous_start > p_previous_end
    or p_end - p_start > 365 or p_previous_end - p_previous_start > 365
  then
    raise exception 'Choose valid reporting ranges of at most 366 days.' using errcode = '22023';
  end if;

  if p_account_id is not null and not exists (
    select 1 from public.accounts a
    where a.id = p_account_id and a.user_id = v_user_id
  ) then
    raise exception 'The account is unavailable.' using errcode = '42501';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = p_category_id and c.user_id = v_user_id
  ) then
    raise exception 'The category is unavailable.' using errcode = '42501';
  end if;

  with recursive category_scope as (
    select c.id
    from public.categories c
    where c.user_id = v_user_id and c.id = p_category_id
    union all
    select child.id
    from public.categories child
    join category_scope parent on child.parent_id = parent.id
    where child.user_id = v_user_id
  ), selected_splits as (
    select t.id as transaction_id, t.occurred_on, t.type, t.account_id,
      t.merchant, s.category_id, s.amount_minor::numeric as amount_minor
    from public.transactions t
    join public.transaction_splits s
      on s.transaction_id = t.id and s.user_id = t.user_id
    where t.user_id = v_user_id
      and (p_account_id is null or t.account_id = p_account_id)
      and (p_category_id is null or s.category_id in (select id from category_scope))
      and (
        t.occurred_on between p_start and p_end
        or t.occurred_on between p_previous_start and p_previous_end
      )
  ), current_splits as (
    select * from selected_splits where occurred_on between p_start and p_end
  ), previous_splits as (
    select * from selected_splits
    where occurred_on between p_previous_start and p_previous_end
  ), current_totals as (
    select coalesce(sum(amount_minor) filter (where type = 'expense'), 0) as expense,
      coalesce(sum(amount_minor) filter (where type = 'income'), 0) as income,
      count(distinct transaction_id) as transaction_count
    from current_splits
  ), previous_totals as (
    select coalesce(sum(amount_minor) filter (where type = 'expense'), 0) as expense,
      coalesce(sum(amount_minor) filter (where type = 'income'), 0) as income
    from previous_splits
  ), daily_totals as (
    select day::date as occurred_on,
      coalesce(sum(s.amount_minor) filter (where s.type = 'expense'), 0) as expense,
      coalesce(sum(s.amount_minor) filter (where s.type = 'income'), 0) as income
    from generate_series(p_start, p_end, interval '1 day') as day
    left join current_splits s on s.occurred_on = day::date
    group by day::date
  ), category_totals as (
    select c.id, c.name, c.parent_id, c.archived_at is not null as archived,
      sum(s.amount_minor) as expense
    from current_splits s
    join public.categories c on c.id = s.category_id and c.user_id = v_user_id
    where s.type = 'expense'
    group by c.id, c.name, c.parent_id, c.archived_at
  ), merchant_totals as (
    select coalesce(nullif(btrim(s.merchant), ''), 'Unspecified') as merchant,
      sum(s.amount_minor) as expense,
      count(distinct s.transaction_id) as transaction_count
    from current_splits s
    where s.type = 'expense'
    group by coalesce(nullif(btrim(s.merchant), ''), 'Unspecified')
    order by expense desc, merchant
    limit 5
  ), largest_expenses as (
    select s.transaction_id, s.occurred_on, s.merchant, s.account_id,
      sum(s.amount_minor) as expense
    from current_splits s
    where s.type = 'expense'
    group by s.transaction_id, s.occurred_on, s.merchant, s.account_id
    order by expense desc, s.occurred_on desc, s.transaction_id
    limit 5
  ), account_totals as (
    select a.id, a.name, a.archived_at is not null as archived,
      coalesce(sum(s.amount_minor) filter (where s.type = 'expense'), 0) as expense,
      coalesce(sum(s.amount_minor) filter (where s.type = 'income'), 0) as income
    from current_splits s
    join public.accounts a on a.id = s.account_id and a.user_id = v_user_id
    group by a.id, a.name, a.archived_at
  )
  select jsonb_build_object(
    'expense_minor', ct.expense::text,
    'income_minor', ct.income::text,
    'net_minor', (ct.income - ct.expense)::text,
    'transaction_count', ct.transaction_count,
    'previous', jsonb_build_object(
      'expense_minor', pt.expense::text,
      'income_minor', pt.income::text,
      'net_minor', (pt.income - pt.expense)::text
    ),
    'trend', coalesce((select jsonb_agg(jsonb_build_object(
      'date', d.occurred_on, 'expense_minor', d.expense::text,
      'income_minor', d.income::text
    ) order by d.occurred_on) from daily_totals d), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object(
      'category_id', c.id, 'name', c.name, 'parent_id', c.parent_id,
      'archived', c.archived, 'expense_minor', c.expense::text
    ) order by c.expense desc, c.name) from category_totals c), '[]'::jsonb),
    'merchants', coalesce((select jsonb_agg(jsonb_build_object(
      'merchant', m.merchant, 'expense_minor', m.expense::text,
      'transaction_count', m.transaction_count
    ) order by m.expense desc, m.merchant) from merchant_totals m), '[]'::jsonb),
    'largest', coalesce((select jsonb_agg(jsonb_build_object(
      'transaction_id', e.transaction_id, 'date', e.occurred_on,
      'merchant', e.merchant, 'account_id', e.account_id,
      'expense_minor', e.expense::text
    ) order by e.expense desc, e.occurred_on desc) from largest_expenses e), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object(
      'account_id', a.id, 'name', a.name, 'archived', a.archived,
      'expense_minor', a.expense::text, 'income_minor', a.income::text
    ) order by a.expense desc, a.name) from account_totals a), '[]'::jsonb)
  ) into v_result
  from current_totals ct cross join previous_totals pt;

  return v_result;
end;
$$;

revoke all on function public.get_financial_report(date, date, date, date, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_financial_report(date, date, date, date, uuid, uuid)
  to authenticated;

commit;
