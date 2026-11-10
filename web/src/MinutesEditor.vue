<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { emptyMinutes, minutesSchema, minutesTemplate, minutesText, textMinutes, type MinutesNode } from './minutesDocument'
import { organizeMinutes } from './minutes'
import { blankTask, type Task, type TaskFields } from './domain'
const props=defineProps<{task?:Task;owner:string;model:string;endpoint:string;apiKey:string;busy:boolean;error:string;startEditing:boolean}>()
const emit=defineEmits<{save:[TaskFields];close:[]}>()
const viewing=ref(!!props.task && !props.startEditing)
function startEdit(){viewing.value=false;editor.value?.setEditable(true)}
const title=ref(props.task?.title||''), date=ref(props.task?.due_date||''), priority=ref<TaskFields['priority']>(props.task?.priority||'normal'), category=props.task?.category||'meeting'
const notice=ref(''), dirty=ref(false), aiBusy=ref(false), preview=ref<MinutesNode|null>(null), linkOpen=ref(false), linkURL=ref(''), recovered=ref(false)
const draftKey=`qingji.minutes.draft.v1.${props.owner}.${props.task?.id||'new'}`
const availableDraft=ref<{title:string;document:MinutesNode;date:string;priority:TaskFields['priority'];base?:string}|null>(null)
const draftWriter=crypto.randomUUID();let lastDraft:string|null=null,draftDamaged=false
try{lastDraft=localStorage.getItem(draftKey);const raw=JSON.parse(lastDraft||'null');if(raw){if(!(typeof raw.title==='string' && raw.title.length<=200 && minutesSchema.safeParse(raw.document).success && typeof raw.date==='string' && ['high','normal','low'].includes(raw.priority)))throw Error('invalid draft');availableDraft.value=raw}}catch{draftDamaged=true;notice.value='草稿无法读取；原草稿已保留，请及时保存本次编辑。'}
let controller:AbortController|undefined, timer:ReturnType<typeof setTimeout>|undefined, discarded=false
const extensions=()=>[StarterKit.configure({heading:{levels:[1,2,3]},link:false,underline:false,code:false,codeBlock:false,strike:false,horizontalRule:false}),Underline,Link.configure({openOnClick:false,autolink:false,protocols:['https','http','mailto']}),TaskList,TaskItem.configure({nested:false})]
const editor=useEditor({extensions:extensions(),content:props.task?.document||textMinutes(props.task?.content||''),editable:!viewing.value,editorProps:{attributes:{role:'textbox','aria-label':'会议纪要正文','aria-multiline':'true'}},onUpdate(){dirty.value=true;preview.value=null;queueDraft()}})
const previewEditor=useEditor({extensions:extensions(),content:emptyMinutes(),editable:false,editorProps:{attributes:{'aria-label':'整理结果预览'}}})
function writeDraft(){
 if(discarded || draftDamaged || !dirty.value || !editor.value || availableDraft.value)return
 try{if(!minutesSchema.safeParse(editor.value.getJSON()).success){notice.value='内容超出草稿限制，请缩短后保存。';return};const existing=localStorage.getItem(draftKey);if(existing && existing!==lastDraft){notice.value='其他页面的草稿已有更新，已停止覆盖；请保存当前纪要。';return};const serialized=JSON.stringify({writer:draftWriter,title:title.value,document:editor.value.getJSON(),date:date.value,priority:priority.value,base:props.task?.updated_at,updatedAt:new Date().toISOString()});localStorage.setItem(draftKey,serialized);lastDraft=serialized;notice.value='草稿已暂存到当前浏览器'}catch{notice.value='浏览器未允许暂存草稿，请及时保存。'}
}
function queueDraft(){clearTimeout(timer);timer=setTimeout(writeDraft,400)}
watch([title,date,priority],()=>{dirty.value=true;queueDraft()})
function restoreDraft(){const draft=availableDraft.value;if(!draft)return;title.value=draft.title;date.value=draft.date;priority.value=draft.priority;editor.value?.commands.setContent(draft.document);availableDraft.value=null;dirty.value=true;recovered.value=true;notice.value=draft.base && draft.base!==props.task?.updated_at?'已恢复草稿；线上版本已有变化，请核对后保存。':'草稿已恢复';queueDraft()}
function discardDraft(){try{if(localStorage.getItem(draftKey)!==lastDraft){notice.value='其他页面的草稿已有更新，请重新打开后查看。';return};localStorage.removeItem(draftKey);lastDraft=null;availableDraft.value=null;notice.value='旧草稿已移除'}catch{notice.value='草稿无法移除，请检查浏览器存储权限。'}}
function addTemplate(){if(!editor.value?.isEmpty){notice.value='模板仅用于空白纪要，已有正文已保留。';return};editor.value.commands.setContent(minutesTemplate());dirty.value=true;queueDraft()}
function applyLink(){if(!editor.value)return;const url=linkURL.value.trim();if(!/^(https?:\/\/|mailto:)/i.test(url)){notice.value='链接仅支持 http、https 或 mailto 地址。';return};editor.value.chain().focus().extendMarkRange('link').setLink({href:url}).run();linkOpen.value=false;linkURL.value=''}
async function organize(){
 if(!editor.value || aiBusy.value)return
 const text=editor.value.getText();if(!text.trim()){notice.value='先输入会议原文，再进行 AI 整理。';return}
 if(text.length>100000){notice.value='正文最多支持 100000 字符。';return}
 aiBusy.value=true;controller=new AbortController();const snapshot=JSON.stringify(editor.value.getJSON())
 try{const doc=await organizeMinutes({model:props.model,endpoint:props.endpoint},props.apiKey,text,controller.signal);if(JSON.stringify(editor.value.getJSON())!==snapshot){notice.value='整理期间正文有新修改，请重新整理。';return};preview.value=doc;previewEditor.value?.commands.setContent(doc);notice.value='请预览整理结果，确认后替换原文。'}catch(e){if(!controller.signal.aborted)notice.value=e instanceof Error?e.message:'整理失败，原文已保留。'}finally{aiBusy.value=false}
}
function applyPreview(){const doc=preview.value;if(doc){editor.value?.commands.setContent(doc);dirty.value=true;preview.value=null;queueDraft();notice.value='已采用整理结果，请保存纪要。'}}
function save(){
 try{if(availableDraft.value)throw Error('请先恢复或移除旧草稿。');const doc=minutesSchema.parse(editor.value?.getJSON());const text=minutesText(doc);if(!title.value.trim())throw Error('请填写会议标题。');if(text.length>100000)throw Error('正文最多支持 100000 字符。');emit('save',{...(props.task||blankTask()),title:title.value.trim(),record_kind:'meeting_minutes',document:doc,content:text,category,due_date:date.value,priority:priority.value})}catch(e){notice.value=e instanceof Error?e.message:'内容格式无效'}
}
function saved(){discarded=true;try{if(localStorage.getItem(draftKey)===lastDraft)localStorage.removeItem(draftKey)}catch{};dirty.value=false}
defineExpose({saved})
const canSave=computed(()=>!props.busy && !aiBusy.value && !availableDraft.value)
onBeforeUnmount(()=>{controller?.abort();clearTimeout(timer);writeDraft();editor.value?.destroy();previewEditor.value?.destroy()})
</script>
<template>
 <div class="minutes-workspace">
  <header class="minutes-header"><div><p class="eyebrow">MEETING NOTES</p><h2>会议纪要</h2></div><div><a-button v-if="viewing" type="primary" @click="startEdit">编辑纪要</a-button><a-button v-if="!viewing" :disabled="aiBusy || busy" @click="addTemplate">使用纪要模板</a-button><a-button v-if="!viewing" :loading="aiBusy" :disabled="busy" @click="organize">AI 整理</a-button><a-button v-if="!viewing" type="primary" :disabled="!canSave" @click="save">{{ busy?'保存中…':'保存纪要' }}</a-button></div></header>
  <div v-if="availableDraft && !viewing" class="minutes-draft" role="status">发现本机未保存的草稿。<a-button @click="restoreDraft">恢复草稿</a-button><a-button @click="discardDraft">移除旧草稿</a-button></div>
  <div class="minutes-meta"><label>会议标题<input v-model="title" :disabled="viewing" maxlength="200" placeholder="输入会议主题"></label><label>安排日期<input v-model="date" :disabled="viewing" type="date"></label><label>优先级<select v-model="priority" :disabled="viewing"><option value="normal">普通</option><option value="high">重要</option><option value="low">较低</option></select></label></div>
  <div v-if="editor && !viewing" class="minutes-toolbar" role="toolbar" aria-label="纪要格式工具">
   <a-button v-for="level in ([1,2,3] as const)" :key="level" :aria-label="level+'级标题'" :aria-pressed="editor.isActive('heading',{level})" @click="editor.chain().focus().toggleHeading({level}).run()">H{{ level }}</a-button>
   <a-button aria-label="加粗" :aria-pressed="editor.isActive('bold')" @click="editor.chain().focus().toggleBold().run()"><b>B</b></a-button><a-button aria-label="斜体" :aria-pressed="editor.isActive('italic')" @click="editor.chain().focus().toggleItalic().run()"><i>I</i></a-button><a-button aria-label="下划线" :aria-pressed="editor.isActive('underline')" @click="editor.chain().focus().toggleUnderline().run()"><u>U</u></a-button>
   <a-button aria-label="编号列表" :aria-pressed="editor.isActive('orderedList')" @click="editor.chain().focus().toggleOrderedList().run()">1. 列表</a-button><a-button aria-label="无序列表" :aria-pressed="editor.isActive('bulletList')" @click="editor.chain().focus().toggleBulletList().run()">• 列表</a-button><a-button aria-label="勾选清单" :aria-pressed="editor.isActive('taskList')" @click="editor.chain().focus().toggleTaskList().run()">☑ 清单</a-button><a-button aria-label="引用" :aria-pressed="editor.isActive('blockquote')" @click="editor.chain().focus().toggleBlockquote().run()">引用</a-button><a-button aria-label="添加链接" @click="linkOpen=!linkOpen">链接</a-button><a-button aria-label="移除链接" :disabled="!editor.isActive('link')" @click="editor.chain().focus().unsetLink().run()">取消链接</a-button><a-button aria-label="撤销" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()">↶</a-button><a-button aria-label="重做" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()">↷</a-button>
  </div>
  <div v-if="linkOpen" class="minutes-link"><label>链接地址<input v-model="linkURL" type="url" placeholder="https://"></label><a-button @click="applyLink">应用链接</a-button></div>
  <div class="minutes-columns" :class="{'with-preview':preview}"><section class="minutes-page"><EditorContent :editor="editor"/></section><section v-if="preview" class="minutes-preview"><h3>整理结果预览</h3><p>确认前原文保持不变。</p><EditorContent :editor="previewEditor"/><div class="minutes-preview-actions"><a-button type="primary" @click="applyPreview">采用整理结果</a-button><a-button @click="preview=null">保留原文</a-button></div></section></div>
  <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="notice" role="status" class="minutes-notice">{{ notice }}</p><footer class="minutes-footer">{{ editor?.getText().length || 0 }} 字符 · {{ dirty?'尚未保存到任务列表':'已加载' }} · 草稿仅在本机保存</footer>
 </div>
</template>
