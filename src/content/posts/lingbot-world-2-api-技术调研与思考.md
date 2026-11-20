---
title: "LingBot World 2 API 调研：它怎么边跑边生成世界"
description: "最近我盯上了一个叫 LingBot World 2 的东西。它是蚂蚁 LingBot 团队做的世界模型，由 Reactor 托管成了一个实时可交互的在线版本。说人话：你给它一张参考图和一段文字描述，它"
publishedAt: 2026-07-09T08:06:45.000Z
category: "【费曼·实战复盘】"
tags: []
draft: false
source: public-rewrite
updatedAt: 2026-11-20
---

# 为什么先读文档不直接上手试

**LingBot World 2** 是蚂蚁 LingBot 团队做、挂在 Reactor 上的实时交互世界模型。给一张参考图和文字描述，就能在电脑上实时算出一个用键盘鼠标走进去逛的场景，边走边生成，属于即时推演而非提前渲染完的视频。

最初听说它「能让人直接走进生成出来的世界里逛」才去关注，点进去发现排队太长暂时进不去，就先翻完官方 API 文档顺一遍三件事：

1. 这套 API 到底需要什么前提、怎么在本地跑起来？
2. 提供了哪些命令、参数规格与状态机流转？
3. 它跟以前常用的「图生 3D」工具本质差在哪，后续演进怎么看？

<callout emoji="💡">
**一句话结论：**这套 API 跑得通，官方还送了开源前端脚手架，拿到 Reactor API Key 几分钟就能在浏览器用键盘逛世界。但本质是一条「长连接加实时视频流」交互协议，贵和门槛全都卡在后端独占 GPU 的实时算力上。
</callout>

调研基于 Reactor 官方三份文档：[Overview](https://docs.reactor.inc/model-api-reference/lingbot-world-2/overview)、[Schema](https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema)、[Tutorial](https://docs.reactor.inc/model-api-reference/lingbot-world-2/tutorial)。

---

# 跑通流程要准备什么，怎么启动

官方已经把前端演示工程写好了（Next.js 配合 SDK，含启动、驾驶、切场景和报错处理），上手成本很低，先确认四项前提：

| 前提条件 | 具体要求 |
|-|-|
| **Reactor API Key** | 以 `rk_` 开头，必须放在服务端换取短期 JWT 下发给前端，密钥不能露在浏览器侧 |
| **本地运行环境** | 前端用 Node.js 18 以上版本配合 pnpm（npm 或 yarn 也可）；Python 侧装 `reactor-sdk` 后直接连，无需中转 JWT |
| **计费口径** | 按真实会话时长计费（具体费率看官方 pricing 接口动态页面），只要连接不断就会一直烧算力 |
| **GPU 调度排队** | 建连会经历 `disconnected → connecting → waiting → ready` 四步等待 GPU 分配；人多进不去正是卡在这一环 |

## 跟着官方示例四步跑通

1. `git clone https://github.com/reactor-team/js-sdk` 后进入 `examples/lingbot-world-2` 目录
2. 复制 `.env.example` 为 `.env.local`，填入自己的 `REACTOR_API_KEY`
3. 跑起 `pnpm install && pnpm dev` 并打开 `localhost:3000`
4. 点 **Connect** 后挑一个 Quick Start 场景，用 WASD 走动、方向键或鼠标环视、数字键放事件、空格跳跃、C 键下蹲

## 三个容易踩坑的设计反直觉点

它和发一次请求拿回结果的常规接口不同，这套协议是有状态、异步且持续吐流的：

<callout emoji="💡">
1. **命令异步生效，事件才是真状态：**发了 `setImage` 得等收到 `image_accepted` 才算换图，UI 状态只能跟着事件流走。
2. **出错通过带外事件返回：**比如没设参考图就调 `start`，函数当场不报错，随后推过来一条 `command_error`。
3. **输入当成持续状态管理：**发了 `set_move_longitudinal: "forward"` 会一路向前冲，直到你再发一次 `"idle"`；每个按下都得配对松开。
</callout>

另一个值得抄进 Agent 的设计是：示例里的 prompt **完全从输入状态实时合成**（拆成 base、camera、movement、events、vertical 五层），按键一变立刻重拼发送，不靠手动微调旧文本。

---

# 能力清单与底层协议

## 基本规格

| 规格项 | 值 |
|-|-|
| 模型名 | `reactor/lingbot-world-2` |
| 帧率与分辨率 | 48 fps，1664 × 960（960P） |
| 输入 | 参考图加上文本 prompt |
| 输出 | 单条 `main_video` 自适应视频流，控制全部走指令 |

## 会话生命周期

建连后从 `WAITING` 起步，靠 `start` 进入 `GENERATING`，可由 `pause` 和 `resume` 启停。要特别注意一轮 chunk 跑完后如果会话还处于 started 状态，服务端会自动按旧配置开下一轮；真想彻底停下来必须显式调 `reset` 清回 `WAITING`。

## 四类控制命令

所有 `set_*` 命令都在下一个 chunk 边界生效（每个 chunk 大约 3 个 latent，合 12 帧左右）：

| 类别 | 命令 | 说明 |
|-|-|-|
| 场景设定 | `set_image` | 设置参考图锚定画面基调，开跑前必须设，`start` 之后想换只能先 reset |
| 场景设定 | `set_prompt` | 热替换文本 prompt，生成途中可随时改天气、光线或突发事件，下个 chunk 生效 |
| 场景设定 | `set_seed` | 固定随机种子（默认 42） |
| 相机驾驶 | `set_move_longitudinal` / `set_move_lateral` | 控制前后移动（W/S）与左右横移（A/D），两轴叠加可斜行 |
| 相机驾驶 | `set_look_horizontal` / `set_look_vertical` | 控制水平偏航与上下俯仰，配合 `set_rotation_speed_deg`（默认 5，范围 0 至 30） |
| 相机驾驶 | `set_camera_pose` | 底层速度剖面控制 `[rx,ry,rz,tx,ty,tz]`，旋转覆盖 look 轴，平移叠加在 WASD 上 |
| 高级调参 | `set_attn_window` | 覆盖自注意力窗口（auto/small/large），静态用小窗，大运动切大窗 |
| 高级调参 | `set_kv_cache_reset` / `trigger_kv_cache_reset` | 设置 KV-cache 与 RoPE 重置模式（auto/manual/off），切大场景时手动冲刷旧记忆 |
| 生命周期 | `start` / `pause` / `resume` / `reset` | 开跑（缺图或缺词报 `command_error`）、块间暂停恢复与状态复位 |

## 上层玩法都是命令和文案拼出来的

示例工程里看起来像游戏功能的花活，底下都没有额外 API，全靠上面这几条原语凑出来：

- **世界事件（数字键 1 到 9）：**按住某个键就把对应事件描述织进 prompt，松开即撤回。本质全靠 `set_prompt`，功夫全在文案组织上。
- **跳跃与下蹲：**把相机垂直增量 `set_camera_pose` 的 `ty` 通道和文本描述成对下发，靠对称的上下速度把视角送回原高度。
- **绕物旋转（Orbit）：**并不存在独立模式，而是把水平偏航和成比例的横移绑在一起跑。
- **录屏与手柄支持：**基础 SDK 带了 `requestClip` 和手柄映射，只看怎么接入。

## 事件流怎么订阅

服务端吐出的消息里，`state` 是唯一真相源，订阅即可拿到完整会话快照（是否生成中、当前 prompt、当前 chunk 编号、各个输入轴和随机种子），不用自己手动拼凑历史。另外配套有 `image_accepted`、`prompt_accepted`、驱动逐段动画的时钟事件 `chunk_complete` 和 `command_error`。

---

# 和之前用过的「图生 3D」本质差在哪

看起来都是给一张图出发，但底层路线完全两码事，正好用来认清世界模型新在何处：

| 对比维度 | 图生 3D（CAD 3D） | LingBot World 2（世界模型） |
|-|-|-|
| 产出物形态 | 静态 3D 文件：mesh 网格、点云和贴图 | 持续输出的视频流，没有落地 3D 文件，世界边走边算 |
| 底层原理 | 几何重建，把单一物体形状还原出来 | 动力学推演，预测我执行动作后下一帧世界长什么样 |
| 交互时机 | 先生成完再导进引擎，生成中途插不上手 | 生成过程就是交互过程，输入实时改写后面每一帧 |
| 一致性保证 | 显式三维几何，天生支持多视角对齐和测量 | 靠 KV-cache 与注意力窗口记前文，长程容易跑偏，需要定期 reset |
| 物理因果 | 只管形状，不另外接物理引擎就不会动 | 模型自己带着因果和物理直觉，比如撞墙会停、开枪带火光 |

<callout emoji="📌">
图生 3D 给你的是一件可存可改的物体资产；世界模型给你的是一个当下正算出来的可交互场景。
</callout>

---

# 看完文档后的几点判断

## 最亮眼的其实是控制层抽象

它把连续视频生成网络包成了一套游戏手柄式的状态机接口。开枪、跳跃、绕物、切天气都没有硬编码成独立接口，而是全由运行时分层 prompt 加几个运动原语拼成，跟做 Agent 时把意图拆成结构化输入的思路如出一辙。

## 实时性既是卖点，也是算力枷锁

48 fps、960P 加亚秒延迟体验很惊艳，代价是一直开着会话就必须独占一块 GPU 烧钱。之前遇到人太多排不上队，正是这类实时生成模型成本结构决定的。消费端短期绕不开算力排队，率先大面积落地的反而是机器人训练、自动驾驶仿真这类离线的批量交互数据场景。

## 高级控制旋钮暴露了长程跑偏的软肋

文档专门给了 `set_attn_window` 和 `set_kv_cache_reset`，等于直认基于视频注意力的世界模型走远了必飘，必须定期清缓存拉回稳态。短期记忆、实时性与长程几何一致之间目前撞上了「不可能三角」，学界也在探「显式 3D 锚点配合隐式记忆」想越过这堵墙。

## 后面可能往哪走

- **短期演进：**把分层 prompt 引擎搭成创作平台，让作者靠纯文本 JSON 就能编排丰富事件和玩法。
- **中期演进：**接上大语言模型，由 LLM 负责意图和规划，世界模型负责物理推演，合出一个能在虚拟空间里试错的 Agent。
- **长期演进：**跳出纯视频生成，补出真正的显式空间几何，走到「转过身房还在、走远不漂移」的模拟器形态，数字孪生和科研仿真才能跑起来。

<callout emoji="💡">
**最后建议：**值得花半天跑通一次官方脚手架，感受「命令异步、事件为真相、输入是持续状态、prompt 从状态派生」这四条交互模式。如果是业务接入，先问清是否真要 48fps 实时陪跑，非实时场景跑离线批量划算得多。
</callout>
