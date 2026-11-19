---
title: "多模型网关设计：连接 Claude Code、Codex 与自选模型"
description: "一套本机网关的设计：接住 Claude Code 的 Messages 与 Codex 的 Responses，转给自选模型 API，再把回答、工具调用与结束状态还回客户端。"
publishedAt: 2026-11-17
category: "AI 与工程"
tags: ["AI Agent", "Claude Code", "Codex", "协议适配"]
draft: false
source: public-rewrite
---

**我们的目标是设计一个多模型网关：**接住 Claude Code 的 Messages 请求和 Codex 的 Responses 请求，转给自选模型 API，再把模型回答、工具调用和结束状态还给客户端。

客户端负责读文件、执行命令、审批和推进任务。网关负责模型通信。下面沿一次“读文件并回答”的任务，把两次模型请求之间的工具往返讲完整。

# 先明确网关的职责

网关统一客户端的接入方式，模型能力、上下文和费用仍来自所接的上游。我们可以使用自己的 API Key、本地模型或已有模型服务。

| 设计问题 | 推荐方式 |
|-|-|
| 如何获得上游调用权限 | 读取自己的 API Key；需要 OAuth 的服务再实现刷新 |
| 如何选择模型与服务 | 本地路由表维护模型目录与供应商公开 API |
| 如何适配两种客户端 | 输入解析、统一回合、输出编码分层，新增上游时只扩展 provider 适配器 |

协议一致时，直接代理即可；协议不一致时，才做转换。上游原生支持 Responses，可先让 Codex 直连；原生支持 Messages，可先让 Claude Code 直连。要让两种客户端都使用同一组模型，网关才需要同时提供两种入口。

# 网关怎样接住模型请求

网关在本机提供 `POST /v1/messages` 和 `POST /v1/responses`。客户端改服务地址后，发来的仍是自己的协议；网关按请求路径选择解析器。

两套解析器进入同一个回合执行器。执行器组织模型、历史、工具、推理参数和 session，交给 provider 适配器调用所选 API；上游 SSE 转成统一事件，再交给对应客户端编码器。

模型名称也经过映射：客户端模型 ID、上游模型名、上下文窗口和工具能力各有用途。前缀或“Max”名称不会自动增加模型能力。

| 信息 | 实际作用 |
|-|-|
| 模型路由表 | 把公开 ID 映射到 provider、上游模型名与凭证 |
| 客户端能力目录 | 告诉客户端上下文大小、推理档位、工具类型和提示词模板 |
| 上游实际能力 | 决定工具调用、图片、推理与上下文能否兑现 |

Claude Code 可通过网关模型发现读取 `/v1/models`。Codex 的模型菜单与工具模式需要它的原生 catalog 格式；只返回名称列表不够。设计时还应提供与客户端版本相匹配的模型配置与指令模板。[1][3]

# 两套协议怎样共用一个回合

内部契约保留任务含义。字段名可以自行设计，但角色、内容顺序、工具 ID、输出限制与结束状态必须有明确位置。

| 语义 | Claude Code 输入 | Codex 输入 | 内部表示 |
|-|-|-|-|
| 指令与消息 | `system`、`messages` | `instructions`、`input` | 有序消息，保留 system／developer／user／assistant／tool |
| 工具定义 | `input_schema` | function 的 `parameters` | 名称、描述、JSON Schema |
| 工具调用 | `tool_use` | `function_call` | 调用 ID、名称、完整参数字符串 |
| 工具结果 | `tool_result.tool_use_id` | `function_call_output.call_id` | 同一个调用 ID、结果内容、错误状态 |
| 生成参数 | `max_tokens`、thinking／effort | `max_output_tokens`、`reasoning.effort` | 输出上限、已支持的推理档位、tool choice、parallel、取消信号 |

基础版先支持文本与 JSON function。内容用有序块保存，别把文本和工具混成一段 prompt；图片和 custom tool 后续扩展时才增加对应块类型。接收不支持的实质内容时明确报错。

内部也保留 developer 角色。上游支持就原样传；不支持时，需要明确约定将其按顺序合入 system，并标注这是近似适配。给消息加角色标记，只能表达来源，不能保证原厂的指令优先级。

```text
TurnRequest：模型、消息块、工具定义、生成参数、会话标识、取消信号
TurnEvent：文本增量、推理增量、完整工具调用、用量、结束、错误
```

下图中，一次工具调用会先结束第一条模型请求，客户端执行工具后再发第二条请求。

![一次本地工具调用对应两次模型请求](/assets/content/llm-gateway-design/arch.webp)

# 工具调用为什么需要两次请求

假设客户端声明了 `read_file(path)`。模型需要读 README 时返回工具调用，网关把它还给客户端，并结束本次模型响应；客户端执行读取，然后把真实结果送进下一次请求。

| 环节 | 这次发送的数据 |
|-|-|
| 第一次请求 | 任务“读取 README 并总结”、历史、read_file 的工具定义 |
| 模型返回调用 | `id=call_1`，`name=read_file`，参数 `{"path":"README.md"}` |
| 客户端执行 | 调用本机工具，取得真实文件内容；网关不执行 read_file |
| 第二次请求 | 原任务与历史＋assistant 的 call_1＋对应的工具结果 |
| 模型继续 | 根据结果总结，或提出下一次工具调用 |

- **参数：**Claude 的 `tool_use.input` 是对象，转入内部时序列化；Responses 的 `function_call.arguments` 本来就是 JSON 字符串。返回时做反向转换。
- **ID：**Responses 输出 item 的 `id` 标识响应项；`call_id` 才关联工具结果。两者各自稳定，不能用新生成的 item ID 替代 call_id。[2]
- **交付：**参数收齐后校验工具名与 JSON，strict 工具还要校验 Schema。客户端应在调用完成后执行，不能在半截参数时执行。

namespace 可以展开成唯一的上游名称，同时存反向映射。上游不支持 custom 自由文本工具时，可用 `{"input":"原始文本"}` 包装成 function，返回时解包。原始名称、namespace 和工具种类要一起保留；语法约束无法保留时明确说明。

历史缺少调用时，只能从本次请求或网关缓存恢复真实调用。恢复不到就报错，不虚构参数。重复通知、空输出和孤立结果需制定受控修复策略；基础版先保证严格配对。

# 流式返回怎样才算完整

SSE 是持续发送事件的 HTTP 流。适配器把网络字节还原成上游事件，执行器再发统一事件，客户端编码器负责创建响应项、发送增量和关闭响应。

| 阶段 | Claude Messages | Codex Responses |
|-|-|-|
| 开始 | `message_start` | `response.created → response.in_progress` |
| 文本 | `content_block_start → text_delta → content_block_stop` | `output_item.added → content_part.added → output_text.delta → output_text.done → content_part.done → output_item.done` |
| 工具 | `content_block_start(tool_use) → input_json_delta → content_block_stop` | `output_item.added(function_call) → function_call_arguments.delta → function_call_arguments.done → output_item.done` |
| 请求结束 | `message_delta(stop_reason, usage) → message_stop` | `response.completed`，携带最终 output 与 usage |

表中的 delta 在 Claude 属于 `content_block_delta`；Codex 的事件名统一带 `response.` 前缀。响应 ID、item ID、block／output index 保持一致，Responses 的 sequence number 单调递增。[2][3]

**结束一次响应不等于结束整个任务。**上游因工具调用结束时，Claude 的 stop reason 是 `tool_use`；Responses 可以是带已完成 function_call 的 `response.completed`。客户端看到调用后执行工具，再开启下一轮。

| 实际结果 | Claude 终态 | Responses 终态 |
|-|-|-|
| 正常文本 | `end_turn` | `completed` |
| 输出达到上限 | `max_tokens` | `incomplete`，reason 为 max_output_tokens |
| 流内失败或异常 EOF | 协议 error，不能伪装正常 stop | `failed`，保留错误信息 |

- **解析：**用流式 UTF-8 解码，保留跨 chunk 的尾部，按空行组帧，合并多行 data。Chat Completions 常常没有 event 行，需要读取 data JSON 内的 choices。
- **传输：**先用非流式请求做 HTTP 冒烟，真实客户端则必须兑现 `stream:true`。长时间无输出时发送合法保活；断连时通过 AbortController 中止上游并清理计时器。
- **重试：**尚未交付答案或工具调用时才进行有界重试。已交付后从头重试会重复内容；普通工具只让客户端执行一次。

基础版不主动开启扩展思考，也不声明 thinking 能力。要展示推理时，另加 Claude thinking block 或 Responses reasoning summary 的编码与回放规则；不要把普通文本、可见摘要和私有推理状态混为一谈。

排队提示应与任务内容分开，不能在下一轮变成用户指令。

# 上游模型 API 怎样接入

下面固定一种外部方案：上游支持 OpenAI 兼容的 Chat Completions 和 function calling。网关对客户端继续提供 Messages／Responses，上游适配器请求 `POST /v1/chat/completions`。

配置一个公开别名 `external-code`，映射到所选服务的真实模型 ID。网关读取 `UPSTREAM_BASE_URL` 和 `UPSTREAM_API_KEY`，凭证只发给该上游。

```json
{
  "model": "REAL_MODEL_ID",
  "stream": true,
  "messages": [
    {"role": "user", "content": "读取 README 并总结"},
    {"role": "assistant", "content": null, "tool_calls": [
      {"id": "call_1", "type": "function", "function": {
        "name": "read_file", "arguments": "{\"path\":\"README.md\"}"
      }}
    ]},
    {"role": "tool", "tool_call_id": "call_1", "content": "实际 README 内容"}
  ],
  "tools": [{"type": "function", "function": {
    "name": "read_file",
    "description": "读取文件",
    "parameters": {"type": "object", "properties": {
      "path": {"type": "string"}
    }, "required": ["path"]}
  }}],
  "tool_choice": "auto"
}
```

第一次请求只含原任务、既有历史与工具定义；第二次才加入真实调用和结果。示例省略了 system 与生成参数，实际构造时按内部契约保留。

| 上游返回 | 适配器如何处理 |
|-|-|
| `choices[].delta.content` | 变成文本增量，交给客户端编码器 |
| `delta.tool_calls` | 按 index 汇总，保留 id 和 name，拼接 function.arguments；完成后生成完整工具事件 |
| `finish_reason` | 把 stop／tool_calls／length 转成前节的语义与终态 |
| 用量与上游错误 | 按供应商口径归一；流开始前返回 HTTP 错误，开始后返回协议内错误 |

请求参数也由该适配器决定：输出上限使用上游支持的字段，reasoning 档位与 parallel tool calls 按能力映射。某服务只接受 low／high 时，不要直接转发 xhigh。API 兼容标签不能代替真实调用验证。[2]

认证分两段：客户端携带网关自己的 `LOCAL_GATEWAY_KEY`，网关实际校验它；上游使用 `UPSTREAM_API_KEY`。两段凭证分别管理，不用固定示例字符串代替访问控制。

- **消息历史：**由客户端回传完整消息，或使用它压缩后的文本摘要。
- **上游推理状态：**只回送给原 provider 与模型，不能用可见摘要替代。
- **响应引用：**`previous_response_id` 要求网关存储并恢复历史；会话 ID 本身不包含历史。

需要回放上游私有状态时，可按 provider、模型和会话保存，再给客户端一个引用。设置过期时间，恢复时核对归属；Base64 只做编码，可见推理摘要不能替代私有状态。

基础版使用完整历史，`store:false`，不接受 previous_response_id 与不可转换的非空推理密文。切模型时保留公开历史，跨 provider 的私有状态需要丢弃或拒绝。客户端压缩后的摘要仍可作为文本历史继续任务。

# 交给实现 AI 的默认方案与验收

默认目标是本机 Node.js／TypeScript 网关、一个外部 Chat Completions 上游、两种客户端入口；基础能力是文本、JSON 工具、完整历史和 HTTP SSE。通用图片、搜索、订阅共存与桌面修改以后再加。

| 模块 | 唯一职责 |
|-|-|
| `server` | 路由、请求体限制、网关认证、请求取消与 HTTP 响应 |
| `claude / codex` | 各自解析输入，并编码 JSON／SSE；两端必须都有编码器 |
| `turn` | 组织内部契约、历史配对与单次模型调用，不执行本机工具 |
| `provider / sse` | 构造供应商请求、解析流、归一事件、终态与错误 |
| `models / state` | 别名与能力表、工具名称反向映射；仅在实现引用功能后存 response 历史 |

先验证上游可调用，再完成一次文本与工具往返，随后完成两套 SSE 编码器，最后接真实客户端。第一阶段的 curl 通畅不能替代客户端验收。

Claude Code 的配置示例：网关把 `claude-external-code` 映射到 external-code。鉴权值用本机生成的网关 Key，不能填供应商 Key。[3]

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8791",
    "ANTHROPIC_AUTH_TOKEN": "LOCAL_GATEWAY_KEY_VALUE",
    "ANTHROPIC_API_KEY": ""
  },
  "model": "claude-external-code"
}
```

Codex 使用同一个网关，但 base_url 带 /v1。`LOCAL_GATEWAY_KEY` 是在启动 Codex 的环境里设置的变量名；保留现有配置，先用独立配置测试。[1]

```toml
model_provider = "external"
model = "external-code"

[model_providers.external]
name = "External gateway"
base_url = "http://127.0.0.1:8791/v1"
wire_api = "responses"
env_key = "LOCAL_GATEWAY_KEY"
```

- **辅助请求：**真实客户端还会请求小模型、count_tokens 或额外参数。为已知快模型别名明确配置路由，未知模型返回错误；token 估算与实际 tokenizer 的计数分开标注。
- **能力声明：**model discovery 与 catalog 按客户端版本接入，只声明已兑现的能力。custom／namespace 出现在真实请求里时，按前文扩展或关闭相应客户端功能；基础 JSON 工具不等同于全部 Codex 工具。

| 额外字段 | 处理规则 |
|-|-|
| metadata、追踪信息、stream:false | 识别并安全接受；需要用到的 session 信息进入内部契约 |
| beta header、cache_control、工具搜索、结构化输出 | 逐项标记直通、转换或不支持；不能一律丢弃，也不能盲传另一种协议 |
| background、远程压缩、非空不可转换状态、previous_response_id | 基础版明确报不支持；支持后需补对应状态存储与测试 |

让实现 AI 交付时，要求记录客户端版本、目标 provider 和如下运行证据。表里每项都是独立验收条件，不靠“代码里写了”来证明。

| 试验 | 通过条件 |
|-|-|
| 两种客户端各发一段文本 | 走 external-code 对应的真实上游，收到合法终态 |
| 两种客户端各执行一次 read_file | 本机工具只执行一次；第二次模型请求含原 call_id 与真实结果；答案引用工具内容 |
| 两个工具的参数交错分片 | 按 index／ID 分别收齐；不串参数；Schema 错误不能交付为有效调用 |
| SSE 任意位置切片，含中文和多行 data | 合并后文本与未切片对照一致；ID 稳定；终态只出现一次 |
| 主动取消、429、半截流断开 | 取消停止上游；重试有界；异常 EOF 不是 completed；不重复工具动作 |
| 输出达上限、未知模型、不支持的实质字段 | 正确区分截断与失败，不偷偷改模型或丢任务语义 |
| 长对话与切换 provider | 仍用公开历史继续任务，不回放另一家服务的私有状态 |

按这些默认选择，接手的 AI 可以独立确定模块和转换规则，并开始实现、联调。是否已经可用，取决于实际客户端与上游通过上述试验；仅补一份类型声明不能保证一次完成。

# 公开参考与验收边界

本文给出一套可实施的网关设计，公开协议负责定义接入契约，具体 provider 能力与客户端版本需要在实现时核对。

1. [Codex provider 定义](https://github.com/openai/codex/blob/main/codex-rs/model-provider-info/src/lib.rs)：Responses 接入和模型 catalog。
2. [OpenAI 工具调用](https://developers.openai.com/api/docs/guides/function-calling)、[Responses 事件规范](https://developers.openai.com/api/reference/resources/responses/methods/create)：调用 ID、参数增量与响应生命周期。
3. [Claude Code 网关协议](https://code.claude.com/docs/en/llm-gateway-protocol)、[Messages 流式协议](https://platform.claude.com/docs/en/build-with-claude/streaming)：接入、模型发现与事件顺序。

文中的验收表规定实现完成标准。设计说明和协议核对不代表新网关已经完成联调；交付时应提供实际客户端与目标上游的运行证据。
