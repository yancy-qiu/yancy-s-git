import { z } from 'zod'
export const categories = { task: '任务', meeting: '会议', progress: '进展', need: '需求' }
export type Category = keyof typeof categories
export type Filter = 'today' | 'inbox' | 'planned' | 'unorganized' | 'all' | 'completed'
export const views: { id: Filter; name: string; icon: string; description: string }[] = [
  { id:'today', name:'今天', icon:'☀', description:'把注意力留给今天最重要的事。' },
  { id:'inbox', name:'收集箱', icon:'▱', description:'先记下来，安排可以慢慢来。' },
  { id:'planned', name:'计划', icon:'▦', description:'让未来的每一步，都有迹可循。' },
  { id:'unorganized', name:'待整理', icon:'✧', description:'给零散的想法一点清晰的方向。' },
  { id:'all', name:'全部记录', icon:'▤', description:'所有想法与行动，都在这里。' },
  { id:'completed', name:'已完成', icon:'✓', description:'每一个完成，都值得被看见。' },
]
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
const date = z.string().refine(v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && localDate(new Date(`${v}T12:00:00`)) === v, '日期格式无效')
export const taskFields = z.object({
  title:z.string().trim().min(1,'请输入标题').max(200), content:z.string().max(12000),
  category:z.enum(['task','meeting','progress','need']), due_date:date,
  due_time:z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
  priority:z.enum(['high','normal','low']), reminder:z.boolean(), completed:z.boolean(),
  organized:z.boolean(), summary:z.string().max(2000), action_items:z.array(z.string().max(500)).max(3),
})
export type TaskFields = z.infer<typeof taskFields>
export interface Task extends TaskFields { id:string; user_id:string; created_at:string; updated_at:string; deleted_at:string|null }
export function blankTask(): TaskFields { return {title:'',content:'',category:'task',due_date:'',due_time:'',priority:'normal',reminder:false,completed:false,organized:false,summary:'',action_items:[]} }
export function matches(t:Task, filter:Filter, today=localDate()) {
  if(t.deleted_at) return false
  if(filter === 'all') return true
  if(filter === 'completed') return t.completed
  if(t.completed) return false
  return filter === 'today' ? !!t.due_date && t.due_date <= today : filter === 'inbox' ? !t.due_date : filter === 'planned' ? t.due_date > today : !t.organized
}
export function endpointURL(value:string) {
  const u = new URL(value)
  if(u.protocol !== 'https:' || u.username || u.password || u.hash) throw Error('模型接口需要不含用户名、密码和片段的 HTTPS 地址。')
  return u.href
}
const aiTask = z.object({
  title:taskFields.shape.title.optional(), content:taskFields.shape.content.optional(),
  category:taskFields.shape.category.optional(), dueDate:date.nullable().optional(),
  dueTime:taskFields.shape.due_time.nullable().optional(), priority:taskFields.shape.priority.optional(),
  reminder:z.boolean().optional(), completed:z.boolean().optional(), summary:taskFields.shape.summary.optional(),
  actionItems:taskFields.shape.action_items.optional(), clarification:z.string().optional(),
})
export const aiResponse = z.object({reply:z.string().min(1).max(4000),action:z.enum(['create','update','none']),task:aiTask.nullish()})
export function applyAI(raw:unknown, current:TaskFields|null): {reply:string; fields:TaskFields|null; action:'create'|'update'|'none'} {
  const data=aiResponse.parse(raw)
  if(data.action==='none' || data.task?.clarification?.trim()) return {reply:data.task?.clarification || data.reply,fields:null,action:'none'}
  if(!data.task) throw Error('模型没有返回任务数据。')
  if(data.action==='update' && !current) throw Error('请先引用需要修改的任务。')
  const t=data.task, fields={...(data.action==='update' && current ? current : blankTask()),organized:true}
  for(const k of ['title','content','category','priority','reminder','completed','summary'] as const) {
    if(t[k]!==undefined) Object.assign(fields,{[k]:t[k]})
  }
  if(t.dueDate!==undefined && t.dueDate!==null) fields.due_date=t.dueDate
  if(t.dueTime!==undefined && t.dueTime!==null) fields.due_time=t.dueTime
  if(t.actionItems) fields.action_items=t.actionItems
  if(!fields.due_date) { fields.reminder=false; fields.due_time='' }
  return {reply:data.reply,fields:taskFields.parse(fields),action:data.action}
}
