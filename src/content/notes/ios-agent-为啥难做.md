---
title: "iOS Agent 为啥难做"
order: 3
tags: []
draft: true
source: public-rewrite
source_id: "note-2014629dd401"
review_required: true
---
**不是 iOS 难,是它先天缺东西。**比如我们看看前端为什么 AI 写得飞起?因为它有完整的"写 → 编 → 跑"反馈闭环。而iOS的问题是

- **数据：**语料少，相比前端等（GitHub PR 口径：JS + TS 占全平台 30% 以上，Swift + OC 合计仅约 1.5%，差距 20 倍）
- **语言特性：**OC Runtime(强依赖运行时，光看代码文件根本不知道运行起来是啥)，沙盒机制等
- **环境苛刻：**强依赖MacOS+Xcode工具链（前端是个机器就能跑）
- **构建链路：**构建反馈链断裂

前三个没啥办法，但有了XcodeBuildMCP（相比xcodebuild门槛低），iOS Agent 起码能玩了
