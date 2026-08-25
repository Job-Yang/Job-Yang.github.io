---
title: VDD
kind: skill
eyebrow: Verification Method
description: 一套让 Agent 在下结论前先完成验证的方法，防止没验过就报喜，也防止为了显得尽责而硬挤问题。
statement: 在说“做完了”“没问题”之前，先拿证据走一遍。
github: https://github.com/Job-Yang/jobbyang-ai-skills/tree/main/skills/vdd
install: cp -R jobbyang-ai-skills/skills/vdd ~/.claude/skills/vdd
tags:
  - Agent Skill
  - Verification
  - Engineering
order: 1
featured: true
draft: false
visual: generic
---

## 它解决什么

Agent 很容易在没有验证时宣布完成，也可能在 Review 时为了显得认真，硬找出一批并不存在的问题。VDD 用单次自证和多轮防漂移两套机制，把判断重新锚定到证据上。

## 怎么工作

- 开工前检查前提和验收标准
- 每个关键动作都说明理由和证据
- 用时间、范围、机制和反证判断结论是否成立
- 大任务提前冻结设计契约，避免多轮对话改变尺度
- 验收时换一个目标或上下文，不让实现者直接给自己判分

VDD 不依赖特定工具。它要求 Agent 在能说“完成”之前，先证明这件事确实做成了。
