# 轻记 Vue 网站

Vue 3 + TypeScript + Vite + Pinia + Arco Design Vue；Supabase Auth / PostgreSQL / Realtime；用户自带 OpenAI 兼容 API Key。

完整测试流程、已修复问题和真实服务验收边界见 [网站测试记录](../docs/development/web-test-plan.md)。

## 开发

Node.js 22 或以上。在仓库 `web/` 目录运行：

```bash
npm ci
npm run dev
npm test
npm run build
```

浏览器端到端测试：`npm run test:e2e`。测试默认使用 `/usr/bin/chromium`，可通过 `CHROMIUM_PATH` 指定自己的 Chromium 安装位置。测试启动独立的 Vite 服务，使用虚拟 Supabase 地址和网络拦截，不会调用真实数据库、模型或发送邮件。

未配置 Supabase 时，首页显示连接提示，仍可进入演示模式。演示数据与云端数据分离，不会自动迁移至账号；演示模式不提供跨设备同步。旧的 `prototype/` 保留不动。

## 连接 Supabase

1. 创建 Supabase 项目，在 SQL Editor 执行仓库 `supabase/migrations/202611090001_tasks.sql`（一次性迁移，不要重复执行）。脚本创建表、约束、更新时间触发器、按用户隔离的 RLS 策略，并将任务表加入 Realtime publication。
2. 在 Authentication → Providers 启用 Email 登录。建议保留邮箱确认；生产发送邮件需配置 SMTP 并检查供应商邮件限额。
3. 在 Authentication → URL Configuration 中将 Site URL 设为正式网站地址；把开发和正式部署的准确地址加入 Redirect URLs。避免宽泛的回调白名单。
4. 从项目的 Connect / API Keys 页面取得 Project URL 和 **publishable key**（旧版项目可用 anon key）。不得把 service_role / secret key 放到前端。
5. 复制 `.env.example` 到 `.env.local`，填入公开连接信息：

```dotenv
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=项目公开密钥
```

6. 重启开发服务。注册账号，确认邮件后登录。用另一个浏览器登录同一账号，验证创建、编辑、完成、删除的同步；用第二个账号确认看不到第一个账号的数据。

公开连接信息不等于管理权限，RLS 是账号隔离边界。AI Key 不进入任务数据库。通过“设置 → 模型配置”独立界面编辑，默认按账号保存在当前浏览器，重新打开或重新登录同一账号后恢复；演示模式单独保存。共享设备可取消“在此浏览器记住配置”，也可清除保存的配置。退出时清空内存中的密钥，但保留用户选择记住的本机配置。浏览器站点存储可能被同源脚本或设备使用者读取，不跨设备同步。

## 在现有 Vercel 项目部署

当前旧站点若使用 `prototype/dist`，需在项目 Settings → Build and Deployment 将 **Root Directory 改为 `web`**，Framework 选择 Vite，Build Command 设为 `npm run build`，Output Directory 设为 `dist`，Install Command 设为 `npm ci`。清除先前用于静态站点的空构建命令或 `.` 输出目录覆盖。

在 Vercel Environment Variables 添加上面的两个 `VITE_SUPABASE_*` 变量，按需设置 Production / Preview，重新部署使变量进入构建产物。仓库 `web/vercel.json` 已声明构建和响应安全头。Supabase URL 配置需包含实际使用的站点地址。

这些步骤不需要平台 AI Key。网站设置内输入用户自己的接口地址、模型 ID 和 Key；服务需要允许浏览器 CORS。测试连接仅发送固定短句。正式对话会发送最近六条对话及引用任务的信息。接口拒绝跨域时无法从前端修复，需要后续设计经过鉴权的代理；当前没有开放转发代理。

## 任务筛选与工作台

桌面左侧为视图和记录类型，中间为纵向任务列表，右侧展示点击任务的详情。任务采用紧凑单行表格，默认优先级排序；AI 输入独立悬浮固定在底部，新建入口位于顶部，使用弹窗编辑。移动端详情为浮层，类型筛选出现在工具栏。筛选在当前视图内组合生效，支持日期、重要性、优先级和搜索；重要性沿用高优先级标记。自定义日期包含两端，未来七天包含今天，无日期任务在按时间排序时放在末尾。清除筛选不会更改任务数据。

## 同步和已知边界

- 登录后从云端加载任务，Realtime 事件触发刷新；每 30 秒、页面重新可见和网络恢复时也会刷新。
- 保存成功才更新列表；离线或请求失败明确报错，不声称已同步，不提供离线写入队列。
- 更新携带 `updated_at`，其他设备抢先修改时提示刷新，不静默覆盖。
- 删除采用软删除，六秒内可撤销。软删除记录仍保留在数据库；正式长期运行前需决定保留期和清理策略。
- 提醒目前只保存设置，不触发系统通知。小组件仅是站内预览。
- 单元测试包含真实 PostgreSQL 引擎（PGlite）中的 RLS、账号隔离、冲突和撤销检查；Realtime publication、真实邮件登录、真实云端两设备同步及供应商 API 仍需连接实际服务验证。
- 保持旧原型数据和新站数据独立，不自动导入浏览器原型的历史数据。

## 组件与视觉主题

界面使用 Arco Design Vue 按需注册的按钮、搜索输入框、浮层、提示、标签及官方图标。明亮蓝色为主色，暖黄和珊瑚橙作为辅助色，支持深色模式。筛选区采用图标按钮：悬停查看说明，点击展开选择；黄色圆点表示已应用非默认条件。
