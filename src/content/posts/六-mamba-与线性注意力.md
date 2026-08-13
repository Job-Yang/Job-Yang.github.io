---
title: "六、Mamba 与线性注意力"
description: "传统的 Transformer 读小说，每读一个新字，都要把前面所有的字重新看一遍（越长越卡，O(N²)）。"
publishedAt: 2026-08-13
category: "AI 底层原理连载"
tags: []
draft: false
source: public-rewrite
source_id: "article-bb7b43bf49"
migration_classification: "ready_for_editorial_review"
review_required: true
---
> [!NOTE]
> **《写给客户端工程师的 AI 底层原理》连载 · 第 7 期**
> 到这里，Transformer 的家底我们都翻遍了。但它有个天生的天花板：算力随上下文长度**平方级**暴涨——文本越长越卡。这一篇，看看挑战者 Mamba 怎么用流式压缩，试图把这堵墙推倒。

# 六、 面向未来：Mamba 与线性注意力

## 🟢【通俗版】流式压缩，看再长都不卡

传统的 Transformer 读小说，每读一个新字，都要把前面所有的字重新看一遍（越长越卡，O(N²)）。

Mamba 就像人在做阅读理解，读完一段就"在脑子里写个总结"，然后忘掉原句。它看再长的文章都不卡，**速度恒定 O(N)**，且推理时显存占用恒定 O(1)。

> [!NOTE]
> **客户端类比**：Transformer + KV Cache 像把所有聊天记录都加载到内存里（越聊越占内存）。Mamba 像 IM 系统的"会话摘要" —— 滚动维护一个固定大小的状态向量，把历史压缩进去。

## 🔴【进阶版】状态空间模型（SSM）

Mamba 基于**状态空间模型 (State Space Model, SSM)**，源自控制论。核心递推公式：

hₜ = A · hₜ₋₁ + B · xₜ

yₜ = C · hₜ

其中 h_t 是一个固定维度的"隐状态"，A、B、C 是学习到的参数矩阵。每来一个新 token x_t，只需做一次矩阵运算更新 h_t，**计算复杂度 O(N)、显存 O(1)**。

Mamba 的关键创新是**"选择性 SSM"**：让 A、B、C 这些参数**本身依赖于当前输入**，从而具备类似 Attention 的"信息筛选"能力 —— 这正是早期 SSM 打不过 Transformer 的根本原因被解决了。

不过到 2026 年，主流大模型仍是 Transformer + 各种优化。Mamba 在长序列（百万级 token）和端侧场景表现亮眼，但通用能力上还未完全替代 Transformer。**主流趋势是"混合架构"**（如 Jamba：部分层用 Mamba、部分层用 Attention）。

> 📚 **推荐阅读**：
> 
> \- [Mamba: Linear-Time Sequence Modeling with Selective State Spaces (Gu & Dao, 2023)](https://arxiv.org/abs/2312.00752)：挑战 Transformer 王座的头号种子。

---

> [!NOTE]
> **下期预告 · 第 8 期**
> 讲完想掀翻 Transformer 的挑战者，下一篇我们反过来——回到 2017 年那台整车第一次被造出来的地方，重读被奉为「**AI 圣经**」的《Attention Is All You Need》，看看这篇论文除了自注意力，还藏了哪些今天仍在用的设计。
