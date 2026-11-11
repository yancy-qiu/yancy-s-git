import {test,expect} from '@playwright/test'

for(const [label,tag] of [['编号列表','ol'],['无序列表','ul'],['勾选清单','ul[data-type="taskList"]']] as const){
 test(`${label} applies only to selected soft-break lines in a detail editor`,async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'先体验演示版'}).click()
  await page.getByRole('button',{name:'展开长文本',exact:true}).click()
  const body=page.getByRole('textbox',{name:'长文本内容',exact:true})
  await body.fill('保留前言');await body.press('Shift+Enter');await body.pressSequentially('方案一');await body.press('Shift+Enter');await body.pressSequentially('方案二');await body.press('Shift+Enter');await body.pressSequentially('保留结尾')
  await page.getByRole('button',{name:'发送',exact:true}).click()
  await page.getByRole('button',{name:'查看：保留前言',exact:true}).click();await page.getByRole('button',{name:'编辑记录',exact:true}).click()
  await body.evaluate(el=>{
   const nodes:Array<Text>=[];const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode())nodes.push(n as Text)
   const range=document.createRange();range.setStart(nodes.find(n=>n.data==='方案一')!,0);range.setEnd(nodes.find(n=>n.data==='方案二')!,3)
   const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));document.dispatchEvent(new Event('selectionchange'))
  })
  await page.getByRole('button',{name:label,exact:true}).click()
  await expect(body.locator(`${tag}>li`)).toHaveCount(2)
  await expect(body.locator(tag)).toHaveText(/方案一.*方案二/)
  await expect(body.locator(tag)).not.toContainText('保留前言');await expect(body.locator(tag)).not.toContainText('保留结尾')
  await page.getByRole('button',{name:'保存修改',exact:true}).click()
  await expect(page.getByRole('article',{name:'记录正文'}).locator(`${tag}>li`)).toHaveCount(2)
 })
}

test('reverse selection isolates partial text, retains marks and can toggle a list off',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'先体验演示版'}).click();await page.getByRole('button',{name:'展开长文本',exact:true}).click()
 const body=page.getByRole('textbox',{name:'长文本内容',exact:true})
 await body.fill('前言选中内容结尾')
 await body.evaluate(el=>{const text=el.querySelector('h2')!.firstChild!;window.getSelection()!.setBaseAndExtent(text,6,text,2);document.dispatchEvent(new Event('selectionchange'))})
 await page.getByRole('button',{name:'加粗',exact:true}).click();await expect(body.locator('strong')).toHaveText('选中内容')
 await page.getByRole('button',{name:'编号列表',exact:true}).click()
 await expect(body.locator('ol')).toHaveText('选中内容');await expect(body.locator('ol strong')).toHaveText('选中内容')
 await expect(body.locator(':scope>h2')).toHaveText(['前言','结尾'])
 await page.getByRole('button',{name:'编号列表',exact:true}).click();await expect(body.locator('ol')).toHaveCount(0)
 await expect(body).toHaveText('前言选中内容结尾')
 await body.press('ControlOrMeta+z');await expect(body.locator('ol')).toHaveText('选中内容')
 await body.press('ControlOrMeta+z');await expect(body.locator('ol')).toHaveCount(0);await expect(body.locator(':scope>h2')).toHaveCount(1)
 await expect(body.locator('strong')).toHaveText('选中内容')
})
