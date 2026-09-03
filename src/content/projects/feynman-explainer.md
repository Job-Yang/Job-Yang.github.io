---
title: 费曼讲透法
kind: skill
eyebrow: Explanation Skill
description: 用一条连续的因果链讲透复杂概念，让原本不懂的人读完之后真的能复述。
statement: 不堆术语和要点，从问题一路推到答案。
github: https://github.com/Job-Yang/jobbyang-ai-skills/tree/main/skills/feynman-explainer
install: cp -R jobbyang-ai-skills/skills/feynman-explainer ~/.claude/skills/feynman-explainer
tags:
  - Agent Skill
  - 技术解释
  - 调研
order: 6
featured: true
draft: false
visual: generic
---

## 它解决什么

很多总结看起来信息很多，读完却只剩一堆互不相干的术语。费曼讲透法要求内容沿着一个问题持续追问：朴素做法为什么不够，真正机制怎么解决，又带来了什么新问题。

## 输出边界

它适合调研、源码解读和原理说明。内部会使用比喻、难点定位和自检，但这些脚手架不会出现在最终文章里。
