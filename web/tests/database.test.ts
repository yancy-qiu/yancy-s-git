import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
const db=new PGlite()
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222'
async function asUser(id:string,sql:string){
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`)
 try{return await db.query(sql)}finally{await db.exec('reset role')}
}
beforeAll(async()=>{
 await db.exec(`create schema auth; create role anon; create role authenticated; create table auth.users(id uuid primary key); insert into auth.users values ('${a}'),('${b}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
 // Realtime publication is hosted Supabase configuration, not available in PGlite.
 const sql=readFileSync(new URL('../../supabase/migrations/202611090001_tasks.sql',import.meta.url),'utf8').replace('alter publication supabase_realtime add table public.tasks;','')
 await db.exec(sql)
 await db.exec(readFileSync(new URL('../../supabase/migrations/202611100002_task_categories.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../../supabase/migrations/202611100003_meeting_minutes.sql',import.meta.url),'utf8'))
},30000)
afterAll(()=>db.close())
describe.sequential('PostgreSQL row-level security',()=>{
 it('allows own insert and rejects another owner',async()=>{
   await asUser(a,`insert into tasks(title) values ('A的记录')`)
   await expect(asUser(a,`insert into tasks(user_id,title) values ('${b}','越权')`)).rejects.toThrow()
 })
 it('isolates reads and updates between accounts',async()=>{
   expect((await asUser(b,'select * from tasks')).rows).toHaveLength(0)
   expect((await asUser(b,"update tasks set title='越权' returning id")).rows).toHaveLength(0)
   expect((await asUser(a,'select * from tasks')).rows).toHaveLength(1)
   await expect(asUser(a,`update tasks set user_id='${b}'`)).rejects.toThrow()
 })
 it('rejects stale device updates, supports soft delete and undo',async()=>{
   const first=(await asUser(a,'select id, updated_at::text as stamp from tasks')).rows[0] as {id:string;stamp:string}
   const stamp=first.stamp
   expect((await asUser(a,`update tasks set title='设备一' where id='${first.id}' and updated_at='${stamp}' returning id`)).rows).toHaveLength(1)
   expect((await asUser(a,`update tasks set title='设备二' where id='${first.id}' and updated_at='${stamp}' returning id`)).rows).toHaveLength(0)
   await asUser(a,`update tasks set deleted_at=now() where id='${first.id}'`)
   expect((await asUser(a,'select * from tasks where deleted_at is null')).rows).toHaveLength(0)
   await asUser(a,`update tasks set deleted_at=null where id='${first.id}'`)
   expect((await asUser(a,'select * from tasks where deleted_at is null')).rows).toHaveLength(1)
 })
 it('does not allow anonymous reads',async()=>{
   await db.exec('set role anon')
   try{await expect(db.query('select * from tasks')).rejects.toThrow()}finally{await db.exec('reset role')}
 })
 it('isolates custom types, preserves renamed assignments, and blocks used type deletion',async()=>{
   const type='custom_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   await asUser(a,`insert into task_categories(id,name) values ('${type}','学习')`)
   expect((await asUser(b,`select * from task_categories where id='${type}'`)).rows).toHaveLength(0)
   await expect(asUser(b,`insert into tasks(title,category) values ('越权类型','${type}')`)).rejects.toThrow()
   await asUser(a,`insert into tasks(title,category) values ('读书','${type}')`)
   await asUser(a,`update task_categories set name='阅读' where id='${type}'`)
   expect((await asUser(a,`select * from tasks where category='${type}'`)).rows).toHaveLength(1)
   await expect(asUser(a,`delete from task_categories where id='${type}'`)).rejects.toThrow()
   await expect(asUser(a,`update task_categories set id='task' where id='${type}'`)).rejects.toThrow()
   await expect(asUser(a,`insert into task_categories(id,name) values ('custom_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','阅读')`)).rejects.toThrow()
   expect((await asUser(a,`delete from task_categories where id='task' returning id`)).rows).toHaveLength(0)
 })
 it('seeds basic types for newly created accounts',async()=>{
   const c='33333333-3333-4333-8333-333333333333'
   await db.exec(`insert into auth.users values ('${c}')`)
   expect((await asUser(c,'select * from task_categories')).rows).toHaveLength(4)
 })

 it('preserves ordinary tasks and isolates structured meeting minutes',async()=>{
   await asUser(a,`insert into tasks(title,record_kind,category,document,content) values ('会议纪要','meeting_minutes','meeting','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"会议结论"}]}]}','会议结论')`)
   expect((await asUser(b,`select * from tasks where record_kind='meeting_minutes'`)).rows).toHaveLength(0)
   await expect(asUser(a,`insert into tasks(title,record_kind) values ('坏文档','meeting_minutes')`)).rejects.toThrow()
   await expect(asUser(a,`insert into tasks(title,record_kind,document) values ('坏文档','meeting_minutes','{}')`)).rejects.toThrow()
   expect((await asUser(a,`select * from tasks where record_kind='task'`)).rows.length).toBeGreaterThan(0)
 })

})
