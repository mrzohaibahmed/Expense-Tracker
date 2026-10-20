begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  default_currency text not null default 'PKR',
  timezone text not null default 'Asia/Karachi',
  week_starts_on smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(btrim(display_name)) between 1 and 100
  ),
  constraint profiles_default_currency_pkr check (default_currency = 'PKR'),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 100),
  constraint profiles_week_starts_on_range check (week_starts_on between 0 and 6)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  currency text not null default 'PKR',
  opening_balance_minor bigint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint accounts_type_allowed check (type in ('cash', 'bank', 'mobile_wallet', 'other')),
  constraint accounts_currency_pkr check (currency = 'PKR'),
  constraint accounts_opening_balance_safe_integer check (
    opening_balance_minor between -9007199254740991 and 9007199254740991
  ),
  unique (user_id, id),
  unique (user_id, id, currency)
);

create unique index accounts_active_name_unique
  on public.accounts (user_id, lower(name))
  where archived_at is null;
create index accounts_user_id_idx on public.accounts (user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null,
  parent_id uuid,
  icon text,
  color text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint categories_kind_allowed check (kind in ('expense', 'income')),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id),
  constraint categories_icon_length check (icon is null or char_length(icon) between 1 and 50),
  constraint categories_color_length check (color is null or char_length(color) between 1 and 32),
  unique (user_id, id),
  constraint categories_parent_same_user_fk
    foreign key (user_id, parent_id)
    references public.categories (user_id, id)
    on update restrict on delete restrict
);

create unique index categories_active_name_kind_unique
  on public.categories (user_id, kind, lower(name))
  where archived_at is null;
create index categories_user_kind_idx on public.categories (user_id, kind);
create index categories_user_parent_idx on public.categories (user_id, parent_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  account_id uuid not null,
  amount_minor bigint not null,
  currency text not null default 'PKR',
  occurred_on date not null,
  merchant text,
  notes text,
  source text not null default 'manual',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_type_allowed check (type in ('expense', 'income')),
  constraint transactions_amount_positive_safe check (
    amount_minor > 0 and amount_minor <= 9007199254740991
  ),
  constraint transactions_currency_pkr check (currency = 'PKR'),
  constraint transactions_merchant_length check (
    merchant is null or char_length(merchant) <= 200
  ),
  constraint transactions_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint transactions_source_allowed check (source in ('manual', 'receipt')),
  constraint transactions_idempotency_key_length check (
    idempotency_key is null or char_length(idempotency_key) between 1 and 200
  ),
  unique (user_id, id),
  constraint transactions_account_owner_currency_fk
    foreign key (user_id, account_id, currency)
    references public.accounts (user_id, id, currency)
    on update restrict on delete restrict
);

create unique index transactions_user_idempotency_unique
  on public.transactions (user_id, idempotency_key)
  where idempotency_key is not null;
create index transactions_user_occurred_on_idx
  on public.transactions (user_id, occurred_on desc, id desc);
create index transactions_user_account_date_idx
  on public.transactions (user_id, account_id, occurred_on desc);

create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null,
  category_id uuid not null,
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  constraint transaction_splits_amount_positive_safe check (
    amount_minor > 0 and amount_minor <= 9007199254740991
  ),
  constraint transaction_splits_transaction_owner_fk
    foreign key (user_id, transaction_id)
    references public.transactions (user_id, id)
    on update restrict on delete cascade,
  constraint transaction_splits_category_owner_fk
    foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on update restrict on delete restrict,
  unique (transaction_id, category_id)
);

create index transaction_splits_user_transaction_idx
  on public.transaction_splits (user_id, transaction_id);
create index transaction_splits_user_category_idx
  on public.transaction_splits (user_id, category_id);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount_minor bigint not null,
  currency text not null default 'PKR',
  occurred_on date not null,
  notes text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_different_accounts check (from_account_id <> to_account_id),
  constraint transfers_amount_positive_safe check (
    amount_minor > 0 and amount_minor <= 9007199254740991
  ),
  constraint transfers_currency_pkr check (currency = 'PKR'),
  constraint transfers_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint transfers_idempotency_key_length check (
    idempotency_key is null or char_length(idempotency_key) between 1 and 200
  ),
  constraint transfers_from_account_owner_currency_fk
    foreign key (user_id, from_account_id, currency)
    references public.accounts (user_id, id, currency)
    on update restrict on delete restrict,
  constraint transfers_to_account_owner_currency_fk
    foreign key (user_id, to_account_id, currency)
    references public.accounts (user_id, id, currency)
    on update restrict on delete restrict
);

create unique index transfers_user_idempotency_unique
  on public.transfers (user_id, idempotency_key)
  where idempotency_key is not null;
create index transfers_user_occurred_on_idx
  on public.transfers (user_id, occurred_on desc, id desc);
create index transfers_user_from_account_date_idx
  on public.transfers (user_id, from_account_id, occurred_on desc);
create index transfers_user_to_account_date_idx
  on public.transfers (user_id, to_account_id, occurred_on desc);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function private.set_updated_at();
create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.set_updated_at();
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function private.set_updated_at();
create trigger transfers_set_updated_at
before update on public.transfers
for each row execute function private.set_updated_at();

create function private.enforce_category_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_kind text;
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'A category owner cannot be changed.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.kind <> old.kind then
    if exists (
      select 1 from public.categories c
      where c.user_id = old.user_id and c.parent_id = old.id
    ) or exists (
      select 1 from public.transaction_splits s
      where s.user_id = old.user_id and s.category_id = old.id
    ) then
      raise exception 'The kind of a referenced category cannot be changed.' using errcode = '23514';
    end if;
  end if;

  if new.parent_id is null then
    return new;
  end if;

  select c.kind into v_parent_kind
  from public.categories c
  where c.user_id = new.user_id
    and c.id = new.parent_id
    and c.archived_at is null;

  if not found then
    raise exception 'The parent category is unavailable or does not belong to this user.' using errcode = '23503';
  end if;

  if v_parent_kind <> new.kind then
    raise exception 'Parent and child categories must have the same kind.' using errcode = '23514';
  end if;

  if exists (
    with recursive ancestors as (
      select c.id, c.parent_id
      from public.categories c
      where c.user_id = new.user_id and c.id = new.parent_id
      union
      select c.id, c.parent_id
      from public.categories c
      join ancestors a on a.parent_id = c.id
      where c.user_id = new.user_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'Category hierarchies cannot contain cycles.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger categories_enforce_hierarchy
before insert or update of user_id, kind, parent_id on public.categories
for each row execute function private.enforce_category_hierarchy();

create function private.enforce_split_category_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_transaction_kind text;
  v_category_kind text;
begin
  select t.type into v_transaction_kind
  from public.transactions t
  where t.user_id = new.user_id and t.id = new.transaction_id;

  select c.kind into v_category_kind
  from public.categories c
  where c.user_id = new.user_id and c.id = new.category_id;

  if v_transaction_kind is null or v_category_kind is null then
    raise exception 'The transaction and category must belong to the split owner.' using errcode = '23503';
  end if;

  if v_transaction_kind <> v_category_kind then
    raise exception 'The category kind must match the transaction type.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger transaction_splits_enforce_category_kind
before insert or update of user_id, transaction_id, category_id
on public.transaction_splits
for each row execute function private.enforce_split_category_kind();

create function private.assert_one_transaction_split_total(p_transaction_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_amount bigint;
  v_split_total numeric;
begin
  select t.amount_minor into v_amount
  from public.transactions t
  where t.id = p_transaction_id;

  if not found then
    return;
  end if;

  select coalesce(sum(s.amount_minor::numeric), 0) into v_split_total
  from public.transaction_splits s
  where s.transaction_id = p_transaction_id;

  if v_split_total <> v_amount::numeric then
    raise exception 'Transaction split total must equal transaction amount.' using errcode = '23514';
  end if;
end;
$$;

create function private.enforce_transaction_split_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'transaction_splits' then
    if tg_op in ('UPDATE', 'DELETE') then
      perform private.assert_one_transaction_split_total(old.transaction_id);
    end if;
    if tg_op in ('INSERT', 'UPDATE') and (tg_op <> 'UPDATE' or new.transaction_id <> old.transaction_id) then
      perform private.assert_one_transaction_split_total(new.transaction_id);
    end if;
  else
    perform private.assert_one_transaction_split_total(coalesce(new.id, old.id));
  end if;

  return null;
end;
$$;

create constraint trigger transaction_split_total_from_transaction
after insert or update on public.transactions
deferrable initially deferred
for each row execute function private.enforce_transaction_split_total();

create constraint trigger transaction_split_total_from_splits
after insert or update or delete on public.transaction_splits
deferrable initially deferred
for each row execute function private.enforce_transaction_split_total();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.transfers enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check ((select auth.uid()) is not null and id = (select auth.uid()));
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()))
with check ((select auth.uid()) is not null and id = (select auth.uid()));
create policy profiles_delete_own on public.profiles
for delete to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));

create policy accounts_select_own on public.accounts
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy accounts_insert_own on public.accounts
for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy accounts_update_own on public.accounts
for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy accounts_delete_own on public.accounts
for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy categories_select_own on public.categories
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy categories_insert_own on public.categories
for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy categories_update_own on public.categories
for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy categories_delete_own on public.categories
for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy transactions_select_own on public.transactions
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy transactions_insert_own on public.transactions
for insert to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.accounts a
    where a.user_id = (select auth.uid())
      and a.id = transactions.account_id
      and a.currency = transactions.currency
  )
);
create policy transactions_update_own on public.transactions
for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.accounts a
    where a.user_id = (select auth.uid())
      and a.id = transactions.account_id
      and a.currency = transactions.currency
  )
);
create policy transactions_delete_own on public.transactions
for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy transaction_splits_select_own on public.transaction_splits
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy transaction_splits_insert_own on public.transaction_splits
for insert to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1
    from public.transactions t
    join public.categories c on c.user_id = t.user_id and c.kind = t.type
    where t.user_id = (select auth.uid())
      and t.id = transaction_splits.transaction_id
      and c.id = transaction_splits.category_id
  )
);
create policy transaction_splits_update_own on public.transaction_splits
for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1
    from public.transactions t
    join public.categories c on c.user_id = t.user_id and c.kind = t.type
    where t.user_id = (select auth.uid())
      and t.id = transaction_splits.transaction_id
      and c.id = transaction_splits.category_id
  )
);
create policy transaction_splits_delete_own on public.transaction_splits
for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy transfers_select_own on public.transfers
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy transfers_insert_own on public.transfers
for insert to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.accounts a
    where a.user_id = (select auth.uid())
      and a.id = transfers.from_account_id
      and a.currency = transfers.currency
  )
  and exists (
    select 1 from public.accounts a
    where a.user_id = (select auth.uid())
      and a.id = transfers.to_account_id
      and a.currency = transfers.currency
  )
);
create policy transfers_update_own on public.transfers
for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.accounts a
    where a.user_id = (select auth.uid())
      and a.id = transfers.from_account_id
      and a.currency = transfers.currency
  )
  and exists (
    select 1 from public.accounts a
    where a.user_id = (select auth.uid())
      and a.id = transfers.to_account_id
      and a.currency = transfers.currency
  )
);
create policy transfers_delete_own on public.transfers
for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.accounts from anon, authenticated;
revoke all on table public.categories from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;
revoke all on table public.transaction_splits from anon, authenticated;
revoke all on table public.transfers from anon, authenticated;

grant usage on schema public to authenticated;
grant select on table public.profiles, public.accounts, public.categories,
  public.transactions, public.transaction_splits, public.transfers to authenticated;
grant insert, update on table public.profiles to authenticated;
grant insert, update, delete on table public.accounts, public.categories to authenticated;

create function private.initialize_user_financials(p_user_id uuid, p_display_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Cannot initialize an unknown auth user.' using errcode = '23503';
  end if;

  insert into public.profiles (id, display_name)
  values (p_user_id, nullif(left(btrim(p_display_name), 100), ''))
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, type, currency, opening_balance_minor)
  values (p_user_id, 'Cash', 'cash', 'PKR', 0)
  on conflict do nothing;

  insert into public.categories (user_id, name, kind)
  select p_user_id, defaults.name, defaults.kind
  from (
    values
      ('Groceries', 'expense'),
      ('Dining out', 'expense'),
      ('Transport', 'expense'),
      ('Utilities', 'expense'),
      ('Shopping', 'expense'),
      ('Health', 'expense'),
      ('Education', 'expense'),
      ('Entertainment', 'expense'),
      ('Personal care', 'expense'),
      ('Household', 'expense'),
      ('Other', 'expense'),
      ('Salary', 'income'),
      ('Freelance', 'income'),
      ('Gift', 'income'),
      ('Other income', 'income')
  ) as defaults(name, kind)
  on conflict do nothing;
end;
$$;

revoke all on function private.initialize_user_financials(uuid, text) from public, anon, authenticated;

create function public.initialize_current_user()
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

  perform private.initialize_user_financials(v_user_id, null);
end;
$$;

revoke all on function public.initialize_current_user() from public, anon, authenticated;
grant execute on function public.initialize_current_user() to authenticated;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.initialize_user_financials(
      new.id,
      coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name')
    );
  exception when others then
    raise warning 'Financial initialization failed for auth user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created_initialize_financials
after insert on auth.users
for each row execute function private.handle_new_auth_user();

do $$
declare
  existing_user record;
begin
  for existing_user in
    select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'name') as display_name
    from auth.users u
  loop
    begin
      perform private.initialize_user_financials(existing_user.id, existing_user.display_name);
    exception when others then
      raise warning 'Financial backfill failed for auth user %: %', existing_user.id, sqlerrm;
    end;
  end loop;
end;
$$;

create function private.assert_transaction_input(
  p_user_id uuid,
  p_type text,
  p_account_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_splits jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_split_count integer;
  v_split_total numeric;
  v_valid_category_count integer;
begin
  if p_type not in ('expense', 'income') then
    raise exception 'Transaction type must be expense or income.' using errcode = '23514';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 9007199254740991 then
    raise exception 'Transaction amount must be a positive safe integer.' using errcode = '23514';
  end if;

  if p_currency <> 'PKR' then
    raise exception 'Only PKR is supported in the initial release.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.user_id = p_user_id
      and a.id = p_account_id
      and a.currency = p_currency
      and a.archived_at is null
  ) then
    raise exception 'The account is unavailable or does not belong to this user.' using errcode = '42501';
  end if;

  if p_splits is null or jsonb_typeof(p_splits) <> 'array'
    or jsonb_array_length(p_splits) = 0 or jsonb_array_length(p_splits) > 100 then
    raise exception 'One to one hundred category splits are required.' using errcode = '23514';
  end if;

  select count(*), coalesce(sum(split.amount_minor::numeric), 0)
  into v_split_count, v_split_total
  from jsonb_to_recordset(p_splits) as split(category_id uuid, amount_minor bigint);

  if v_split_count <> jsonb_array_length(p_splits)
    or exists (
      select 1
      from jsonb_to_recordset(p_splits) as split(category_id uuid, amount_minor bigint)
      where split.category_id is null
        or split.amount_minor is null
        or split.amount_minor <= 0
        or split.amount_minor > 9007199254740991
    ) then
    raise exception 'Every split requires a category and positive safe-integer amount.' using errcode = '23514';
  end if;

  if v_split_total <> p_amount_minor::numeric then
    raise exception 'Transaction split total must equal transaction amount.' using errcode = '23514';
  end if;

  if exists (
    select split.category_id
    from jsonb_to_recordset(p_splits) as split(category_id uuid, amount_minor bigint)
    group by split.category_id
    having count(*) > 1
  ) then
    raise exception 'A category may appear only once in a transaction.' using errcode = '23514';
  end if;

  select count(*) into v_valid_category_count
  from jsonb_to_recordset(p_splits) as split(category_id uuid, amount_minor bigint)
  join public.categories c
    on c.id = split.category_id
   and c.user_id = p_user_id
   and c.kind = p_type
   and c.archived_at is null;

  if v_valid_category_count <> v_split_count then
    raise exception 'Every category must be active, owned by the user, and match the transaction type.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_transaction_input(uuid, text, uuid, bigint, text, jsonb)
  from public, anon, authenticated;

create function public.create_transaction(
  p_type text,
  p_account_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_occurred_on date,
  p_splits jsonb,
  p_merchant text default null,
  p_notes text default null,
  p_source text default 'manual',
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select t.id into v_transaction_id
    from public.transactions t
    where t.user_id = v_user_id and t.idempotency_key = p_idempotency_key;
    if found then
      return v_transaction_id;
    end if;
  end if;

  perform private.assert_transaction_input(
    v_user_id, p_type, p_account_id, p_amount_minor, p_currency, p_splits
  );

  begin
    insert into public.transactions (
      user_id, type, account_id, amount_minor, currency, occurred_on,
      merchant, notes, source, idempotency_key
    ) values (
      v_user_id, p_type, p_account_id, p_amount_minor, p_currency, p_occurred_on,
      nullif(btrim(p_merchant), ''), nullif(btrim(p_notes), ''), p_source,
      nullif(btrim(p_idempotency_key), '')
    )
    returning id into v_transaction_id;
  exception when unique_violation then
    if p_idempotency_key is not null then
      select t.id into v_transaction_id
      from public.transactions t
      where t.user_id = v_user_id and t.idempotency_key = p_idempotency_key;
      if found then
        return v_transaction_id;
      end if;
    end if;
    raise;
  end;

  insert into public.transaction_splits (user_id, transaction_id, category_id, amount_minor)
  select v_user_id, v_transaction_id, split.category_id, split.amount_minor
  from jsonb_to_recordset(p_splits) as split(category_id uuid, amount_minor bigint);

  return v_transaction_id;
end;
$$;

create function public.update_transaction(
  p_transaction_id uuid,
  p_type text,
  p_account_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_occurred_on date,
  p_splits jsonb,
  p_merchant text default null,
  p_notes text default null,
  p_source text default 'manual',
  p_idempotency_key text default null
)
returns uuid
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

  perform 1 from public.transactions t
  where t.id = p_transaction_id and t.user_id = v_user_id
  for update;

  if not found then
    raise exception 'The transaction does not belong to this user.' using errcode = '42501';
  end if;

  perform private.assert_transaction_input(
    v_user_id, p_type, p_account_id, p_amount_minor, p_currency, p_splits
  );

  update public.transactions
  set type = p_type,
      account_id = p_account_id,
      amount_minor = p_amount_minor,
      currency = p_currency,
      occurred_on = p_occurred_on,
      merchant = nullif(btrim(p_merchant), ''),
      notes = nullif(btrim(p_notes), ''),
      source = p_source,
      idempotency_key = nullif(btrim(p_idempotency_key), '')
  where id = p_transaction_id and user_id = v_user_id;

  delete from public.transaction_splits
  where transaction_id = p_transaction_id and user_id = v_user_id;

  insert into public.transaction_splits (user_id, transaction_id, category_id, amount_minor)
  select v_user_id, p_transaction_id, split.category_id, split.amount_minor
  from jsonb_to_recordset(p_splits) as split(category_id uuid, amount_minor bigint);

  return p_transaction_id;
end;
$$;

create function public.create_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_occurred_on date,
  p_notes text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_transfer_id uuid;
  v_account_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select t.id into v_transfer_id
    from public.transfers t
    where t.user_id = v_user_id and t.idempotency_key = p_idempotency_key;
    if found then
      return v_transfer_id;
    end if;
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'Transfer accounts must be different.' using errcode = '23514';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 9007199254740991 then
    raise exception 'Transfer amount must be a positive safe integer.' using errcode = '23514';
  end if;

  if p_currency <> 'PKR' then
    raise exception 'Only PKR is supported in the initial release.' using errcode = '23514';
  end if;

  select count(*) into v_account_count
  from public.accounts a
  where a.user_id = v_user_id
    and a.id in (p_from_account_id, p_to_account_id)
    and a.currency = p_currency
    and a.archived_at is null;

  if v_account_count <> 2 then
    raise exception 'Both transfer accounts must be active, owned by the user, and use the same currency.' using errcode = '42501';
  end if;

  begin
    insert into public.transfers (
      user_id, from_account_id, to_account_id, amount_minor, currency,
      occurred_on, notes, idempotency_key
    ) values (
      v_user_id, p_from_account_id, p_to_account_id, p_amount_minor, p_currency,
      p_occurred_on, nullif(btrim(p_notes), ''), nullif(btrim(p_idempotency_key), '')
    )
    returning id into v_transfer_id;
  exception when unique_violation then
    if p_idempotency_key is not null then
      select t.id into v_transfer_id
      from public.transfers t
      where t.user_id = v_user_id and t.idempotency_key = p_idempotency_key;
      if found then
        return v_transfer_id;
      end if;
    end if;
    raise;
  end;

  return v_transfer_id;
end;
$$;

revoke all on function public.create_transaction(text, uuid, bigint, text, date, jsonb, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.update_transaction(uuid, text, uuid, bigint, text, date, jsonb, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.create_transfer(uuid, uuid, bigint, text, date, text, text)
  from public, anon, authenticated;

grant execute on function public.create_transaction(text, uuid, bigint, text, date, jsonb, text, text, text, text)
  to authenticated;
grant execute on function public.update_transaction(uuid, text, uuid, bigint, text, date, jsonb, text, text, text, text)
  to authenticated;
grant execute on function public.create_transfer(uuid, uuid, bigint, text, date, text, text)
  to authenticated;

commit;
