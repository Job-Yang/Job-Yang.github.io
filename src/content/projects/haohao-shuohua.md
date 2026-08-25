---
title: 好好说话
kind: skill
eyebrow: Chinese Writing Skill
description: 一个给 AI Agent 用的中文写作 Skill。从起草到交付，保事实、去 AI 味、加中文味。
statement: 让 AI 写出的中文，不再像一份翻译过来的汇报材料。
github: https://github.com/Job-Yang/jobbyang-ai-skills/tree/main/skills/haohao-shuohua
install: git clone https://github.com/Job-Yang/jobbyang-ai-skills.git
tags:
  - Agent Skill
  - 中文写作
  - Prompt Engineering
order: 2
featured: true
draft: false
visual: writing
---

## 适合什么

- 文档、方案、周报、通知、邮件和群消息
- 已经写完、但读起来有明显 AI 味的稿件
- 需要保留事实与专业术语的技术内容
- 想让中文更自然，但不想变成网络口语的正式表达

它不替作者决定观点，也不靠「更有文采」遮住信息不足。原文没有的事实，不会因为润色凭空出现。

## 安装

```bash
git clone https://github.com/Job-Yang/jobbyang-ai-skills.git
cp -R jobbyang-ai-skills/skills/haohao-shuohua ~/.claude/skills/haohao-shuohua
```

安装完成后，直接对 Agent 说：

```text
把这段用好好说话过一下。
```

仓库里还包含症状词典、改前改后对照、受保护跨度、造词检查和节奏终审等参考规则。完整目录必须一起安装，不能只复制主文件。

## 它不做什么

它不是一套「高级中文」模板，也不会把所有文本改成同一种腔调。工作消息、技术方案和个人文章，本来就应该有不同的声音。

这套 Skill 真正固定的只有底线：事实不能动，概念不能偷换，普通话能说清的事不要靠大词撑着。剩下的空间，应该留给作者自己。
