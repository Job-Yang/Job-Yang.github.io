---
title: 三思而后行
kind: skill
eyebrow: Document Editing Skill
description: 修改已有文档前先通读全文骨架，确认影响面，再决定这一处该怎么动。
statement: 别盯着一段打补丁，先看清它在整篇里的位置。
github: https://github.com/Job-Yang/jobbyang-ai-skills/tree/main/skills/sansi-erhouxing
install: cp -R jobbyang-ai-skills/skills/sansi-erhouxing ~/.claude/skills/sansi-erhouxing
tags:
  - Agent Skill
  - 文档编辑
  - Review
order: 7
featured: true
draft: false
visual: generic
---

## 它解决什么

Agent 修改文档时很容易看到一个点就修一个点。每次局部修改都合理，几轮叠起来却可能让全文重复、断裂，甚至把上次删掉的内容重新加回来。

## 怎么工作

动手前先通读整体、列出影响面，再回答三个问题：这处以前动过吗，修法风险是否更大，会不会破坏全文骨架。只要有一问过不了，就回到骨架重新设计。
