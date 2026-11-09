import { test, expect, type Page, type BrowserContext } from '@playwright/test'
async function demo(page:Page){await page.goto('/');await page.getByRole('button',{name:'先体验演示版'}).click()}
async function modelSettings(page:Page){
 await page.getByRole('button',{name:'设置',exact:true}).click()
 await page.getByLabel('HTTPS 接口地址').fill('https://model.example/v1/chat/completions')
 await page.getByLabel('模型名称').fill('test-model')
 await page.getByLabel('API Key',{exact:true}).fill('session-test-key')
 await page.getByRole('button',{name:'保存设置',exact:true}).click()
}
test('whitespace title explains validation and preserves the editable form',async({page})=>{
 await demo(page)
 await page.getByRole('button',{name:'＋ 新建记录'}).click()
 await page.getByRole('textbox',{name:'标题',exact:true}).fill('   ')
 await page.getByRole('button',{name:'保存记录',exact:true}).click()
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('标题')
 await page.getByRole('textbox',{name:'标题',exact:true}).fill('修正后的标题')
 await page.getByRole('button',{name:'保存记录',exact:true}).click()
 await expect(page.getByRole('heading',{name:'修正后的标题',exact:true}).first()).toBeVisible()
})
test('damaged preferences and demo cache do not crash or silently overwrite saved data',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('qingji.vue.preferences','null');localStorage.setItem('qingji.vue.demo.v1','{"unexpected":true}')})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await demo(page)
 await expect(page.getByRole('alert')).toContainText('演示数据')
 expect(await page.evaluate(()=>localStorage.getItem('qingji.vue.demo.v1'))).toBe('{"unexpected":true}')
 expect(errors).toEqual([])
})
test('AI connection test, successful referenced update, clear key and logout cleanup',async({page})=>{
 await demo(page);await modelSettings(page)
 let requests=0
 await page.route('https://model.example/**',async route=>{
  const payload=route.request().postDataJSON();requests++
  if(payload.messages.length===1){expect(payload.messages[0].content).toBe('Reply with OK.');await route.fulfill({json:{choices:[{message:{content:'OK'}}]}});return}
  expect(payload.messages[0].content).toContain('给今天留一点清晰')
  await route.fulfill({json:{choices:[{message:{content:JSON.stringify({reply:'已调整优先级',action:'update',task:{title:'AI 更新后的任务',priority:'high',summary:'只更新引用任务',actionItems:['整理需求','确认时间']}})}}]}})
 })
 await page.getByRole('button',{name:'设置',exact:true}).click()
 await page.getByRole('button',{name:'测试连接',exact:true}).click()
 await expect(page.getByText('连接成功，模型已响应。',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'保存设置',exact:true}).click()
 await page.getByRole('button',{name:'引用：给今天留一点清晰',exact:true}).click()
 const count=await page.locator('.record-card').count()
 await page.getByLabel('给 AI 发送消息').fill('设为重要并整理下一步')
 await page.getByRole('button',{name:'发送 ↗',exact:true}).click()
 await expect(page.getByText('已调整优先级',{exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'AI 更新后的任务',exact:true}).first()).toBeVisible()
 expect(await page.locator('.record-card').count()).toBe(count)
 expect(requests).toBe(2)
 await page.getByRole('button',{name:'设置',exact:true}).click()
 await page.getByRole('button',{name:'清除会话密钥',exact:true}).click()
 await expect(page.getByLabel('API Key',{exact:true})).toBeEmpty()
 expect(await page.evaluate(()=>sessionStorage.getItem('qingji.vue.ai-key'))).toBeNull()
 await page.getByRole('button',{name:'保存设置',exact:true}).click()
 await page.getByRole('button',{name:'退出演示',exact:true}).click()
 await page.getByRole('button',{name:'先体验演示版'}).click()
 await expect(page.getByLabel('给 AI 发送消息')).toBeEmpty()
 await expect(page.locator('.messages')).toHaveCount(0)
 expect(await page.evaluate(()=>sessionStorage.getItem('qingji.vue.ai-key'))).toBeNull()
})
test('logging out during an AI request cannot restore prior conversation into the next session',async({page})=>{
 await demo(page);await modelSettings(page)
 let release!:()=>void
 const gate=new Promise<void>(resolve=>release=resolve)
 let started!:()=>void
 const pending=new Promise<void>(resolve=>started=resolve)
 await page.route('https://model.example/**',async route=>{started();await gate;await route.fulfill({status:500,body:'failure'}).catch(()=>{})})
 await page.getByLabel('给 AI 发送消息').fill('上一会话的私密内容')
 await page.getByRole('button',{name:'发送 ↗',exact:true}).click()
 await pending
 await page.getByRole('button',{name:'退出演示',exact:true}).click()
 release()
 await page.getByRole('button',{name:'先体验演示版'}).click()
 await expect(page.getByLabel('给 AI 发送消息')).toBeEmpty()
 await expect(page.locator('.messages')).toHaveCount(0)
 await expect(page.getByRole('alert')).toHaveCount(0)
})
async function cloud(context:BrowserContext){
 const owner='11111111-1111-4111-8111-111111111111'
 const user={id:owner,aud:'authenticated',email:'test@example.com',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}
 const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated'})).toString('base64url')}.fake`
 const state={tasks:[] as any[],writeFailure:false,readFailure:false,readAttempts:0,rejectLogin:false}
 let version=0
 await context.routeWebSocket('**/realtime/**',ws=>ws.close())
 await context.route('https://qingji-test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(url.pathname.includes('/token')){await route.fulfill(state.rejectLogin?{status:400,json:{code:'invalid_credentials',message:'Invalid login credentials'}}:{json:{access_token:jwt,refresh_token:'fake',expires_in:3600,token_type:'bearer',user}});return}
  if(url.pathname.includes('/signup')){await route.fulfill({json:{user,session:null}});return}
  if(url.pathname.includes('/logout')){await route.fulfill({status:204});return}
  if(url.pathname.includes('/user')){await route.fulfill({json:user});return}
  if(url.pathname.includes('/rest/v1/tasks')){
   if(req.method()==='GET'){if(state.readFailure)state.readAttempts++;await route.fulfill(state.readFailure?{status:503,json:{message:'unavailable'}}:{json:state.tasks.filter(t=>!t.deleted_at)});return}
   if(state.writeFailure){await route.fulfill({status:503,json:{message:'unavailable'}});return}
   const body=req.postDataJSON(),stamp=new Date(Date.UTC(2026,10,10,0,0,++version)).toISOString()
   if(req.method()==='POST'){const t={...body,id:crypto.randomUUID(),created_at:stamp,updated_at:stamp};state.tasks.unshift(t);await route.fulfill({json:t});return}
   const t=state.tasks.find(t=>`eq.${t.id}`===url.searchParams.get('id'))
   if(!t || `eq.${t.updated_at}`!==url.searchParams.get('updated_at')){await route.fulfill({status:406,json:{code:'PGRST116',message:'0 rows'}});return}
   Object.assign(t,body,{updated_at:stamp});await route.fulfill({json:t});return
  }
  await route.fulfill({status:404,json:{message:'unhandled endpoint'}})
 })
 return state
}
async function login(page:Page){await page.goto('/');await page.getByLabel('邮箱',{exact:true}).fill('test@example.com');await page.getByLabel('密码',{exact:true}).fill('password123');await page.getByRole('button',{name:'登录轻记',exact:true}).click()}
test('signup email confirmation and failed login feedback',async({context,page})=>{
 const state=await cloud(context);state.rejectLogin=true
 await login(page);await expect(page.getByRole('status')).toContainText('登录失败')
 await page.getByRole('button',{name:'第一次来？创建账号'}).click()
 await page.getByRole('button',{name:'创建账号',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('检查邮箱')
})
test('two browser sessions sync via refresh and recover safely after save/read failure',async({context,page})=>{
 const state=await cloud(context)
 await login(page);await expect(page.getByText('test@example.com',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'＋ 新建记录'}).click()
 await page.getByRole('textbox',{name:'标题',exact:true}).fill('跨会话同步任务')
 state.writeFailure=true
 await page.getByRole('button',{name:'保存记录',exact:true}).click()
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('云端保存失败')
 await expect(page.getByRole('textbox',{name:'标题',exact:true})).toHaveValue('跨会话同步任务')
 expect(state.tasks).toHaveLength(0)
 state.writeFailure=false;await page.getByRole('button',{name:'保存记录',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 const second=await context.newPage();await second.goto('/')
 await second.getByRole('navigation',{name:'任务视图',exact:true}).getByRole('button',{name:/收集箱/}).click()
 await expect(second.getByRole('button',{name:'查看：跨会话同步任务'})).toBeVisible()
 await second.getByRole('button',{name:'查看：跨会话同步任务'}).click()
 await second.getByRole('button',{name:'编辑记录',exact:true}).click()
 await second.getByRole('textbox',{name:'标题',exact:true}).fill('另一设备已更新')
 await second.getByRole('button',{name:'保存记录',exact:true}).click()
 await expect(second.getByRole('dialog')).toHaveCount(0)
 state.readFailure=true;await page.getByRole('button',{name:'刷新任务',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('云端读取失败',{timeout:15000})
 expect(state.readAttempts).toBeGreaterThanOrEqual(4)
 await expect(page.getByRole('button',{name:'查看：跨会话同步任务'})).toBeVisible()
 state.readFailure=false;await page.getByRole('button',{name:'刷新任务',exact:true}).click()
 await expect(page.getByRole('button',{name:'查看：另一设备已更新'})).toBeVisible()
 await expect(page.getByRole('alert')).toHaveCount(0)
 await second.close()
})

test('deleting every demo task remains empty after reload',async({page})=>{
 await demo(page)
 await page.getByRole('button',{name:'查看：给今天留一点清晰'}).click()
 await page.getByRole('button',{name:'删除记录',exact:true}).click()
 await expect(page.locator('.record-card')).toHaveCount(0)
 await page.reload();await page.getByRole('button',{name:'先体验演示版'}).click()
 await expect(page.locator('.record-card')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'给这一天，留一点空白'})).toBeVisible()
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('qingji.vue.demo.v1')!))).toEqual([])
})
