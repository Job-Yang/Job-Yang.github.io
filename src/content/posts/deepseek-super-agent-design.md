---
title: "DeepSeek Super-agent 深度调研"
description: "Router、Worker、事件直通和持久恢复如何组织多任务Agent，调度实验支持什么，研究原型还缺什么。"
publishedAt: "2026-11-02"
category: "AI 与工程"
tags: ["AI"]
draft: false
---

> [!NOTE]
> DeepSeek Harness ：《Exploring Super-agent Design: Towards a More Autonomous Agent System》与配套研究原型。

 **这篇文章的价值，在于把多任务 Agent 的瓶颈从“模型能否完成工作”推进到“系统能否持续接住工作，并减少人的介入”。**  它把任务分派、消息续接、上下文读取和故障恢复组织成一套架构，已有可阅读的实现。初步实验支持调度效率改善；真实编码质量、人的注意力节省、长期运行和安全隔离，仍需要各自的证据。

X 上的英文全文注明为中文原文的机器翻译。本报告已通读该版本，沿其引用读取 Anthropic 原文，并静态核对官方仓库。源码固定在提交 6337fc823ce20251c8de8085948165c81aaa701e，未安装或运行原型；下文分别说明作者实验、可见实现与研究判断。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)[[2]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/README.md)

# 研究问题与方法

本报告围绕三个问题展开：Super-agent 如何在多个渠道与任务之间保持连续；文章的实验到底支持哪些收益；开源原型距离可靠的实际部署还差什么。研究类型是公开技术材料的定向分析与固定版本源码核对，不是覆盖整个行业的系统综述，也不是独立性能复现。

原文是设计和实验主张的首要来源；官方仓库的 README、领域模型、授权、执行、架构和部署文档用来判断实现范围，并核对对应源码。外部对照选择文章直接引用的 Anthropic Managed Agents，以及与并行、恢复和生产力测量相关的官方材料。转述报道只用于定位原始材料，不承担关键数字或机制结论。

| 材料类别 | 本报告如何使用 | 可以证明什么 | 无法据此证明什么 |
| --- | --- | --- | --- |
| 作者文章 | 通读机制、实验设置与未决问题 | 作者的设计、观察和报告数值 | 其他团队复现后一定有同样收益 |
| 固定版本代码与文档 | 对照接口、状态、权限和恢复路径 | 该版本具体有哪些实现 | 所有代码在目标环境都正确运行 |
| 独立机构的工程资料 | 核对共通机制与不同边界 | 这些工程问题确实被独立实践处理 | DeepSeek 实验数据已被独立验证 |
| 公开工作台说明 | 用于提出适合个人工作台的建议 | 本次建议的应用背景 | 本地工作台已经具备全部能力 |

研究材料的边界也决定结论：原文英文版经过机器翻译，数字以其表格精度为准；性能实验来自作者，源码核对只覆盖固定提交。没有原始实验轨迹、完整模型配置或长期部署数据的部分，按缺失条件限制判断，不以新闻转述补齐。全文中的应用例子用于解释机制，不冒充作者的实际实验结果。

# 会话管理开始限制多任务交付

一个 coding agent 已经能在单项任务中连续读代码、修改和测试。人同时交给它几件事时，却往往仍要记住：哪个会话处理哪个问题，哪项改动在等 CI，哪个 PR 的评论需要转回原会话。任务越多，管理这些会话的工作越重。文章提出，人通常只能跟住 3～5 个活跃会话；这是团队经验，没有给出用户研究来证明这个数量具有普遍性。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

因此，作者想建立一种持续存在的协作者：人在聊天或 GitHub 里提出需求，系统自己找到相关任务，接住后续意见，后台并行推进，最后在需要判断时回来。文章称其为 Super-agent，并提出 Continuous、Productive、Proactive、Persistent 四项要求，对应跨渠道连续性、并行产出、主动响应环境，以及持续在线与恢复。它描述的是 Agent 系统的行为要求，没有声称发布了一个更强的基础模型。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

这也解释了为什么接入 MCP 或消息平台还不够。连接器解决“消息和工具能否到达”，但任务属于谁、是否重复、旧决定有没有被替换、重启后从哪里继续，都需要额外的状态与调度逻辑。一个入口能收到群消息，与它能可靠地承担群里的工作，是两种成熟度。

# Router 保连续，Worker 保并行

如果所有工作都进入同一会话，全局信息容易连续，但长任务会占住执行，多个任务的细节也会混在上下文里。如果每条消息都开新会话，并行容易了，前后关系又容易断。文章用双层架构处理这个冲突。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

Router 是长期存在的全局协调层，负责接收请求、判断归属、分派和汇总回复。Worker 是执行层，每个 Worker 只处理一项任务，持有独立上下文与执行工具。复杂任务仍可在 Worker 内部使用 Subagent 或 Agent Team；上层 Router 无须参与每项任务的具体拆解。

<img src="/assets/content/deepseek-super-agent-design/image-01.webp" alt="Router与Worker分工及事件直通" width="2200" height="2200" loading="lazy" decoding="async" />

读图时先看新候选进入 Router、再分给并行 Worker 的路径；左侧直通路径用于已订阅线程的后续事件。图简化了路由关系，原型的授权与恢复细节见后文。

| 职责 | Router | Worker |
| --- | --- | --- |
| 信息范围 | 各任务的关系、状态与重要结论 | 当前任务的代码、日志、历史与执行细节 |
| 核心工作 | 归属判断、分派、跨任务协调、对外回复 | 复现、实现、验证、形成可交付结果 |
| 并发方式 | 轻量决策，必要时合并事件批次 | 各自推进；内部可再委派 |
| 模型选择 | 作者认为较轻模型通常足够，尚无完整选型对照 | 作者建议使用能力最强的可用模型 |
| 对人的呈现 | 保持统一交流入口 | 执行细节留在内部，报告交给 Router |

上表是文章的职责划分。原型也把主 Session 和执行 Session 分开配置模型与工具，不过 Router preset 仍有受限 shell 能力。因此，“Router 可以完全没有 Bash”是架构选择，不能直接当成原型已经实施的权限边界。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)[[5]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md)[[17]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/cordis.patch.yml)

这套划分与常见的“组长带几个专家处理一项任务”有所不同。Super-agent 的上层主要管理 **多项独立工作的连续生命周期** 。当任务强耦合，需要成员频繁交换细节时，复杂协调仍然存在，只是落在 Worker 内部或交由 Router 处理。分层不能消除任务本身的依赖。

# 事件直通与按需回忆

## 线程、任务与事件的归属

系统有了分工，还需要知道后来的消息送给谁。文章把环境消息称为 Trigger，把同一个 PR、聊天话题或邮件链的连续事件称为 Thread。Worker 接到任务后订阅相关 Thread，后续事件由程序直接投递，减少 Router 逐条转发。订阅是多对多关系：一项任务可以关联聊天与 PR，同一 Thread 也可以有多个订阅者。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

## 用代码过滤，再用模型判断

接入真实平台之后，绝大多数事件无需行动。文章先用程序规则判断来源、群范围和允许的身份，过滤确定无关的内容；剩余候选再由模型结合上下文和自然语言规则判断。它借用 Fast Path／Slow Path 的分工，把稳定、便宜的判断留给代码，把需要语义理解的判断交给模型。原型的 observe 模式则允许先记录命中而不执行，后文会说明其边界。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)[[4]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)

源码对此有明确实现。

| 对象 | 用途 | 实现中的关键约束 |
| --- | --- | --- |
| Trigger | 一条不可变事件 | 相同 ID 再次接入返回 duplicate |
| Thread | 一组有关联的事件 | 管理订阅与待评估事件；同线程至多一个 Eval |
| Ticket | 一项已授权工作 | 持有范围、输入、交付渠道与生命周期 |
| Mandate | 工作为何可做、可做到哪里 | 记录来源身份、策略版本、范围与授权强度 |
| Assignment | 一次执行绑定 | 把 Ticket 交给 Executor；重启或重试可以换一轮绑定 |

这些对象来自原型的领域模型；文章主要讨论 Trigger、Thread 和 Worker。Ticket 的价值是把工作状态从模型会话里拿出来：会话空闲、执行失败、等待审阅和任务结束可以分别表达。[[3]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/001-domain.md)[[7]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/intake.ts#L19-L63)

## 一项任务如何跨渠道继续

可以用一条示意链理解这些对象：允许的用户在聊天中请求修复问题，Source 记录 Trigger，Router 创建带范围的 Ticket，Executor 在独立目录执行。它打开 PR 后，任务订阅这个 PR 的 Thread；新的评论和 CI 结果进入原任务。Router 接到关键结果或问题，再向人回复。这个例子依据文章与领域模型整理，用来解释生命周期，不是本报告运行得到的记录。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)[[3]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/001-domain.md)

如果 PR 评论只是要求在原修复范围内补测试，Worker 可以继续。如果评论提出另一项独立需求，就要退回 Router 判断归属与新的授权。它也可能只是相关背景：原型专门区分仅用于上下文的订阅，防止“看过某个讨论”被默认为“获准处理那个讨论”。[[4]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)

这条链要求始终区分 Thread、Ticket 与 Session。Thread 按平台讨论组织事件；Ticket 表示已授权工作；Session 是执行器用来调用模型的上下文容器。一项 Ticket 可能关联多个 Thread，也可能先后经历多个 Assignment。把三者硬绑为一对一，跨渠道续接、执行器替换和恢复都会变得困难。[[3]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/001-domain.md)

共同订阅让多个 Worker 看到同一环境的变化，但不等于解决了资源冲突。若两个任务改同一分支、文件、构建缓存或同一个 PR，仅靠事件同步还不足以保证一致性。实际部署应为共享资源定义所有权、协调或串行规则；文章也把更强耦合任务的协作拓扑列为后续问题。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

## 上下文不扩大授权

这里有个重要细节： **事件投递不等于新增授权。**  订阅路径可以接收整个 Thread 的内容，包括机器人和 CI 消息，而不重复走新任务准入。执行者要在原有 Mandate 范围内处理，越界请求应退回 Router。只为补充背景而订阅的 Thread，也不能据此恢复一项已结束的工作。[[4]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)

这种设计节省判断开销，同时让“上下文”与“指令”混在同一个输入流里的风险更突出。来源和范围的检查需要落在宿主能执行的规则上。仅在 prompt 里写“不要越权”，不能获得与沙箱或权限代理相同的保障。

## 摘要索引与原始材料分开

事件持续累积后，还有上下文窗口有限的问题。文章提出 Inline & Spill：把马上可能用到的摘要和关联 ID 放进窗口，完整长内容保存在外部，需要时再读。Chain of Recall 沿 ID 逐跳找回相关任务和历史，例如从当前 PR 评论找到所属任务，再找到最初的聊天请求。它相当于让模型先读档案目录，再按目录查原件。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

原型的 cards.ts 与这一思想一致：事件卡片给出 ID、预览、总长度和读取路径，长文本支持分页，任务卡片链接报告、输入与 transcript。这些是可见的按需读取机制，仍没有证明模型一定会找到所需证据，也没有解决几个月后的记忆冲突、事实失效和重要性更新。文章 §8.1 本身也把长期记忆列为瓶颈。[[8]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/cards.ts)[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

## 提前行动的收益与成本

主动性还包括文章 §3.4 的提前行动：环境信号出现后，先在后台尝试复现、收集背景或准备结果，再决定是否交付。作者举出的内部规则是静默复现并修复；确认问题且找到简单修复时才给出结果，否则保持安静。这里的授权来自团队事先写明的规则，不能理解为任意群消息都允许改代码。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)[[4]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)

它用额外计算换取更短的等待，因而适合试错成本低、结果可复核、失败能收住的工作。要判断是否划算，应把没有形成交付的后台消耗、误触发、重复工作和审阅成本一起计入。文章没有量化这种提前行动的净收益，也没有证明保持安静就等于没有风险；外部写入和权限仍须单独限制。

## 渠道决定报告的呈现方式

文章把详细推理和工具输出留在 Worker 内部，再由 Router 统一对外回复。群聊里优先给结果、具体问题或需人工决定的事项；GitHub、邮件和文档则保留背景、改动与验证证据。原文提到的 100 words 上限是作者的交流策略，不能换算成对所有中文场景都合适的固定字数。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

原型的 panel 把用户关心的事情排成三个问题：现在有没有事需要我；系统是否健康并在做正确的事；某项工作从触发到结果发生了什么。它以结构化状态区分等回答、等审阅、受阻、失败、工作中与等待事件，避免从模型最后一句话里猜状态。[[21]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/005-panel.md)

| 展示对象 | 优先给人的内容 | 完整证据的位置 |
| --- | --- | --- |
| 接到明确请求 | 确认一次，并说清将处理什么 | 原始请求与任务关联 |
| 正在执行 | 仅在有必要时更新，不逐条转发工具日志 | 执行记录、日志与产物 |
| 需要人决定 | 一个具体问题，注明影响和可选动作 | 范围、授权与当前证据 |
| 交付审阅 | 结果、改动与验证情况 | PR、报告与对应版本证据 |
| 失败或停止 | 卡在哪里、已做什么、收到什么可继续 | 错误与恢复记录 |

这套呈现的意义是降低读者判断成本。保持安静必须和可追溯、可停止同时成立，否则系统的失败会被隐藏，或者后台工作继续消耗预算。官方 philosophy 也反对为了增加产出数量而批量制造 PR 或广播消息。[[20]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/000-philosophy.md)[[21]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/005-panel.md)

# 异步执行与持久恢复

## 后台运行时仍能接住反馈

任务有了归属，还可能被漫长的编译或工具调用卡住。文章把同步 run() 改成异步 start()：先返回 Started，后台完成后把结果作为事件送回会话。人可以在执行期间改要求或叫停。这里的“全双工”是交互与执行解耦；新输入仍要等当前模型推理步骤结束，并不表示一次推理中能随时抢占。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

原型把主 Session 与 Worker 的前台 shell 等待上限设为 5 秒，超过后转为后台工作。Worker 有后台任务时继续占用并发槽位，完成事件再唤醒它；人工续接可使用正常上限之外的一个槽位，避免新任务排队压住人的反馈。WorkerSlots 先同步预留槽位再启动异步操作，处理了两个启动争抢最后一个名额的问题。[[6]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md)[[17]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/cordis.patch.yml)[[18]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/executor/dsh.ts#L167-L207)

这比“工具超时后继续聊天”完整：后台作业是谁的、结果送哪里、何时释放容量，都有明确状态。作为对照，OpenAI background mode 主要解决长模型请求的后台运行与状态查询，粒度不同，不能单独替代任务路由和工具生命周期管理。[[15]](https://platform.openai.com/docs/guides/background)

## 运行、状态与环境的分离

持续在线还要求状态不依赖某个进程。文章进一步拆分 Agent Loop、持久状态与执行环境：Loop 可以在云端运行，状态存在数据库，代码仓库、特殊工具链和设备留在原机器，由轻量端点执行命令。Anthropic Managed Agents 已公开相近的 session、harness、sandbox 分离思路，文章也直接引用了它。双方实践支持这种分离有工程价值，不能据此推断二者的安全保障和可用性等价。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)[[11]](https://www.anthropic.com/research/managed-agents)

<img src="/assets/content/deepseek-super-agent-design/image-02.webp" alt="Agent运行、持久状态与执行环境的分离" width="2200" height="2200" loading="lazy" decoding="async" />

图中分别表示推理与调度、持久记录、独立监督以及可连接的执行环境。它解释文章的目标设计，不表示开源原型已经具备全部云端与跨设备实现。

 **开源原型采用的是更集中的部署。**  它运行在专用 DeepSeek Harness profile 中，使用本地 SQLite 保存工作状态，目录锁阻止第二个进程同时写同一状态目录。部署说明没有提供云端弹性 Loop 与多端 daemon 的完整落地路径。“装好原型即可跨设备一直工作”超出了可见实现。[[5]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md)[[9]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md)

## 持久动作与恢复后的核对

恢复机制中，最值得读的是 Effects 队列：动作先写入事务，提交后才执行；失败保留并退避重试，同一种类与 key 的待办会合并，generation 检查防止旧执行结果覆盖更新后的内容。Session 投递也通过固定 request ID，并结合持久历史与收件箱去重。[[10]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/effects.ts)[[19]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/delivery.ts)

这些保证都有范围。Session 消息去重，不能保证外部世界的所有副作用恰好发生一次。例如 PR 已创建、回执尚未落盘就崩溃，恢复后仍须查外部状态。原型的恢复提示明确要求先看 worktree、Git 历史和 GitHub，避免重复操作。LangGraph 的 durable execution 文档也要求把副作用单独记录，用幂等 key 或结果检查处理重放。三者相互印证： **可靠恢复需要知道哪些动作已经发生，不能只把旧对话重新送给模型。** [[6]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md)[[11]](https://www.anthropic.com/research/managed-agents)[[13]](https://docs.langchain.com/oss/python/langgraph/durable-execution)

## 存活检查之外的进展判断

最后，文章用外部 Watchdog 观察进程和任务进展，尝试识别“进程还活着，但工作没有推进”。原型提供组件健康状态，并给出从另一个 profile 定时检查、按退出码恢复的办法。这是外部维护循环的参考实现；材料未展示完整的语义进展判断准确率，以及误停、误恢复的评测。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)[[9]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md)

# 实验支持调度收益

文章 §7 的实验目的和数据很明确，但结论应限定在测试负载内。它模拟群聊和 GitHub CI 消息流，每轮约 300 条消息、约 20 个工作请求，其余包含闲聊、追问、取消与 CI；真正的编码被只消耗时间的工具替代。每种设计运行 5 次。消息间隔与任务耗时缩为原来的 1/4，模型调用时间保持真实。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

| 配置 | 任务完成时间 p50 | 任务完成时间 p95 | 每轮全 Session 缓存读取 token |
| --- | --- | --- | --- |
| Super-agent | 12.4 分钟 | 15.7 分钟 | 23.2M |
| Super-agent，去掉直通 | 12.6 分钟 | 15.5 分钟 | 31.8M |
| 单 Session + Subagent，中性 prompt | 20.4 分钟 | 29.5 分钟 | 6.1M |
| 单 Session + Subagent，优先委派 prompt | 13.8 分钟 | 29.0 分钟 | 10.8M |

数据直接来自原文表格；M 表示百万。完成时间从工作请求到结果消息计算，p50 是中位数，p95 描述较慢的一端。转述文章出现更细的 token 数字时，本报告保留原文精度。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

以优先委派版本为对照，用表中数据计算，Super-agent 的 p50 缩短约  **10.1%** ，p95 缩短约  **45.9%** ；缓存读取 token 约为  **2.15 倍** 。以中性 prompt 对照，p50 缩短约  **39.2%** ，p95 缩短约  **46.8%** 。这些是完成耗时的相对变化，没有测出同样比例的开发者生产力提升。

中性 prompt 的模型在 5 次运行中一次也没调用 Subagent。优先委派 prompt 在 4 次运行中委派，另一次判断工作“小”，自己执行，形成长尾。这说明该负载下，让主 Session 临场决定是否委派容易产生不稳定行为；明确分工减少了这种调度失误。它还没有排除更强模型、更好的单会话调度器或强制委派基线获得相近结果的可能。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

直通的作用也要读准确。去掉直通后，p50 与 p95 几乎不变；Router 决策次数却增加约 30%，总缓存读取 token 从 23.2M 增至 31.8M，约多 37%。换一个方向算，启用直通相对无直通节省约 27% 的缓存读取量。这个负载支持它降低转发和推理开销，没有显示它提高编码质量或明显缩短完成时间。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

Router 压测把需决策 Trigger 的到达率从约每分钟 1 个提高到 40 个：平均批量从 1.0 增到 2.8，每次请求耗时从 2.5 秒增到 3.9 秒，每个决策的摊销推理时间从 6.4 秒降到 1.6 秒。一个决策可能包含多次请求，所以这三类量不能直接相除替代。该实验支持“当前负载下合批提高有效吞吐”，没有展示继续增压后的饱和点，也没有完整的决策错误率随负载变化曲线。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

| 想回答的问题 | 本次实验能否回答 | 依据或缺口 |
| --- | --- | --- |
| 多任务消息流中，分层调度是否更稳定 | 有初步支持 | 中位与长尾耗时，中性与委派 prompt 对照 |
| 直通是否减少 Router 开销 | 有支持 | 决策次数与缓存读取量下降 |
| 真正的代码是否更正确 | 不能 | 没有执行真实编码任务 |
| 人被打断得更少、审阅更省时 | 不能 | 没测人工介入、审阅或切换耗时 |
| 持续运行数月是否可靠 | 不能 | 没有长期负载、故障与恢复数据 |
| 总费用是否划算 | 不能 | 仅有缓存读取量，缺输入／输出量、价格与交付价值 |
| 换模型、项目、团队后是否仍领先 | 不能 | 缺完整复现材料和跨场景结果 |

Anthropic 的多 Agent 研究实践报告过独立上下文与并行的收益，同时指出 token 消耗高、强依赖任务不适合简单并行。它支持文章的取舍方向，但任务和指标不同，不能当作 DeepSeek 数字的独立复现。[[12]](https://www.anthropic.com/engineering/multi-agent-research-system)

更值得补的数据是“每项被接受的交付耗费多少人工时间”。METR 在 2026 年实验更新中明确提到：开发者同时使用多个 Agent 时，单项任务耗时难以可靠归属，任务选择和参加实验的意愿也会影响结果。这说明任务总耗时缩短、人工时间减少和产出价值提高，需要分别测量。2025 年的旧减速结果不应用来判断本次新系统。[[14]](https://metr.org/blog/2026-02-24-uplift-update/)

## 实验仍存在的替代解释

这里最有力的结果是“把执行从主会话移走，减少新事件对正在处理任务的干扰”。但比较中同时改变了职责约束、消息投递和模型上下文组织，不能把全部耗时差异都归因于某一个设计。中性 prompt 不委派、优先委派 prompt 偶尔自己执行，也是模型遵循分工的差异。要隔离架构收益，还应加入明确强制委派、相同模型和预算的对照。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

每种配置 5 次运行足以发现方向和明显失败模式，却不足以稳健估计真实环境里的长尾。原文没有说明表中百分位具体是如何跨任务与运行聚合的，也没有给出置信区间。这里既不能把 5 次运行当成只有 5 个任务样本，也不能把 p95 当成成熟服务的延迟承诺。

时间缩放也是需要保留的条件。任务和消息间隔缩短，推理耗时不缩，会提高推理延迟相对于任务执行时间的占比，从而改变队列压力和结果。这个设置适合低成本观察调度行为，但恢复成真实时间尺度之后，收益幅度可能变化。原文没有提供另一组时间尺度来估计这个影响。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

缓存读取量尤其容易被误读。它反映被计量的缓存输入，不等于所有 token，更不等于费用；输出、非缓存输入、不同模型的单价与后台执行成本都缺失。23.2M 对 10.8M 只能算出该项计量约 2.15 倍，不能宣称总账单也是 2.15 倍。

如果任务越多，人工审阅和合入可能成为新的瓶颈。系统完成更多候选改动，并不意味着团队接受了更多有价值的交付。更完整的比较应同时记录交付接受率、审阅时间、返工与回归，以及主动任务里被丢弃的工作。这个判断是对测量设计的建议，不是原文已经报告的现象。

# 与已有 Agent 工程的关系

Super-agent 的分层、异步、持久化和引用读取都能找到成熟的工程来源。文章自己也说明没有提出全新理论。它的贡献主要在于把这些机制围绕一个具体目标组织起来：持续接收团队环境中的事件，把多任务管理从人手中移到系统。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

| 对照对象 | 已公开的重点 | 与 Super-agent 的共同点 | 本报告的判断边界 |
| --- | --- | --- | --- |
| Anthropic Managed Agents | session、harness、sandbox 分离，持久事件与凭据代理 | 运行、状态和环境各有接口，可分别替换或恢复 | 两者的部署场景与安全实现不同，性能数字不能直接比较 |
| Anthropic 多 Agent Research | 主 Agent 委派独立研究，强调工具、预算与恢复 | 独立上下文与并行；协调和 token 开销需要控制 | 主要围绕一项研究任务，不等同于团队多任务长期管理 |
| LangGraph durable execution | 检查点、重放、暂停恢复与副作用幂等 | 把恢复作为明确状态机制 | 提供执行基础，不自动解决事件准入、全局路由或产品界面 |
| OpenAI background mode | 长模型请求后台运行、查询与取消 | 前台连接不必阻塞等待 | 一个后台响应对象不等于持久任务调度系统 |
| 普通单 Session + Subagent | 根据本次任务临场委派 | 可以使用多个上下文并行工作 | 若无任务状态与续接机制，仍需要人管理事件归属 |

前四项的机制分别来自官方资料。最后一项按文章的实验基线和一般职责定义对照，不代表所有现有 Agent 产品都缺少相应能力。[[11]](https://www.anthropic.com/research/managed-agents)[[12]](https://www.anthropic.com/engineering/multi-agent-research-system)[[13]](https://docs.langchain.com/oss/python/langgraph/durable-execution)[[15]](https://platform.openai.com/docs/guides/background)

这些材料共同支持两项较稳的工程判断。第一，长期工作需要可恢复的外部状态，模型窗口不能承担唯一档案。第二，把执行与协调分开，能让系统控制并发、输入归属和交互节奏。它们没有共同证明特定模型或特定 Router 拓扑在所有任务中最优。

## 何时分层收益更明显

| 工作特征 | 更可能适合的组织方式 | 原因 |
| --- | --- | --- |
| 独立问题同时到来，反馈分散在聊天与 PR | Router 管生命周期，Worker 各自执行 | 归属、续接与并行可以分别处理 |
| 一项高度耦合重构，反复共享细节 | 一个任务下集中协调，按明确边界委派 | 减少跨任务传话和资源冲突 |
| 单个短问题，很少后续反馈 | 直接在单会话处理 | 常驻路由与持久任务开销可能高于收益 |
| 跨设备且依赖特定本地环境 | 路由与执行端分离，并明确等待设备的状态 | 上层在线不能使离线硬件执行工作 |
| 多个团队之间有严格信息边界 | 按权限与共享需求划分实例 | 全局连续性应服从组织的信息隔离 |

上表是根据机制做出的选型建议，仍需在具体负载上验证。作者在 §8.3 讨论 A2A 时指的是一般的 Agent 间通信，没有绑定某个协议；它也没有解决跨实例的身份、权限和可信信息交换。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)

# 原型的成熟度与权限边界

官方 README 明确把项目定位为研究参考代码，说明它不是官方 DeepSeek 产品，不等同于内部版本，也没有实现文章中的所有设计。代码位于 DeepSeek 官方组织之下，可以确认来源；这个归属不改变 README 给出的成熟度边界。[[2]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/README.md)

| 文章设计 | 原型中可见的实现 | 判断 |
| --- | --- | --- |
| 双层会话与并行任务 | 主／执行 Session、Ticket、独立目录、槽位控制 | 有具体实现 |
| 事件过滤与线程直通 | GitHub、可选飞书 Source，准入与订阅 fan-out | 有具体实现 |
| 按需上下文与引用追溯 | 摘要卡片、ID、资源链接、分页原文 | 有具体实现；长期记忆未解决 |
| 异步工具与及时续接 | 5 秒前台等待、后台状态、人工续接优先 | 有具体实现；依赖宿主生命周期 |
| 持久状态与恢复 | SQLite、Effects、回执、Session 去重、恢复提示 | 有具体实现；外部动作仍须核对 |
| 云端 Loop 与多端执行 | 专用 profile 与执行根的集中部署 | 未见文章完整云端／多端部署实现 |
| 语义 Watchdog | 健康状态与另一 profile 的定时维护建议 | 未见完整进展判断评测 |
| 需人处理的工作集中呈现 | 显示待决定工作与系统问题的 panel | 有实现；实际节省注意力未测 |

以上是固定版本的静态核对，依据领域、执行、架构、部署文档与对应源码，不是部署验收结果。[[3]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/001-domain.md)[[5]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md)[[6]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md)[[9]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md)

安全问题并非只有未来云端架构才会遇到。部署文档明确写出：Router 与 Worker 都以操作者 OS 账号运行，使用 danger-full-access；账号包装器只决定默认凭据，不隔离进程。Worker 可通过绝对路径运行程序，也可读取运行账号的 home。每个 Ticket 一个目录，提供的是工作组织与一定的改动分离，不能阻止读取其他目录。[[9]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md)[[6]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md)

另一个边界是合入。原型默认自动合入条件写在 Delivery requirements prompt 中，包括对应任务的 PR、head commit 的审批，以及增删合计少于 200 行；宿主没有专用合入判定逻辑。文档建议通过 GitHub 分支保护真正强制审批并失效旧审批。因此，prompt 中的条件属于行为要求，分支保护才是平台执行的限制，200 行也不是风险大小的可靠代理。[[6]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md)

准入有 off、observe、auto 三种模式，默认 observe：主动候选会被评估，正向结果记为“本会接单”，但不会启动工作。明确请求在各模式下仍可执行。这适合先观察主动规则的命中质量，再放开自动处理，没有让所有外部内容自动获得执行权。[[4]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)

不过，策略变化对正在运行的 Ticket 主要发送通知，不会立即撤销全部既有授权；已结束任务恢复时再校验 Mandate。跨平台身份映射也放在 team prompt 中，而非统一身份实体。这让原型保持轻量，却不足以直接承接更大组织的实时权限撤销与严格身份审计。[[3]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/001-domain.md)[[4]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)

作者 §8.4 已直言，云端 Loop 接收不可信事件后，又能连接带源码、私密数据和凭据的机器，会形成高风险链路。Anthropic 的参考方案把 OAuth 凭据放在沙箱之外的 vault，通过专用代理调用工具，让模型与生成代码不直接接触凭据。这个方向比“让模型读到之后再要求保密”更可靠；对本机工具也需要按目录、动作和账号建立真正的权限限制。[[1]](https://x.com/DeepSeekHarness/status/2116857257245987236)[[11]](https://www.anthropic.com/research/managed-agents)

## 权限与恢复要分层落实

| 边界 | 原型的做法 | 实际部署需要额外判断什么 |
| --- | --- | --- |
| 新任务准入 | 程序策略与模型评估，记录 Mandate | 规则是否能可靠表达谁授权了哪种动作 |
| 已订阅事件 | 整个 Thread 内容可以直通 | 不可信内容不得提升权限或扩大范围 |
| 文件与命令 | 独立目录、命令包装器，操作者 OS 权限 | 专用账号、沙箱、目录范围与工具执行约束 |
| 外部写入 | 持久待办、重试与回执记录 | 回执缺失时核对外部结果，避免重复副作用 |
| 策略变更 | 旧评估失效，运行任务接收通知 | 紧急撤权是否需要立即停止实际工具权限 |
| 合入与发布 | Prompt 条件与平台规则分别承担职责 | 用分支保护和发布权限执行不可绕过的条件 |

原型的 Eval 会绑定策略版本与评估 ID，过期判断不能直接决定新一轮工作；这属于明确的并发一致性处理。它和“模型读懂所有最新意见”不是同一项保证。[[22]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/evals.ts)[[4]](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)

Watchdog 也需要有边界。进程崩溃、网络暂时失败可以由确定性检查和有限重试处理；“是不是没有进展”则应先看任务状态和新证据，再让模型解释。长编译暂时没有输出不一定是停滞，反复生成文字也不一定是进展。维护者应明确什么可以自动重试、什么必须停下，以及 Watchdog 自身无法运行时由谁发现。这些是实施建议，文章没有给出完整答案。

# 对个人工作台的参考价值

Personal Harness定位为可迁移的个人研发工作台，把工作流、Skills、模型与工具组合起来。这里讨论的是架构参考，不代表运行能力已经重新验收。[[16]](/writing/personal-harness-workbench/)

Super-agent 最有用的补充，是让工作台管理 **任务及其后续事件** ，再把已有执行和验证能力放到 Worker 内部。iLoop／VDD 负责一项工作的证据与完成判断，Router 负责哪项工作该继续、谁来执行，以及什么时候需要人。它们处于不同层次，可以组合；层次图对齐不等于接入完成。

| 可借鉴的变化 | 给工作台带来的价值 | 采用前要核对的条件 |
| --- | --- | --- |
| 任务状态独立于会话 | 不靠翻聊天判断是否在等 CI、审阅或输入 | 任务 ID、状态、结果有唯一事实来源 |
| 后续消息按线程续接 | PR 评论回到原任务，减少转述与重复开工 | 来源可识别，新范围重新授权 |
| Router 读取全局摘要 | 执行日志不挤占全局判断上下文 | 摘要可追溯，重要约束不丢失 |
| 外部动作先落盘再执行 | 重启后找回待办与发送状态 | 幂等 key、外部回执和重复检查 |
| 集中展示需人工处理的工作 | 人先看自己必须决定什么 | 状态来自结构化事实，失败不隐藏 |
| 主动规则先 observe | 看清误触发与重复工作再自动接单 | 有预算、停止条件和可验证交付 |

这些是架构迁移建议，不是已实现清单。对个人工作台，先建立可靠的任务状态、续接和验收，比直接扩大事件来源更容易看清收益。跨设备常驻涉及远程执行、凭据与个人文件边界，应单独设计和验收。

Chain of Recall 也可以给 me-context 提供“概览保留引用，详情按需加载”的工程参考，但关系图本身不带隐私权限。把内容 Spill 到本地，只表示它暂时没进入当前上下文；以后读取并送给云端模型，仍发生了外发。因此，本地保存、按需读取和允许发给哪个模型，必须分别判断。这里借鉴的是机制，不涉及读取个人或家人的实际档案。

如果验证这条方向，适合先在隔离测试仓库里观察少量明确工作：接单、接 PR 反馈、等待验证、恢复执行、交付审阅。关键指标是每项交付的人工介入时间与接受率。下表给出验证思路，不表示这些 Case 已执行。

| 测试 Case | 验证思路 | 应保留的证据 | 完成条件 |
| --- | --- | --- | --- |
| 同一事件重复到达 | 重放相同来源和事件 ID | 接入记录、任务列表 | 不重复建任务 |
| 聊天改为 PR 反馈 | 将相关 Thread 绑定同一任务 | 关联记录、执行输入 | 原任务收到反馈，不重复开工 |
| 长任务中改要求 | 后台命令运行期间送入新要求 | 作业状态、输入进入下一步的时点 | 新要求生效，旧结果不直接提交 |
| 外部写入后崩溃 | 在动作完成与回执之间模拟中断 | 外部结果、本地待办、恢复日志 | 不重复创建或发送同一结果 |
| 线程出现越界请求 | 已订阅线程补充超范围指令 | Mandate、退回／重新评估记录 | 原授权不被自动扩大 |
| 长日志包含敏感内容 | 用无真实秘密的标记端到端检查 | 模型请求、导出内容、代理日志 | 标记不越过约定边界 |
| Worker 反复无进展 | 重复失败但进程保持活跃 | 新证据数量、预算与维护判断 | 有限重试后停下，给出具体问题 |
| 人工验收与实际收益 | 相近任务记录投入与接受情况 | 审阅时间、改回次数、通过证据 | 人工总投入下降且交付标准不降 |

文章的产品目标是减少人的注意力支出。把这个目标验证成事实，验收必须覆盖人花的时间、结果是否被接受，以及异常时系统能否收住。缓存 token 或任务完成速度只能回答其中一部分。

## 验证应从任务正确性扩展到系统正确性

一项代码修改的编译和测试通过，证明的是这项工作的某些行为正确。Super-agent 还要证明系统接对了任务、引用了正确版本、没有重复执行、没有因恢复扩大权限，并把真实结果交给人。验证对象因此从代码扩展到事件、状态与外部副作用。

建议把成本记到被接受的交付上：人工投入包括需求澄清、恢复上下文、审阅、修回、处理误触发和回归问题；系统投入包括模型调用、执行环境和无用后台工作。这样才能判断“人的介入更少”与“更多自动活动”是否指向同一个结果。

| 指标 | 记录口径 | 用途 |
| --- | --- | --- |
| 人工投入 | 从接单到验收，为该任务实际花的时间 | 判断是否减少会话管理与返工 |
| 交付接受率 | 按固定标准被接受的结果，占已结束任务的比例 | 防止只追求更多候选结果 |
| 完成耗时 | 请求进入到可审阅结果的时间，按任务类别统计 | 比较中位和长尾，而非混合不同难度 |
| 重复与错投 | 重复任务、重复外部写入、反馈送错任务的记录 | 检查系统调度与恢复正确性 |
| 总执行成本 | 模型、工具、环境与废弃工作的成本 | 判断等待减少是否值得额外投入 |
| 失败可恢复性 | 中断后保留的状态、恢复动作与最终结果 | 区分“重新开始”与“接着完成” |

初期观察可以先验证一个真实仓库的明确请求，不必同时接入大量平台。先让人工触发、审阅与停止可用，再观察主动规则；只有新的能力带来可记录收益时才扩大范围。这里给出的是可审查的验证设计，不是已批准的部署计划。

# 综合判断

Super-agent 已经给出值得学习的系统组织方式：任务有独立身份和状态，环境事件沿关系续接，执行并发与对外交流分开，恢复依赖外部记录。开源代码让这些机制可以被具体检查，价值超过一篇只有概念的设想文。

当前证据最强的是实现存在与调度实验的方向；最薄弱的是跨场景真实交付收益、长期运行和完整安全边界。适合从它的领域模型、持久动作队列、结构化待人工状态和按需读取机制中提取设计，再用自己的任务验证。直接把原型当成生产就绪产品，会跳过作者自己明确保留的边界。

对个人工作台，下一步的关键是能否在减少人工管理的同时维持交付标准。对团队系统，关键是能否把授权、状态一致性和外部动作的正确性落实到宿主和平台。文章提供了一条清楚的工程路径，收益大小需要在这条路径上的真实工作里测出来。

# 来源与核查范围

原文证明作者提出了哪些机制与结果；源码证明固定版本存在什么实现；Anthropic、LangGraph、OpenAI 和 METR 提供独立工程与测量参照。它们没有独立复现 DeepSeek 的实验。作者关于内部持续运行、主动修复的描述，目前仍主要依赖团队自己的报告。

 **[1]**  DeepSeek Harness：[Exploring Super-agent Design: Towards a More Autonomous Agent System](https://x.com/DeepSeekHarness/status/2116857257245987236)。X 英文版显示 2026-11-01，注明机器翻译。重点核对 §§2–8。

 **[2]**  [官方原型 README](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/README.md)。研究定位、单仓库范围与文章／原型差异。

 **[3]**  [Domain model](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/001-domain.md)。领域对象与订阅约束。

 **[4]**  [Authorization](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/002-authorization.md)。准入、范围、策略变化与恢复授权。

 **[5]**  [Architecture](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md)。Store、Effects、DshExecutor、Sessions 与资源接口。

 **[6]**  [Execution](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md)。并发、后台、合入、重启与外部动作核对。

 **[7]**  [Intake](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/intake.ts#L19-L63)。事件去重、订阅 fan-out、恢复条件与分流。

 **[8]**  [Cards](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/cards.ts)。有限预览、引用、分页与关联任务。

 **[9]**  [Deployment](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md)。专用 profile、本机权限、隔离与定时维护。

 **[10]**  [Effects](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/effects.ts)。持久待办、合并 key、generation 与退避。

 **[11]**  Anthropic：[Scaling Managed Agents: Decoupling the brain from the hands](https://www.anthropic.com/research/managed-agents)，2026-04-08。运行、状态、环境分离，凭据代理与持久事件。

 **[12]**  Anthropic：[How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)。并行的适用范围、token 代价和恢复经验。

 **[13]**  LangGraph：[Durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)。检查点、重放与幂等副作用。

 **[14]**  METR：[We are Changing our Developer Productivity Experiment Design](https://metr.org/blog/2026-02-24-uplift-update/)，2026-02-24。耗时归属、选择偏差和生产力测量限制。

 **[15]**  OpenAI：[Background mode](https://platform.openai.com/docs/guides/background)。后台模型请求、状态查询与取消。

 **[16]**  [Personal Harness公开文章](/writing/personal-harness-workbench/)。用于说明个人工作台的架构取舍。

 **[17]**  [原型 preset 配置](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/cordis.patch.yml)。工具边界、5 秒等待与 Subagent preset。

 **[18]**  [DshExecutor 与 WorkerSlots](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/executor/dsh.ts#L167-L207)。槽位预留、人工续接优先与恢复。

 **[19]**  [AgentDelivery](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/delivery.ts)。request ID、持久历史与收件箱去重。

 **[20]**  [Philosophy](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/000-philosophy.md)。减少注意力支出、按规则行动与不制造无用工作。

 **[21]**  [Panel](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/005-panel.md)。待人工状态、健康信息与可追溯任务历史。

 **[22]**  [Evals](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/evals.ts)。Thread 评估、策略版本与过期决策处理。

<style>
.prose th, .prose td { min-width: 110px; overflow-wrap: normal; word-break: normal; }
</style>
