---
title: iLoop
kind: system
eyebrow: Verification-Driven Agent System
description: 一个验证驱动的研发 Agent 闭环内核。让 AI 在说“完成”之前，先拿出别人能重跑、能复核的证据。
statement: 把 Agent 从“会写代码”，推进到“能在真实工程里持续交付”。
github: https://github.com/Job-Yang/iloop
install: git clone https://github.com/Job-Yang/iloop.git
status: 已开源
tags:
  - VDD
  - Agent Kernel
  - iOS Automation
order: 0
featured: true
draft: false
visual: generic
---

## 为什么做 iLoop

AI 写代码已经很快，但工程的瓶颈并没有消失。它只是从“写”搬到了理解、验证和信任。

一个 Agent 可以在几分钟内改完代码，也可以在没有真正看到结果时宣布“已经完成”。iLoop 要解决的不是生成速度，而是这句“完成”到底能不能信。

## 它做了什么

- 把任务保存成持续的病例，不让诊断证据散在一次性对话里
- 区分真实观测和模型推断，推断不能冒充事实
- 按改动风险决定验证强度，不给所有任务套同一套重流程
- 用编译、日志、UI 层级、截图和 crash report 验证真实结果
- 高风险改动交给独立角色验收，避免自己给自己判分
- 把反复踩过的工程问题沉淀进错题本

## 一套内核，多种 Agent

iLoop 的内核不认识 iOS、飞书或任何具体业务。它只认证据、能力、流程和错题本四类协议。

iOS 是第一个官方插件，用来证明这套闭环能在模拟器和真机上真正跑起来。以后可以接入代码排查、oncall、服务端或其他平台，而不需要重写闭环本身。

## 当前状态

开源版已经发布，包含平台无关内核和 iOS 官方插件。

- [iLoop 的设计思路](/writing/iloop-设计思路/)
- [VDD：让 AI 说“完成”前先自证一遍](/writing/vdd-面向验证的开发/)
- [我想做一个帮我查线上问题的 Oncall 助手](/writing/oncall-助手/)
- [GitHub 仓库](https://github.com/Job-Yang/iloop)
