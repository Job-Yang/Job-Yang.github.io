---
title: PNG Compress
kind: skill
eyebrow: Local Image Compression Skill
description: 一个在本地批量压缩 App 工程 PNG 的 Agent Skill。用公开算法组合完成量化、无损收尾、质量门禁、增量缓存和失败回退。
statement: 把 TinyPNG 同类的公开压缩路线，做成能在工程里持续运行、压坏自动回退的本地能力。
github: https://github.com/Job-Yang/jobbyang-ai-skills/tree/main/skills/png-compress-skill
install: cp -R jobbyang-ai-skills/skills/png-compress-skill ~/.claude/skills/png-compress-skill
tags:
  - Agent Skill
  - Image Compression
  - Package Size
order: 4
featured: true
draft: false
visual: generic
---

## 适合什么

- App 包体积治理中的 PNG 批量压缩
- 一次需要处理几万张图片的工程
- 图片不能上传到第三方服务的本地处理场景
- 需要持续处理新增资源，并避免重复有损压缩的团队工作流

它只接收一个目录，不读取 Xcode 工程、Scheme、Bundle ID 或业务源码。默认跳过依赖目录和构建产物，因此也能用于其他 App 工程或独立图片目录。

## 安装

```bash
git clone https://github.com/Job-Yang/jobbyang-ai-skills.git
cp -R jobbyang-ai-skills/skills/png-compress-skill ~/.claude/skills/png-compress-skill
```

装好后，直接告诉 Agent：

```text
帮我压一下这个 App 工程里的 PNG：/path/to/MyApp
```

建议先用 `--dry-run` 估算收益。正式执行会原地替换通过门禁的 PNG，并在目标目录写入内容 hash 缓存。

## 边界

这是有损压缩。自动门禁可以拦住无法解码、尺寸变化、alpha 丢失和明显劣化，但不能替代全部主观视觉验收。

AppIcon、启动图、大面积渐变、半透明阴影，以及带 ICC 或 Display P3 色彩配置的素材，仍应在真实设备上抽检。APNG 会直接跳过，避免动画被压成单帧。

这套实现沿用 TinyPNG 公开描述中的同类技术路线，不声称复刻它的未公开算法。不同素材差异很大，最终效果应以项目自己的 A/B 结果为准。
