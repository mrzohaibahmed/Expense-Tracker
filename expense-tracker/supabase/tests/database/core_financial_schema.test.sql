begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'user-a@example.test', '{}', '{}', now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'user-b@example.test', '{}', '{}', now(), now()
  );

insert into public.accounts (id, user_id, name, type, currency)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A Bank', 'bank', 'PKR'),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'A Wallet', 'mobile_wallet', 'PKR'),
  ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'B Bank', 'bank', 'PKR');

insert into public.categories (id, user_id, name, kind)
values
  ('13000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A Test Expense', 'expense'),
  ('13000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'A Test Income', 'income'),
  ('23000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'B Test Expense', 'expense');

select is(
  (select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'new-user initialization creates one profile'
);
select is(
  (select count(*) from public.categories where user_id = '10000000-0000-0000-0000-000000000001' and id not in (
    '13000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000002'
  )),
  15::bigint,
  'new-user initialization creates the default categories'
);
select is(
  (select count(*) from public.accounts where user_id = '10000000-0000-0000-0000-000000000001' and name = 'Cash'),
  1::bigint,
  'new-user initialization creates one Cash account'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select public.initialize_current_user();
select public.initialize_current_user();

select is((select count(*) from public.profiles), 1::bigint, 'initialization is idempotent for profiles');
select is(
  (select count(*) from public.categories where id not in (
    '13000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000002'
  )),
  15::bigint,
  'initialization is idempotent for default categories'
);
select is(
  (select count(*) from public.accounts where name = 'Cash'),
  1::bigint,
  'initialization is idempotent for the Cash account'
);

select is((select count(*) from public.profiles), 1::bigint, 'User A can select only their profile');
select is(
  (select count(*) from public.accounts where id = '22000000-0000-0000-0000-000000000001'),
  0::bigint,
  'User A cannot select User B accounts'
);
select is(
  (
    with changed as (
      update public.accounts set name = 'Taken' where id = '22000000-0000-0000-0000-000000000001'
      returning id
    )
    select count(*) from changed
  ),
  0::bigint,
  'User A cannot alter User B accounts'
);

select throws_ok(
  $$
    select public.create_transaction(
      'expense',
      '22000000-0000-0000-0000-000000000001',
      100,
      'PKR',
      current_date,
      '[{"category_id":"13000000-0000-0000-0000-000000000001","amount_minor":100}]'::jsonb,
      null, null, 'manual', 'cross-user-account'
    )
  $$,
  '42501',
  'The account is unavailable or does not belong to this user.',
  'cross-user account references are rejected'
);

select throws_ok(
  $$
    select public.create_transaction(
      'expense',
      '11000000-0000-0000-0000-000000000001',
      100,
      'PKR',
      current_date,
      '[{"category_id":"23000000-0000-0000-0000-000000000001","amount_minor":100}]'::jsonb,
      null, null, 'manual', 'cross-user-category'
    )
  $$,
  '42501',
  'Every category must be active, owned by the user, and match the transaction type.',
  'cross-user category references are rejected'
);

select throws_ok(
  $$
    select public.create_transaction(
      'expense',
      '11000000-0000-0000-0000-000000000001',
      100,
      'PKR',
      current_date,
      '[{"category_id":"13000000-0000-0000-0000-000000000002","amount_minor":100}]'::jsonb,
      null, null, 'manual', 'wrong-category-kind'
    )
  $$,
  '42501',
  'Every category must be active, owned by the user, and match the transaction type.',
  'category kinds must match transaction kinds'
);

select throws_ok(
  $$
    select public.create_transaction(
      'expense',
      '11000000-0000-0000-0000-000000000001',
      100,
      'PKR',
      current_date,
      '[{"category_id":"13000000-0000-0000-0000-000000000001","amount_minor":99}]'::jsonb,
      null, null, 'manual', 'invalid-total'
    )
  $$,
  '23514',
  'Transaction split total must equal transaction amount.',
  'invalid split totals are rejected'
);
select is(
  (select count(*) from public.transactions where idempotency_key = 'invalid-total'),
  0::bigint,
  'a failed create leaves no partial transaction'
);

select public.create_transaction(
  'expense',
  '11000000-0000-0000-0000-000000000001',
  100,
  'PKR',
  date '2026-10-15',
  '[{"category_id":"13000000-0000-0000-0000-000000000001","amount_minor":100}]'::jsonb,
  'Test merchant', null, 'manual', 'transaction-idempotency'
);
select public.create_transaction(
  'expense',
  '11000000-0000-0000-0000-000000000001',
  100,
  'PKR',
  date '2026-10-15',
  '[{"category_id":"13000000-0000-0000-0000-000000000001","amount_minor":100}]'::jsonb,
  'Test merchant', null, 'manual', 'transaction-idempotency'
);

select is(
  (select count(*) from public.transactions where idempotency_key = 'transaction-idempotency'),
  1::bigint,
  'duplicate transaction idempotency keys create one transaction'
);
select is(
  (select count(*) from public.transaction_splits s join public.transactions t on t.id = s.transaction_id where t.idempotency_key = 'transaction-idempotency'),
  1::bigint,
  'an idempotent retry does not duplicate splits'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, type, account_id, amount_minor, currency, occurred_on, source
    ) values (
      '10000000-0000-0000-0000-000000000001', 'expense',
      '11000000-0000-0000-0000-000000000001', 1, 'PKR', current_date, 'manual'
    )
  $$,
  '42501',
  'permission denied for table transactions',
  'authenticated users cannot bypass atomic transaction functions'
);

select throws_ok(
  $$
    select public.update_transaction(
      (select id from public.transactions where idempotency_key = 'transaction-idempotency'),
      'expense',
      '11000000-0000-0000-0000-000000000001',
      200,
      'PKR',
      date '2026-10-15',
      '[{"category_id":"13000000-0000-0000-0000-000000000001","amount_minor":200}]'::jsonb,
      'Test merchant', repeat('x', 2001), 'manual', 'transaction-idempotency'
    )
  $$,
  '23514',
  null,
  'a failure during an atomic update is rejected'
);
select is(
  (select amount_minor from public.transactions where idempotency_key = 'transaction-idempotency'),
  100::bigint,
  'a failed update rolls back the transaction row'
);
select is(
  (
    select s.amount_minor
    from public.transaction_splits s
    join public.transactions t on t.id = s.transaction_id
    where t.idempotency_key = 'transaction-idempotency'
  ),
  100::bigint,
  'a failed update preserves the original split'
);

select throws_ok(
  $$
    select public.create_transfer(
      '11000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000001',
      50,
      'PKR',
      current_date,
      null,
      'same-account-transfer'
    )
  $$,
  '23514',
  'Transfer accounts must be different.',
  'same-account transfers are rejected'
);

select public.create_transfer(
  '11000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000002',
  50,
  'PKR',
  date '2026-10-15',
  null,
  'transfer-idempotency'
);
select public.create_transfer(
  '11000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000002',
  50,
  'PKR',
  date '2026-10-15',
  null,
  'transfer-idempotency'
);

select is(
  (select count(*) from public.transactions),
  1::bigint,
  'creating a transfer does not create income or expense transactions'
);
select is(
  (select count(*) from public.transfers where idempotency_key = 'transfer-idempotency'),
  1::bigint,
  'duplicate transfer idempotency keys create one transfer'
);

insert into public.categories (id, user_id, name, kind)
values
  ('13000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Cycle parent', 'expense'),
  ('13000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Cycle child', 'expense');
update public.categories
set parent_id = '13000000-0000-0000-0000-000000000010'
where id = '13000000-0000-0000-0000-000000000011';

select throws_ok(
  $$
    update public.categories
    set parent_id = '13000000-0000-0000-0000-000000000011'
    where id = '13000000-0000-0000-0000-000000000010'
  $$,
  '23514',
  'Category hierarchies cannot contain cycles.',
  'category cycles are rejected'
);

reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.accounts $$,
  '42501',
  'permission denied for table accounts',
  'anonymous users cannot read financial accounts'
);
select throws_ok(
  $$ select public.initialize_current_user() $$,
  '42501',
  'permission denied for function initialize_current_user',
  'anonymous users cannot execute initialization functions'
);

reset role;
select * from finish();
rollback;
