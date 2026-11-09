-- Run once in the Supabase SQL editor (or via supabase db push).
begin;
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (length(trim(title)) between 1 and 200),
  content text not null default '' check (length(content) <= 12000),
  category text not null default 'task' check (category in ('task','meeting','progress','need')),
  due_date text not null default '' check (due_date = '' or due_date ~ '^\d{4}-\d{2}-\d{2}$'),
  due_time text not null default '' check (due_time = '' or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  priority text not null default 'normal' check (priority in ('high','normal','low')),
  reminder boolean not null default false, completed boolean not null default false,
  organized boolean not null default false, summary text not null default '' check (length(summary) <= 2000),
  action_items jsonb not null default '[]' check (jsonb_typeof(action_items) = 'array' and jsonb_array_length(action_items) <= 3),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (due_date <> '' or (not reminder and due_time = ''))
);
create index tasks_user_created on public.tasks(user_id, created_at desc);
alter table public.tasks enable row level security;
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
create policy tasks_select on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_update on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tasks_delete on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);
create function public.touch_task() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  new.created_at = old.created_at;
  return new;
end;
$$;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_task();
alter publication supabase_realtime add table public.tasks;
commit;
