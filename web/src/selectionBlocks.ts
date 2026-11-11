import type {Command} from '@tiptap/core'
import {TextSelection} from '@tiptap/pm/state'
import {closeHistory} from '@tiptap/pm/history'

// Block commands normally include the whole paragraph, even when it contains
// several soft-break lines. Isolate the selected text before applying a format.
export const isolateSelectedBlocks:Command=({tr})=>{
 closeHistory(tr)
 const {from,to,empty,anchor,head}=tr.selection
 if(empty)return true
 const breaks:number[]=[]
 tr.doc.nodesBetween(from,to,(node,pos,parent)=>{
  if(!node.isTextblock || !['paragraph','heading'].includes(node.type.name) || !parent || !['doc','blockquote'].includes(parent.type.name))return
  node.forEach((child,offset)=>{if(child.type.name==='hardBreak')breaks.push(pos+1+offset)})
  return false
 })
 for(const pos of breaks.reverse())tr.delete(pos,pos+1).split(pos)
 // Split the end first so the beginning remains stable; map from the original
 // selection for every step, preserving direction and excluding adjacent text.
 for(const [edge,assoc] of [[to,-1],[from,1]] as const){
  const pos=tr.mapping.map(edge,assoc),$pos=tr.doc.resolve(pos)
  if(['paragraph','heading'].includes($pos.parent.type.name) && ['doc','blockquote'].includes($pos.node(-1).type.name) && $pos.parentOffset>0 && $pos.parentOffset<$pos.parent.content.size)tr.split(pos)
 }
 const start=tr.mapping.map(from,1),end=tr.mapping.map(to,-1)
 tr.setSelection(TextSelection.create(tr.doc,anchor>head?end:start,anchor>head?start:end))
 return true
}
