---
title: "obra/superpowers 调研：AI 编码 Agent 的全流程自治框架"
description: "Skill 无需手动调用，Agent 根据上下文自动激活对应 skill："
publishedAt: 2026-05-22T08:08:31.000Z
category: "【费曼·调研】"
tags: []
draft: false
source: public-rewrite
source_id: "article-73278c5ced"
migration_classification: "needs_refactor"
review_required: true
---
> [!NOTE]
> **一句话总结**：Superpowers 是一套让 AI 编码 Agent "自动驾驶"的开发方法论 + 可组合 skill 框架。Agent 从需求澄清到代码合并全程自治，强制 TDD、subagent 驱动、两阶段 code review。GitHub 201K stars，MIT 协议。

# 一、项目概述

| 属性 | 说明 |
|-|-|
| 作者 | Jesse Vincent（obra），Prime Radiant 团队 |
| GitHub | [github.com/obra/superpowers](https://github.com/obra/superpowers)（201K stars / 17.9K forks） |
| 安装方式 | Claude Code: `/plugin install superpowers@claude-plugins-official` |
| 兼容 Agent | Claude Code、Codex CLI/App、Cursor、Gemini CLI、OpenCode、GitHub Copilot CLI |

---

# 二、核心工作流（7 步自动激活）

Skill 无需手动调用，Agent 根据上下文**自动激活**对应 skill：

1. **Brainstorming** — 苏格拉底式问答，逼出清晰的设计 spec
2. **Git Worktree** — 创建隔离分支，验证测试基线通过后才开始
3. **Writing Plans** — 拆分为 2-5 分钟粒度的任务（精确到文件路径和代码片段）
4. **Subagent-Driven Development** — 每个任务 spawn 全新子 Agent 执行
5. **Test-Driven Development** — 强制 RED → GREEN → REFACTOR 循环
6. **Code Review** — 两阶段审查：spec 合规 → 代码质量，critical 问题阻断
7. **Finishing** — 全部测试通过后，提供 merge / PR / keep / discard 选项，自动清理 worktree

> [!NOTE]
> **关键特性**：Agent 可自主工作数小时不偏离计划，无需人工干预。

---

# 三、Skill 体系

**开发类**
- test-driven-development
- systematic-debugging（4 阶段根因分析）
- verification-before-completion

**协作类**
- brainstorming
- writing-plans / executing-plans
- subagent-driven-development
- dispatching-parallel-agents
- using-git-worktrees
- requesting/receiving-code-review

元 skill `writing-skills` 允许用户按规范编写自定义 SKILL.md 扩展能力。

---

# 四、Superpowers vs Spec Kit 差异对比

| 维度 | Superpowers | Spec Kit（GitHub 官方） |
|-|-|-|
| **定位** | 开发方法论 + Agent 自治框架 | 规范驱动开发（SDD）工具包 |
| **触发方式** | Skill 自动激活，零操作 | 显式 slash command（`/speckit.*`） |
| **子 Agent** | 核心机制：每任务 spawn 独立子 Agent + 两阶段 review | 无内置 subagent，单 Agent 线性执行 |
| **TDD** | 硬性约束，不写测试不让 commit | 无强制，由用户 constitution 自定义 |
| **Git 工作流** | 内置 worktree 隔离（自动建/清理分支） | 无内置 git 管理 |
| **制品形式** | 行为规则内嵌 SKILL.md，隐式驱动 | 每阶段产出独立 Markdown 文档，链式传递 |
| **Agent 兼容** | 7+ Agent | 30+ Agent（最广） |
| **扩展方式** | 编写 SKILL.md | CLI + Extensions + Presets 三层体系 |
| **项目治理** | 规则分散在各 skill 中 | 显式 `/speckit.constitution` 统一管理 |
| **调试能力** | 内置 systematic-debugging skill | 无专用调试流程 |
| **适合场景** | 追求 Agent 最大自治 + 强 TDD 纪律 | 重视规范文档可追溯 + 多 Agent 灵活切换 |

---

# 五、结论

> [!NOTE]
> **选型建议**：
> - 想让 Agent 尽可能自主跑完全流程、强调 TDD → 选 **Superpowers**
> - 想要每步产出可审阅的规范文档、团队多人协作需统一流程 → 选 **Spec Kit**
> - 两者不互斥，可组合使用：Spec Kit 管规范产出，Superpowers 管执行纪律

---

# 读完之后：Superpowers 给 iLoop 的启发

调研 Superpowers，是想看看「让 agent 尽可能自己跑完全程」这条路别人是怎么走的——手头这个 iOS 通用 agent（**iLoop**），目标也是让它能多自主走几步而不偏。Superpowers 是个极端样本：它敢让 agent 自主工作数小时不偏离计划。读它，重点不是抄它的激进，而是看它**靠什么纪律撑住了这份激进**。下面几条是真戳到 iLoop 的。

## 1. 「先澄清再动手」被它做成了硬门槛，而 iLoop 是软的

Superpowers 第一步永远是 **Brainstorming**——苏格拉底式追问，逼出清晰的设计 spec，不带着歧义开干。它是个强制的闸门：没澄清清楚，不进下一步。

iLoop 现在也有「先诊断」这一步，但它是软的——诊断完不够清楚，也会往下走。区别就在「门槛」二字：Superpowers 把澄清做成了过不去就卡住的 gate，iLoop 只是把它当成一个建议动作。对模糊的大任务，该把 iLoop 的诊断也升级成一道真闸门：歧义没消干净，不让进执行。这是省返工最便宜的一招。

## 2. 「先定验收标准，再实现」——iLoop 的验收偏事后

Superpowers 强制 TDD：先写测试（定义「怎么算成功」），再写实现，红→绿→重构。本质是**把验收标准前置到动手之前**，避免做完一大堆才发现跑偏了方向。

iLoop 有收口标准，但偏事后——往往是干完了再回头看「这算不算完成」。该借的就是这个顺序：在 iLoop 开工前先把「这件事怎么算做对」写下来，让验收标准变成开工的前提，而不是收尾的检查。方向错了，越早发现越省。

## 3. iLoop 最大的空白：subagent 隔离上下文，它完全没有

Superpowers 的核心机制是 **每个任务 spawn 一个全新的子 agent 去执行**——大任务拆给子 agent 跑，主上下文不会被一堆中间过程塞爆。这对长任务是命门：上下文一爆，agent 就开始胡说。

iLoop 在这块是**完全空白**。现在所有事都在一个上下文里滚，任务一长就有「上下文爆炸」的风险——这也是长任务 agent 最常见的死法。这是 iLoop 该认真补的一根骨头：把长任务里相对独立的子任务，丢给隔离的子 agent 去跑，跑完只把结论收回主线，中间过程不污染主上下文。

## 4. 它和 Spec Kit 的对照，反过来给 iLoop 指了路

正文那张对比表其实点破了一件事：**Superpowers 重「执行纪律」（TDD、subagent、自动化程度高），Spec Kit 重「规范产出」（每步留可审阅文档、可追溯）。**两者不互斥，能组合——规范产出管「方向对不对」，执行纪律管「过程稳不稳」。

iLoop 想要的其实是两边各取一半：从 Spec Kit 拿「任务树 + 可恢复状态 + 项目铁律」（解决方向和续传），从 Superpowers 拿「澄清闸门 + 验收前置 + subagent 隔离」（解决过程稳不稳）。这两篇调研合起来看，iLoop 该补的清单就齐了。

> [!NOTE]
> 一句话收口：Superpowers 对 iLoop 最大的启发，是「敢自治」的前提是「有纪律兜底」——iLoop 现阶段最该先补的是 **subagent 隔离**（长任务上下文爆炸的解药）和**开工前定验收标准**（方向跑偏的解药）。至于它那种数小时无人值守的激进，iLoop 不追，纪律先立起来再说。
