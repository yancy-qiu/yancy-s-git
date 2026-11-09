import { z } from 'zod'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User, RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { blankTask, localDate, taskFields, type Task, type TaskFields } from './domain'
export const useTasks=defineStore('tasks',()=>{
  const user=ref<User|null>(null), tasks=ref<Task[]>([]), demo=ref(false), loading=ref(true), busy=ref(false), error=ref(''), synced=ref('')
  let channel:RealtimeChannel|null=null, generation=0, request=0
  const demoKey='qingji.vue.demo.v1'
  let demoReadOnly=false
  const cachedTasks=z.array(taskFields.extend({id:z.string(),user_id:z.string(),created_at:z.string(),updated_at:z.string(),deleted_at:z.string().nullable()}))
  async function refresh(){
    if(demo.value || busy.value || !user.value || !supabase) return
    const version=generation, id=++request
    const result=await supabase.from('tasks').select('*').eq('user_id',user.value.id).is('deleted_at',null).order('created_at',{ascending:false})
    if(version!==generation || id!==request) return
    if(result.error) { error.value='云端读取失败，请检查网络、数据库配置后重试。'; return }
    tasks.value=result.data as Task[]; synced.value=new Date().toLocaleTimeString(); error.value=''
  }
  async function setUser(next:User|null){
    generation++; request++; if(channel && supabase) void supabase.removeChannel(channel)
    channel=null; user.value=next; tasks.value=[]; synced.value=''; error.value=''
    if(next && supabase){
      demo.value=false
      channel=supabase.channel(`tasks:${next.id}`).on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`user_id=eq.${next.id}`},()=>{void refresh()}).subscribe()
      await refresh()
    }
    loading.value=false
  }
  async function init(){
    if(!supabase){loading.value=false;return}
    supabase.auth.onAuthStateChange((_event, session)=>{setTimeout(()=>{if(user.value?.id !== session?.user?.id) void setUser(session?.user ?? null)},0)})
    const {data,error:e}=await supabase.auth.getSession()
    if(e) error.value='无法恢复登录，请重新登录。'
    await setUser(data.session?.user ?? null)
  }
  function enterDemo(){
    generation++; demo.value=true; user.value=null; loading.value=false; error.value=''
    let cached:string|null=null
    demoReadOnly=false
    try {
      cached=localStorage.getItem(demoKey)
      tasks.value=cachedTasks.parse(JSON.parse(cached||'[]'))
    } catch {
      tasks.value=[];demoReadOnly=true
      error.value='本地演示数据无法读取，已停止写入以保护原数据。请先备份浏览器站点数据，再清理演示数据后重试。'
      return
    }
    if(cached===null) tasks.value=[{...blankTask(),id:crypto.randomUUID(),user_id:'demo',title:'给今天留一点清晰',content:'试试编辑这条任务，或者记录你的第一个想法。',due_date:localDate(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),deleted_at:null}]
  }
  async function save(fields:TaskFields, existing?:Task, deletedAt:string|null=null){
    if(busy.value) throw Error('正在保存，请稍候。')
    if(demo.value && demoReadOnly) throw Error(error.value)
    const validation=taskFields.safeParse(fields)
    if(!validation.success){error.value=validation.error.issues[0]?.message || '请检查任务内容。';throw Error(error.value)}
    const parsed=validation.data
    if(!parsed.due_date){parsed.reminder=false;parsed.due_time=''}
    busy.value=true; request++; error.value=''
    const version=generation
    try{
      let saved:Task
      if(demo.value){
        saved={...parsed,id:existing?.id||crypto.randomUUID(),user_id:'demo',created_at:existing?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),deleted_at:deletedAt}
      }else{
        if(!user.value || !supabase) throw Error('请先登录。')
        const payload={...parsed,deleted_at:deletedAt}
        const query=existing
          ? supabase.from('tasks').update(payload).eq('id',existing.id).eq('user_id',user.value.id).eq('updated_at',existing.updated_at)
          : supabase.from('tasks').insert({...payload,user_id:user.value.id})
        const {data,error:e}=await query.select().single()
        if(e) throw Error(e.code==='PGRST116'?'任务已在其他设备修改，请刷新后重试。':'云端保存失败，当前修改未同步，请重试。')
        saved=data as Task
      }
      if(version!==generation) throw Error('登录状态已改变，请重新操作。')
      const next=tasks.value.filter(t=>t.id!==saved.id)
      if(!saved.deleted_at) next.unshift(saved)
      if(demo.value) localStorage.setItem(demoKey,JSON.stringify(next))
      tasks.value=next; synced.value=new Date().toLocaleTimeString()
      return saved
    }catch(e){error.value=e instanceof Error?e.message:'保存失败';throw e}finally{request++;busy.value=false}
  }
  async function logout(){
    if(supabase && user.value){const {error:e}=await supabase.auth.signOut();if(e) throw Error('退出失败，请重试。')}
    demo.value=false; await setUser(null); sessionStorage.removeItem('qingji.vue.ai-key')
  }
  return {user,tasks,demo,loading,busy,error,synced,init,refresh,enterDemo,save,logout}
})
