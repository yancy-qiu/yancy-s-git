# AI 模型 API 接入说明

> 版本：V0.4
>
> 更新时间：2026-09-21
>
> 状态：浏览器原型已实现

## 1. 目标

浏览器原型允许用户选择 OpenAI、Claude / Anthropic、DeepSeek、智谱 GLM 或自定义 OpenAI 兼容接口，填写模型名称和 API Key，并通过对话创建任务或引用已有任务继续编辑。模型可处理标题、正文、自动分类、摘要、行动项、时间、优先级、提醒和完成状态。

当前实现用于验证真实模型整理流程。正式 Mac 版应把密钥迁移到 Keychain，并由原生网络层调用模型服务。

## 2. 配置与存储

| 数据 | 浏览器存储 | 生命周期 |
| --- | --- | --- |
| API 地址 | `localStorage` | 保留到用户清理站点数据 |
| 模型名称 | `localStorage` | 保留到用户清理站点数据 |
| API Key | `sessionStorage` | 按供应商分别保存于当前标签页会话，关闭后清除 |
| 记录内容 | `localStorage` | 仅保存在当前浏览器 |

API Key 不写入代码、Git、日志或 WebMCP 输出。界面默认隐藏密钥，并提供清除入口。

## 3. 供应商与请求协议

| 供应商 | 默认 API 地址 | 协议 |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1/chat/completions` | Chat Completions |
| Claude / Anthropic | `https://api.anthropic.com/v1/messages` | Anthropic Messages API |
| DeepSeek | `https://api.deepseek.com/chat/completions` | OpenAI 兼容 Chat Completions |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | OpenAI 兼容 Chat Completions |
| 自定义接口 | 用户填写 | OpenAI 兼容 Chat Completions |

所有默认地址都允许用户修改。每个供应商分别保留 API 地址、模型名称和当前会话中的 API Key，切换供应商不会串用密钥。

DeepSeek 当前模型名称为 `deepseek-flash` 和 `deepseek-v4-pro`。界面默认选择 `deepseek-flash`，并把历史配置中的 `deepseek-chat`、`deepseek-reasoner` 和旧 Flash 名称迁移到该模型。DeepSeek 返回 400 时，界面会显示经过密钥脱敏的官方错误信息和可用模型提示。

OpenAI、DeepSeek、智谱和自定义接口使用以下结构：

- 请求头：`Content-Type: application/json`、`Authorization: Bearer <API Key>`。
- 请求体：`model` 与 `messages`。
- 返回内容：读取 `choices[0].message.content`。

Claude / Anthropic 使用独立适配：

- 请求头：`x-api-key`、`anthropic-version: 2023-06-01` 和浏览器直连标识。
- 请求体：`model`、`max_tokens`、顶层 `system` 与 `messages`。
- 返回内容：合并 `content` 中的文本块。

协议参考：[OpenAI Chat Completions](https://developers.openai.com/api/reference/cli/resources/chat)、[Anthropic Messages API](https://platform.claude.com/docs/en/api/messages)、[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) 和[智谱开放文档](https://docs.bigmodel.cn/)。

测试连接只发送固定短句，不发送用户记录。执行 AI 协作时，会发送当前对话；引用任务后还会发送该任务的标题、正文、分类、摘要、行动项、时间、优先级、提醒和完成状态。

## 4. 对话与任务引用

- 未引用任务时，模型可以返回 `create` 创建新任务，或在信息不足时返回 `none` 并追问。
- 引用任务时，默认返回 `update` 修改该任务；只有用户明确要求时才创建新任务。
- 任务可以通过协作区下拉列表、任务卡快捷按钮或详情页入口引用。
- 每次请求最多携带最近六条对话消息；对话仅保存在当前页面内存中，刷新后清除。
- 模型请求失败、超时或返回无效 JSON 时，不写入或修改任务。

## 5. 模型输出

AI 协作返回以下结构：

```json
{
  "reply": "已经改到明天下午 3 点，并开启提醒。",
  "action": "update",
  "task": {
    "title": "提交原型反馈",
    "content": "汇总反馈后提交结论",
    "category": "task",
    "summary": "整理并提交原型反馈。",
    "actionItems": ["汇总反馈", "确认优先级", "提交结论"],
    "dueDate": "2026-09-22",
    "dueTime": "15:00",
    "priority": "high",
    "reminder": true,
    "completed": false,
    "clarification": ""
  }
}
```

保留的单条记录整理入口继续兼容以下任务对象：

模型必须返回 JSON 对象，字段如下：

```json
{
  "title": "精炼标题",
  "category": "task",
  "summary": "简短摘要",
  "actionItems": ["下一步行动"],
  "dueDate": "2026-09-21",
  "dueTime": "15:00",
  "priority": "normal",
  "reminder": true,
  "clarification": ""
}
```

前端会再次校验分类、优先级、日期、时间和数组长度。无法确定的信息不得编造；模型应返回空值，并通过 `clarification` 提醒用户确认。

## 6. 失败保护

- 非本地 HTTP 地址会在发起请求前被拦截；公开接口必须使用 HTTPS。
- 请求 30 秒超时，连接测试 20 秒超时。
- 接口错误、跨域错误、超时或 JSON 解析失败都会显示明确提示。
- 整理失败时不修改原始记录。
- 已由用户手动设置的日期与提醒不会因模型返回空日期而被清除。

## 7. 浏览器原型限制

模型服务必须允许浏览器跨域请求。部分服务会拒绝网页直接调用，此时需要兼容的安全代理，或等待 Mac 原生版通过原生网络层接入。

浏览器中使用用户 API Key 只适合个人原型验证。若后续公开发布浏览器产品，应采用服务端令牌管理、用户鉴权、请求限额和隐私审计，不应把平台级密钥下发到浏览器。

## 8. 验收结果

2026-09-20 使用本地模拟接口完成两种协议的端到端验证：

- OpenAI 兼容 Chat Completions 与 Anthropic Messages API 均可完成连接测试和真实整理。
- 供应商切换、默认地址、独立密钥、密钥隐藏和会话存储正常。
- DeepSeek 与智谱 GLM 默认地址正确，切换后不会复用其他供应商的密钥。
- 不安全 HTTP 地址拦截正常。
- 模型结果可更新标题、类型、摘要、行动项、日期、时间、优先级和提醒。
- 整理后记录会自动进入正确的“计划”视图。
- 浏览器控制台无错误。

待项目负责人使用 `deepseek-flash` 完成一次真实成功验证。

2026-09-21 项目负责人使用 DeepSeek 真实 API 验证时遇到 HTTP 400。依据 DeepSeek 当前官方模型列表，原型已更新模型候选、旧名称迁移和安全错误详情，等待使用 `deepseek-flash` 复测。

2026-09-21 使用本地模拟接口完成 AI 协作端到端验证：自然语言可创建结构化任务，任务选择器、任务卡和详情页可引用已有任务，对话可直接更新标题、正文、日期、时间、优先级、提醒、摘要和行动项；切换引用任务会清空旧对话上下文，浏览器控制台无错误。
