---
title: "me-context：可移植的个人上下文"
description: "把个人事实和偏好保存成可携带的明文档案，在多个 AI 宿主间按任务最小读取。"
publishedAt: "2026-09-07"
category: "AI 与工程"
tags: ["AI"]
draft: false
source: "public-rewrite"
---

本方案要解决的问题很具体：每个人在多个 AI 宿主（本地模型、云 AI、编程 agent）之间反复自我介绍，而平台聊天记忆带不走、也换不了宿主。me-context 把"关于我、关于我身边的人"的事实与偏好，沉淀成一份 **本地、明文、可拷贝、人能直接看懂和改的 Markdown 档案** ，再由一个 MIT 开源的 skill 负责科学采集、分层读取和安全投喂。本文面向技术读者，讲清楚它依赖什么知识、链路怎么跑、与 Claude Code / Codex / Cursor 原生记忆差在哪里、以及不做什么。

# 背景与缺口

对 11 个现有方案做"五要素"核对（科学采集、主动取舍、可移植、关系建模、读侧敏感分层）， **没有一个全绿** ：

| 缺口维度 | 现状 | 后果 |
|-|-|-|
| 平台聊天记忆不可迁移 | OpenAI 等无独立记忆导出入口；国内 C 端一旦关停或停服，对话记忆即消失 | 换宿主 = 从零开始 |
| 载体格已被证明 | 编码 agent 的规则文件、SKILL.md 已在 30+ 平台成为可携带的指令载体 | 技术上"一份档案到处装"成立 |
| 最薄弱的两环 | 访谈式科学采集、隐私分层 | 多数方案要么不采、要么全量灌 |

个人 Agent 是明确趋势，但"把一切交给 AI、让它全自动记住全部"并不是出路：一方面，自传体记忆是 **重构而非录像** ，全量逐字灌进上下文既无必要也不安全（见第 2、12 章）；另一方面，本机实测 Claude Code / Codex / Cursor 的原生记忆（第 11 章）也都是"少量、人写或半自动、机器本地"，没有任何一家做全量记忆。me-context 取中间路线： **科学采集、主动取舍、人裁决、可移植、分层安全** 。

# 知识与理论基础

下表是我们直接依赖、可追溯的知识。每条 = 结论 + 数字 + 来源；不是装饰，每条都对应一个设计决定。

## 人格、测量与决策证据

| 结论 / 数字 | 来源 | 对设计的意义 |
|-|-|-|
| 大五维度有跨职业预测效度（尽责性 ρ≈.23），人格能预测人生结果 | [Barrick & Mount 1991](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1744-6570.1991.tb00688.x)；[Roberts 等](https://pmc.ncbi.nlm.nih.gov/articles/PMC4499872/) | 采大五，不采类型学 |
| 短量表信度边界：[Mini-IPIP](https://ipip.ori.org/MiniIPIPKey.htm) α .65–.77；[BFI-2-XS](https://www.ocf.berkeley.edu/~johnlab/bfi.html) 只够粗筛；[TIPI](https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/) α .40–.73 | IPIP / Soto & John | 只给"粗轮廓带"，不做诊断 |
| 弃 [MBTI](https://www.themyersbriggs.com/hubfs/Addressing misconceptions about the MBTI Assessment.pdf)：5 周后约 50% 的人在某一维度翻转；漏了 N 维；巴纳姆效应（[Forer 1949](https://onlinelibrary.wiley.com/doi/abs/10.1002/9780470479216.corpsy0108)） | 行业测量学共识 | 不做类型标签 |
| 显式写进上下文的偏好确实有效 | [LaMP, arXiv:2304.11406](https://arxiv.org/abs/2304.11406) | 显式档案有效 |
| 把行为写成结构化规格，约为全量上下文的 1/25 成本 | [arXiv:2605.28969](https://arxiv.org/abs/2605.28969) | 原子化、行为化条目 |
| SJT r≈.26–.34；结构化行为访谈 r=.51；工作样本 r=.54 | [Schmidt & Hunter 等元分析](http://www.homepages.se.edu/cvonbergen/files/2013/11/The-Validity-and-Utility-of-Selection-Methods-in-Personnel-Psychology_Practical-and-Theoretical-Implications-of-85-Years-of-Research-Findings.pdf) | 用情境题/行为题，不用空泛自评 |
| IRT/CAT 信息增益：按当前估计选最有信息的题（MovieLens/ASVAB 可省近半时长） | IRT 文献 | 三档采集、断点续填、冷启动熵选问 |
| 问卷疲劳：>60 题或 >20 分钟完成率骤降，15+ 题完成率约 42% | 问卷方法学 | 快速档 \~10 题/8–10 分钟 |
| 言行不一：observed ≠ declared；AI 推断可被人推翻（[Contestable AI](https://arxiv.org/abs/2506.01662)） | HCI / 可信 AI | source 分层、人裁决 |
| 记忆提取 [MEXTRA](https://arxiv.org/abs/2502.13172)；持久记忆投毒（[Bad Memory](https://arxiv.org/html/2607.14611)）会污染后续建议 | 记忆安全研究 | AI 不直接落盘，先 inbox 人确认 |
| 健康信息缺失会翻转建议；医学引用约 47% 被指编造；[SEC](https://www.sec.gov/files/exams-eia-risk-alert.pdf) 把采集质量写成合规前提 | 医学 / 金融合规研究 | L3 健康财务逐次确认、不自动投喂 |

## 社交网与自我记忆理论（本轮新增，支撑关系网与"少即是多"）

| 理论 | 出处 | 一句话核心命题 → 对设计的意义 |
|-|-|-|
| 差序格局 | [费孝通《乡土中国》1947，第四篇](http://jds.cssn.cn/newzxdt/202101/t20210128_5300581.shtml) | 以己为中心按亲疏推波纹 → 档案以"我"为圆心、关系分层 |
| 社会护航模型 | [Kahn & Antonucci 1980, Life-Span Development and Behavior Vol.3, pp.254–283](https://academic.oup.com/gerontologist/article/61/8/1188/6412643) | 同心圈、内圈最亲密 → inner/close/peripheral 三圈 |
| 社会脑假说 / 层级量化 | [Dunbar 1992 J.Human Evolution 22(6):469–493](https://doi.org/10.1016/0047-2484(92)90081-J)；[Zhou/Sornette/Hill/Dunbar 2005 Proc.R.Soc.B](https://pmc.ncbi.nlm.nih.gov/articles/PMC1634986/) | 关系按 5/15/50/150 嵌套、内密外疏 → 内圈少而详、外圈多而疏 |
| 弱关系的力量 | [Granovetter 1973 AJS 78(6):1360–1380](https://www.journals.uchicago.edu/doi/abs/10.1086/225469) | 弱关系桥接新机会 → peripheral 也留一行梗概，不删成空白 |
| 交互记忆系统 TMS | [Wegner 1987, Theories of Group Behavior, pp.185–208](https://www.pnas.org/doi/abs/10.1073/pnas.2105061118) | 记住"找谁问什么" → 关系网里记"该向谁求证哪类事" |
| 自我记忆系统 SMS | [Conway & Pleydell-Pearce 2000 Psychological Review 107(2):261–288](https://doi.org/10.1037/0033-295X.107.2.261) | lifetime periods→general events→ESK 层级建构 → 迁移只带核心总结层 |
| 记忆巩固/再巩固（仅类比） | [Dudai 2004 Ann.Rev.Psychol.55:51–86](https://doi.org/10.1146/annurev.psych.55.090902.142050) | 自传体记忆是重构非录像 → 类比"inbox→人确认→巩固"， **不暗示 LLM 有生物巩固**  |

## 为什么不用心理量表做 onboarding（产品取舍，非否定心理学）

显式事实档案对任务有用的证据仍然成立：LaMP 证明显式上下文能提升模型在个性化任务上的表现，结构化行为规格约 1/25 上下文成本即可达到同等效果——这正是我们坚持采集"显式事实与协作指令"的原因。但人格特质短测（Mini-IPIP α .65–.77、TIPI α .40–.73）只够粗方向、像考试，对"帮我把事做好"这类具体任务增益弱；助理真正需要的是用户显式告诉它的事实与协作方式，而不是从几十道 Likert 题反推一个五维粗轮廓。

性格对齐改用低成本的 **自报标签** （用户自己填 MBTI/星座/形容词）：这是 user-declared 的自我描述， **自报 ≠ 测量** ，不假装科学、不产出人格诊断标签。大五/MBTI 效度等学术内容降级为"可选学术自评（非默认）"，仅在用户明确想做时单独引导。 **这是产品取舍而非否定心理学** ：大五本身的学术价值与预测效度没有被推翻，只是对一个"想先把事做好"的助理而言，性价比不够高。

# 总体架构

三件东西：可开源的能力仓（skill）、本地明文的私有数据仓、以及挂在上面的多类宿主。关键边界是—— **技能自身不提供上传通道；云端模型读取的片段仍会发送到对应服务，必须由用户确认、用户随时能打开文件看见/修改/删除"AI 记住了我什么"** 。

<img src="/assets/content/me-context-portable-memory/image-01.webp" alt="图 1 · 总体架构：可开源能力仓 ⇄ 本地明文私有数据仓（含 inbox 暂存区与 network 自我中心关系网）⇄ 多类宿主；数据无上传通道" width="1800" height="841" loading="lazy" decoding="async" />

-  **能力仓（MIT，无数据）** ：SKILL.md 的 read/write 双模式入口、templates/references（读门禁、写确认、圈层定义）、export.py。
-  **数据仓（本地明文 Markdown）** ：ME.md（默认投喂层）、profile/（work/goals/preferences/decisions/health/finance，L0–L4 分色）、network.md + entities/ + relations.md（自我中心关系网）、inbox/（未确认草稿）、private/（L4）、exports/。
-  **多宿主** ：本地 AI / 云 AI / 编程 agent，同一 skill 到处装；不支持则三级降级（粘贴 ME.md → 规则文件索引 → 纯文本片段）。

# 端到端链路总览

写链路与读链路分离。写：两源采集 → 轻探针 → inbox 草稿 → 批量整理确认 → declared 落盘 → CHANGELOG。读：六步门禁 + 按圈层最小切片。普通闲聊对档案 **零加载、零抓取** 。

<img src="/assets/content/me-context-portable-memory/image-02.webp" alt="图 2 · 端到端读写双泳道：上写（两源→轻探针→inbox→批量确认→declared），下读（六步门禁 + 三分支端点）" width="1800" height="734" loading="lazy" decoding="async" />

# 链路 · 采集

me-context 的 onboarding，本质是" **新个人助理向老板做入职情况了解** "——采集对实际服务有用的背景事实与协作偏好， **像聊天、不像考试** 。采集形态只有一种： **自然话题式访谈，没有前端页面、没有弹窗、没有表单、没有照念的问卷** 。

**话题式口径（按敏感度分层的节奏）** ：题本只是 AI 心里的话题地图（不照念），节奏随敏感度走——T0 低敏/半公开的轻话题（称呼、城市、职业方向、在忙什么、目标、爱好、口味、作息、年龄性别身高体重）允许一句自然的话成组带出 2–4 个（"对了顺便问下"），几轮自然收完、提效，但仍是散文聊天，不编号列表、不问号轰炸、不流水线；T1 家庭梗概一个话题一段、用户主动聊到才接；T2 收入/病史/婚姻细节仍召唤触发、就事问最小一条、绝不成批。用户答完先接话、再自然过渡，顺序随用户当下愿意聊的方向顺势走，用户主导节奏，首轮不追求问全。 **提问分寸（不查户口）** ：心甘情愿 > 信息完整；先讲这条信息对用户有什么好处；能合理推断的不盘问；给台阶（大概/跳过/分次补）融在语气里；AI 是想把老板服务好的助理，不是调研员。 **落盘不打断对话** ：句中轻确认即可，聊完一次性汇总，未确认的先进草稿，不每答一题就复述打断。

**心理量表（大五 Mini-IPIP / PVQ / GDMS / DOSPERT 等）整体移出默认流程** ：默认快速档不再有任何 Likert、反向计分或特质题。性格只保留"用户自报标签"（可填 MBTI/星座/自我形容词），明确是 user-declared 的自我标签、非测评、可改。这是一次诚实的产品演进：v1 曾把量表当快速档主体，实测被用户反馈"做成心理测试、跑偏"，v2 改回事实采集——因为助理要的是显式事实与协作指令，而不是特质分。

<img src="/assets/content/me-context-portable-memory/image-03.webp" alt="图 3 · 采集时序：自然话题式访谈——心里有话题地图不照念 → 一次聊一个话题、先接话再过渡 → 可跳过/给大概/中断续聊 → 句中轻确认、聊完一次性汇总，未确认进草稿；全程对话无前端" width="1800" height="586" loading="lazy" decoding="async" />

快速档就是"助理入职了解"：8 个事实/偏好模块是 AI 心里的话题地图，不是照念的问卷；首轮不追求问全，顺着用户当下愿意聊的话题走，随时跳过、只给大概、分次补。开场先发固定"开场话术"（讲清身份目的、怎么聊、只存本地不上传、健康财务家庭默认本地、可看可改可删）。

<img src="/assets/content/me-context-portable-memory/image-04.webp" alt="图 4 · 助理 onboarding 信息模块：8 个事实/偏好卡片（称呼基本/身体健康/工作方向/生活喜好/家庭重要的人/协作方式/自我标签/隐私设置）+ 底部时间轴（快速约10–12分钟 → 标准逐模块追问 → 深度领域事实清单，全程无量表）" width="1800" height="623" loading="lazy" decoding="async" />

| 模块 | 问什么（事实/偏好） | 默认存储位置 / 敏感度 |
|-|-|-|
| ① 称呼与基本 | 怎么称呼、pronouns、城市/时区 | L0/L1 · 可给云 |
| ② 身体与健康 | 身高体重作息 + 过敏/慢病/用药/忌口（禁忌安全最重要） | L3 · 只本地 |
| ③ 工作与方向 | 职业、在做什么、近期目标 | L1/L2 · 默认 |
| ④ 生活与喜好 | 饮食偏好、兴趣、旅行/消费 | L2 · 默认 |
| ⑤ 家庭与重要的人 | 谁重要、关系梗概（可跳） | L2/L3 · 只本地 |
| ⑥ 你希望我怎么工作 | 回答详略/给建议方式/格式/do-not—— **不管聊什么都适用的通用习惯（非工程规矩）** ；具体写代码、做技能的规矩不在建档时问 | L2 · 默认 |
| ⑦ 自我标签（可选） | 自报 MBTI/星座/形容词（非测评、可改） | L2 · 自报非测量 |
| ⑧ 隐私设置 | 大白话选哪些可给云、哪些只本地 | 控制项 · 由用户定 |

**量表降级为"可选学术自评"（非默认）** ：大五 [Mini-IPIP](https://ipip.ori.org/MiniIPIPKey.htm)、PVQ、[GDMS](https://pmc.ncbi.nlm.nih.gov/articles/PMC4438778/)、DOSPERT 等学术量表不再是默认采集内容；如用户明确想做，再单独引导，且结果只作为可选的学术自评参考，不进默认档案主体、不产出人格诊断标签。版权量表只给官方链接、不入库；量表许可小表见附录 B。

**决策与财务分片也不做心理测评** ：决策相关只记三条纯行为偏好——"重要决定希望我怎么帮（直接推荐/列优劣对比/先追问关键信息）、重大事项主动提示哪些风险、哪些必须你拍板哪些可放手"，不再用 GDMS 风格分类或 DOSPERT 风险分域；财务分片同理只记事实（收支区间/负债约束/目标/需提醒的风险），不做风险测评。inbox 草稿内部带一个 general/engineering 标记用于分流（用户无感）：AI 在整理新记忆时若识别到工程/研发规矩候选，会明确说"这是工程规矩，有专门的地方管，我不放进你的个人档案，需要的话帮你写进工程规则"。

## 信任梯度 T0 / T1 / T2 与需求触发

采集按信任梯度分层，而不是建档后按顺序自动推下一个包：T0 建档即可聊，T1 建立信任后/按需顺带，T2 高敏内容召唤制、就事问最小一条。深度包（健康/财务）是用户召唤制，收尾只一句"以后想管健康/做财务规划随时说，我就那件事问你一两条，平时不打听"，绝不主动盘点。

<img src="/assets/content/me-context-portable-memory/image-05.webp" alt="图 5 · 信任梯度 T0/T1/T2：T0 建档即可聊 / T1 信任后按需 / T2 召唤制就事问；深度包不按顺序自动推进，财务只记目标约束与粗量级、健康首次任务就事问过敏用药" width="1800" height="446" loading="lazy" decoding="async" />

# 链路 · 转化

回答不等于记忆。机器要把回答"转化"成可证伪的原子条目，且 **未确认的一律先落 inbox，不直接写进 declared** 。

<img src="/assets/content/me-context-portable-memory/image-06.webp" alt="图 5 · 转化流程：量表→反向键计分(6-x)→五维粗轮廓带（非诊断）；开放题→原子化打标→inbox 草稿→批量确认→declared" width="1800" height="716" loading="lazy" decoding="async" />

-  **早期量表方案（非默认）** ：按 IPIP 官方键反向计分（反向题取 6−x）→ 五维求和 → 领域级粗轮廓带（偏高/居中/偏低）， **不产诊断标签、不贴**  [ **MBTI** ](https://www.themyersbriggs.com/hubfs/Addressing misconceptions about the MBTI Assessment.pdf)  **式人格类型** 。
-  **开放/情境题** ：原子化——一条 = 一个事实/偏好、行为化可证伪；打 source（declared/observed/inferred）、confidence、layer、domain、updated；AI 拟稿先进 `inbox/`，人在批量整理时采纳/改/否/升级。

# 链路 · 存储与关系网

双仓分离：能力仓不含数据，数据仓是本地明文 Markdown。每条记忆是一个 **多维原子条目** （12 信息域 × L0–L4 × source × entity × 圈层）。物理上就是一棵树。

<img src="/assets/content/me-context-portable-memory/image-07.webp" alt="图 6 · 多维存储模型：12 域 × L0–L4 × source × entity(含 inner/close/peripheral 圈层)；右侧为明文文件树含 inbox/network" width="1800" height="693" loading="lazy" decoding="async" />

## 自我中心关系网（替代旧的 family 分片）

不再把"家人"当成一个单独的 family.md 分片，而是以"我"为圆心的同心三圈：inner（配偶/孩子/父母，详写喜好禁忌关键事实）、close（密友/关键同事，主要事实+"该向谁求证什么"）、peripheral（弱关系，只留"是谁、什么关系"一行梗概）。network.md 是概览，entities/ 存 inner/close 详档（每个 ≤约 1500 字），relations.md 存 10 词关系边（spouse_of / parent_of / works_with …）。

<img src="/assets/content/me-context-portable-memory/image-08.webp" alt="图 A · 自我中心关系网三圈：inner 详写 / close 主要事实 / peripheral 仅梗概；AI 沿边获得关系全局视角，但按圈层最小加载" width="1800" height="913" loading="lazy" decoding="async" />

## Conway SMS 三层映射（本轮不实现 JSONL）

| 层 | 对应 Conway | me-context 落法 | 是否迁移 |
|-|-|-|-|
| 核心总结 MD | lifetime periods + general events | 人写确认的结构化原子条目 |  **唯一迁移物**  |
| 可选事件层 events.jsonl | event-specific knowledge | 具体事件/轶事 | 本轮不实现、不迁移（V2） |
| 不记 | — | 一次性闲聊 / 临时状态 / L4 / 未确认推断 / 他人敏感隐私 | — |

正面回答一个常被忽略的点： **全程本地明文 Markdown、无加密流程** 。用户随时能打开文件看见"AI 记住了我什么"，透明、可审、可手改、可删——这是特性不是缺陷。用户不必懂文件结构，所有操作都通过对话完成。

## 个人知识图谱与可视化查看

档案本身就是一张个人知识图谱：ME.md 是枢纽，profile 各分片是属性节点，entities/\*.md 是人节点，relations.md 是关系边。`viz.py`（纯原生 HTML/CSS/JS，零框架 / CDN / 外链，断网可开；Python 端按 audience / 分区过滤、清洗模板占位后才序列化为 JSON 注入前端，前端只渲染、不取数）做成单文件自包含、可交互的本地页面；节点就是 Markdown 文件、边就是 relations，确定性渲染，不做向量 / embedding、无黑盒检索。布局是 **左关系网导航 + 右档案页主体** ：左栏只做导航，右栏是档案内容。

**点中心「我」→ 我的档案页** ：个人主页 header（首字头像 / 称呼 / 本名 / 城市时区 / 语言 / 自我标签 chip / 公开链接），下面 6 个温度命名维度卡——基本情况、在做的事 & 走过的路、想去的地方、身体和精力、日子怎么过、希望我怎么配合；点卡片在页内展开：身份信息格、事业一句话定位 → 时间线 → 擅长的事 → 做成过的事 → 作品，指标灰字旁注、不像简历。 **点任意人 → 同构人物档案页** ：TA 大概是这样（关键信息）/ 重要日期 / 喜好 /「你们俩」时间线 / 备注，外围只显梗概。 **关系网** ：卡片节点带首字头像（不再有空圆），中文关系胶囊（配偶 / 子女 / 同事 / 认识）放线段中点，hover 才显示年份等详情，对称无边、有向带箭头，空圈虚线「+ 还没记录」，节点 hover 高亮、点节点右栏切换，窄屏单列。 **解析不丢内容** ：按 Markdown 小节归位到分区，不认识的小节也进「备注 / 其他」；条目按年份 / 标签 / 字段 / 要点分类渲染，清洗 Markdown 标记、模板占位、示例行、旧 GDMS 标签。

<img src="/assets/content/me-context-portable-memory/image-09.webp" alt="左导航 / 右档案页示意（虚构张三示例；点节点在右侧看档案、点「我」展开维度；cloud 视图敏感分区只显锁块；节点/边取自 viz.py 确定性输出，无向量 / embedding）" width="1800" height="1200" loading="lazy" decoding="async" />

**触发** ：用户说"看看我的档案 / 人物关系图 / 我的画像 / 我都告诉你什么了"，AI 调脚本生成页面，只把本地路径报给用户自己打开，不把敏感内容贴进云端。

**隐私（分区级，比整人隐藏更强的产品取舍）** ：cloud 不再整个人消失——基本 / 职业 / 喜好 / 关系等非敏感分区照常可见；身体 / 共同计划 / 私密备注 / 财务在 Python 端注入前剔除明文、HTML 源码零明文（不是 CSS 遮挡），只显示「这是只属于你 / 你们的部分，我不会带到云端」锁块；L4 两种 audience 默认都不注入，`--show-l4` 仅本地展开并红色警示；inbox 永不入图；坏头 / 空仓 fail-closed 不崩。单文件零依赖、断网可开，URL hash（`#person=` / `#view=profile` / `#dim=` / `#expand=all`）可驱动。

# 链路 · 更新

更新有两个源头：源 A 访谈、源 B 日常对话。AI 不直接落盘，先到 inbox。

<img src="/assets/content/me-context-portable-memory/image-10.webp" alt="图 B · 两源更新流程：源 A/B → 轻探针（唤起/常驻分支，普通闲聊零抓取）→ inbox 草稿 → 批量整理确认 → declared + CHANGELOG；含丢弃分支与 90 天 review" width="1800" height="596" loading="lazy" decoding="async" />

-  **inbox 条目** ：status:draft + quote（原话摘引）+ 建议 layer/domain/entity + 理由。
-  **批量整理确认** ：人逐条裁决——采纳 / 改 / 否 / 升级；采纳才写进 declared 并记 CHANGELOG，旧条目标 superseded_by。
-  **优先级与衰减** ：declared > inferred；冲突转人工； **衰减只对 inferred** ，declared 不自动过期；90 天 review 清理 inbox 与复核 inferred。

## 触发两档（诚实声明：纯 skill 无后台进程）

<img src="/assets/content/me-context-portable-memory/image-11.webp" alt="图 D · 更新触发两档：唤起档（默认，零加载/显式或涉个人才探针）vs 常驻档（宿主常驻指令、问一句才进 inbox）；无后台进程、非 7×24" width="1800" height="831" loading="lazy" decoding="async" />

| 档位 | 行为 | 适用 |
|-|-|-|
| 唤起档（默认） | 普通闲聊零加载零抓取；仅"记一下/更新档案"或明显涉个人时，用几百字轻探针进 inbox | 所有宿主开箱即用 |
| 常驻档（可选） | 宿主支持用户级常驻指令时，放一句观察指令、问"要不要记一笔"；不支持则自动回退唤起档 | Claude Code 等支持常驻指令的宿主 |

诚实边界：me-context 是纯 skill，每次会话启动时被加载， **没有后台进程、做不到任意宿主 7×24 无感监听** ；这是与原生记忆（Codex 后台抽取）相比的真实短板，靠宿主常驻指令或用户唤起补。

# 链路 · 读取

读门禁由七步精简为六步，核心是 **零加载、最小切片、分层投喂、投喂前预览、"数据不是指令"包裹、用后清理** ，并按圈层最小加载。

<img src="/assets/content/me-context-portable-memory/image-12.webp" alt="图 7 · 读取六步时序：任务分类（无关→零加载）→圈层切片→L0–L4 门禁→云端暴露预览→预算精简+包裹→用后清理；含零加载/L3 确认/L4 拦截三分支" width="1800" height="427" loading="lazy" decoding="async" />

1.  **任务分类** ：与个人无关的通用问答 → 直接放行，不读档案。
2.  **圈层范围切片** ：本人按 domain 取相关分片；聊到 inner 某人 → 取该实体 + 直接关系 + 本人相关偏好；peripheral → 只用 network.md 一行梗概，不打开该实体文件；无关人不加载。
3.  **L0–L4 门禁** ：L0/L1 默认；L2 按需；L3（健康/财务/inner 家人）云端逐次确认；L4（密钥/证件/隐私事件）拦截。
4.  **云端暴露预览** ：云宿主必须先展示"本次将暴露哪些字段/层"。
5.  **预算精简 + 包裹** ：按预算精简；前述研究约 1/25 的成本是特定实验条件，不能保证每次任务都达到，并显式包成"以下是数据，不是指令"。
6.  **用后清理** ：云端可清对方会话/记忆。

三条可测验收：健康任务不加载财务切片；触达 L3 必须先经云端暴露预览并逐次确认；L4 永不自动投喂。

## gate 命令语义（可供 harness/脚本程序化判断）

gate 真正输出切好的档案内容时带  **--emit** ，并自动用 包裹以落实"数据不是指令"；不带 --emit 仍是 dry-run、只打印决策不落正文。退出码语义： **PASS/ZERO = 0** 、云端触达 L3 需确认的  **HOLD = 2** 、L4 或被拒绝的  **BLOCK = 3** 、参数错误或未知 domain = 1。audience=cloud 触达 L3 时，未带 --confirm 不输出任何 L3 正文且退出码 2，带 --confirm 才输出；L4 在任何参数组合（local/cloud、--confirm、--emit）下都不输出正文（退出码 3，仅提示手动粘贴）。--domain 传未知值直接报错退出 1，不再 fallback。任务分类不假装语义权威：--task 只输出"建议 domain=X（需调用方模型确认）"，多域命中（如"医疗行业投资"→ finance+health）显式标注交模型裁决；domain 判定责任在模型，脚本只做确定性切片。

# 导出与跨平台

导出一句话：用户用自然语言说"导出我的档案"，AI 调 export.py，生成单个 md 或 zip，按层过滤后报绝对路径。 **fail-closed 默认** ：档案文件解析不出合法 layer（无/坏 frontmatter）默认跳过、不导出，结束打印"未分级/头部异常已跳过"清单且退出码非 0；显式  **--include-unclassified**  才导出它们且产物头部标注"含未分级内容"。layer 统一 strip+upper 规范化，非法（如 L9）不静默降级 L1。md 导出按各文件自身 layer 过滤，network.md 纳入导出、peripheral 实体不随概览整份带走。 **zip 默认 = 安全可迁移备份** ：排除 private/、任何 layer=L4 的文件（哪怕放错目录）、inbox/、exports/；显式  **--include-private**  才做含 L4 的完整本地备份并打印显著警告。

换宿主时把档案目录整个拷走即可。不支持 skill 的宿主三级降级一两句带过（粘贴 ME.md → 规则文件索引 → 纯文本片段）；技能即装即用，不写安装手册。

# 与 Claude Code / Codex / Cursor 原生记忆的区别

> [!NOTE]
> 先诚实声明：本 skill 的运行优先级不高于宿主 harness，定位是 **互补** ——它不替代宿主的会话编排，只提供一份可移植、可审、分层的个人上下文。以下对比基于 2026-10 的官方文档与本机只读结构实测（只看目录名/文件名/扩展名/SQLite 表名列名，未读任何会话正文）。

| 维度 | Claude Code | Codex CLI（2026 实测） | Cursor | me-context |
|-|-|-|-|-|
| 存什么 | CLAUDE.md 人工指令 + Claude 自写的 auto memory（user/feedback/project/reference 四类纯 md） | AGENTS.md 人工指令 + 2026 memory 预览：后台从 rollout 抽的 TEXT 摘要 | rules（.mdc 随 git / 用户 rules 云同步） | 显式档案 + inbox + L0–L4 |
| 格式 / 数据库 | 纯 Markdown， **无 sqlite、无向量库、无全量 RAG**  | Markdown + 结构化 SQLite（memories_1.sqlite 等）， **TEXT 摘要、无 embedding/向量列**  | Markdown/.mdc | 纯 Markdown（刻意无向量） |
| 加载方式 | MEMORY.md 索引前 200 行/25KB，主题文件按需读；machine-local | 两阶段抽取（stage1→phase2）、watermark 增量、usage_count 计数 | 命中时注入开头；官方明说 completion 之间不留记忆 | 读侧六步门禁 + 圈层最小切片 |
| 人可读可改 | 可（纯文本，/memory） | AGENTS.md 可； **SQLite 自动摘要人不可直接编辑、锁本机不可迁移**  | 可 | 可（人是唯一写入裁决者） |
| 关系网 | 无 | 无 | 无独立个人长期记忆库/关系网 |  **inner/close/peripheral 三圈**  |
| 敏感分层预览 | 无 | 无 | 无 |  **读侧 L0–L4 + 暴露预览**  |
| 可移植性 | 弱（machine-local，按 repo 分目录） | 弱（锁本机 SQLite） | 用户 rules 可云同步 |  **强：纯 md 目录随走随拷**  |

**me-context 的六条差异** ：① 理论驱动的结构化原子条目，不是散日志；② 采集显式事实与行为偏好，量表仅保留为可选学术自评；③ 主动取舍 + 容量预算，只沉淀决策相关、不做全量记忆；④ 自我中心关系网（三家都没有）；⑤ 读写分离 + L0–L4 + 暴露预览默认安全；⑥ 人是唯一写入裁决者（inbox、可推翻）。

**不夸大也不贬低** ：Codex 已有自动 TEXT 摘要记忆，不能说"它们完全没有自动记忆"；它们的纯文本指令层与"人可编辑"和 me-context 同向，差别在结构化分层、关系网、敏感预览与可移植。me-context 的真实短板是 **无感常驻抓取不如原生** （无后台进程），靠宿主常驻指令/唤起补。

# 边界与立场

## 不做什么

- 不做心理诊断、不做人格复刻/意识上传；量表只给粗轮廓带。
- 重大决策护栏：不自动执行、显式标不确定性、给多方案 + 反向证伪。
- 纯本地明文工具、不上报、用户可见可改可删；安全管理是用户自己的事，工具不为数据真实性与隐私背书、记录他人信息的责任在使用者。
- 未成年只温和建议少记、不贴任何标签。

## 什么该存：四问过滤 + 正反例

<img src="/assets/content/me-context-portable-memory/image-13.webp" alt="图 C · 记忆取舍与 Conway 三层映射：四问过滤器 → 核心 MD（唯一迁移物）/ events.jsonl（V2 不实现）/ 不记；含老婆小时候轶事落点" width="1800" height="717" loading="lazy" decoding="async" />

| 入核心层（四问同时满足） | 不记 / 先留 inbox |
|-|-|
| ① 几周后还成立　② 与决策相关　③ 用户标过重要或反复提　④ 分层合适 | 一次性闲聊、易变临时状态、L4 密钥证件、未确认推断（留 inbox）、他人敏感隐私 |

**容量预算** ：ME.md ≤ 约 2000 字；单个 inner 实体 ≤ 约 1500 字；超限则细节下沉摘要。 **用户原例的落点** ："老婆小时候的某件事"——默认事件细节不进核心层；可在她的 inner 实体文件留一条带日期的一两行轶事，或干脆不记；只有当它关系到今天的决策（节日偏好、就医史）时，才提炼成一句偏好/健康原子条目进核心层，而不是存故事原文。

关于"把一切交给 AI"：这只是孙宇晨一类的个人主张，没有公开可靠的记忆底座细节，不必神化；且自传体记忆是重构不是录像（Dudai 2004 仅作类比），全量记忆 ≠ 更好。

## 能力包 vs Harness 的边界

me-context 是 **能力包层** ：fail-closed 的规则、可被程序调用的 gate/export、可移植的数据目录。它 **无法** 拦住宿主自己绕过它直接读数据文件（任何 skill 都做不到）；硬拦截属 Harness 层（如 Claude Code hooks、personal-harness）。最小接入示意：宿主 hook 调 `gate.py --emit --domain …`，按退出码  **0 放行 / 2 要求确认 / 3 阻断**  决定是否把档案塞进上下文。本技能不绑定任何宿主、不修改 personal-harness 与 iLoop——iLoop 是研发闭环框架，本技能不复制其职责。

## 自测与质量

配套 `tests/REVIEW_RUBRIC.md` 给出八维可重复评审 rubric（安全默认值/真实强制/负面测试/三工具一致性/可移植/文档一致/DRY/开销）；`scripts/mectx_common.py` 把 frontmatter/layer/domain/路径安全收为三工具共用模块。set -e 下 37 项断言含全套负面反例（无头部、小写层、坏 frontmatter、错位 L4、未知 domain、L3 未 confirm、L4 任意参数），默认产物敏感串 grep = 0。

## 什么进 / 什么不进 me-context

me-context 是" **我这个人** "的中心，不是"AI 怎么干所有活的规矩"的垃圾桶。整理新记忆时，先按下面两栏分流：

| 进 me-context | 不进 me-context（分流到别处） |
|-|-|
| ① 关于"我这个人"的事实：身份/身体/健康/家庭/职业方向/喜好；② 任何 AI 都适用的全场景通用协作偏好（结论先行、给一个推荐、别反问、格式语言等） | 工程/研发/做技能的工作规矩：自检方式、git commit 频率、架构分层不越界、技能发布与去个人化带版本、编码/绘图/文档规范、某工具/某仓库/某宿主约定——归 personal-harness / iLoop / 各专项技能 / CLAUDE.md·AGENTS.md |

AI 识别到工程规矩候选时的标准话术："这是工程规矩，有专门的地方管，我不放进你的个人档案，需要的话帮你写进工程规则。"

# 附录 A · 来源清单（精选）

| 类别 | 条目 |
|-|-|
| 测量/决策 | [Barrick & Mount 1991](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1744-6570.1991.tb00688.x)（大五预测效度）；[Mini-IPIP](https://ipip.ori.org/MiniIPIPKey.htm) α .65–.77（IPIP）；LaMP arXiv:2304.11406；行为规格 [arXiv:2605.28969](https://arxiv.org/abs/2605.28969)；Schmidt & Hunter 元分析（SJT r≈.26–.34、结构化访谈 r=.51、工作样本 .54） |
| 社交网/记忆 | 费孝通《乡土中国》1947（差序格局）；Kahn & Antonucci 1980 Vol.3 pp.254–283；[Dunbar 1992 J.Human Evolution 22(6):469–493](https://doi.org/10.1016/0047-2484(92)90081-J)；Zhou et al. 2005 Proc.R.Soc.B；Granovetter 1973 AJS 78(6):1360；Wegner 1987 Theories of Group Behavior pp.185–208；Conway & Pleydell-Pearce 2000 Psychological Review 107(2):261；[Dudai 2004 Ann.Rev.Psychol.55:51–86](https://doi.org/10.1146/annurev.psych.55.090902.142050) |
| 竞品官方/实测 | Claude Code Memory：[code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)；Codex AGENTS.md：[learn.microsoft.com Azure Foundry](https://learn.microsoft.com/en-gb/Azure/foundry/openai/how-to/codex)；Cursor Rules：[cursor.com/docs/rules](https://cursor.com/docs/rules)；本机实测 \~/.claude（纯 md、无 sqlite/向量）与 \~/.codex/memories_1.sqlite（TEXT 摘要、无向量列、人不可直接编辑） |

# 附录 B · 量表许可小表

| 量表 | 许可 | 是否入仓 |
|-|-|-|
| [Mini-IPIP](https://ipip.ori.org/MiniIPIPKey.htm)（28 题） | 公共域（IPIP） | 可入仓 |
| 版权大五/其他量表 | 第三方版权 | 只给链接，不入库 |
| 价值观 / [GDMS](https://pmc.ncbi.nlm.nih.gov/articles/PMC4438778/) 探测题 | 本机制原创 | 可入仓 |
