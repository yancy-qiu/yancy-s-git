import { test, expect, type Page } from '@playwright/test'
async function demo(page:Page){await page.goto('/');await page.getByRole('button',{name:'先体验演示版'}).click()}
async function create(page:Page,title:string){await page.getByRole('button',{name:'＋ 新建记录'}).click();await page.getByRole('textbox',{name:'标题',exact:true}).fill(title);await page.getByRole('button',{name:'保存记录',exact:true}).click();await expect(page.getByRole('heading',{name:title,exact:true}).first()).toBeVisible()}
test('demo CRUD, filters, undo, persistence, theme and widget privacy',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await demo(page)
 await create(page,'准备产品评审')
 await page.getByRole('button',{name:'编辑记录',exact:true}).click()
 await page.getByRole('textbox',{name:'正文',exact:true}).fill('整理三个关键问题')
 await page.getByRole('button',{name:'保存记录',exact:true}).click()
 await page.getByRole('button',{name:'标记完成',exact:true}).click()
 await page.getByRole('navigation',{name:'任务视图',exact:true}).getByRole('button',{name:/已完成/}).click()
 await expect(page.getByRole('heading',{name:'准备产品评审',exact:true}).first()).toBeVisible()
 await page.getByRole('button',{name:'恢复记录',exact:true}).click()
 await page.getByRole('navigation',{name:'任务视图',exact:true}).getByRole('button',{name:/收集箱/}).click()
 await page.getByRole('button',{name:'延后到明天',exact:true}).click()
 await page.getByRole('navigation',{name:'任务视图',exact:true}).getByRole('button',{name:/计划/}).click()
 await expect(page.getByRole('heading',{name:'准备产品评审',exact:true}).first()).toBeVisible()
 await page.getByRole('button',{name:'删除记录',exact:true}).click()
 await expect(page.getByRole('heading',{name:'准备产品评审',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'撤销',exact:true}).click()
 await expect(page.getByRole('heading',{name:'准备产品评审',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'设置',exact:true}).click()
 await page.getByLabel('外观', {exact:true}).selectOption('dark')
 await page.getByLabel('小组件预览隐藏任务标题').check()
 await page.getByRole('button',{name:'保存设置',exact:true}).click()
 await page.reload();await page.getByRole('button',{name:'先体验演示版'}).click()
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.getByRole('button',{name:/小组件预览/}).click()
 await expect(page.getByRole('dialog').getByText('私密记录',{exact:true}).first()).toBeVisible()
 await page.getByRole('button',{name:'关闭弹窗'}).click()
 await page.getByRole('navigation',{name:'任务视图',exact:true}).getByRole('button',{name:/全部记录/}).click()
 await page.screenshot({path:'/tmp/qingji-desktop.png',fullPage:true})
 expect(errors).toEqual([])
})
test('mobile renders without overflow and supports creation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await demo(page);await create(page,'移动端随手记')
 await page.getByRole('button',{name:'关闭详情'}).click()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'/tmp/qingji-mobile.png',fullPage:true})
 await page.getByRole('button',{name:'小组件预览',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'小组件预览',exact:true})).toBeVisible()
})
test('AI creates, clarifies without mutation, and preserves tasks on failure',async({page})=>{
 await demo(page);await page.getByRole('button',{name:'设置',exact:true}).click()
 await page.getByRole('button',{name:'模型配置 →',exact:true}).click()
 await page.getByLabel('HTTPS 接口地址').fill('https://model.example/v1/chat/completions')
 await page.getByLabel('模型名称').fill('test-model');await page.getByLabel('API Key',{exact:true}).fill('test-session-key')
 await page.getByRole('button',{name:'保存模型配置',exact:true}).click()
 let mode='create'
 await page.route('https://model.example/**',async route=>{
  expect(route.request().headers().authorization).toBe('Bearer test-session-key')
  if(mode==='fail'){await route.fulfill({status:500,body:'failure'});return}
  const result=mode==='create'?{reply:'已记录',action:'create',task:{title:'AI 安排评审',content:'讨论产品',category:'meeting'}}:mode==='malformed'?{reply:'已修改',action:'update',task:{title:null}}:mode==='empty-update'?{reply:'已修改',action:'update',task:null}:{reply:'你指哪天？',action:'none',task:null}
  await route.fulfill({json:{choices:[{message:{content:JSON.stringify(result)}}]}})
 })
 await page.getByLabel('给 AI 发送消息').fill('安排产品讨论')
 await page.getByRole('button',{name:'发送 ↗',exact:true}).click()
 await expect(page.getByRole('heading',{name:'AI 安排评审',exact:true}).first()).toBeVisible()
 const before=await page.evaluate(()=>localStorage.getItem('qingji.vue.demo.v1'))
 await page.getByRole('button',{name:'引用：AI 安排评审'}).click();mode='clarify'
 await page.getByLabel('给 AI 发送消息').fill('改个时间');await page.getByRole('button',{name:'发送 ↗',exact:true}).click()
 await expect(page.getByText('你指哪天？',{exact:true})).toBeVisible()
 expect(await page.evaluate(()=>localStorage.getItem('qingji.vue.demo.v1'))).toBe(before)
 for(const [nextMode,expected] of [['empty-update','模型没有返回任务数据'],['malformed','模型返回的数据格式不正确']]){
  mode=nextMode;await page.getByLabel('给 AI 发送消息').fill('补充行动项');await page.getByRole('button',{name:'发送 ↗',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText(expected)
  await expect(page.getByRole('alert')).not.toContainText('invalid_type')
  expect(await page.evaluate(()=>localStorage.getItem('qingji.vue.demo.v1'))).toBe(before)
 }
 mode='fail';await page.getByLabel('给 AI 发送消息').fill('改到明天');await page.getByRole('button',{name:'发送 ↗',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('HTTP 500')
 expect(await page.evaluate(()=>localStorage.getItem('qingji.vue.demo.v1'))).toBe(before)
 expect(await page.evaluate(()=>localStorage.getItem('qingji.vue.model.v1.demo'))).toContain('test-session-key')
 expect(await page.evaluate(()=>sessionStorage.getItem('qingji.vue.ai-key'))).toBeNull()
})
test('cloud login, remote task persistence, conflict handling and logout with mocked Supabase',async({page})=>{
 const owner='11111111-1111-4111-8111-111111111111';let tasks:any[]=[];let stale=false
 const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated'})).toString('base64url')}.fake`
 const user={id:owner,aud:'authenticated',email:'test@example.com',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}
 await page.routeWebSocket('**/realtime/**',ws=>ws.close())
 await page.route('https://qingji-test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method()
  if(url.pathname.includes('/token')){await route.fulfill({json:{access_token:jwt,refresh_token:'fake-refresh',expires_in:3600,token_type:'bearer',user}});return}
  if(url.pathname.includes('/logout')){await route.fulfill({status:204});return}
  if(url.pathname.includes('/user')){await route.fulfill({json:user});return}
  if(url.pathname.includes('/rest/v1/tasks')){
   if(method==='GET'){await route.fulfill({json:tasks.filter(t=>!t.deleted_at)});return}
   const body=req.postDataJSON()
   if(method==='POST'){expect(body.user_id).toBe(owner);const t={...body,id:crypto.randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};tasks.unshift(t);await route.fulfill({json:t});return}
   if(method==='PATCH'){
    if(stale){await route.fulfill({status:406,json:{code:'PGRST116',message:'0 rows'}});return}
    const id=url.searchParams.get('id')!.slice(3);const t=tasks.find(t=>t.id===id);Object.assign(t,body,{updated_at:new Date().toISOString()});await route.fulfill({json:t});return
   }
  }
  await route.fulfill({status:404,json:{message:'Unhandled test endpoint'}})
 })
 await page.goto('/');await page.getByLabel('邮箱',{exact:true}).fill('test@example.com');await page.getByLabel('密码',{exact:true}).fill('password123');await page.getByRole('button',{name:'登录轻记',exact:true}).click()
 await expect(page.getByText('test@example.com',{exact:true})).toBeVisible()
 await create(page,'云端记录');await page.reload()
 await page.getByRole('navigation',{name:'任务视图',exact:true}).getByRole('button',{name:/收集箱/}).click()
 await expect(page.getByRole('heading',{name:'云端记录',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'查看：云端记录',exact:true}).click()
 stale=true;await page.getByRole('button',{name:'标记完成',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('其他设备修改')
 expect(tasks[0].completed).toBe(false)
 await page.getByRole('button',{name:'退出登录',exact:true}).click()
 await expect(page.getByRole('button',{name:'登录轻记',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'云端记录',exact:true})).toHaveCount(0)
})
test('three column task workbench, combined filters and bottom composer',async({page})=>{
 await page.setViewportSize({width:1440,height:1000})
 await page.addInitScript(()=>{
  const base={user_id:'demo',content:'',category:'task',due_date:'',due_time:'',priority:'normal',reminder:false,completed:false,organized:false,summary:'',action_items:[],created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z',deleted_at:null}
  localStorage.setItem('qingji.vue.demo.v1',JSON.stringify([
   {...base,id:'alpha',title:'重要评审',priority:'high',due_date:'2026-11-12'},
   {...base,id:'beta',title:'普通会议',category:'meeting',due_date:'2026-11-14'},
   {...base,id:'gamma',title:'较低优先事项',priority:'low'},
  ]))
 })
 await demo(page)
 await page.getByRole('navigation',{name:'任务视图',exact:true}).getByRole('button',{name:/全部记录/}).click()
 const list=page.locator('.records-section'), details=page.getByRole('complementary',{name:'记录详情'})
 await expect(details.getByRole('heading',{name:'选择一条任务'})).toBeVisible()
 const originalWidth=(await list.boundingBox())!.width
 await page.getByRole('button',{name:'关闭详情',exact:true}).click()
 await expect(details).toHaveCount(0)
 expect((await list.boundingBox())!.width).toBeGreaterThan(originalWidth)
 await page.getByRole('button',{name:'查看：重要评审',exact:true}).click()
 await expect(details).toBeVisible()
 await expect(page.locator('.filter-toolbar .search')).toBeVisible()
 const listBox=(await list.boundingBox())!, detailBox=(await details.boundingBox())!, composerBox=(await page.locator('.copilot').boundingBox())!
 expect(detailBox.x).toBeGreaterThanOrEqual(listBox.x+listBox.width)
 expect(await page.locator('.copilot').evaluate(el=>getComputedStyle(el).position)).toBe('fixed')
 expect(composerBox.y+composerBox.height).toBeLessThanOrEqual(1000)
 expect(await page.locator('.quick-create').count()).toBe(0)
 await expect(page.locator('.filter-sort-label')).toHaveText('优先级优先')
 expect((await page.locator('.record-card').first().boundingBox())!.height).toBeLessThanOrEqual(56)
 await page.getByRole('button',{name:'查看：重要评审',exact:true}).click()
 await expect(details.getByRole('heading',{name:'重要评审',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'查看：普通会议',exact:true}).click()
 await expect(details.getByRole('heading',{name:'普通会议',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'关闭详情',exact:true}).click()
 await expect(details).toHaveCount(0)
 await page.getByRole('button',{name:'查看：普通会议',exact:true}).click()
 await expect(details.getByRole('heading',{name:'普通会议',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'筛选重要性',exact:true}).click()
 await page.getByLabel('重要性筛选',{exact:true}).selectOption('important')
 await expect(page.locator('.record-card')).toHaveCount(1)
 await page.getByRole('button',{name:'筛选优先级',exact:true}).click()
 await page.getByLabel('优先级筛选',{exact:true}).selectOption('low')
 await expect(page.getByRole('heading',{name:'没有匹配的记录'})).toBeVisible()
 await page.getByRole('button',{name:'清除全部筛选',exact:true}).click()
 await expect(page.locator('.record-card')).toHaveCount(3)
 await page.getByRole('button',{name:'筛选安排日期',exact:true}).click()
 await page.getByLabel('安排日期筛选',{exact:true}).selectOption('custom')
 await page.getByLabel('开始日期',{exact:true}).fill('2026-11-12')
 await page.getByLabel('结束日期',{exact:true}).fill('2026-11-12')
 await expect(page.locator('.record-card')).toHaveCount(1)
 await page.getByLabel('结束日期',{exact:true}).fill('2026-11-11')
 await expect(page.getByRole('alert')).toHaveText('结束日期不能早于开始日期。')
 await page.getByRole('button',{name:'清除全部筛选',exact:true}).click()
 await page.getByRole('button',{name:'会议',exact:true}).click()
 await expect(page.locator('.record-card')).toHaveCount(1)
 await expect(page.getByRole('button',{name:'查看：普通会议',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'全部类型',exact:true}).click()
 await page.getByRole('button',{name:'筛选排序',exact:true}).click()
 await page.getByLabel('任务排序',{exact:true}).selectOption('priority')
 await expect(page.locator('.record-card').first()).toContainText('重要评审')
 await page.getByRole('button',{name:'查看：重要评审',exact:true}).click()
 await page.screenshot({path:'/tmp/qingji-workbench-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844})
 await page.getByRole('button',{name:'关闭详情',exact:true}).click()
 await page.getByRole('button',{name:'筛选类型',exact:true}).click()
 await page.getByLabel('类型筛选',{exact:true}).selectOption('meeting')
 await expect(page.locator('.record-card')).toHaveCount(1)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'/tmp/qingji-workbench-mobile.png',fullPage:true})
})

test('compact rows keep the composer fixed while the last task remains reachable',async({page})=>{
 await page.setViewportSize({width:1440,height:1000})
 await page.addInitScript(()=>{
  const base={user_id:'demo',content:'详细正文保留在右侧',category:'task',due_date:'',due_time:'',priority:'normal',reminder:false,completed:false,organized:false,summary:'',action_items:[],created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z',deleted_at:null}
  localStorage.setItem('qingji.vue.demo.v1',JSON.stringify(Array.from({length:40},(_,i)=>({...base,id:String(i).padStart(2,'0'),title:`任务 ${i}：需要查看的安排`,priority:i===39?'high':'normal'}))))
 })
 await demo(page)
 await page.getByRole('navigation',{name:'任务视图',exact:true}).getByRole('button',{name:/全部记录/}).click()
 await expect(page.locator('.record-card').first()).toContainText('任务 39')
 const before=(await page.locator('.copilot').boundingBox())!
 await page.locator('.record-card').last().scrollIntoViewIfNeeded()
 const after=(await page.locator('.copilot').boundingBox())!
 expect(after.y).toBeCloseTo(before.y,0)
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight))
 expect((await page.locator('.record-card').last().boundingBox())!.y+46).toBeLessThan(after.y)
 await page.getByRole('button',{name:'引用：任务 9：需要查看的安排',exact:true}).click()
 await expect(page.getByLabel('给 AI 发送消息')).toBeFocused()
 await page.screenshot({path:'/tmp/qingji-floating-desktop.png',fullPage:false})
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'/tmp/qingji-floating-mobile.png',fullPage:false})
})
