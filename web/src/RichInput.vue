<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {EditorContent,useEditor} from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import FormatIcon from './FormatIcon.vue'
import {isolateSelectedBlocks} from './selectionBlocks'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {type MinutesNode,emptyMinutes} from './minutesDocument'
const props=defineProps<{document:MinutesNode;expanded?:boolean;readonly?:boolean;disabled?:boolean;mentions?:boolean}>()
const emit=defineEmits<{update:[MinutesNode,string];send:[];mention:[{query:string;from:number;to:number}|null]}>()
function detectMention(){
 if(!props.mentions || !editor.value)return
 const {selection}=editor.value.state
 const match=selection.empty?selection.$from.parent.textBetween(0,selection.$from.parentOffset,'\n').match(/(?:^|\s)@([^@\s]*)$/):null
 emit('mention',match?{query:match[1],from:selection.from-match[1].length-1,to:selection.from}:null)
}
const editor=useEditor({extensions:[StarterKit.configure({heading:{levels:[1,2,3]},link:false,underline:false,code:false,codeBlock:false,strike:false,horizontalRule:false}),Highlight,Underline,Link.configure({openOnClick:false,autolink:false}),TaskList,TaskItem.configure({nested:false})],content:props.document||emptyMinutes(),editable:!props.readonly&&!props.disabled,editorProps:{attributes:{role:props.readonly?'article':'textbox','aria-label':props.readonly?'记录正文':'长文本内容','aria-multiline':'true','data-placeholder':'写点内容…'},handleKeyDown(_view,e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!props.readonly){emit('send');return true}return false}},onSelectionUpdate(){detectMention()},onUpdate({editor}){emit('update',editor.getJSON() as MinutesNode,editor.getText());detectMention()}})
watch(()=>props.document,doc=>{if(editor.value && JSON.stringify(editor.value.getJSON())!==JSON.stringify(doc))editor.value.commands.setContent(doc,{emitUpdate:false})},{deep:true})
watch(()=>props.disabled,()=>editor.value?.setEditable(!props.readonly&&!props.disabled))
function focus(){editor.value?.view.dom.focus()}
function removeMention(from:number,to:number){editor.value?.chain().focus().deleteRange({from,to}).run()}
defineExpose({focus,removeMention})
onBeforeUnmount(()=>editor.value?.destroy())
</script>
<template>
 <div class="rich-input" :class="{'rich-expanded':expanded,'rich-readonly':readonly}">
  <div v-if="editor && expanded && !readonly" class="format-strip">

   <div class="rich-tools" role="toolbar" aria-label="文本格式" @mousedown.prevent>
   <a-button html-type="button" aria-label="标题格式" title="标题 / 正文" :disabled="disabled" :aria-pressed="editor.isActive('heading',{level:2})" @click="editor.chain().focus().command(isolateSelectedBlocks).toggleHeading({level:2}).run()"><FormatIcon name="heading"/></a-button>
   <a-button html-type="button" title="加粗" :disabled="disabled" aria-label="加粗" :aria-pressed="editor.isActive('bold')" @click="editor.chain().focus().toggleBold().run()"><FormatIcon name="bold"/></a-button><a-button html-type="button"  :disabled="disabled" aria-label="荧光笔高亮" title="选中文字后高亮，再点一次取消" :aria-pressed="editor.isActive('highlight')" @click="editor.chain().focus().toggleHighlight().run()"><span class="highlight-swatch" aria-hidden="true"></span></a-button>
   <span class="format-divider" aria-hidden="true"></span><a-button html-type="button" title="编号列表" :disabled="disabled" aria-label="编号列表" :aria-pressed="editor.isActive('orderedList')" @click="editor.chain().focus().command(isolateSelectedBlocks).toggleOrderedList().run()"><FormatIcon name="ordered"/></a-button><a-button html-type="button" title="无序列表" :disabled="disabled" aria-label="无序列表" :aria-pressed="editor.isActive('bulletList')" @click="editor.chain().focus().command(isolateSelectedBlocks).toggleBulletList().run()"><FormatIcon name="bullet"/></a-button><a-button html-type="button" title="勾选清单" :disabled="disabled" aria-label="勾选清单" :aria-pressed="editor.isActive('taskList')" @click="editor.chain().focus().command(isolateSelectedBlocks).toggleTaskList().run()"><FormatIcon name="checklist"/></a-button>
  </div>
  </div>
  <EditorContent :editor="editor"/>
 </div>
</template>
