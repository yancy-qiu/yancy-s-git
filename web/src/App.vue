<script setup lang="ts">
import { defineAsyncComponent, computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { IconCalendar, IconStar, IconSort, IconSortDescending, IconApps, IconSearch, IconSun, IconSettings, IconThunderbolt, IconCheck, IconClockCircle, IconStarFill, IconArrowUp, IconArrowDown, IconMinus, IconFile, IconUserGroup, IconBulb, IconEdit, IconPlus, IconExpand, IconShrink, IconArchive, IconCalendarClock, IconCheckCircle, IconLaunch, IconRefresh, IconDelete, IconUndo, IconMessage } from '@arco-design/web-vue/es/icon'
const RichInput=defineAsyncComponent(()=>import('./RichInput.vue'))
import {minutesSchema,minutesText,textMinutes,type MinutesNode} from './minutesDocument'
import { useTasks } from './store'
import { supabase, configured } from './supabase'
import { blankTask, localDate, matches, views, endpointURL, taskFields, type Task, type TaskFields, type Filter } from './domain'
import { collaborate, testConnection, type Message } from './ai'
import { defaultFilters, filterTasks } from './taskFilters'
const viewIcons={today:IconSun,inbox:IconArchive,planned:IconCalendarClock,unorganized:IconBulb,all:IconFile,completed:IconCheckCircle}
const store=useTasks()
const categories=computed(()=>store.categoryNames)
const typesOpen=ref(false),typeName=ref(''),typeEditing=ref(''),typeNotice=ref('')
function openTypes(){typeName.value='';typeEditing.value='';typeNotice.value='';filterPopup.value='';typesOpen.value=true}
async function saveType(){try{await store.changeCategory(typeName.value,typeEditing.value||undefined);typeName.value='';typeEditing.value='';typeNotice.value='类型已保存'}catch(e){typeNotice.value=(e as Error).message}}
async function deleteType(id:string){try{if(undo.value?.category===id)throw Error('该类型有待撤销的删除记录，请稍后再试。');await store.changeCategory('',id,true);if(criteria.category===id)criteria.category='all';if(typeEditing.value===id){typeEditing.value='';typeName.value=''};typeNotice.value='类型已删除'}catch(e){typeNotice.value=(e as Error).message}}
const filter=ref<Filter>('today'), today=ref(localDate())
const criteria=reactive(defaultFilters())
const filtersActive=computed(()=>Object.entries(defaultFilters()).some(([k,v])=>k!=='sort' && criteria[k as keyof typeof criteria]!==v))
const filterPopup=ref('')
const filterControls=computed(()=>[
 {field:'date',title:'安排日期',label:'安排日期筛选',icon:IconCalendar,initial:'all',options:[['all','全部日期'],['overdue','已逾期'],['today','今天'],['next7','未来七天（含今天）'],['undated','未安排日期'],['custom','自定义日期']]},
 {field:'importance',title:'重要性',label:'重要性筛选',icon:IconStar,initial:'all',options:[['all','全部重要性'],['important','重要'],['regular','非重要']]},
 {field:'priority',title:'优先级',label:'优先级筛选',icon:IconSort,initial:'all',options:[['all','全部优先级'],['high','高（重要）'],['normal','普通'],['low','较低']]},
 {field:'category',title:'类型',label:'类型筛选',icon:IconApps,initial:'all',options:[['all','全部类型'],...Object.entries(categories.value)]},
 {field:'sort',title:'排序',label:'任务排序',icon:IconSortDescending,initial:'priority',options:[['priority','优先级优先'],['newest','最新创建'],['schedule','安排时间']]},
] as const)
function changeFilter(field:string,value:string){Object.assign(criteria,{[field]:value});filterPopup.value=''}
function filterOptionIcon(field:string,value:string){
  if(value==='all')return IconApps
  if(field==='date')return ({overdue:IconClockCircle,today:IconSun,next7:IconCalendar,undated:IconMinus,custom:IconEdit} as Record<string,typeof IconApps>)[value] || IconCalendar
  if(field==='importance')return value==='important'?IconStarFill:IconStar
  if(field==='priority')return ({high:IconArrowUp,normal:IconMinus,low:IconArrowDown} as Record<string,typeof IconApps>)[value] || IconSort
  if(field==='category')return ({task:IconCheck,meeting:IconUserGroup,progress:IconArrowUp,need:IconBulb} as Record<string,typeof IconApps>)[value] || IconFile
  return value==='priority'?IconSort:value==='newest'?IconClockCircle:IconCalendar
}
const invalidRange=computed(()=>criteria.date==='custom' && !!criteria.from && !!criteria.to && criteria.from>criteria.to)
function resetFilters(){Object.assign(criteria,defaultFilters())}
function focusComposer(){if(richDraft.value)richRef.value?.focus();else document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus({preventScroll:true})}
const expanded=ref(false),richDraft=ref<MinutesNode|null>(null),draftCategory=ref('task'),draftPriority=ref<TaskFields['priority']>('normal'),draftDate=ref(''),longEditingId=ref(''),longEditingStamp=ref(''),richRef=ref<{focus:()=>void}|null>(null)
function selectRecord(task:Task){selectedId.value=task.id}
function richUpdated(doc:MinutesNode,text:string){richDraft.value=doc;input.value=text}
function toggleLong(){
 if(aiBusy.value||store.busy)return
 if(!richDraft.value){richDraft.value=textMinutes(input.value);contextId.value=''}
 expanded.value=!expanded.value;focusComposer()
}
function resetComposer(){richDraft.value=null;expanded.value=false;longEditingId.value='';longEditingStamp.value='';draftCategory.value='task';draftPriority.value='normal';draftDate.value='';input.value='';contextId.value='';messages.value=[];aiError.value='';try{if(localStorage.getItem(composerDraftKey.value)===lastComposerDraft)localStorage.removeItem(composerDraftKey.value);lastComposerDraft=null}catch{}}
let lastComposerDraft:string|null=null,draftStorageDisabled=false
const composerDraftKey=computed(()=>`qingji.composer.draft.v1.${store.user?.id || (store.demo?'demo':'signed-out')}`)
function restoreComposer(){
 try{lastComposerDraft=localStorage.getItem(composerDraftKey.value);const raw=JSON.parse(lastComposerDraft||'null');if(!raw)return;const doc=minutesSchema.safeParse(raw.document);if(!doc.success || typeof raw.category!=='string' || !['high','normal','low'].includes(raw.priority) || typeof raw.date!=='string'){draftStorageDisabled=true;notice.value='未发送内容格式异常，原缓存已保留。';return};richDraft.value=doc.data;input.value=minutesText(doc.data);draftCategory.value=raw.category;draftPriority.value=raw.priority;draftDate.value=raw.date;longEditingId.value=typeof raw.id==='string'?raw.id:'';longEditingStamp.value=typeof raw.stamp==='string'?raw.stamp:'';expanded.value=true;notice.value='已恢复未发送的内容'}catch{draftStorageDisabled=true;notice.value='本机未发送内容无法读取，原缓存已保留。'}
}
watch([richDraft,draftCategory,draftPriority,draftDate],()=>{if(!richDraft.value || draftStorageDisabled || (!store.demo&&!store.user))return;try{if(localStorage.getItem(composerDraftKey.value)!==lastComposerDraft){aiError.value='其他页面已更新未发送内容，本页停止覆盖暂存，请先发送当前内容。';return};const serialized=JSON.stringify({document:richDraft.value,category:draftCategory.value,priority:draftPriority.value,date:draftDate.value,id:longEditingId.value,stamp:longEditingStamp.value});localStorage.setItem(composerDraftKey.value,serialized);lastComposerDraft=serialized}catch{aiError.value='本机暂存失败，请及时保存内容。'}},{deep:true})
async function saveLong(){
 const version=sessionVersion
 try{
  const doc=minutesSchema.parse(richDraft.value),text=minutesText(doc).trim();if(!text)throw Error('先写点内容再发送。')
  const existing=longEditingId.value?store.tasks.find(t=>t.id===longEditingId.value):undefined
  if(longEditingId.value && (!existing || existing.updated_at!==longEditingStamp.value))throw Error('原记录已有变化，请刷新并核对后再保存。当前内容已保留。')
  const fields={...(existing||blankTask()),title:text.split('\n').find(line=>line.trim())!.trim().slice(0,120),content:text,record_kind:'meeting_minutes' as const,document:doc,category:draftCategory.value,priority:draftPriority.value,due_date:draftDate.value}
  const t=await store.save(fields,existing);if(version!==sessionVersion)return;selectedId.value=window.innerWidth<=1050?'':t.id;resetFilters();filter.value=t.completed?'completed':!t.due_date?'inbox':t.due_date>today.value?'planned':'today';resetComposer();notice.value=existing?'记录已更新':'记录已保存'
 }catch(e){aiError.value=e instanceof Error?e.message:'保存失败，内容已保留。'}
}
const detailVisible=ref(true)
const selectedId=ref(''), settingsOpen=ref(false), widgetOpen=ref(false)
const modal=ref<HTMLElement|null>(null)
let previousFocus:HTMLElement|null=null
const email=ref(''), password=ref(''), signup=ref(false), authBusy=ref(false), authNotice=ref(''), notice=ref('')
const input=ref(''), contextId=ref(''), messages=ref<Message[]>([]), aiBusy=ref(false), aiError=ref('')
const key=ref(''), testing=ref(false), connectionNotice=ref('')
const modelPage=ref(false), rememberModel=ref(true)
const modelDraft=reactive({endpoint:'',model:'',key:''})
const modelStorageKey=computed(()=>`qingji.vue.model.v1.${store.user?.id || (store.demo?'demo':'signed-out')}`)
function readSettings(){try{const value=JSON.parse(localStorage.getItem('qingji.vue.preferences')||'{}');return value && typeof value==='object' && !Array.isArray(value)?value:{}}catch{return {}}}
const saved=readSettings(), theme=ref(saved.theme||'system'), privacy=ref(!!saved.privacy)
const endpoint=ref(saved.endpoint||'https://api.openai.com/v1/chat/completions'), model=ref(saved.model||'')
const selected=computed(()=>store.tasks.find(t=>t.id===selectedId.value)), context=computed(()=>store.tasks.find(t=>t.id===contextId.value)||null)
const view=computed(()=>views.find(v=>v.id===filter.value)!)
const visible=computed(()=>filterTasks(store.tasks,filter.value,criteria,today.value))
const active=computed(()=>store.tasks.filter(t=>!t.completed).slice(0,3))
const done=computed(()=>store.tasks.filter(t=>t.completed).length)
const dialogOpen=computed(()=>settingsOpen.value || modelPage.value || typesOpen.value || widgetOpen.value)
const undo=ref<Task|null>(null)
let sessionVersion=0
let undoTimer:ReturnType<typeof setTimeout>|undefined, refreshTimer:ReturnType<typeof setInterval>|undefined, controller:AbortController|undefined
watch([theme,privacy],()=>{try{localStorage.setItem('qingji.vue.preferences',JSON.stringify({theme:theme.value,privacy:privacy.value}))}catch{notice.value='浏览器未允许保存设置。'};applyTheme()})
function loadModel(){
  rememberModel.value=true;key.value='';model.value='';endpoint.value='https://api.openai.com/v1/chat/completions'
  if(!store.user && !store.demo)return
  try{
    const saved=JSON.parse(localStorage.getItem(modelStorageKey.value)||'null')
    if(saved && typeof saved.endpoint==='string' && typeof saved.model==='string' && typeof saved.key==='string'){
      endpointURL(saved.endpoint);endpoint.value=saved.endpoint;model.value=saved.model;key.value=saved.key
    }
  }catch{notice.value='本机模型配置无法读取，请重新配置。'}
}
function openModel(){
  Object.assign(modelDraft,{endpoint:endpoint.value,model:model.value,key:key.value})
  connectionNotice.value='';settingsOpen.value=false;modelPage.value=true
  requestAnimationFrame(()=>modal.value?.querySelector<HTMLElement>('button')?.focus())
}
function saveModel(){
  try{
    const next={endpoint:endpointURL(modelDraft.endpoint.trim()),model:modelDraft.model.trim(),key:modelDraft.key.trim()}
    if(!next.model || !next.key)throw Error('请填写模型名称和 API Key。')
    if(rememberModel.value)localStorage.setItem(modelStorageKey.value,JSON.stringify(next))
    else localStorage.removeItem(modelStorageKey.value)
    endpoint.value=next.endpoint;model.value=next.model;key.value=next.key
    sessionStorage.removeItem('qingji.vue.ai-key')
    modelDraft.key='';modelPage.value=false;notice.value=rememberModel.value?'模型配置已记住，下次打开可继续使用':'模型配置已保存，仅本次打开使用'
  }catch(e){connectionNotice.value=e instanceof Error?e.message:'配置保存失败，请检查浏览器存储权限。'}
}
function clearModelKey(){
  try{localStorage.removeItem(modelStorageKey.value);sessionStorage.removeItem('qingji.vue.ai-key');key.value='';modelDraft.key='';connectionNotice.value='已清除本机保存的模型配置。'}
  catch{connectionNotice.value='清除失败，请检查浏览器存储权限。'}
}

const media=window.matchMedia('(prefers-color-scheme: dark)')
function applyTheme(){const next=theme.value==='system'?(media.matches?'dark':'light'):theme.value;document.documentElement.dataset.theme=next;next==='dark'?document.body.setAttribute('arco-theme','dark'):document.body.removeAttribute('arco-theme')}
watch(contextId,()=>{messages.value=[];aiError.value=''})
watch(dialogOpen,async (open)=>{
  if(open){previousFocus=document.activeElement as HTMLElement;setTimeout(()=>modal.value?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(),0)}
  else previousFocus?.focus()
})
function clearSessionState(){
  lastComposerDraft=null;draftStorageDisabled=false;sessionVersion++;controller?.abort();controller=undefined;aiBusy.value=false
  selectedId.value='';detailVisible.value=true;contextId.value='';messages.value=[];input.value='';richDraft.value=null;expanded.value=false;longEditingId.value='';longEditingStamp.value='';draftCategory.value='task';draftPriority.value='normal';draftDate.value='';input.value=''
  cancelDetailEdit();settingsOpen.value=false;typesOpen.value=false;modelPage.value=false;modelDraft.key='';widgetOpen.value=false;undo.value=null;clearTimeout(undoTimer);key.value='';aiError.value='';notice.value='';resetFilters()
}
watch(modelStorageKey,()=>{clearSessionState();loadModel();restoreComposer()})
async function authenticate(){
  if(!supabase || authBusy.value)return
  authBusy.value=true;authNotice.value=''
  try{
    const {data,error}=signup.value?await supabase.auth.signUp({email:email.value,password:password.value,options:{emailRedirectTo:location.origin}}):await supabase.auth.signInWithPassword({email:email.value,password:password.value})
    if(error) throw Error(signup.value?'注册失败，请检查邮箱、密码或稍后重试。':'登录失败，请检查邮箱和密码。')
    if(signup.value && !data.session) authNotice.value='注册已提交，请检查邮箱并点击确认链接，然后登录。'
    password.value=''
  }catch(e){authNotice.value=e instanceof Error?e.message:'登录失败'}finally{authBusy.value=false}
}
const detailDraft=ref<{id:string;stamp:string;document:MinutesNode;category:string;priority:TaskFields['priority'];date:string}|null>(null)
const detailError=ref('')
function openEditor(task?:Task){
 if(store.busy||aiBusy.value)return
 if(!task){focusComposer();return}
 if(detailDraft.value && detailDraft.value.id!==task.id){notice.value='请先保存或取消另一条记录的编辑。';selectedId.value=detailDraft.value.id;return}
 detailError.value=''
 detailDraft.value ||= {id:task.id,stamp:task.updated_at,document:task.document || textMinutes([task.title,task.content].filter(Boolean).join('\n')),category:task.category,priority:task.priority,date:task.due_date}
}
function cancelDetailEdit(){detailDraft.value=null;detailError.value=''}
async function saveDetail(){
 const draft=detailDraft.value,version=sessionVersion
 if(!draft || store.busy)return
 detailError.value=''
 try{
  const existing=store.tasks.find(t=>t.id===draft.id)
  if(!existing || existing.updated_at!==draft.stamp)throw Error('原记录已有变化，请核对后再保存。编辑内容已保留。')
  const doc=minutesSchema.parse(draft.document),text=minutesText(doc).trim()
  if(!text)throw Error('请填写记录内容。')
  await store.save({...existing,title:text.split('\n').find(line=>line.trim())!.trim().slice(0,120),content:text,record_kind:'meeting_minutes',document:doc,category:draft.category,priority:draft.priority,due_date:draft.date},existing)
  if(version!==sessionVersion)return
  cancelDetailEdit();notice.value='记录已更新'
 }catch(e){if(version===sessionVersion)detailError.value=e instanceof Error?e.message:'保存失败，编辑内容已保留。'}
}

async function toggle(task:Task){try{await store.save({...task,completed:!task.completed},task);notice.value=task.completed?'已恢复':'完成得很好，继续轻松前行。'}catch{}}
async function postpone(task:Task){const date=new Date();date.setDate(date.getDate()+1);try{await store.save({...task,due_date:localDate(date)},task);notice.value='已延后到明天'}catch{}}
async function remove(task:Task){try{undo.value=await store.save(task,task,new Date().toISOString());selectedId.value='';clearTimeout(undoTimer);undoTimer=setTimeout(()=>undo.value=null,6000);notice.value='记录已删除'}catch{}}
async function restore(){if(!undo.value)return;try{await store.save(undo.value,undo.value);undo.value=null;notice.value='已撤销删除'}catch{}}
function closeDetails(){selectedId.value='';detailVisible.value=false}
watch(selectedId,id=>{if(id)detailVisible.value=true})
function reference(task:Task){if(richDraft.value && input.value.trim()){aiError.value='请先保存当前内容，再引用任务。';focusComposer();return};contextId.value=task.id;if(window.innerWidth<=1050)selectedId.value='';focusComposer()}
async function send(){
  if(!input.value.trim()||aiBusy.value||store.busy)return
  if(richDraft.value){await saveLong();return}
  if(!key.value||!model.value){openModel();aiError.value='请先配置模型和 API Key，输入内容已保留。';return}
  const text=input.value.trim(), original=context.value, owner=store.user?.id, wasDemo=store.demo, version=sessionVersion
  messages.value.push({role:'user',content:text});input.value='';aiBusy.value=true;aiError.value='';controller=new AbortController()
  try{
    const result=await collaborate({endpoint:endpoint.value,model:model.value},key.value,messages.value,original,controller.signal,categories.value)
    if(version!==sessionVersion||store.user?.id!==owner||store.demo!==wasDemo)throw Error('登录状态已改变，本次结果已取消。')
    if(result.fields){if(result.action==='create')resetFilters();const t=await store.save(result.fields,result.action==='update'?original??undefined:undefined);selectedId.value=window.innerWidth<=1050?'':t.id;filter.value=t.completed?'completed':!t.due_date?'inbox':t.due_date>today.value?'planned':'today';messages.value=[];contextId.value='';notice.value='记录已保存，本轮对话已清空'}
    else messages.value.push({role:'assistant',content:result.reply})
  }catch(e){if(version!==sessionVersion)return;input.value=text;messages.value.pop();aiError.value=e instanceof DOMException&&e.name==='TimeoutError'?'模型请求超时，原任务未改变。':e instanceof Error?e.message:'请求失败，原任务未改变。'}finally{if(version===sessionVersion){aiBusy.value=false;controller=undefined}}
}
async function checkConnection(){
  testing.value=true;connectionNotice.value=''
  try{await testConnection({endpoint:modelDraft.endpoint,model:modelDraft.model},modelDraft.key);connectionNotice.value='连接成功，模型已响应。'}catch(e){connectionNotice.value=e instanceof Error?e.message:'连接失败'}finally{testing.value=false}
}
function validateSettings(){settingsOpen.value=false;notice.value='设置已保存'}
async function logout(){try{controller?.abort();await store.logout();clearSessionState()}catch(e){notice.value=(e as Error).message}}
function closeDialog(){if(store.busy)return;cancelDetailEdit();settingsOpen.value=false;typesOpen.value=false;modelPage.value=false;modelDraft.key='';widgetOpen.value=false}
function shortcuts(e:KeyboardEvent){
  if(e.key==='Escape')closeDialog()
  if(dialogOpen.value && e.key==='Tab'){
    const items=Array.from(modal.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]')||[])
    if(!items.length)return
    if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus()}
    else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus()}
  }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='n'){e.preventDefault();focusComposer()}
}
function onFocus(){today.value=localDate();if(document.visibilityState==='visible'){void store.refresh();void store.refreshCategories()}}
onMounted(()=>{void store.init();applyTheme();media.addEventListener('change',applyTheme);window.addEventListener('keydown',shortcuts);document.addEventListener('visibilitychange',onFocus);window.addEventListener('online',onFocus);refreshTimer=setInterval(onFocus,30000)})
onUnmounted(()=>{controller?.abort();clearInterval(refreshTimer);clearTimeout(undoTimer);media.removeEventListener('change',applyTheme);window.removeEventListener('keydown',shortcuts);document.removeEventListener('visibilitychange',onFocus);window.removeEventListener('online',onFocus)})
</script>

<template>
  <div v-if="store.loading" class="loading" role="status">✳ 正在打开轻记…</div>
  <main v-else-if="!store.user && !store.demo" class="welcome">
    <section class="welcome-story"><a href="#" class="brand">✳ <em>轻记</em><span>QINGJI</span></a><div><p class="eyebrow">LESS FRICTION. MORE FOCUS.</p><h1>把事情记下，<br>把轻松留下。</h1><p>从一个想法到下一步行动。<br>让 AI 帮你理清安排，让每一天更轻。</p><div class="welcome-note"><span>✓</span> 自然语言记录 <span>✓</span> 多设备同步 <span>✓</span> 自带 AI</div></div><small>记录更快，工作更轻。</small></section>
    <section class="login-panel"><div class="login-card"><p class="eyebrow">YOUR SPACE TO THINK</p><h2>{{ signup?'开始轻记':'欢迎回来' }}</h2><p>给想法一个去处，给今天一点秩序。</p>
      <form v-if="configured" @submit.prevent="authenticate"><label>邮箱<input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label>密码<input v-model="password" type="password" :autocomplete="signup?'new-password':'current-password'" minlength="8" maxlength="72" required placeholder="至少 8 位"></label><a-button html-type="submit" type="primary" class="primary" :disabled="authBusy">{{ authBusy?'请稍候…':signup?'创建账号':'登录轻记' }}</a-button><a-button html-type="button" class="text-button" @click="signup=!signup;authNotice=''">{{ signup?'已有账号？返回登录':'第一次来？创建账号' }}</a-button></form>
      <div v-else class="setup-notice"><strong>云端空间尚未连接</strong><p>配置 Supabase 后即可注册、登录并同步任务。现在可以先体验完整界面。</p></div>
      <p v-if="authNotice || store.error" role="status" class="error">{{ authNotice || store.error }}</p><a-button html-type="submit" class="demo-button" @click="store.enterDemo()">先体验演示版 <span>↗</span></a-button><small>演示数据仅保存在此浏览器，不会上传云端。</small>
    </div></section>
  </main>
  <div v-else class="app-shell" :class="{'detail-open': selected,'details-hidden':!detailVisible,'long-expanded':expanded}" :inert="dialogOpen || undefined">
    <aside class="sidebar"><a class="brand" href="#" @click.prevent="filter='today'"><span class="brand-icon"><IconSun /></span><em>轻记</em><span>QINGJI</span></a><p class="sidebar-caption">你的日常，轻一点</p><nav aria-label="任务视图"><a-button html-type="submit" v-for="v in views" :key="v.id" :class="{active:filter===v.id}" :aria-current="filter===v.id?'page':undefined" @click="filter=v.id"><span class="nav-icon"><component :is="viewIcons[v.id]" :size="16" :stroke-width="1.8" aria-hidden="true"/></span>{{ v.name }}<span class="count">{{ store.tasks.filter(t=>matches(t,v.id,today)).length }}</span></a-button></nav><div class="type-navigation"><div class="type-section-heading"><p class="sidebar-section-title">记录类型</p><a-button class="type-manage-icon" aria-label="管理任务类型" title="新增或编辑任务类型" @click="openTypes"><IconPlus :size="15"/></a-button></div><a-button html-type="submit" :class="{active:criteria.category==='all'}" @click="criteria.category='all'"><IconApps class="type-icon" :size="16" :stroke-width="1.8" aria-hidden="true"/>全部类型</a-button><a-button html-type="submit" v-for="(name,id) in categories" :key="id" :class="{active:criteria.category===id}" @click="criteria.category=id"><IconFile class="type-icon" :size="16" :stroke-width="1.8" aria-hidden="true"/>{{ name }}</a-button></div><div class="sidebar-bottom"><a-button html-type="submit" class="widget-launch" @click="widgetOpen=true"><IconApps :size="16" :stroke-width="1.8"/><span>小组件预览</span><IconLaunch class="widget-arrow" :size="14"/></a-button><div class="sync-note"><span class="status-dot" :class="{demo:store.demo}"></span>{{ store.demo?'演示模式 · 仅本机':store.error?'同步遇到问题':'云端空间' }}<a-button html-type="submit" v-if="!store.demo" class="text-button" @click="store.refresh()" aria-label="刷新任务"><IconRefresh :size="14"/></a-button></div><small v-if="store.synced && !store.demo">上次同步 {{ store.synced }}</small></div></aside>
    <div class="workspace"><header class="topbar"><span class="breadcrumb">我的空间 <span>/</span> {{ view.name }}</span><div class="top-actions"><span class="account">{{ store.demo?'演示体验':store.user?.email }}</span><a-button html-type="submit" class="icon-button mobile-widget" aria-label="小组件预览" @click="widgetOpen=true"><IconApps :size="16"/></a-button><a-button html-type="submit" class="icon-button" aria-label="设置" @click="settingsOpen=true"><IconSettings /></a-button><a-button html-type="submit" class="text-button" @click="logout">{{ store.demo?'退出演示':'退出登录' }}</a-button></div></header>
      <nav class="mobile-nav" aria-label="移动端任务视图"><a-button html-type="submit" v-for="v in views" :key="v.id" :class="{active:filter===v.id}" @click="filter=v.id">{{ v.name }}</a-button></nav>
      <div v-if="store.demo" class="demo-banner">你正在体验演示空间，记录仅保存在当前浏览器。<a-button html-type="submit" class="text-button" @click="logout">{{ configured?'前往登录':'连接云端后即可同步' }} ↗</a-button></div>
      <div class="page-content"><div class="heading-row"><div><p class="eyebrow">{{ new Date(`${today}T12:00:00`).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}) }}</p><h1>{{ filter==='today'?'今天，轻装上阵。':view.name }}</h1><p>{{ view.description }}</p></div><a-tag class="workspace-label" color="arcoblue">给今天一点好心情 ☀</a-tag></div>
      <div class="content-layout"><div class="main-column">
        <section class="records-section"><div class="records-header"><h2>{{ view.name }}的记录 <span>{{ visible.length }}</span></h2></div>
          <div class="filter-toolbar" aria-label="任务筛选">
            <a-popover v-for="control in filterControls" :key="control.field" trigger="click" position="bl" :popup-visible="filterPopup===control.field" @popup-visible-change="filterPopup=$event?control.field:''" :title="control.title">
              <a-tooltip :content="control.title+' · '+control.options.find(option=>option[0]===criteria[control.field])?.[1]">
                <a-button class="filter-icon" :class="{'filter-active':criteria[control.field]!==control.initial}" :aria-label="'筛选'+control.title" :aria-expanded="filterPopup===control.field" :title="control.title" shape="round"><component :is="control.icon" :size="18"/><span v-if="criteria[control.field]!==control.initial" class="filter-dot"></span></a-button>
              </a-tooltip>
              <template #content><div class="filter-options" role="group" :aria-label="control.label">
                <a-button v-for="option in control.options" :key="option[0]" class="filter-option" :class="{'option-selected':criteria[control.field]===option[0]}" :aria-pressed="criteria[control.field]===option[0]" @click="changeFilter(control.field,option[0])">
                  <component :is="filterOptionIcon(control.field,option[0])" :size="17" aria-hidden="true"/><span>{{ option[1] }}</span><IconCheck v-if="criteria[control.field]===option[0]" class="option-check" aria-hidden="true"/>
                </a-button>
              <a-button v-if="control.field==='category'" class="text-button manage-types-link" @click="openTypes"><IconEdit/>管理类型</a-button></div></template>
            </a-popover>
            <label class="search"><span class="sr-only">搜索记录</span><a-input v-model="criteria.search" placeholder="搜索记录…" allow-clear :input-attrs="{'aria-label':'搜索记录'}"><template #prefix><IconSearch /></template></a-input></label>
          </div>
          <div v-if="criteria.date==='custom'" class="date-range"><label>开始日期<input v-model="criteria.from" type="date" min="1900-01-01" max="9999-12-31"></label><span>至</span><label>结束日期<input v-model="criteria.to" type="date" min="1900-01-01" max="9999-12-31"></label></div>
          <p v-if="invalidRange" role="alert" class="error">结束日期不能早于开始日期。</p>
          <div v-if="filtersActive" class="filter-summary"><span>已筛选 {{ visible.length }} 条记录 · 仅筛选当前分类</span><a-button html-type="submit" class="text-button" @click="resetFilters">清除筛选</a-button></div>
          <p v-if="store.error && store.error!==aiError" class="error" role="alert">{{ store.error }} <a-button html-type="submit" class="text-button" @click="store.refresh()">重新同步</a-button></p>
          <div v-if="!visible.length" class="empty-state"><span>✧</span><h3>{{ filtersActive?'没有匹配的记录':'给这一天，留一点空白' }}</h3><p>{{ filtersActive?'试试调整筛选条件，或清除筛选查看当前分类。':'还没有相关记录。记下一件小事，就有了开始。' }}</p><a-button html-type="submit" v-if="filtersActive" class="text-button" @click="resetFilters">清除全部筛选</a-button><a-button html-type="submit" v-else class="text-button" @click="openEditor()">＋ 添加第一条记录</a-button></div>
          <div v-if="visible.length" class="record-grid"><table class="task-table"><caption class="sr-only">任务列表，按所选排序显示</caption><thead><tr><th scope="col"><span class="sr-only">完成状态</span></th><th scope="col">任务</th><th scope="col">类型</th><th scope="col">优先级</th><th scope="col">安排</th><th scope="col"><span class="sr-only">协作</span></th></tr></thead>
            <tbody><tr v-for="t in visible" :key="t.id" class="record-card" :class="{completed:t.completed,selected:selectedId===t.id}" @click="selectRecord(t)">
              <td><a-button html-type="submit" class="check" :class="{checked:t.completed}" :aria-label="(t.completed?'恢复：':'完成：')+t.title" :disabled="store.busy" @click.stop="toggle(t)">{{ t.completed?'✓':'' }}</a-button></td>
              <td class="task-title-cell"><a-button html-type="submit" class="record-body" :title="t.title" :aria-label="'查看：'+t.title" :aria-pressed="selectedId===t.id" @click="selectRecord(t)"><h3>{{ t.title }}</h3></a-button></td>
              <td><span class="category" :class="t.category">{{ categories[t.category] || '未命名类型' }}</span></td>
              <td><span class="priority-label" :class="t.priority">{{ {high:'重要 · 高',normal:'普通',low:'较低'}[t.priority] }}</span></td>
              <td class="task-schedule" :class="{overdue:!!t.due_date && t.due_date<today && !t.completed}">{{ t.due_date || '未安排' }} {{ t.due_time }}</td>
              <td><a-button html-type="submit" class="row-reference" :disabled="aiBusy" :aria-label="'引用：'+t.title" @click.stop="reference(t)">✦</a-button></td>
            </tr></tbody></table></div>
        </section>
<footer class="page-footer"><span>一步一步，也是在向前。</span><span>{{ done }} 条已完成 · {{ store.tasks.length }} 条记录</span></footer>
      </div><aside v-if="selected" class="detail-panel" aria-label="记录详情"><div class="detail-top"><span>记录详情</span><a-button html-type="submit" class="icon-button" @click="closeDetails" aria-label="关闭详情">×</a-button></div><div class="detail-category-row"><span class="category" :title="categories[selected.category] || '未命名类型'">{{ categories[selected.category] || '未命名类型' }}</span><div v-if="detailDraft?.id!==selected.id" class="detail-actions" role="group" aria-label="记录操作">
 <a-tooltip content="与 AI 协作"><a-button html-type="button" type="text" class="detail-action" :disabled="aiBusy" aria-label="与 AI 协作" @click="reference(selected)"><IconMessage :size="18" :stroke-width="1.8"/></a-button></a-tooltip>
 <a-tooltip content="编辑记录"><a-button html-type="button" type="text" class="detail-action" aria-label="编辑记录" @click="openEditor(selected)"><IconEdit :size="18" :stroke-width="1.8"/></a-button></a-tooltip>
 <a-tooltip :content="selected.completed?'恢复记录':'标记完成'"><a-button html-type="button" type="text" class="detail-action" :disabled="store.busy" :aria-label="selected.completed?'恢复记录':'标记完成'" @click="toggle(selected)"><IconUndo v-if="selected.completed" :size="18" :stroke-width="1.8"/><IconCheck v-else :size="18" :stroke-width="1.8"/></a-button></a-tooltip>
 <a-tooltip content="延后到明天"><a-button html-type="button" type="text" class="detail-action" :disabled="store.busy" aria-label="延后到明天" @click="postpone(selected)"><IconClockCircle :size="18" :stroke-width="1.8"/></a-button></a-tooltip>
 <a-tooltip content="删除记录"><a-button html-type="button" type="text" class="detail-action danger" :disabled="store.busy" aria-label="删除记录" @click="remove(selected)"><IconDelete :size="18" :stroke-width="1.8"/></a-button></a-tooltip>
</div></div><form v-if="detailDraft?.id===selected.id" class="detail-editor" aria-label="编辑记录" @submit.prevent="saveDetail">
 <div class="detail-edit-options"><label>类型<select v-model="detailDraft.category" :disabled="store.busy" aria-label="编辑类型"><option v-for="(name,id) in categories" :key="id" :value="id">{{ name }}</option></select></label><label>优先级<select v-model="detailDraft.priority" :disabled="store.busy" aria-label="编辑优先级"><option value="normal">普通</option><option value="high">重要</option><option value="low">较低</option></select></label><label>日期<input v-model="detailDraft.date" type="date" :disabled="store.busy" aria-label="编辑日期"></label></div>
 <RichInput :document="detailDraft.document" expanded :disabled="store.busy" @update="doc=>{if(detailDraft)detailDraft.document=doc}" @send="saveDetail"/>
 <p v-if="detailError" role="alert" class="error">{{ detailError }}</p>
 <div class="detail-edit-footer"><a-button html-type="button" :disabled="store.busy" @click="cancelDetailEdit">取消</a-button><a-button html-type="submit" type="primary" :disabled="store.busy">{{ store.busy?'保存中…':'保存修改' }}</a-button></div>
 </form><template v-else><h2 v-if="!selected.document">{{ selected.title }}</h2><RichInput v-if="selected.document" :document="selected.document" readonly/><p v-else class="detail-content">{{ selected.content }}</p><dl><dt>安排</dt><dd>{{ selected.due_date || '尚未安排' }} {{ selected.due_time }}</dd><dt>优先级</dt><dd>{{ {high:'重要',normal:'普通',low:'较低'}[selected.priority] }}</dd><dt>提醒设置</dt><dd>{{ selected.reminder?'已标记提醒':'未设置' }}（暂不触发通知）</dd></dl><section v-if="selected.summary"><h3>✦ 整理摘要</h3><p>{{ selected.summary }}</p></section><ol v-if="selected.action_items.length"><li v-for="(item,i) in selected.action_items" :key="i">{{ item }}</li></ol></template></aside><aside v-else-if="detailVisible" class="detail-panel detail-placeholder" aria-label="记录详情"><div class="detail-top"><span>记录详情</span><a-button class="icon-button" @click="closeDetails" aria-label="关闭详情">×</a-button></div><div><span class="detail-placeholder-icon"><IconCheck /></span><h2>选择一条任务</h2><p>点击左侧任务列表，随时查看安排、内容和下一步行动。</p></div></aside></div>
      </div>
    </div>
    <section class="copilot compact-composer" :class="{'composer-expanded':expanded}" aria-label="AI 任务对话">
      <div v-if="messages.length" class="messages" aria-live="polite"><div v-for="(m,i) in messages" :key="i" :class="m.role"><span>{{ m.role==='user'?'你':'轻记' }}</span><p>{{ m.content }}</p></div></div>
      <div v-if="context" class="context-tag"><span>引用：{{ context.title }}</span><a-button html-type="button" :disabled="aiBusy" @click="contextId=''" aria-label="取消引用任务">×</a-button></div>
      <div v-if="expanded" class="composer-options"><label>类型<select v-model="draftCategory" :disabled="store.busy" aria-label="记录类型"><option v-for="(name,id) in categories" :key="id" :value="id">{{name}}</option></select></label><label>优先级<select v-model="draftPriority" :disabled="store.busy" aria-label="记录优先级"><option value="normal">普通</option><option value="high">重要</option><option value="low">较低</option></select></label><label>日期<input v-model="draftDate" :disabled="store.busy" type="date" aria-label="记录日期"></label><span v-if="longEditingId">编辑记录</span></div>
      <form @submit.prevent="send"><RichInput v-if="richDraft" ref="richRef" :document="richDraft" :expanded="expanded" :disabled="store.busy" @update="richUpdated" @send="send"/><label class="sr-only" for="chat-input">给 AI 发送消息</label><textarea v-if="!richDraft" id="chat-input" v-model="input" :disabled="aiBusy" :placeholder="context?'告诉 AI，你想怎样调整这条任务…':'记录任务，或让 AI 帮你理清下一步…'" maxlength="12000" @keydown.meta.enter.prevent="send" @keydown.ctrl.enter.prevent="send"></textarea>
        <div class="composer-footer"><a-button html-type="button" class="expand-composer" :aria-label="expanded?'收起长文本':'展开长文本'" :title="expanded?'收起':'长文本'" @click="toggleLong"><IconShrink v-if="expanded"/><IconExpand v-else/></a-button><div class="composer-send"><a-button html-type="button" class="composer-model" :title="model || '配置你的模型'" @click="openModel"><IconThunderbolt :size="14"/><span>{{ model || '配置模型' }}</span></a-button><span v-if="aiBusy" class="composer-status" role="status">正在处理…</span><a-tooltip content="发送 · ⌘ / Ctrl + Enter"><a-button html-type="submit" type="primary" class="primary send-icon" :disabled="aiBusy || store.busy || !input.trim()" :aria-label="aiBusy?'正在发送':'发送'" :title="richDraft?'保存记录 · ⌘ / Ctrl + Enter':'⌘ / Ctrl + Enter 发送'"><IconArrowUp :size="19"/></a-button></a-tooltip></div></div>
      </form><p v-if="aiError" class="error" role="alert">{{ aiError }}</p>
    </section>
  </div>
  <div v-if="dialogOpen" :class="{'model-config-backdrop':modelPage}" class="modal-backdrop" @click.self="closeDialog"><section ref="modal" class="modal"  role="dialog" aria-modal="true" :aria-label="settingsOpen?'设置':modelPage?'模型配置':typesOpen?'管理任务类型':'小组件预览'"><a-button html-type="submit" class="modal-close icon-button" @click="closeDialog" aria-label="关闭弹窗">×</a-button>
    <form v-if="settingsOpen" @submit.prevent="validateSettings"><p class="eyebrow">MAKE IT YOURS</p><h2>你的轻记，你来定义</h2><label>外观<select v-model="theme" aria-label="外观"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><label class="checkbox"><input v-model="privacy" type="checkbox">小组件预览隐藏任务标题</label><hr><h3>模型配置</h3><p class="muted">在独立界面管理模型服务与密钥。</p><a-button html-type="button" class="full" @click="openModel">模型配置 →</a-button><a-button html-type="submit" type="primary" class="primary full">保存设置</a-button></form>
    <form v-else-if="modelPage" @submit.prevent="saveModel" autocomplete="off">
      <a-button html-type="button" class="text-button" @click="closeDialog();settingsOpen=true">← 返回设置</a-button>
      <p class="eyebrow">YOUR MODEL, YOUR CONTROL</p><h2>模型配置</h2>
      <p class="muted">使用 OpenAI 兼容服务。发送消息时，对话和引用任务会发送到此接口。</p>
      <label>HTTPS 接口地址<input v-model="modelDraft.endpoint" type="url" required></label>
      <label>模型名称<input v-model="modelDraft.model" required placeholder="填写供应商提供的模型 ID"></label>
      <label>API Key<input v-model="modelDraft.key" type="password" autocomplete="new-password" required placeholder="你的 API Key"></label>
      <label class="checkbox"><input v-model="rememberModel" type="checkbox">在此浏览器记住配置</label>
      <p class="muted">仅在本机按账号保存，不同步到云端。共享设备请取消勾选；可随时清除。浏览器站点数据可能被同源脚本或设备使用者读取。</p>
      <div class="connection-actions"><a-button html-type="button" :disabled="testing" @click="checkConnection">{{ testing?'测试中…':'测试连接' }}</a-button><a-button html-type="button" class="text-button" @click="clearModelKey">清除保存的配置</a-button></div>
      <p v-if="connectionNotice" class="muted" role="status">{{ connectionNotice }}</p>
      <p class="muted">服务需要允许浏览器跨域请求。</p><a-button html-type="submit" type="primary" class="primary full">保存模型配置</a-button>
    </form>
    <div v-else-if="typesOpen" class="type-manager"><p class="eyebrow">MAKE IT YOURS</p><h2>管理任务类型</h2><p class="muted">新增专属类型，或修改现有名称。基础类型保留；使用中的类型不能删除。</p>
      <p v-if="store.categoryError" class="error" role="alert">{{ store.categoryError }}<a-button class="text-button" @click="store.refreshCategories">重试</a-button></p>
      <form @submit.prevent="saveType"><label>类型名称<input v-model="typeName" maxlength="20" required placeholder="例如：学习、生活、客户跟进"></label><div class="type-form-actions"><a-button html-type="submit" type="primary" :disabled="!store.categoryReady || store.categoryBusy">{{ typeEditing?'保存名称':'添加类型' }}</a-button><a-button v-if="typeEditing" @click="typeEditing='';typeName=''">取消编辑</a-button></div></form>
      <p v-if="typeNotice" role="status" class="muted">{{ typeNotice }}</p>
      <div class="type-manager-list"><div v-for="(name,id) in categories" :key="id" class="type-manager-row"><span>{{ name }}</span><small v-if="['task','meeting','progress','need'].includes(id)">基础类型</small><a-button :aria-label="'编辑类型：'+name" :disabled="store.categoryBusy || !store.categoryReady" @click="typeEditing=id;typeName=name;typeNotice=''">编辑</a-button><a-button v-if="!['task','meeting','progress','need'].includes(id)" class="danger" :aria-label="'删除类型：'+name" :disabled="store.categoryBusy || !store.categoryReady" @click="deleteType(id)">删除</a-button></div></div>
      <p class="muted">{{ store.demo?'演示模式：类型仅保存在当前浏览器。':'类型按账号保存在云端，可在其他设备恢复。' }}</p>
    </div>
    <div v-else><p class="eyebrow">A LITTLE SPACE FOR FOCUS</p><h2>小组件预览</h2><p class="muted">站内交互预览，不是系统桌面组件。</p><div class="widget"><div class="widget-heading"><em>轻记</em><span>{{ today }}</span></div><h3>今天，做一点就好。</h3><div v-for="t in active" :key="t.id" class="widget-record"><a-button html-type="submit" class="check" :disabled="store.busy" :aria-label="'小组件完成：'+t.title" @click.stop="toggle(t)"></a-button><a-button html-type="submit" @click="selectedId=t.id;widgetOpen=false">{{ privacy?'私密记录':t.title }}</a-button></div><p v-if="!active.length">都完成了，好好享受这份轻松。</p></div></div>
  </section></div>
  <div v-if="notice || undo" class="toast" role="status"><span>{{ undo?'记录已删除':notice }}</span><a-button html-type="submit" v-if="undo" :disabled="store.busy" @click="restore">撤销</a-button><a-button html-type="submit" v-else @click="notice=''" aria-label="关闭提示">×</a-button></div>
</template>
