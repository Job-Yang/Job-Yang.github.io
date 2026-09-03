---
title: Video Reader
kind: skill
eyebrow: Visual Debugging Skill
description: 一个让只会看图片的 LLM 理解视频的 Agent Skill。代码先找出真正有变化的时刻，再把关键帧和时间线交给模型判断。
statement: 把录屏拆成运动时间线和带时间戳的关键帧，让 Agent 看清一件事是怎么发生的。
github: https://github.com/Job-Yang/jobbyang-ai-skills/tree/main/skills/video-reader
install: git clone https://github.com/Job-Yang/jobbyang-ai-skills.git
tags:
  - Agent Skill
  - Video Analysis
  - UI Debugging
order: 3
featured: true
draft: false
visual: video
---

## 适合什么

- App 滚动、手势、页面跳转和状态切换问题
- 用户录屏中「第几秒发生了什么」的定位
- 长视频先看九宫格，再缩小排查范围
- 需要把讲解音频和画面变化对齐的场景

如果不知道正确行为，Video Reader 只会客观复述画面怎么变，不会替业务下判断。把用户反馈或预期行为一起交给 Agent，才能判断哪一秒开始偏离预期。

## 安装

```bash
git clone https://github.com/Job-Yang/jobbyang-ai-skills.git
cp -R jobbyang-ai-skills/skills/video-reader ~/.claude/skills/video-reader
```

装好后，不需要自己记脚本命令。把视频交给 Agent，直接说：

```text
看一下这段录屏，第几秒开始不对？
```

Skill 会根据视频长度和问题类型选择 `grid`、`scan` 或 `zoom`。底层使用 Python、OpenCV 和 NumPy，不依赖系统安装的 ffmpeg；缺少基础依赖时会先做自检。平台不允许上传视频时，也可以先压成 zip 再交给 Agent 解压。

## 边界

Video Reader 不判断帧率和性能卡顿。截图会抹掉帧间时间，这类问题应该使用日志、Perfetto 或其他性能数据。

它也不猜业务预期。底层只负责交付画面变化；判断行为是否正确，仍需要用户诉求或正确行为作为上下文。

翻拍视频里的手、反光和轻微抖动会被尽量过滤，但触点位置只能做定性判断。需要精确坐标时，仍应使用 UI 层级、触摸日志或自动化工具。
