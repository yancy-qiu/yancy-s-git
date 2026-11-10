import { z } from 'zod'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User, RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { categories as builtinCategories, categoryId, blankTask, localDate, taskFields, type Task, type TaskFields } from './domain'
export const useTasks=defineStore('tasks',()=>{
  const user=ref<User|null>(null), tasks=ref<Task[]>([]), demo=ref(false), loading=ref(true), busy=ref(false), error=ref(''), synced=ref('')
  const categoryNames=ref<Record<string,string>>({...builtinCategories}), categoryReady=ref(false), categoryBusy=ref(false), categoryError=ref('')
  let categoryVersion=0
  const categoryCache='qingji.vue.demo.categories.v1'
  function validCategoryName(name:string,except=''){
    const value=name.trim()
    if(!value || value.length>20)throw Error('类型名称需为 1–20 个字符。')
    if(Object.entries(categoryNames.value).some(([id,n])=>id!==except && n.toLocaleLowerCase()===value.toLocaleLowerCase()))throw Error('已存在同名类型。')
    return value
  }
  async function refreshCategories(){
    if(demo.value || !user.value || !supabase || categoryBusy.value)return
    const owner=user.value.id, version=categoryVersion
    const {data,error:e}=await supabase.from('task_categories').select('id,name').eq('user_id',owner).order('id')
    if(user.value?.id!==owner || demo.value || version!==categoryVersion)return
    if(e || !data?.length){categoryReady.value=false;categoryError.value='类型管理暂时不可用，请稍后重试。';return}
    categoryNames.value={...builtinCategories,...Object.fromEntries(data.map(c=>[c.id,c.name]))};categoryReady.value=true;categoryError.value=''
  }
  async function changeCategory(name:string,id?:string,remove=false){
    if(categoryBusy.value || busy.value)throw Error('正在保存，请稍候。')
    if(!categoryReady.value)throw Error(categoryError.value || '类型管理尚未就绪。')
    if(remove && (!id || id in builtinCategories))throw Error('基础类型可重命名，不能删除。')
    if(remove && tasks.value.some(t=>t.category===id))throw Error('该类型仍有任务使用，请先将任务改为其他类型。')
    const value=remove?'':validCategoryName(name,id), target=id || `custom_${crypto.randomUUID()}`, owner=user.value?.id, wasDemo=demo.value
    categoryVersion++;categoryBusy.value=true
    try{
      const next={...categoryNames.value}
      if(remove)delete next[target];else next[target]=value
      if(wasDemo){
        const cached=JSON.parse(localStorage.getItem(demoKey)||'[]')
        if(remove && cached.some((t:Task)=>t.category===target))throw Error('该类型仍有任务使用，含已删除记录，请先保留该类型。')
        localStorage.setItem(categoryCache,JSON.stringify(next))
      }else{
        if(!supabase || !owner)throw Error('请先登录。')
        const query=remove?supabase.from('task_categories').delete().eq('user_id',owner).eq('id',target):id?supabase.from('task_categories').update({name:value}).eq('user_id',owner).eq('id',target):supabase.from('task_categories').insert({user_id:owner,id:target,name:value})
        const result=await query.select('id,name').single()
        if(result.error)throw Error(result.error.code==='23503'?'该类型仍有任务使用（含已删除记录），无法删除。':result.error.code==='23505'?'已存在同名类型。':'类型保存失败，请检查网络或数据库配置后重试。')
      }
      if(user.value?.id!==owner || demo.value!==wasDemo)throw Error('登录状态已改变，请重新操作。')
      categoryNames.value=next
      return target
    }finally{categoryBusy.value=false}
  }
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
    channel=null;categoryVersion++;categoryNames.value={...builtinCategories};categoryReady.value=false;categoryError.value=''; user.value=next; tasks.value=[]; synced.value=''; error.value=''
    if(next && supabase){
      demo.value=false
      channel=supabase.channel(`tasks:${next.id}`).on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`user_id=eq.${next.id}`},()=>{void refresh()}).subscribe()
      await Promise.all([refresh(),refreshCategories()])
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
    generation++;categoryVersion++;categoryNames.value={...builtinCategories};categoryReady.value=true;categoryError.value='';try{const c=JSON.parse(localStorage.getItem(categoryCache)||'null');if(c){const parsed=z.record(categoryId,z.string().trim().min(1).max(20)).parse(c);categoryNames.value={...builtinCategories,...parsed}}}catch{categoryReady.value=false;categoryError.value='本机类型配置损坏，已停止修改以保护原数据。'}; demo.value=true; user.value=null; loading.value=false; error.value=''
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
    if(!categoryNames.value[parsed.category])throw Error('任务类型不存在，请重新选择。')
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
  return {categoryNames,categoryReady,categoryBusy,categoryError,refreshCategories,changeCategory,user,tasks,demo,loading,busy,error,synced,init,refresh,enterDemo,save,logout}
})
