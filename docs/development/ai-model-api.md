# AI 模型 API 接入说明

> 版本：V0.2
>
> 更新时间：2026-09-20
>
> 状态：浏览器原型已实现

## 1. 目标

浏览器原型允许用户选择 OpenAI、Claude / Anthropic、DeepSeek、智谱 GLM 或自定义 OpenAI 兼容接口，填写模型名称和 API Key，并由模型完成记录标题提炼、自动分类、摘要、行动项、时间、优先级和提醒建议。

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

OpenAI、DeepSeek、智谱和自定义接口使用以下结构：

- 请求头：`Content-Type: application/json`、`Authorization: Bearer <API Key>`。
- 请求体：`model` 与 `messages`。
- 返回内容：读取 `choices[0].message.content`。

Claude / Anthropic 使用独立适配：

- 请求头：`x-api-key`、`anthropic-version: 2023-06-01` 和浏览器直连标识。
- 请求体：`model`、`max_tokens`、顶层 `system` 与 `messages`。
- 返回内容：合并 `content` 中的文本块。

协议参考：[OpenAI Chat Completions](https://developers.openai.com/api/reference/cli/resources/chat)、[Anthropic Messages API](https://platform.claude.com/docs/en/api/messages)、[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) 和[智谱开放文档](https://docs.bigmodel.cn/)。

测试连接只发送固定短句，不发送用户记录。执行“用 AI 整理”时，才会发送当前记录的标题、正文和已有时间信息。

## 4. 模型输出

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

## 5. 失败保护

- 非本地 HTTP 地址会在发起请求前被拦截；公开接口必须使用 HTTPS。
- 请求 30 秒超时，连接测试 20 秒超时。
- 接口错误、跨域错误、超时或 JSON 解析失败都会显示明确提示。
- 整理失败时不修改原始记录。
- 已由用户手动设置的日期与提醒不会因模型返回空日期而被清除。

## 6. 浏览器原型限制

模型服务必须允许浏览器跨域请求。部分服务会拒绝网页直接调用，此时需要兼容的安全代理，或等待 Mac 原生版通过原生网络层接入。

浏览器中使用用户 API Key 只适合个人原型验证。若后续公开发布浏览器产品，应采用服务端令牌管理、用户鉴权、请求限额和隐私审计，不应把平台级密钥下发到浏览器。

## 7. 验收结果

2026-09-20 使用本地模拟接口完成两种协议的端到端验证：

- OpenAI 兼容 Chat Completions 与 Anthropic Messages API 均可完成连接测试和真实整理。
- 供应商切换、默认地址、独立密钥、密钥隐藏和会话存储正常。
- DeepSeek 与智谱 GLM 默认地址正确，切换后不会复用其他供应商的密钥。
- 不安全 HTTP 地址拦截正常。
- 模型结果可更新标题、类型、摘要、行动项、日期、时间、优先级和提醒。
- 整理后记录会自动进入正确的“计划”视图。
- 浏览器控制台无错误。

待项目负责人使用自己的模型服务完成一次真实接口验证。
