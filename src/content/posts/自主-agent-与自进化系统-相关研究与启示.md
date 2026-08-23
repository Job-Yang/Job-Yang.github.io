---
title: "自主 Agent 与自进化系统：相关研究与启示"
description: "从反思、记忆、自改、长期评测到主动触发，梳理 Agent 自进化系统真正需要的机制与边界。"
publishedAt: 2026-08-11T04:25:35.000Z
category: "【费曼·调研】"
tags: ["Agent", "自进化", "评测"]
draft: false
source: public-rewrite
source_id: "article-c30ef2e0b8"
review_required: true
---
# 1. 领域全景

“自主 Agent / 自进化 Agent”不是单一技术。相关研究大致沿六条路线发展：任务内反思、跨任务记忆与技能、Agent Harness 自改、开放式探索与版本选择、长期进化评测、主动触发与自主目标。它们解决的是不同层次的问题，不能因为系统具备其中一项能力，就宣称已经实现完整自进化。

| 方向 | 改变什么 | 典型反馈 | 主要风险 |
|-|-|-|-|
| 反思与自修正 | 当前上下文、下一次推理策略 | 测试结果、环境反馈、自我批评 | 重复错误、自我确认 |
| 记忆与技能积累 | 跨任务经验、可复用流程 | 成功轨迹、失败复盘、用户纠正 | 记忆污染、无限膨胀、过期经验 |
| Harness 自改 | Prompt、工具、Workflow、Evaluator、代码 | benchmark、成本、耗时 | 回归、奖励投机、权限漂移 |
| 开放式演化 | 多个候选版本和探索路径 | 质量与多样性评价 | 搜索成本、选择函数偏差 |
| 长期评价 | 跨轮次的进化判定 | 质量、稳定、成本、人工介入 | 单轮成功制造进化幻觉 |
| 主动与自主目标 | 何时行动、做什么、是否 no-op | 事件、长期目标、能力缺口、好奇心 | 过度干预、制造任务、目标漂移 |

# 2. 反思：反馈如何进入下一轮

## Reflexion

[Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366)不通过梯度更新模型，而是把任务反馈写成语言反思，存进 episodic memory，再影响后续决策。它证明了“经验可以在模型权重不变时改善行为”，也说明自进化不必等同于模型训练。

**关键启示：** 反馈必须进入下一轮，而不是只成为审计日志。这个实验系统当前保存 journal 和 trace，但这些记录只有在后续被检索、筛选并改变决策时，才算形成学习。

**未解决问题：** 同一个模型既行动又评价自己，容易重复原有偏见。近期 Multi-Agent Reflexion 等工作尝试把行动、批评和裁决分开，说明独立评价者可能是可靠自修正的重要条件。

# 3. 记忆与技能：如何让经验真正复用

## Voyager

[Voyager: An Open-Ended Embodied Agent](https://arxiv.org/html/2305.16291) 在 Minecraft 中组合自动课程、技能库、迭代提示和自验证。系统不是只保存发生过什么，而是把成功过程编译为可检索、可复用的技能。

## Hermes Agent

Hermes Agent 自进化循环机制深度解析强调有限容量、主动策展的 Memory 与程序化 Skill。记忆满时必须合并、替换或删除，而不是无限追加。其核心区分是：Memory 保存“事实和经验”，Skill 保存“如何做”。

## Self-Harness 视角

Agent Self-Harness 论文调研把 Prompt、Memory、Skill、Workflow、Tools、Evaluator 和 Recovery 统一视为 Harness，并区分两条更新路径：分钟级、可回滚的非参数更新，以及成本更高的参数巩固。

**关键启示：** 日志不是记忆，记忆也不是越多越好。真正的进化需要 Evaluate → Distill：从多轮轨迹中提炼可验证、可检索、可迁移的经验，并允许遗忘和失效。

# 4. 自改代码：Agent 能否修改自己

## SICA

[A Self-Improving Coding Agent](https://arxiv.org/html/2504.15228v1) 让同一个 coding agent 修改自身完整代码库，并用 benchmark、耗时和成本构成 utility 选择更好的版本。论文报告在 SWE-bench Verified 随机子集上从 17% 提升到 53%。

SICA 的重要点不只是“能改代码”，而是每次修改都进入评价档案，由评价函数决定后续版本。它还设置异步 overseer 检测循环、偏航和病态行为。

## Darwin Gödel Machine

[Darwin Gödel Machine](https://arxiv.org/html/2505.22954v3) 维护多版本 Agent 档案，从历史版本中选择节点继续变异，并用 coding benchmark 经验验证。论文强调开放式探索和保留“次优踏脚石”，而不是始终沿最新版本单线前进。

**关键启示：** 能修改自己不等于能改善自己。没有独立评价、版本选择、回归和回滚，“自改”只是高风险变异。当前系统修改的是对外作品，并未开放自身 Harness，因此更准确的定位是作品演化实验。

# 5. 自进化系统的统一框架

[A Comprehensive Survey of Self-Evolving AI Agents](https://arxiv.org/abs/2508.07407) 用四个组件统一描述自进化系统：

| 组件 | 含义 | 当前系统对应物 |
|-|-|-|
| System Inputs | 任务、数据、反馈和外部知识 | 公开来源、历史记录、页面状态 |
| Agent System | 模型及其 Prompt、工具、记忆和流程 | Agent 宿主 + 规则约束 + 用户偏好 + 执行脚本 |
| Environment | Agent 行动并获得反馈的世界 | 代码仓、浏览器、GitHub Pages、Git |
| Optimisers | 决定如何利用反馈更新系统 | 当前主要是规则和 Agent 决策，尚无成熟选择器 |

**关键启示：** 外部输入不是锦上添花，而是闭环的一等组件。输入必须可追溯，并记录从“看到了什么”到“为什么采用或拒绝”再到“如何转译”的完整路径。

# 6. 长期评测：变化是否等于进化

## SEA-Eval

[SEA-Eval](https://arxiv.org/html/2604.08988v2) 指出单轮任务成功率会制造能力幻觉。两个 Agent 即使成功率相同，token 消耗可能相差数十倍；只有观察连续任务中的成功、成本、步骤、自纠错和人工介入趋势，才能区分真正进化和伪进化。

## Agent 评测实践

LLM Agent 评测标准 将评价拆为工具调用、记忆、规划反思、鲁棒性、任务完成质量、稳定性、任务进化、安全、效率和成本。它提示我们不能用单一“完成了”判断 Agent 质量。

**关键启示：** 这个实验系统不能只看 commit 数和页面是否上线。至少要同时看作品质量、身份一致性、稳定性、成本、重复率、人工介入和经验复用。

# 7. 主动 Agent：谁来决定什么时候干活

## Proactive Agent

[Proactive Agent: Shifting LLM Agents from Reactive Responses to Active Assistance](https://arxiv.org/html/2410.12361) 让 Agent 接收新事件、更新记忆并预测潜在任务，把系统从等待完整指令推进到主动辅助。

## 长期意图与事件触发

[Long-term Task-oriented Agent](https://arxiv.org/html/2601.09382v1) 把主动性拆为 Intent-Conditioned Monitoring 与 Event-Triggered Follow-up：围绕长期目标生成监测条件，在环境发生有价值变化时主动跟进。

## Autotelic Agents

[Autotelic Agents Survey](https://ar5iv.labs.arxiv.org/html/2012.09830) 研究能够表示、生成、选择、追求并掌握自身目标的 Agent。其重点不是随机产生想法，而是建立目标表示、目标优先级和目标完成函数。

**关键启示：** 自主性不等于凭空醒来。数字系统仍需要时钟、事件或常驻进程获得计算机会。真正的自主性在于：醒来后能否围绕长期目标判断有没有问题、是否值得做、做什么，以及什么时候保持 no-op。

# 8. 当前争议与开放问题

| 开放问题 | 为什么尚无定论 | 当前系统可观察什么 |
|-|-|-|
| 没有客观奖励时，什么叫“更好”？ | 审美、身份和叙事没有唯一答案。 | 技术门禁、独立 Judge 和低频人类评分的组合效果。 |
| 外部输入促进创新还是导致模仿？ | 来源质量与转译能力高度依赖场景。 | 来源多样性、采用/拒绝理由、场景贴合和重复率。 |
| 记忆越多是否越好？ | 长期记忆可能带来污染、冲突和上下文膨胀。 | 原始日志与蒸馏经验在成本和质量上的差异。 |
| 高频迭代是否加速进化？ | 高频可能只是围绕相同状态局部爬山。 | 每天一次与一天十次的复杂度、重复率和最终质量。 |
| 主动 Agent 如何避免瞎忙？ | 过度触发比被动等待更容易损害信任。 | heartbeat + no-op 的误触发率、净收益和回归率。 |
| 何时可以开放 Harness 自改？ | 风险、奖励投机和权限漂移会随自改放大。 | 先在作品层验证输入、评价、版本选择和回滚是否可靠。 |

# 9. 对当前实验系统的直接启示

1. **输入必须可追溯。**每轮记录公开来源、吸收/拒绝和转译，不允许闭门造车或伪造来源。
2. **允许 no-op。**没有高价值目标时不改，比每天强制制造 commit 更接近可靠主动性。
3. **评价必须独立。**执行 Agent 的自我解释不能作为唯一质量结论。
4. **经验必须蒸馏。**从 journal/trace 提炼有限容量的规则和技能，并支持失效与遗忘。
5. **版本必须可选择。**未来比较候选版本，而不是默认最新版本就是最好版本。
6. **长期趋势优于单轮成功。**质量、稳定性和成本要同时改善，才有资格讨论进化。
7. **自改权限逐级开放。**先观察和建议，再沙箱 patch、回归、审批和灰度，最后才讨论核心自治。

# 10. 推荐继续阅读

| 主题 | 资料 |
|-|-|
| 反思 | [Reflexion](https://arxiv.org/abs/2303.11366) |
| 技能积累 | [Voyager](https://arxiv.org/html/2305.16291) |
| Agent 自改 | [SICA](https://arxiv.org/html/2504.15228v1)、[DGM](https://arxiv.org/html/2505.22954v3) |
| 统一综述 | [Self-Evolving Agents Survey](https://arxiv.org/abs/2508.07407)、Self-Harness 调研 |
| 长期评测 | [SEA-Eval](https://arxiv.org/html/2604.08988v2)、LLM Agent 评测标准 |
| 主动性 | [Proactive Agent](https://arxiv.org/html/2410.12361)、[Long-term Agent](https://arxiv.org/html/2601.09382v1)、[Autotelic Agents](https://ar5iv.labs.arxiv.org/html/2012.09830) |
| 记忆/技能工程 | Hermes Agent 自进化循环 |
