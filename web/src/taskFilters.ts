import { localDate, matches, type Category, type Filter, type Task } from './domain'
export interface TaskFilters {
  recordKind: 'all' | 'meeting_minutes'
  search: string
  category: 'all' | Category
  date: 'all' | 'overdue' | 'today' | 'next7' | 'undated' | 'custom'
  from: string
  to: string
  importance: 'all' | 'important' | 'regular'
  priority: 'all' | Task['priority']
  sort: 'newest' | 'schedule' | 'priority'
}
export function defaultFilters(): TaskFilters {
  return { recordKind:'all',search:'',category:'all',date:'all',from:'',to:'',importance:'all',priority:'all',sort:'priority' }
}
export function filterTasks(tasks: Task[], view: Filter, options: TaskFilters, today=localDate()): Task[] {
  const end=new Date(`${today}T12:00:00`)
  end.setDate(end.getDate()+6)
  const lastDay=localDate(end)
  const query=options.search.trim().toLocaleLowerCase()
  const rank={high:0,normal:1,low:2}
  return tasks.filter(t=>{
    if(options.recordKind==='meeting_minutes' && t.record_kind!=='meeting_minutes')return false
    if(!matches(t,view,today)) return false
    if(query && !`${t.title} ${t.content} ${t.summary}`.toLocaleLowerCase().includes(query)) return false
    if(options.category!=='all' && t.category!==options.category) return false
    if(options.importance==='important' && t.priority!=='high') return false
    if(options.importance==='regular' && t.priority==='high') return false
    if(options.priority!=='all' && t.priority!==options.priority) return false
    switch(options.date){
      case 'overdue': return !!t.due_date && t.due_date<today && !t.completed
      case 'today': return t.due_date===today
      case 'next7': return t.due_date>=today && t.due_date<=lastDay
      case 'undated': return !t.due_date
      case 'custom': return !(options.from && options.to && options.from>options.to) && !!t.due_date && (!options.from || t.due_date>=options.from) && (!options.to || t.due_date<=options.to)
      default: return true
    }
  }).sort((a,b)=>{
    if(options.sort==='priority' && rank[a.priority]!==rank[b.priority]) return rank[a.priority]-rank[b.priority]
    if(options.sort==='schedule'){
      const dateOrder=(a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99')
      if(dateOrder) return dateOrder
      const timeOrder=(a.due_time || '24:00').localeCompare(b.due_time || '24:00')
      if(timeOrder) return timeOrder
    }
    return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
  })
}
