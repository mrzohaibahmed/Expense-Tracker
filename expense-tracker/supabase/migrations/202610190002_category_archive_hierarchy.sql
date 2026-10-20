create function private.enforce_category_archive_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is not null
    and old.archived_at is null
    and exists (
      select 1
      from public.categories child
      where child.user_id = new.user_id
        and child.parent_id = new.id
        and child.archived_at is null
    )
  then
    raise exception 'Archive active child categories before archiving their parent.'
      using errcode = '23514';
  end if;

  if new.archived_at is null
    and old.archived_at is not null
    and new.parent_id is not null
    and not exists (
      select 1
      from public.categories parent
      where parent.user_id = new.user_id
        and parent.id = new.parent_id
        and parent.archived_at is null
    )
  then
    raise exception 'Restore the parent category before restoring this category.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_category_archive_hierarchy() from public, anon, authenticated;

create trigger categories_enforce_archive_hierarchy
before update of archived_at on public.categories
for each row execute function private.enforce_category_archive_hierarchy();
