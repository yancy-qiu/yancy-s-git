import { z } from 'zod'
export type MinutesNode={type:string;text?:string;attrs?:Record<string,unknown>;marks?:{type:string;attrs?:Record<string,unknown>}[];content?:MinutesNode[]}
const nodes=new Set(['doc','paragraph','text','heading','bulletList','orderedList','listItem','taskList','taskItem','blockquote','hardBreak'])
export function validMinutes(value:unknown):value is MinutesNode{
 let count=0
 function check(n:any,depth=0):boolean{
  if(!n || typeof n!=='object' || Array.isArray(n) || !nodes.has(n.type) || depth>20 || ++count>12000)return false
  if(n.type==='text' && typeof n.text!=='string')return false
  if(n.type==='heading' && ![1,2,3].includes(n.attrs?.level))return false
  if(n.marks && (!Array.isArray(n.marks)||n.marks.some((m:any)=>!['bold','italic','underline','link'].includes(m.type) || m.type==='link' && !(typeof m.attrs?.href==='string' && /^(https?:\/\/|mailto:)/i.test(m.attrs.href)))))return false
  return n.content===undefined || Array.isArray(n.content) && n.content.every((c:any)=>check(c,depth+1))
 }
 try{return check(value) && (value as MinutesNode).type==='doc' && new TextEncoder().encode(JSON.stringify(value)).length<=500000}catch{return false}
}
export const minutesSchema=z.custom<MinutesNode>(validMinutes,'纪要文档格式无效或超出限制')
export const emptyMinutes=():MinutesNode=>({type:'doc',content:[{type:'paragraph'}]})
export function textMinutes(text:string):MinutesNode{return {type:'doc',content:text.split('\n').map(t=>({type:'paragraph',...(t?{content:[{type:'text',text:t}]}:{})}))}}
export function minutesText(doc:MinutesNode):string{
 const text=(n:MinutesNode):string=>n.type==='text'?n.text||'':n.type==='hardBreak'?'\n':(n.content||[]).map(text).join(['doc','bulletList','orderedList','taskList','listItem','taskItem','blockquote'].includes(n.type)?'\n':'')
 return text(doc)
}
