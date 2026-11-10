-- Apply before deploying custom task types. Existing tasks retain their category IDs.
begin;
create table public.task_categories (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null check (id in ('task','meeting','progress','need') or id ~ '^custom_[0-9a-f-]{36}$'),
  name text not null check (length(btrim(name)) between 1 and 20 and name = btrim(name)),
  primary key (user_id,id)
);
create unique index task_categories_unique_name on public.task_categories(user_id,lower(name));
alter table public.task_categories enable row level security;
revoke all on public.task_categories from anon;
grant select,insert,delete on public.task_categories to authenticated;
grant update(name) on public.task_categories to authenticated;
create policy categories_select on public.task_categories for select to authenticated using (user_id=(select auth.uid()));
create policy categories_insert on public.task_categories for insert to authenticated with check (user_id=(select auth.uid()) and id ~ '^custom_[0-9a-f-]{36}$');
create policy categories_update on public.task_categories for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy categories_delete on public.task_categories for delete to authenticated using (user_id=(select auth.uid()) and id not in ('task','meeting','progress','need'));
insert into public.task_categories(user_id,id,name)
select u.id,c.id,c.name from auth.users u cross join (values ('task','任务'),('meeting','会议'),('progress','进展'),('need','需求')) c(id,name);
create function public.seed_task_categories() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.task_categories(user_id,id,name) values (new.id,'task','任务'),(new.id,'meeting','会议'),(new.id,'progress','进展'),(new.id,'need','需求');
  return new;
end;
$$;
revoke all on function public.seed_task_categories() from public;
create trigger user_task_categories after insert on auth.users for each row execute function public.seed_task_categories();
alter table public.tasks drop constraint tasks_category_check;
alter table public.tasks add constraint tasks_category_owner_fk foreign key (user_id,category) references public.task_categories(user_id,id);
commit;
