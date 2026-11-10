import { describe, expect, it } from 'vitest'
import { blankTask, type Task } from '../src/domain'
import { defaultFilters, filterTasks } from '../src/taskFilters'
const today='2026-11-10'
const task=(id:string,patch:Partial<Task>={}):Task=>({...blankTask(),id,user_id:'user',title:id,created_at:'2026-11-01T00:00:00Z',updated_at:'',deleted_at:null,...patch})
const tasks=[
 task('overdue',{due_date:'2026-11-09',priority:'high'}),
 task('today',{due_date:today,priority:'normal',category:'meeting',due_time:'10:00'}),
 task('last',{due_date:'2026-11-16',priority:'low'}),
 task('outside',{due_date:'2026-11-17',priority:'high'}),
 task('undated',{content:'产品讨论'}),
 task('done',{due_date:'2026-11-09',completed:true}),
]
const run=(patch:Partial<ReturnType<typeof defaultFilters>>={},view:Parameters<typeof filterTasks>[1]='all')=>filterTasks(tasks,view,{...defaultFilters(),...patch},today).map(t=>t.id)
describe('combined task filtering and ordering',()=>{
 it('combines current view, text, type, importance and priority',()=>{
   expect(run({search:'产品',category:'task',importance:'regular',priority:'normal'},'inbox')).toEqual(['undated'])
   expect(run({importance:'important',priority:'low'})).toEqual([])
   expect(run({date:'today',category:'meeting',priority:'normal'})).toEqual(['today'])
 })
 it('includes both boundaries of next seven calendar days',()=>{
   expect(run({date:'next7'})).toEqual(['today','last'])
   expect(run({date:'overdue'})).toEqual(['overdue'])
   expect(run({date:'undated'})).toEqual(['undated'])
 })
 it('supports inclusive and open date ranges and rejects inverted ranges',()=>{
   expect(run({date:'custom',from:today,to:'2026-11-16'})).toEqual(['today','last'])
   expect(run({date:'custom',from:'2026-11-17'})).toEqual(['outside'])
   expect(run({date:'custom',from:'2026-11-16',to:today})).toEqual([])
 })
 it('orders schedule times and places undated tasks last without mutating input',()=>{
   const original=tasks.map(t=>t.id)
   expect(run({sort:'schedule'})).toEqual(['done','overdue','today','last','outside','undated'])
   expect(run({sort:'priority'}).slice(0,2)).toEqual(['outside','overdue'])
   expect(tasks.map(t=>t.id)).toEqual(original)
 })
})
