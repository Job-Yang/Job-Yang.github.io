---
title: "PocketLens：客户端工程师从零到一把多模态 AI 装进 iPhone"
description: "以 iPhone 12 Pro Max 为设备基线，从本地图片问答走到相机、语音、流式输出和端云路由，完整跑通一个多模态 AI 客户端。"
publishedAt: 2026-07-29T09:57:55.000Z
category: "iOS / AI"
tags: ["PocketLens", "多模态", "端侧 AI", "iOS"]
featured: true
editorialRank: 78
draft: false
source: public-rewrite
---

> 一篇 All-in-One 学习手册<br>
> 设备基线：iPhone 12 Pro Max（A14、6 GB）<br>
> 目标：零训练、零蒸馏、零私有数据起步，最终跑通一个端云协同的“AI 眼镜模拟器”

---

## 怎么使用这篇文档

这不是模型原理大全，也不是复制一个官方 Sample 就结束。

它像客户端入门时的 Todo List Demo：用一个足够小、但有完整产品闭环的项目，把需要的知识逐层串起来。每一步都要求留下可验证产物，失败时知道退回哪里。

完整学习路径：

```text
本地图片问答
  -> 摄像头实时输入
  -> 最新帧调度
  -> 流式输出
  -> 语音输入/播报
  -> 本地/云端自动路由
  -> 延迟、内存、温度、调用成本看板
  -> 可选：量化、蒸馏、结构化剪枝
```

### 首版需要多少训练数据、多少教师 API 调用

| 阶段 | 训练数据 | 教师 API |
|-|-|-|
| MVP 跑通本地多模态 | 0 | 0 |
| 建立 30 个场景的端云对照 | 自己拍 30 组非敏感样本 | 约 30-100 次，可选 |
| 窄任务微调实验 | 500-5,000 条 | 可用已有标签，不一定调用 API |
| 小规模蒸馏 PoC | 1,000-5,000 条 | 多模态通常约一条一次 |
| 生产级专项模型 | 10,000-100,000+ 条 | 取决于已有标注与合成策略 |

**本手册的主线只做到第二行。** 蒸馏不是入场券，而是模型能力或成本仍不达标时的后续选修。

---

# 第一部分：先定义一个值得做的 Demo

## 1. Demo 名称与一句话定义

**PocketLens：手机模拟 AI 眼镜的端云协同多模态助手。**

用户举起手机，就像戴着一副 AI 眼镜：

1. 相机持续看到环境。
2. 用户可以说“我面前是什么”“读一下这块牌子”“这个设备怎么用”。
3. 简单任务在手机本地完成。
4. 涉及复杂推理、实时知识或长回答时，自动升级到云端。
5. 页面实时显示这次请求为什么走本地或云端，以及节省了多少网络调用。

## 2. 为什么这个 Demo 有学习价值

它同时覆盖客户端 AI 的五条主线：

| 主线 | Demo 中的对应问题 |
|-|-|
| 多媒体 | 如何稳定获取相机帧、麦克风和 TTS |
| 模型 | 如何加载 VLM、预处理图片、流式解码 |
| 系统 | 如何控制内存、GPU、温度、前后台 |
| 架构 | 如何决定本地回答还是云端升级 |
| 产品 | 如何量化低延迟、离线、隐私与成本收益 |

## 3. MVP 用户故事

首版只做三个任务：

### Story A：离线看图问答

用户打开飞行模式，对着桌面问“桌上有什么”，手机能在本地返回简短答案。

### Story B：本地 OCR 与环境说明

用户对着菜单、路牌或产品包装，手机读取关键文字并给出简短说明。

### Story C：复杂问题自动上云

用户问“这是什么型号，它最近的市场价格和替代产品是什么”，路由器判断需要实时知识，自动升级云端。

## 4. 非目标

首版明确不做：

- 30 FPS 每帧运行生成式 VLM；
- 自己预训练模型；
- 自己构造万级数据集；
- 蒸馏或剪枝；
- 完整全双工实时语音；
- 安全关键的自动驾驶或医疗决策；
- 通用 ChatGPT 替代品；
- 生产级账号、计费和模型热更新。

🤔 难理解点在哪？

“相机实时”不等于“模型必须看每一帧”。相机可以保持 30 FPS 预览，语义推理只处理场景变化后的最新一帧，通常 0.5-1 FPS 或用户提问时触发。

💭 比喻：人走在路上也不会每 1/30 秒重新描述整个世界。只有看到变化或被提问时，大脑才组织语言。

---

# 第二部分：AI 眼镜为什么一定是端云协同

## 5. 三层架构

<whiteboard token="ASWiws480hBIXkb7tOhcpQYlnMc"></whiteboard>

## 6. 实际 AI 眼镜该放多大的模型

以下是工程起始范围，不是所有设备的固定标准：

| 层级 | 建议模型量级 | 典型职责 |
|-|-|-|
| 眼镜本体 | 1M-100M 专项模型 | VAD、唤醒词、运动/模糊、简单检测、隐私门禁 |
| 手机伴侣 | 0.25B-1B VLM/LLM | 看图问答、短 OCR、场景记忆、路由 |
| 高端手机/专用硬件 | 1B-4B 激活参数 | 更强本地理解、语音和工具调用 |
| 云端 | 更大模型 | 复杂推理、实时知识、长上下文 |

真正的眼镜通常不应该常驻完整生成式 VLM：

- 电池小；
- 散热差；
- 内存紧；
- 摄像头和无线传输已经耗电；
- 用户对重量和温度极其敏感。

更合理的是眼镜做感知，手机做边缘大脑，云端做深度大脑。首版 PocketLens 把“眼镜 + 手机”合并在 iPhone 上模拟。

## 7. Apple 是怎么做的

截至 2026 年，Apple 官方采用同样的混合思路：

- `AFM 3 Core`：约 3B 的端侧稠密模型；
- `AFM 3 Core Advanced`：完整约 20B 的稀疏模型，根据请求激活约 1-4B 参数；
- 完整权重放在 NAND，按请求选择专家加载到 DRAM；
- 使用 Quantization-Aware Training 压缩模型并保持精度；
- `AFM 3 Cloud / Cloud Pro` 在 Private Cloud Compute 处理复杂推理；
- 开发者可以在 Foundation Models Framework 中使用端侧、PCC 或其他模型。

来源：

- [Apple 第三代 Foundation Models](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models)
- [Foundation Models Framework](https://developer.apple.com/documentation/foundationmodels/)
- [Private Cloud Compute](https://security.apple.com/documentation/private-cloud-compute/)

你的 iPhone 12 Pro Max 不支持 Apple Intelligence，因此不能直接依赖系统 3B 模型。这个 Demo 必须自带更小的模型，通过 MLX、Core ML、Metal 或 ByteNN 运行。

---

# 第三部分：需要学习哪些知识

## 8. 知识地图

### P0：必须先懂

| 知识 | 学到什么程度 |
|-|-|
| Swift Concurrency | 会用 `async/await`、Task、Actor、取消任务 |
| AVFoundation | 能拿相机 `CVPixelBuffer`，控制帧率和前后台 |
| VLM 结构 | 知道 Vision Encoder、Projector、LLM 各自做什么 |
| Prefill / Decode | 能解释 TTFT 和 TPS 为什么是两个指标 |
| 内存 | 区分模型文件、权重、KV Cache、激活和 Metal 缓冲 |
| 量化 | 知道 FP16、INT8、INT4 如何影响大小、精度和速度 |
| 流式 UI | 生成 Token 时逐步更新界面，不阻塞主线程 |

### P1：跑通后补

| 知识 | 用途 |
|-|-|
| MLX Swift | 快速运行 Apple Silicon 上的 LLM/VLM |
| Core ML | 使用 CPU/GPU/ANE，做生产级模型集成 |
| Metal | 理解 GPU 资源、缓冲和 Kernel 首次编译 |
| Vision/Speech | 使用系统 OCR、检测、转写做廉价前置能力 |
| 路由策略 | 根据任务、网络、内存、温度选本地或云 |
| Instruments | 查看内存、Energy、GPU、网络和模型耗时 |

### P2：进阶

| 知识 | 用途 |
|-|-|
| SFT/LoRA | 让模型适配固定业务 |
| 蒸馏 | 用大模型教小模型 |
| 结构化剪枝 | 真正减少层、Head 和 Channel |
| QAT | 在低 bit 下恢复精度 |
| 算子适配 | 让模型真正跑到 ANE/GPU 高效路径 |
| 数据闭环 | 评测、Bad Case、版本和回滚 |

费曼检验：如果不能解释“模型文件 1 GB 为什么运行时可能远大于 1 GB”，先补内存和推理基础。

---

# 第四部分：首版技术选型

## 9. 模型怎么选

### 首选：FastVLM-0.5B

理由：

- Apple 官方有完整 iOS/macOS Demo；
- iOS 18.2+；
- 0.5B 是 FastVLM 最小档；
- 可以直接看到 TTFT；
- 不需要训练和转换；
- 很适合第一周验证“模型是否能在 iPhone 12 跑起来”。

限制：

- 官方近实时展示来自更新的 iPhone，不代表 A14 一定达标；
- 模型权重只允许研究用途；
- 0.5B FP16 对 iPhone 12 仍可能偏重；
- 必须以真机内存、温度和 TTFT 为准。

### 失败后的降级

1. 降输入分辨率；
2. 限制输出到 32-64 Token；
3. 使用更小或量化后的 256M/500M VLM；
4. 用 Vision/OCR 专项模型替代部分 VLM 请求；
5. 只在用户提问时运行，不做持续推理。

### 产品化替代

如果未来需要商业化，优先评估：

- SmolVLM2 256M/500M 等许可更宽松的小模型；
- 公司内部 DOLM/ByteNN VLM；
- 自有训练或明确商用许可的模型。

模型许可证必须和技术指标同等优先。

## 10. 运行时怎么选

| 运行时 | 优点 | 缺点 | 本手册定位 |
|-|-|-|-|
| MLX Swift | FastVLM 官方 Demo 已接通，迭代快 | 主要使用 GPU | MVP |
| Core ML | Apple 原生，可调度 ANE/GPU/CPU | 转换与算子兼容复杂 | 第二阶段 |
| llama.cpp | GGUF 生态广，Metal 成熟 | VLM/iOS 桥接成本更高 | 兼容性实验 |
| ByteNN/DOLM | 公司内部生产能力与治理完整 | 依赖内部模型和流程 | 业务落地 |

## 11. 首版工程栈

```text
UI                SwiftUI
Camera            AVFoundation
Local VLM         FastVLM-0.5B + MLX Swift
Speech Input      SpeechAnalyzer（可用时）/ SFSpeechRecognizer
Speech Output     AVSpeechSynthesizer
Cloud             统一 MultimodalReasoner 协议，具体服务可替换
Metrics           os_signpost + 自定义 InferenceMetrics
Storage           只保存非敏感评测结果，不保存相机原始帧
```

---

# 第五部分：项目怎么组织

## 12. 推荐目录

```text
PocketLens/
├── App/
│   ├── PocketLensApp.swift
│   └── AppState.swift
├── Camera/
│   ├── CameraSession.swift
│   ├── FrameBuffer.swift
│   └── SceneChangeDetector.swift
├── Inference/
│   ├── MultimodalReasoner.swift
│   ├── LocalVLMReasoner.swift
│   ├── CloudVLMReasoner.swift
│   └── Answer.swift
├── Routing/
│   ├── InferenceRouter.swift
│   ├── RoutePolicy.swift
│   └── DeviceState.swift
├── Voice/
│   ├── SpeechInput.swift
│   └── SpeechOutput.swift
├── Privacy/
│   ├── FrameRedactor.swift
│   └── DataPolicy.swift
├── Telemetry/
│   ├── InferenceMetrics.swift
│   └── MetricsStore.swift
└── UI/
    ├── CameraView.swift
    ├── PromptBar.swift
    ├── AnswerOverlay.swift
    └── MetricsPanel.swift
```

## 13. 关键协议

```swift
protocol MultimodalReasoner: Sendable {
    func answer(
        frame: CVPixelBuffer,
        prompt: String
    ) async throws -> Answer
}

struct Answer: Sendable {
    let text: String
    let route: Route
    let timeToFirstToken: Duration
    let totalDuration: Duration
    let inputBytes: Int
    let outputTokenCount: Int
}

enum Route: String, Sendable {
    case local
    case cloud
}
```

为什么先抽协议：

- 首版可以手动切换本地与云端；
- 后续可以 A/B 两种模型；
- UI 不依赖具体推理框架；
- 测试时可以注入 Fake Reasoner；
- 路由逻辑可以独立演进。

---

# 第六部分：从零到一的 12 步

## 14. 总览

| 步骤 | 做什么 | 通过条件 |
|-|-|-|
| 1 | 环境与指标基线 | 真机可安装空 App |
| 2 | 原样跑 FastVLM Sample | 单图问答成功 |
| 3 | 建自己的 App 壳 | Camera UI + 模块协议 |
| 4 | 接入相机 | 30 FPS 预览稳定 |
| 5 | 做最新帧调度 | 不积压旧帧 |
| 6 | 接本地 VLM | 飞行模式可回答 |
| 7 | 流式 UI 与取消 | 可中断旧请求 |
| 8 | 接语音输入/输出 | 说问题、听回答 |
| 9 | 接云端 Reasoner | 手动 Cloud 模式可用 |
| 10 | 自动端云路由 | 简单本地、复杂上云 |
| 11 | 指标与隐私 | 看得到延迟/调用/字节 |
| 12 | 真机验收与演示 | 10 分钟稳定、录屏可复现 |

## 15. 步骤 1：环境与基线

### 学什么

- Xcode 真机签名；
- iOS Deployment Target；
- Swift Package Manager；
- Release 与 Debug 性能差异。

### 做什么

1. 安装 Xcode 26 或能支持目标 iOS 的版本。
2. iPhone 12 Pro Max 开启 Developer Mode。
3. 新建 SwiftUI App。
4. 配置相机、麦克风、语音识别权限。
5. 真机安装空 App。
6. 记录设备型号、系统版本、可用存储和电池状态。

### 产物

`baseline/device.json`

```json
{
  "device": "iPhone 12 Pro Max",
  "chip": "A14",
  "ram_gb": 6,
  "os": "实际版本",
  "build": "Release"
}
```

### Gate

- 空 App 真机启动；
- 相机和麦克风权限弹窗正常；
- 不在模拟器做模型性能结论。

## 16. 步骤 2：原样跑通官方 FastVLM

### 学什么

- 模型权重和 App 代码的关系；
- Tokenizer、Vision Encoder、LLM；
- 模型加载、Prefill、Decode。

### 做什么

```bash
git clone https://github.com/apple/ml-fastvlm.git
cd ml-fastvlm
chmod +x app/get_pretrained_mlx_model.sh
app/get_pretrained_mlx_model.sh --model 0.5b --dest app/FastVLM/model
open app/FastVLM.xcodeproj
```

以仓库实际工程路径为准。不要一开始改模型或 UI。

> 版本止损：截至 2026 年 6 月，官方 App 可能因 `MLXLMCommon/MLXVLM` 迁移到<br>
> `mlx-swift-lm 3.x` 后的破坏性变更而编译失败。遇到依赖错误时，先检查<br>
> [Issue #77](https://github.com/apple/ml-fastvlm/issues/77) 与<br>
> [PR #78](https://github.com/apple/ml-fastvlm/pull/78)，固定已验证依赖版本或使用已适配分支。
> 不要在同一组 API 报错上盲目修几十处源码。

固定三张非敏感测试图：

1. 单个物体；
2. 包含文字的包装；
3. 多物体桌面。

记录：

- 冷加载耗时；
- 热加载耗时；
- TTFT；
- 生成速度；
- 峰值内存；
- 是否触发温度状态。

### Gate

- 连续运行 10 次无崩溃；
- 3 张图都能生成答案；
- 若模型无法加载，立即降级模型，不在集成代码里反复修。

## 17. 步骤 3：搭自己的 PocketLens App 壳

### 学什么

- 协议隔离；
- 依赖注入；
- Observation/状态管理；
- 推理逻辑不进入 View。

### 做什么

先用 Fake Reasoner：

```swift
struct FakeReasoner: MultimodalReasoner {
    func answer(frame: CVPixelBuffer, prompt: String) async throws -> Answer {
        try await Task.sleep(for: .milliseconds(300))
        return Answer(
            text: "这是一个本地模拟答案",
            route: .local,
            timeToFirstToken: .milliseconds(200),
            totalDuration: .milliseconds(300),
            inputBytes: 0,
            outputTokenCount: 10
        )
    }
}
```

页面先有：

- 相机区域；
- 文本输入；
- Local / Auto / Cloud 切换；
- 答案区域；
- 指标面板。

### Gate

- 不接真实模型也能走完整 UI；
- 切换页面不会残留 Task；
- View 不 import MLX/Core ML。

## 18. 步骤 4：接入相机

### 学什么

- `AVCaptureSession`；
- `AVCaptureVideoDataOutputSampleBufferDelegate`；
- `CVPixelBuffer`；
- 前后台和相机中断。

### 做什么

- 预览保持 30 FPS；
- 推理输入与预览解耦；
- 不保存视频；
- 使用串行 Capture Queue；
- UI 只接收预览层，不复制整帧。

### Gate

- 预览 5 分钟稳定；
- 前后台回来能恢复；
- 旋转方向正确；
- 不推理时 CPU/GPU 基线正常。

## 19. 步骤 5：做 FrameGate

### 学什么

- 背压；
- latest-frame-wins；
- 场景变化检测；
- 节流与去抖。

### 错误做法

```text
30 FPS 相机
-> 每帧加入推理队列
-> 队列越来越长
-> 用户看到的是几秒前的世界
```

### 正确做法

```text
相机只保留 latestFrame
-> 用户提问或场景变化
-> 取当前最新帧
-> 推理期间新帧覆盖旧帧
-> 旧请求可取消
```

首版策略：

- 用户提问强制触发；
- 自动模式最多 1 FPS；
- 图像 FeaturePrint 或低分辨率直方图判断变化；
- 变化小于阈值不推理。

### Gate

- 推理队列长度永远不超过 1；
- 延迟增加时仍回答最新场景；
- 10 分钟自动模式不产生任务堆积。

## 20. 步骤 6：接入 LocalVLMReasoner

### 学什么

- PixelBuffer 转模型输入；
- 图像 Resize/Normalize；
- Prompt Template；
- Token 流式回调；
- 模型生命周期。

### 做什么

1. 把 FastVLM Sample 的模型代码抽到 `LocalVLMReasoner`。
2. 不复制整个 Sample UI。
3. 模型加载放 Actor，避免并发加载。
4. 首版最大输出 64 Token。
5. Prompt 要求短答：

```text
请用不超过两句话回答。若图片信息不足，明确说无法判断。
```

1. App 进入后台取消推理并按内存策略释放模型。

### Gate

- 飞行模式可回答；
- 同时提交两个请求不会并发跑两个模型；
- 第二个请求能取消第一个；
- 输出不会无限重复。

## 21. 步骤 7：流式 UI 与取消

### 学什么

- AsyncStream；
- MainActor；
- 取消传播；
- 首 Token 体感。

### 做什么

- 首 Token 到达就显示；
- 正在生成时显示停止按钮；
- 用户切换问题时取消旧请求；
- 区分加载、Prefill、Generating、Done、Failed。

### Gate

- UI 不等完整回答才刷新；
- 取消后 200 ms 内停止 UI 更新；
- 旧 Token 不会串进新回答。

## 22. 步骤 8：接语音

### 学什么

- SpeechAnalyzer / Speech Framework；
- `AVAudioSession`；
- volatile/final transcript；
- TTS 与麦克风冲突。

### 做什么

首版只做半双工：

```text
按住说话
-> 得到最终文本
-> 暂停录音
-> 推理
-> TTS 播放
-> 播放结束恢复录音
```

不要首版就做边听边说和随时打断。

### Gate

- 语音能转换成 Prompt；
- TTS 不会被再次识别为用户输入；
- 权限拒绝时能退回文本输入。

## 23. 步骤 9：接 CloudVLMReasoner

### 学什么

- Multipart/Base64 图片上传；
- 流式 HTTP；
- 超时、重试和取消；
- 数据最小化。

### 做什么

- 具体云服务放在协议实现后面；
- 上传前降分辨率；
- 默认不上传连续视频，只上传当前精选帧；
- 不记录图片和 Prompt 明文日志；
- 超时后允许退回本地短答。

### Gate

- Cloud 模式能回答实时知识问题；
- 取消时网络请求同步取消；
- 网络断开时不阻塞本地模式。

## 24. 步骤 10：自动端云路由

<whiteboard token="CKLBwW0izhQzGFbf40gcWfzLndg"></whiteboard>

### 首版 RoutePolicy

强制云端：

- 用户选择 Cloud；
- Prompt 包含“最新、价格、新闻、附近、联网搜索”；
- 要求长回答或复杂比较；
- 本地模型未下载；
- 温度为 serious/critical；
- 可用内存低于阈值。

优先本地：

- 图片描述；
- OCR；
- 物体识别；
- 短问答；
- 飞行模式；
- 用户选择 Local。

本地失败升级：

- 输出解析失败；
- 重复 Token；
- 超时；
- 明确回答“无法判断”；
- 用户点击“深度回答”。

首版不要假装拥有精确的生成置信度。先用可解释规则，后续再引入模型评估器。

### Gate

- 每次请求显示路由原因；
- Auto 模式可被测试复现；
- 云端失败不破坏本地能力；
- 所有上传都经过 Privacy Policy。

## 25. 步骤 11：指标与隐私

### 必须记录

| 指标 | 含义 |
|-|-|
| Model Load | 模型冷/热加载时间 |
| TTFT | 从请求到首 Token |
| TPS | Decode 生成速度 |
| E2E | 从提问到答案完成 |
| Peak Memory | 峰值内存 |
| Thermal State | 温度状态 |
| Local Hit Rate | Auto 模式本地完成比例 |
| Cloud Calls | 云端调用次数 |
| Upload Bytes | 上传总字节数 |
| Cancel Latency | 取消请求到真正停止 |

### 隐私红线

- 相机帧默认不落盘；
- 不在日志写图片、完整 Prompt 和模型回答；
- 云端上传只发送当前精选帧；
- 支持用户强制 Local；
- UI 明确显示当前路由；
- 相册/相机权限按需申请；
- 敏感 Demo 数据只用合成或非敏感素材。

### Gate

- 一次完整会话可导出只含指标的 JSON；
- 飞行模式下上传字节为 0；
- Local 模式不会初始化 Cloud Client。

## 26. 步骤 12：真机验收

### 功能

- [ ] 三类固定场景均可回答

- [ ] Local / Auto / Cloud 三种模式可切换

- [ ] 飞行模式本地可用

- [ ] 语音输入和 TTS 可用

- [ ] 用户可取消推理

### 性能

- [ ] 相机预览稳定 30 FPS

- [ ] 本地 TTFT p50 <= 1.5 秒

- [ ] 本地 TTFT p95 <= 2.5 秒

- [ ] 本地 Decode >= 8 tok/s

- [ ] 推理队列长度 <= 1

- [ ] 连续运行 10 分钟无 Jetsam

- [ ] 无 serious/critical thermal

- [ ] 峰值内存不超过当前可用预算 70%

### 端云价值

- [ ] 30 个场景中本地完成率 >= 60%

- [ ] 相比 Cloud-only，云端调用下降 >= 50%

- [ ] 相比持续上传，上传字节下降 >= 80%

- [ ] 复杂任务能成功升级云端

- [ ] 每次路由原因可解释

如果这些指标过不了，不要先训练模型。先检查：

1. 输入分辨率；
2. 输出长度；
3. 推理频率；
4. 请求是否积压；
5. 模型是否重复加载；
6. Metal 缓存是否释放；
7. 是否应该换更小模型。

---

# 第七部分：六周学习节奏

## 27. 每周交付

| 周 | 学习主题 | 可运行产物 |
|-|-|-|
| 1 | VLM、MLX、真机性能 | 官方 FastVLM 单图问答 |
| 2 | AVFoundation、FrameGate | 相机最新帧本地问答 |
| 3 | Swift Concurrency、流式 UI | 可取消的 Token 流 |
| 4 | Speech、TTS、端云协议 | 语音提问 + 手动端云切换 |
| 5 | Router、隐私、Telemetry | Auto 路由与指标面板 |
| 6 | 真机压测与演示 | 10 分钟稳定录屏 + 报告 |

每周都回答四个问题：

1. 这周新增了什么能力？
2. 哪个数字比上周更好？
3. 哪个失败是模型问题，哪个是客户端问题？
4. 如果现在停止，已有产物还能独立展示什么？

---

# 第八部分：什么时候学习量化、蒸馏和剪枝

## 28. 压缩不是 MVP 前置

只有出现以下问题才进入模型压缩：

- 模型加载失败；
- 峰值内存超标；
- TTFT 超标；
- 温度不可接受；
- 模型包太大；
- 许可证要求替换模型；
- 需要固定业务能力而通用模型效果不足。

## 29. 零数据阶段先做什么

不训练模型也能做四类优化：

1. 降输入分辨率；
2. 限制输出 Token；
3. Prompt Cache/KV Cache；
4. 降推理频率；
5. 事件触发；
6. 模型按需加载与释放；
7. 选择更小的预训练模型；
8. 使用系统 Vision/Speech 替代部分生成任务。

这些优化通常比第一次剪枝更便宜。

## 30. 可选压缩路线

### A. 量化

最先学：

```text
FP16 基线
-> INT8
-> INT4
-> 比较模型大小、精度、TTFT、TPS、内存
```

### B. 蒸馏

只有在固定任务上做：

- 场景分类；
- 隐私检测；
- OCR；
- 结构化字段抽取；
- 路由判断。

学习 PoC 可用 1,000-5,000 个公开或合成样本，不需要一开始调用十万次 API。

### C. 结构化剪枝

真正删除：

- Layer；
- Attention Head；
- MLP Channel；
- Hidden Dimension；
- Vision Encoder Channel。

剪枝后必须蒸馏恢复，再做量化，最后回到 iPhone 验证。

完整压缩路线见：

隐私 OCR 与模型压缩学习路线见本系列后续进阶篇。

---

# 第九部分：常见失败

## 31. 模型下载后 App 包过大

Demo 可以内置模型。生产版应：

- 首次使用时 Wi-Fi 下载；
- 校验 Hash 和签名；
- 支持分片与断点续传；
- 长期不用自动清理；
- 模型升级用差分下载；
- 低存储设备不下发。

## 32. 模型加载时 App 被杀

检查：

- 是否同时存在两个模型实例；
- 是否在 Debug/Xcode 附加状态测性能；
- 是否模型加载与相机高峰重叠；
- 是否 Context/KV Cache 过大；
- 是否有临时 Tensor 没释放；
- 是否应该降模型或量化。

## 33. 相机不卡，但回答越来越旧

根因通常是队列积压。必须 latest-frame-wins，旧帧和旧请求可取消。

## 34. 本地回答很快但很笨

不要立刻换 7B：

1. 缩小任务范围；
2. 加系统 Vision/OCR 工具；
3. 改 Prompt 和输出 Schema；
4. 对复杂问题上云；
5. 再考虑更大模型或微调。

## 35. 本地反而比云端慢

这是可能的。端侧的价值不是每个请求都更快，而是：

- 没有网络抖动；
- 可离线；
- 原始数据不出端；
- 高频调用无按次费用；
- 可以在上传前先筛选。

用 p50/p95、字节数和云端调用次数联合评价，不只看单次平均延迟。

## 36. “本地没有 Token 费用，所以免费”

错误。成本变成了：

- 用户电量；
- 发热；
- 存储；
- 内存与稳定性；
- 设备覆盖率；
- 模型维护；
- 客户端研发和测试。

端侧只有在调用足够高频、隐私或离线足够重要时，成本优势才成立。

---

# 第十部分：最终交付物

## 37. Demo 演示脚本

### 场景 1：离线

1. 打开飞行模式；
2. 对着桌面问“桌上有什么”；
3. 页面显示 `Route: Local`；
4. 返回简短回答；
5. 指标显示 `Upload Bytes: 0`。

### 场景 2：OCR

1. 对着产品包装或菜单；
2. 问“读一下最重要的文字”；
3. 本地返回关键文字；
4. 展示 TTFT 与 TPS。

### 场景 3：端云协同

1. 恢复网络；
2. 对着一个产品问“它的最新价格和竞品是什么”；
3. 页面显示 `Route: Cloud` 及原因“需要实时知识”；
4. 云端返回；
5. 看板展示 Local Hit Rate 与 Cloud Calls。

## 38. 代码交付

- 可独立编译的 Xcode 工程；
- README；
- 模型与许可证说明；
- 30 个场景测试清单；
- 指标 JSON；
- 真机录屏；
- 性能与成本报告；
- 已知限制。

## 39. 你最终真正学会了什么

完成这一个 Demo 后，你不只是“会把模型放进 App”：

- 你知道模型文件如何进入 iPhone；
- 你知道 VLM 如何消费相机帧；
- 你知道如何避免实时流积压；
- 你知道 TTFT、TPS、KV Cache 和内存；
- 你知道什么时候端、什么时候云；
- 你知道 AI 眼镜为什么需要手机伴侣；
- 你知道如何量化隐私、离线和成本收益；
- 你已经具备进入量化、蒸馏和剪枝的工程基础。

---

# 费曼收口

⭐ 一句话讲完整篇：

**不要先训练一个小模型，而要先用现成模型把“眼镜感知、手机即时理解、云端深度推理”这条链路跑通；链路跑通后，哪个指标卡住，再针对那个指标量化、蒸馏或剪枝。**

📋 速查表：

| 主题 | 最难理解的点 | 难度 |
|-|-|-|
| 多模态 | 实时相机不等于逐帧 VLM | P0 |
| AI 眼镜 | 眼镜、手机、云是三个算力层 | P0 |
| MVP | 不需要训练数据和教师 API | P0 |
| Apple | Siri/Apple Intelligence 不是纯本地 | P0 |
| 成本 | 本地没有按次费，但有设备成本 | P1 |
| 压缩 | 指标卡住后才开始剪枝 | P1 |

🎯 口诀：

**先跑通，再测量；先路由，再压缩；眼镜做感知，手机做即时，云端做深思。**

---

# 参考资料

- [FastVLM 官方研究](https://machinelearning.apple.com/research/fast-vision-language-models)
- [FastVLM 官方仓库](https://github.com/apple/ml-fastvlm)
- [FastVLM MLX 3.x 兼容问题](https://github.com/apple/ml-fastvlm/issues/77)
- [Apple 第三代 Foundation Models](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models)
- [Foundation Models Framework](https://developer.apple.com/documentation/foundationmodels/)
- [Private Cloud Compute](https://security.apple.com/documentation/private-cloud-compute/)
- [Apple Intelligence 设备要求](https://support.apple.com/en-us/121115)
- [MLX Swift Examples](https://github.com/ml-explore/mlx-swift-examples)
- [WhisperKit](https://github.com/argmaxinc/WhisperKit)
- [NVIDIA Minitron](https://github.com/NVlabs/Minitron)
