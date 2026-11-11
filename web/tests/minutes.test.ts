import {describe,it,expect} from 'vitest'
import {emptyMinutes,minutesSchema,minutesText,textMinutes} from '../src/minutesDocument'
import {blankTask,applyAI,taskFields} from '../src/domain'
describe('meeting document validation and task compatibility',()=>{
 it('round-trips long plain text and retains existing task defaults',()=>{
  const text='会议原文'.repeat(4000)
  expect(minutesText(textMinutes(text))).toBe(text)
  expect(taskFields.parse({...blankTask(),title:'纪要',record_kind:'meeting_minutes',document:textMinutes(text),content:text}).content.length).toBe(16000)
 })
 it('supports templates and formatted lists but rejects executable links and unknown nodes',()=>{
  expect(minutesSchema.safeParse(textMinutes('正文')).success).toBe(true)
  expect(minutesSchema.safeParse({type:'doc',content:[{type:'image',attrs:{src:'x'}}]}).success).toBe(false)
  expect(minutesSchema.safeParse({type:'doc',content:[{type:'text',text:'x',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}).success).toBe(false)
  expect(minutesSchema.safeParse({type:'doc',content:[{type:'heading',attrs:{level:6}}]}).success).toBe(false)
 })
 it('generic AI metadata updates preserve the structured minutes document',()=>{
  const current={...blankTask(),title:'纪要',record_kind:'meeting_minutes' as const,document:emptyMinutes(),content:'原文'}
  const result=applyAI({reply:'更新',action:'update',task:{priority:'high',content:'不得覆盖'}},current)
  expect(result.fields?.document).toEqual(emptyMinutes());expect(result.fields?.content).toBe('原文');expect(result.fields?.priority).toBe('high')
 })
 it('accepts highlight marks and keeps highlighted content searchable',()=>{
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'重点',marks:[{type:'highlight'}]}]}]}
  expect(minutesSchema.safeParse(doc).success).toBe(true);expect(minutesText(doc)).toBe('重点')
 })

})
