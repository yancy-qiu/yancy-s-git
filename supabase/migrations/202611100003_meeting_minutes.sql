begin;
alter table public.tasks add column record_kind text not null default 'task' check(record_kind in ('task','meeting_minutes'));
alter table public.tasks add column document jsonb;
alter table public.tasks add constraint tasks_document_check check (
 (record_kind='task' and document is null) or
 (record_kind='meeting_minutes' and document is not null and jsonb_typeof(document)='object' and coalesce(document->>'type','')='doc' and octet_length(document::text)<=500000)
);
alter table public.tasks drop constraint tasks_content_check;
alter table public.tasks add constraint tasks_content_check check(length(content)<=100000);
commit;
