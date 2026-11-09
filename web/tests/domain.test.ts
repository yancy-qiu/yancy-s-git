import { describe, it, expect } from 'vitest'
import { blankTask, matches, applyAI, endpointURL, taskFields, type Task } from '../src/domain'
const task:Task={...blankTask(),title:'提交报告',id:'1',user_id:'a',created_at:'',updated_at:'',deleted_at:null,due_date:'2026-11-10',reminder:true}
describe('task behavior',()=>{
 it('routes overdue, undated, planned and completed tasks',()=>{
   expect(matches(task,'planned','2026-11-09')).toBe(true)
   expect(matches(task,'today','2026-11-11')).toBe(true)
   expect(matches({...task,due_date:''},'inbox')).toBe(true)
   expect(matches({...task,completed:true},'today','2026-11-11')).toBe(false)
   expect(matches({...task,completed:true},'completed')).toBe(true)
   expect(matches({...task,deleted_at:'now'},'all')).toBe(false)
 })
 it('rejects invalid dates and times',()=>{
   expect(taskFields.safeParse({...task,due_date:'2026-02-30'}).success).toBe(false)
   expect(taskFields.safeParse({...task,due_time:'25:99'}).success).toBe(false)
 })
})
describe('AI failure protections',()=>{
 it('preserves manually set date and reminder when model returns null',()=>{
   const result=applyAI({action:'update',reply:'已整理',task:{summary:'摘要',dueDate:null}},task)
   expect(result.fields?.due_date).toBe(task.due_date)
   expect(result.fields?.reminder).toBe(true)
 })
 it('clears dates only when explicitly requested',()=>{
   const result=applyAI({action:'update',reply:'已清除',task:{dueDate:''}},task)
   expect(result.fields?.due_date).toBe('')
   expect(result.fields?.reminder).toBe(false)
 })
 it('does not mutate tasks during clarification',()=>{
   expect(applyAI({action:'update',reply:'追问',task:{title:'不应保存',clarification:'你指哪一天？'}},task).fields).toBeNull()
   expect(task.title).toBe('提交报告')
 })
 it('rejects malformed output and updates without a context',()=>{
   expect(()=>applyAI({action:'update',reply:'已改',task:{title:'更改'}},null)).toThrow()
   expect(()=>applyAI({action:'create',reply:'已创建',task:{title:''}},null)).toThrow()
   expect(()=>applyAI({action:'create',reply:'已创建',task:{title:'a',priority:'urgent'}},null)).toThrow()
 })
 it('blocks insecure endpoints and embedded credentials',()=>{
   expect(()=>endpointURL('http://example.com/chat')).toThrow()
   expect(()=>endpointURL('https://user:secret@example.com')).toThrow()
   expect(endpointURL('https://example.com/v1/chat/completions')).toContain('https:')
 })
})
