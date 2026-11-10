<script setup lang="ts">
import {onBeforeUnmount,watch} from 'vue'
import {EditorContent,useEditor} from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {type MinutesNode,emptyMinutes} from './minutesDocument'
const props=defineProps<{document:MinutesNode;expanded?:boolean;readonly?:boolean;disabled?:boolean}>()
const emit=defineEmits<{update:[MinutesNode,string];send:[]}>()
const editor=useEditor({extensions:[StarterKit.configure({heading:{levels:[1,2,3]},link:false,underline:false,code:false,codeBlock:false,strike:false,horizontalRule:false}),Underline,Link.configure({openOnClick:false,autolink:false}),TaskList,TaskItem.configure({nested:false})],content:props.document||emptyMinutes(),editable:!props.readonly&&!props.disabled,editorProps:{attributes:{role:props.readonly?'article':'textbox','aria-label':props.readonly?'记录正文':'长文本内容','aria-multiline':'true','data-placeholder':'写点内容…'},handleKeyDown(_view,e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!props.readonly){emit('send');return true}return false}},onUpdate({editor}){emit('update',editor.getJSON() as MinutesNode,editor.getText())}})
watch(()=>props.document,doc=>{if(editor.value && JSON.stringify(editor.value.getJSON())!==JSON.stringify(doc))editor.value.commands.setContent(doc,{emitUpdate:false})},{deep:true})
watch(()=>props.disabled,()=>editor.value?.setEditable(!props.readonly&&!props.disabled))
function focus(){editor.value?.view.dom.focus()}
defineExpose({focus})
onBeforeUnmount(()=>editor.value?.destroy())
</script>
<template>
 <div class="rich-input" :class="{'rich-expanded':expanded,'rich-readonly':readonly}">
  <div v-if="editor && expanded && !readonly" class="rich-tools" role="toolbar" aria-label="文本格式">
   <a-button v-for="level in ([1,2,3] as const)" :key="level" html-type="button" :aria-label="level+'级标题'" :aria-pressed="editor.isActive('heading',{level})" @click="editor.chain().focus().toggleHeading({level}).run()">H{{level}}</a-button>
   <a-button html-type="button" aria-label="加粗" :aria-pressed="editor.isActive('bold')" @click="editor.chain().focus().toggleBold().run()"><b>B</b></a-button><a-button html-type="button" aria-label="斜体" :aria-pressed="editor.isActive('italic')" @click="editor.chain().focus().toggleItalic().run()"><i>I</i></a-button><a-button html-type="button" aria-label="下划线" :aria-pressed="editor.isActive('underline')" @click="editor.chain().focus().toggleUnderline().run()"><u>U</u></a-button>
   <a-button html-type="button" aria-label="编号列表" :aria-pressed="editor.isActive('orderedList')" @click="editor.chain().focus().toggleOrderedList().run()">1.</a-button><a-button html-type="button" aria-label="无序列表" :aria-pressed="editor.isActive('bulletList')" @click="editor.chain().focus().toggleBulletList().run()">•</a-button><a-button html-type="button" aria-label="勾选清单" :aria-pressed="editor.isActive('taskList')" @click="editor.chain().focus().toggleTaskList().run()">☑</a-button><a-button html-type="button" aria-label="引用格式" @click="editor.chain().focus().toggleBlockquote().run()">❞</a-button><a-button html-type="button" aria-label="撤销" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()">↶</a-button><a-button html-type="button" aria-label="重做" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()">↷</a-button>
  </div>
  <EditorContent :editor="editor"/>
 </div>
</template>
