---
title: "macOS 下 Google 账号防送中与 Antigravity / Gemini 稳定使用指南"
description: "合并拆清定位清零、双路线网络分流、三类地区概念、账号与家庭组合规方案、地区 400 / 认证 401 排障及多窗口运维，附跨公司一键嗅探与验收脚本。"
publishedAt: 2026-11-25
category: "方法与工具"
tags: ["macOS", "Chrome", "Antigravity", "网络分流", "效率工具"]
draft: false
source: public-rewrite
---

<callout emoji="💡"><p><b>核心结论</b>：Google 账号切区屡次被拒、或 Antigravity（<code>agy</code>）刚配好出口又报地区拦截与认证失效，往往是<b>定位权限、Profile 混用、窄分流漏网、出口地区错配</b>以及<b>凭证会话运维</b>几条线同时出了岔子。</p><p>本文整理了一套可跨电脑、跨公司复用的合规打法：包含四层防送中治理、两类网络分流架构、三类地区区分与家庭组共享路线、400/401 排障及五合一自动嗅探验收脚本。<b>边界说明</b>：本文仅讨论合规网络分流、定位治理、官方改区与多窗口运维，不涉及修改客户端二进制或绕过资格校验。</p></callout>

# 一、为什么总被判回中国：四层泄漏面

很多人明明挂上了海外代理，或者在 Chrome 里顺手关了某个网站的定位，打开 [Google 服务条款](https://policies.google.com/terms) 页面还是显示「中国」，提交切区申诉照样被拒。问题出在定位信号有四条路会绕开你的代理直接连出去：

```mermaid
flowchart TD
    A[浏览器或桌面 AI 客户端] --> B{第一层: 系统与站点定位权限}
    B -->|某站点放行或系统总开关未关| CN[直接上报中国坐标]
    B -->|已全部设为禁止| C{第二层: Chrome Profile 登录态}
    C -->|工作与个人号混在同一 Profile| CN
    C -->|工作与个人 Profile 隔离| D{第三层: 代理分流覆盖面}
    D -->|仅代理少数 AI 域名| E[条款/账号/搜索/API 漏回默认出口]
    E -->|公司默认出口或本地 DNS 返回 cn| CN
    D -->|全量可用 Google 域名走代理| F{第四层: 出口地区与申诉目标}
    F -->|出口新加坡却申诉日区/美区| REJ[切区申诉被拒]
    F -->|出口国家与申诉目标一致| OK[稳定识别目标地区]
```

把这四层拆开来看，每一层都有非常具体的陷阱：

| 泄漏层级 | 常见现象 | 为什么会直接拖累切区 | 正确做法 |
|-|-|-|-|
| **定位权限层** | 平时在日常窗口给 `google.com` 或部分站点点过「允许获取位置」 | 浏览器直接调用 macOS 定位服务上报经纬度，代理 IP 再干净也没用 | 全本机 Chrome Profile 默认策略改为**禁止**，清空允许白名单，并在系统设置关掉浏览器和 AI 客户端定位 |
| **Profile 容器层** | 主窗口登录工作号，又顺手「添加其他账号」把个人 Gmail 挂在同一个 Chrome Profile | 同一 Profile 共享 Cookie、设备标识和站点权限；在公司环境浏览会顺带给同窗个人号打上国内特征 | **工作 Profile 只登工作号**；个人号放到独立个人 Profile，各自维护权限与扩展 |
| **分流漏网层** | 代理插件只填了 `gemini.google.com` 等少数 AI 域名 | 访问 `policies.google.com`（条款与申诉表）、`accounts.google.com`、`www.google.com`、`*.googleapis.com` 全部直连默认出口，Chrome 变体配置接口直接返回 `x-country: cn` | 覆盖 `*.google.com`、`*.googleapis.com`、`*.gstatic.com`、`*.youtube.com` 等全部可用主域，并避开代理不支持的超时域名 |
| **出口与目标错配** | 连的中转代理实际出口在新加坡，切区表单却填日本或美国 | Google 后台核验近一段时间的真实出口特征，IP 所在国与申诉目标国对不上就会直接拒绝 | 先用脚本实测代理的真实国家判定，**申诉目标国家必须与稳定使用的出口国家保持一致** |

# 二、网络方案二选一：精细分流与个人代理

桌面端 `agy` / Gemini 客户端与网页端浏览器分处不同进程，按自己所处的网络环境选一套主方案即可，**切勿两套代理或企业 VPN 同时叠加接管**。

## 2.1 日常办公网推荐：桌面按进程（Antify）+ 浏览器按域名（FoxyProxy）

如果工作环境不方便常开全局海外 VPN（会拖慢内网访问），最稳的方式是不改 macOS 全局代理和系统 DNS，把客户端和浏览器拆开各自接管：

- **桌面端与 CLI（按进程透明代理）：** 用应用级透明代理工具（例如 Antify）只接管桌面 AI 客户端和 `agy` CLI 路径，开启远程 DNS 解析，同时**关闭「派生子进程继承」**。这样 AI 客户端自己的流量走代理，它拉起的 `git`、`ssh` 等子进程依然直连内网。
- **浏览器（按域名精细分流）：** 在 Chrome 或 Firefox 里给需要访问 Google 的 Profile 安装 FoxyProxy，切到「按规则代理」并开启远程 DNS（`proxyDNS: true`），只把实测可用的 Google 全量核心域名送进代理，办公系统与国内网站全部保持直连。

这里有两个硬禁忌：第一，**不要为了省事把整个 Chrome 进程塞进应用级代理**，如果开发代理只放行白名单域名或对非白名单流量回落国内，整进程代理会让普通网页卡顿甚至超时；第二，换到新代理后要**现场并发探测一遍域名连通性**，剔除代理不支持或会超时的边缘域名，不要生搬硬套固定清单。

## 2.2 独立个人 Mac 方案：OpenSurge / Mihomo 规则模式 TUN 分流

在独立个人环境里，如果使用 [OpenSurge for Mac](https://github.com/YTwsy/OpenSurge-for-Mac) 或 Clash/Mihomo 走规则模式 TUN 接管，分流规则要守住三条底线：

- **专用策略组绝不带 `DIRECT` 回退：** 把 `agy` 进程、`language_server` 与 Google 域名规则全部指向专用策略组（例如 `Google-agy`），组内**只放具体海外节点与 `REJECT`**，不要混入 `DIRECT` 或带直连兜底的分组，避免节点短暂波动时请求静默掉回本地直连。
- **DNS 防循环与 DoH：** Google 相关域名走基于代理组的 DoH，代理节点域名与普通国内域名走明确上游 DNS，关闭会干扰内网的下游 DHCP 或多余局域网接管项。
- **切换节点后必清旧连接、再用真实模型验收：** 很多混合分流或「极速模式」下，网页测速能返回 HTTP `204`，真实调用高阶模型却直接报地区 `400`；并且切换节点后，正在运行的旧 CLI 进程可能还握着旧长连接。**每次切换代理或模式，都要在可中断点退出旧进程并重开恢复，再用目标模型真实发一条请求验证。**

# 三、账号与地区：分清三类地区与两条合规路线

同样叫「账号地区」，Google 生态里其实有三张互相独立的表，很多人搞混了才一直白忙：

| 概念 | 查看入口 | 决定什么 | 常见误解 |
|-|-|-|-|
| **服务条款关联国家** | [Google 服务条款](https://policies.google.com/terms) | 决定 Google 账号本身在服务与 API 资格上的归属地 | 改了付款币种或 Google Play 地区，不等于这里跟着变 |
| **付款资料国家** | [Google Payments](https://pay.google.com/) | 决定结算币种（如美元）、订阅扣费与家庭组同区校验 | 美区钱包和在用订阅并不要求每次 API 请求都挂美国 IP；**千万别误关正在扣费的海外钱包** |
| **App Store 地区** | 苹果设备商店账号 | 决定 iOS 客户端下载与苹果内购方式 | 与 Google 账号归属地无关，不必强求同区 |

如果原账号目前仍被归为中国区，有两条合规路径可以走：

- **路线 1：清净环境养号后，提交官方国家关联申诉。** 先按后文把本机、云端与手机端定位全部关干净，用单一稳定的支持区出口（比如新加坡或美国）在独立个人 Profile 里正常使用 1～2 周，再到 [Google 国家/地区关联申请页](https://policies.google.com/country-association-form) 提交审核。填写时如实说明情况，**申诉的目标国家必须与长期使用的出口国家完全一致**，不要用 VPN 出口冒充真实居住经历。
- **路线 2：注册支持区新号，或用 Google One 家庭组共享主号订阅额度。** 如果老号已有高阶订阅（例如 Google AI Ultra），不想丢掉权益又想让支持区账号免折腾直接用，可以利用 Google One 家庭组机制把额度分享给最多 5 位年满 18 岁的家庭成员（成员各自独立账号、对话历史与云盘完全隔离）。使用家庭组必须注意三个硬规则：
  1. **方向不能反：** 加入家庭组不会改变成员原有的条款关联国家；必须由**已订阅主号当家庭管理员，去邀请处于支持区的小号**（[Google 家庭组管理](https://myaccount.google.com/family/details)）。
  2. **付款资料国家必须对齐：** 家庭组强制校验管理员与成员的 **Google Payments 付款资料国家**（而不是条款国家）。如果主号按美元计费且付款资料在美国，受邀的支持区小号必须先把自己的付款资料国家对齐为美国（没有历史资料时按美区新建，有多余他国资料先关闭），否则接受邀请会提示不在同一国家或地区；开启分享后记得在 [Google One](https://one.google.com/) 确认「与家人共享」已打开。
  3. **遵守 12 个月冷却期：** Google Play 改区与切换家庭组均有 12 个月冷却限制，同组内如果有成员触发严重封禁也可能波及整组，务必先规划好再建组，不要反复建删试错。

# 四、常见故障排障与多窗口运维：400、401 与会话恢复

日常跑通网络和账号后，命令行里最常遇到两类报错，排查方向完全不同，千万不要拿同一套办法瞎试：

| 报错类型 | 典型特征 | 排查与恢复动作 |
|-|-|-|
| **服务端地区 `400`** | 返回 `FAILED_PRECONDITION` 或 `User location is not supported` | 1. 对照 [Antigravity 官方支持列表](https://antigravity.google/docs/faq) 核对当前出口国家；<br>2. 确认没有多出口混流（极速模式常见网页通而 API 拒）；<br>3. 退出沿用旧长连接的进程，切换单一干净出口后用报错模型重开复测 |
| **认证 `401`（情况 A：小时级续期竞态）** | 正在跑的长任务在整点前后突然报 `UNAUTHENTICATED (code 401)` | 参考 [Google 开发者论坛公开讨论](https://discuss.ai.google.dev/t/bug-antigravity-cli-1-3-6-a-running-turn-fails-with-401-unauthenticated-right-after-the-hourly-token-refresh/190499) 与 [Gemini API 错误定义](https://ai.google.dev/gemini-api/docs/api-errors)：后台刷新 Token 时正在飞的请求偶尔沿用了旧凭据。只要日志里没有撤销授权记录，直接在原会话发一次「继续」通常即可恢复；若一次仍失败，只退出该故障进程并用准确会话 ID 重开，不必关掉其他正常窗口 |
| **认证 `401`（情况 B：凭证已被吊销）** | 在 Google「您的设备」页误退了挂着 `Google Antigravity` 的会话 | 本机 OAuth Token 已当场失效，发「继续」无效。确认海外代理已接稳后，直接重跑 `agy` 通过内置入口重新完成 OAuth 登录授权即可 |

多窗口长期使用和跨设备迁移时，还有几条稳定运维习惯能省掉很多麻烦：

- **精确恢复会话，多窗口不用 `-c`：** 已知会话 ID 直接运行 `agy --conversation <完整会话ID>`；不记得 ID 时先启动 `agy`，在输入框输入 `/resume` 按标题检索打开。多窗口并行时避免用 `agy -c`，很容易误拉错别的任务窗口。
- **终端还原文字不等于进程活着：** 终端重启窗口后显示的 `Session Contents Restored` 只是历史屏幕回放，不会自动把模型请求接回来；同时避免用两个终端进程打开同一份会话 ID，防止状态互相覆盖。
- **用统一包装脚本锁好环境变量：** 如果通过桌面应用、脚本或编辑器调用 CLI，不要指望它们自动加载 `~/.zshrc` 里的环境变量。把固定入口放在 `~/.local/bin/agy`，在入口里显式导出所需环境配置后再 `exec` 内层程序，更新覆盖排查也会简单得多。

# 五、一键复用脚本：`google-clean-kit.sh`

为了避免每次重装系统、换电脑或换新公司时重新踩一遍坑，下面把**出口主动嗅探、清定位、动态探测域名生成分流配置与四项验收**收拢成一个只依赖 macOS 自带 `bash`、`python3`、`curl` 和 `osascript` 的五合一脚本 `google-clean-kit.sh`。

把它保存到本地目录（例如 `~/antify-network-setup/google-clean-kit.sh`）并加上可执行权限：

```bash
chmod +x ~/antify-network-setup/google-clean-kit.sh
```

它提供五个子命令：

- **`discover [--candidate <proxy_url>]...`：** 主动嗅探本机合法出口候选（默认直连路由、环境变量代理、macOS `scutil --proxy` 与 PAC 脚本、git/curl 用户代理、本机回环常见代理端口以及已有分流配置文件），只对 Google / Gemini / Antigravity 官方公开端点发只读探测（**安全边界：绝不扫描公司内网网段或探测未公开服务**），同时核查本机 DNS 是否把后台域名解析到国内节点，最后按干净度打分排序给出推荐命令。
- **`auto [--candidate <proxy_url>]... [--output <json_path>]`：** 自动跑完 `discover` 选出最优干净出口；若直连已干净直接提醒清定位，若命中可用代理则串联完成兼容域名探测、FoxyProxy 配置生成与 4 项出口验收。
- **`clean-chrome`：** 自动备份全部 Chrome Profile 的 `Preferences` 到 `~/.google-clean-kit-backups/`，优雅退出 Chrome，把所有 Profile 的默认定位改为禁止（`2`）并删光允许白名单，恢复启动 Chrome 复核无回弹后，自动为你打开 macOS「定位服务」设置页。
- **`build-foxyproxy <host> <port> [type] [output] [title]`：** 通过指定代理并发探测 18 个常见 Google 生态域名（5 秒超时），只把实测连通的域名写进 FoxyProxy v8/v9 配置文件，并清楚列出被自动排除的超时域名。
- **`verify <proxy_url> [country_keyword] [country_code]`：** 实测 `policies.google.com/terms`、`www.google.com`、`clientservices.googleapis.com` 和 `www.youtube.com` 四项指标，确认 Google 后台已经把当前出口稳定识别为目标国家。

完整脚本源码如下（不依赖任何三方包，可跨机器直接复用）：

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Google 账号定位清零、出口主动嗅探与精细分流复用工具 (macOS)

用法:
  google-clean-kit.sh discover [--json] [--candidate <proxy_url>]...
      主动嗅探本机所有合法出口候选（直连、环境变量、系统代理/PAC、git/curl 配置、常见本地代理端口及已有分流配置），
      并发探测各出口在 Google / Gemini / Antigravity 官方端点的真实国家判定与连通性，给出推荐排序与命令。

  google-clean-kit.sh auto [--candidate <proxy_url>]... [--output <json_path>]
      一键串行跑通：自动执行 discover 选出最优干净出口 -> 探测并生成 FoxyProxy 全量配置 -> 跑 4 项硬指标验收。
      - output 默认: ./foxyproxy-google-full.json

  google-clean-kit.sh clean-chrome
      备份全部 Chrome Profile 的 Preferences，优雅退出 Chrome，将所有 Profile 的默认定位设为禁止并清空允许列表，
      重启 Chrome 复核持久化生效后，自动打开 macOS 定位服务设置页。

  google-clean-kit.sh build-foxyproxy <proxy_host> <proxy_port> [proxy_type] [output_json] [title]
      并发探测 18 个常见 Google 生态域名在指定代理下的连通性，仅将实测通过的域名写入 FoxyProxy v8/v9 配置文件，
      自动剔除不兼容或超时域名。
      - proxy_type  默认: http（可选: http / https / socks5 / socks4）
      - output_json 默认: ./foxyproxy-google-full.json
      - title       默认: Google 全量 · 分流代理

  google-clean-kit.sh verify <proxy_url> [expected_country_keyword] [expected_country_code]
      通过 4 项硬指标检验出口被 Google 识别的真实国家/地区（例如 Singapore / sg，或 Japan / jp）。
      - expected_country_keyword 默认: Singapore
      - expected_country_code    默认: sg

示例:
  bash google-clean-kit.sh discover
  bash google-clean-kit.sh discover --candidate http://proxy.example.com:8118
  bash google-clean-kit.sh auto --output ~/antify-network-setup/foxyproxy-google-full.json
  bash google-clean-kit.sh clean-chrome
  bash google-clean-kit.sh verify http://proxy.example.com:8118 Singapore sg
EOF
}

run_discover_py() {
  python3 - "$@" <<'PY'
import concurrent.futures
import glob
import json
import os
import re
import socket
import subprocess
import sys
import urllib.parse

args = sys.argv[1:]
json_mode = False
extra_candidates = []
i = 0
while i < len(args):
    a = args[i]
    if a == "--json":
        json_mode = True
    elif a == "--candidate" and i + 1 < len(args):
        extra_candidates.append(args[i + 1])
        i += 1
    elif a.startswith("--candidate="):
        extra_candidates.append(a.split("=", 1)[1])
    i += 1

home = os.path.expanduser("~")
raw_candidates = [("DIRECT", "默认直连路由")]

def add_candidate(url, source):
    if not url:
        return
    u = url.strip()
    if not u:
        return
    if "://" not in u:
        u = "http://" + u
    p = urllib.parse.urlparse(u)
    if not p.hostname or not p.port:
        return
    scheme = p.scheme.lower()
    if scheme == "socks5":
        scheme = "socks5h"
    norm = f"{scheme}://{p.hostname}:{p.port}"
    raw_candidates.append((norm, source))

for env_k in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"]:
    val = os.environ.get(env_k)
    if val:
        add_candidate(val, f"env:{env_k}")

try:
    sp = subprocess.run(["scutil", "--proxy"], capture_output=True, text=True, timeout=3)
    kv = {}
    for line in sp.stdout.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            kv[k.strip()] = v.strip()
    if kv.get("HTTPEnable") == "1" and kv.get("HTTPProxy") and kv.get("HTTPPort"):
        add_candidate(f"http://{kv['HTTPProxy']}:{kv['HTTPPort']}", "scutil:HTTP")
    if kv.get("HTTPSEnable") == "1" and kv.get("HTTPSProxy") and kv.get("HTTPSPort"):
        add_candidate(f"http://{kv['HTTPSProxy']}:{kv['HTTPSPort']}", "scutil:HTTPS")
    if kv.get("SOCKSEnable") == "1" and kv.get("SOCKSProxy") and kv.get("SOCKSPort"):
        add_candidate(f"socks5h://{kv['SOCKSProxy']}:{kv['SOCKSPort']}", "scutil:SOCKS")
    if kv.get("ProxyAutoConfigEnable") == "1" and kv.get("ProxyAutoConfigURLString"):
        pac_url = kv["ProxyAutoConfigURLString"]
        pac_txt = ""
        if pac_url.startswith("file://"):
            pac_path = urllib.parse.unquote(urllib.parse.urlparse(pac_url).path)
            if os.path.isfile(pac_path):
                pac_txt = open(pac_path, encoding="utf-8", errors="ignore").read(65536)
        elif pac_url.startswith(("http://", "https://")):
            pr = subprocess.run(["curl", "-sS", "--max-time", "3", pac_url], capture_output=True, text=True)
            if pr.returncode == 0:
                pac_txt = pr.stdout[:65536]
        for kind, addr in re.findall(r"\b(PROXY|HTTPS|SOCKS5|SOCKS)\s+([A-Za-z0-9._-]+:\d+)", pac_txt):
            scheme = "socks5h" if kind.startswith("SOCKS") else "http"
            add_candidate(f"{scheme}://{addr}", "scutil:PAC")
except Exception:
    pass

for gk in ["http.proxy", "https.proxy"]:
    try:
        gr = subprocess.run(["git", "config", "--global", "--get", gk], capture_output=True, text=True, timeout=2)
        if gr.returncode == 0 and gr.stdout.strip():
            add_candidate(gr.stdout.strip(), f"git:{gk}")
    except Exception:
        pass

curlrc = os.path.join(home, ".curlrc")
if os.path.isfile(curlrc):
    try:
        for line in open(curlrc, encoding="utf-8", errors="ignore"):
            m = re.search(r'(?:^|\s)(?:--proxy|proxy)\s*=?\s*"?([^\s"]+)"?', line.strip())
            if m:
                add_candidate(m.group(1), "curlrc")
    except Exception:
        pass

loopback_ports = [
    (7890, "http"),
    (7897, "http"),
    (6152, "http"),
    (6153, "socks5h"),
    (1080, "socks5h"),
    (1087, "http"),
    (2080, "socks5h"),
    (2081, "http"),
    (8118, "http"),
]
for port, scheme in loopback_ports:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.25):
            add_candidate(f"{scheme}://127.0.0.1:{port}", f"local-port:{port}")
    except Exception:
        pass

def extract_from_json_file(path, label):
    try:
        d = json.load(open(path, encoding="utf-8"))
    except Exception:
        return
    if isinstance(d, dict) and isinstance(d.get("data"), list):
        for item in d["data"]:
            if isinstance(item, dict) and item.get("hostname") and item.get("port"):
                t = str(item.get("type", "http")).lower()
                add_candidate(f"{t}://{item['hostname']}:{item['port']}", label)
    proxies = []
    if isinstance(d, dict):
        if isinstance(d.get("proxies"), list):
            proxies.extend(d["proxies"])
        cfg = d.get("configuration")
        if isinstance(cfg, dict) and isinstance(cfg.get("proxies"), list):
            proxies.extend(cfg["proxies"])
    for item in proxies:
        if isinstance(item, dict) and item.get("host") and item.get("port"):
            t = str(item.get("type", "http")).lower()
            add_candidate(f"{t}://{item['host']}:{item['port']}", label)

for p in sorted(glob.glob(os.path.join(home, "antify-network-setup/*.json"))):
    extract_from_json_file(p, f"file:{os.path.basename(p)}")
for p in sorted(glob.glob(os.path.join(home, "Library/Application Support/Antify/*.json"))):
    extract_from_json_file(p, "antify:config")
bak_files = sorted(glob.glob(os.path.join(home, "Library/Application Support/com.lester.Antify/Backups/*.json")))
if bak_files:
    extract_from_json_file(bak_files[-1], "antify:latest-backup")

for c in extra_candidates:
    add_candidate(c, "cli:--candidate")

dedup = {}
for target, src in raw_candidates:
    dedup.setdefault(target, []).append(src)

dns_info = {}
dns_warnings = []
for host in ["clientservices.googleapis.com", "update.googleapis.com"]:
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
        ips = sorted(set(x[4][0] for x in infos))
        dns_info[host] = ips[:3]
        if any(ip.startswith(("203.208.", "120.253.")) for ip in ips):
            dns_warnings.append(f"{host} 解析到本地国内节点 {ips[:2]}（直连会被判为 CN，必须启用远程 DNS）")
    except Exception as e:
        dns_info[host] = [f"ERR:{e}"]

def probe_target(item):
    target, sources = item
    pargs = [] if target == "DIRECT" else ["-x", target]

    def run_curl(cmd_tail):
        return subprocess.run(
            ["curl", "-sS", "--max-time", "6"] + pargs + cmd_tail,
            capture_output=True,
            text=True,
        )

    def probe_terms():
        r = run_curl(["-L", "-H", "Accept-Language: en-US,en;q=0.9", "https://policies.google.com/terms"])
        if r.returncode != 0:
            return None, f"err:{r.returncode}"
        idx = r.stdout.find("Country version")
        if idx == -1:
            return None, "missing"
        snippet = re.sub(r"<[^>]+>", " ", r.stdout[idx:idx + 220])
        snippet = re.sub(r"\s+", " ", snippet).strip()
        m = re.search(r"Country version:\s*(.+?)\s*(?:What[’']s|What|\n|$)", snippet)
        country = m.group(1).strip(" .:;-") if m else snippet[:30]
        return country, snippet[:80]

    def probe_google():
        r = run_curl(["-D", "-", "-o", "/dev/null", "https://www.google.com/"])
        if r.returncode != 0:
            return False, f"err:{r.returncode}"
        lines = [l.strip() for l in r.stdout.splitlines() if l.strip()]
        http_l = [l for l in lines if l.startswith("HTTP/")]
        st = http_l[-1] if http_l else ""
        loc = next((l for l in lines if l.lower().startswith("location:")), "")
        ok_200 = (" 200" in st) and ("google.com.hk" not in loc.lower()) and ("hkredirect" not in loc.lower())
        desc = "200" if ok_200 else ("302->.hk" if "google.com.hk" in loc.lower() else (st or "?"))
        return ok_200, desc

    def probe_variations():
        r = run_curl(["-D", "-", "-o", "/dev/null", "https://clientservices.googleapis.com/chrome-variations/seed?osname=mac"])
        if r.returncode != 0:
            return None
        for l in r.stdout.splitlines():
            if l.lower().startswith("x-country:"):
                return l.split(":", 1)[1].strip().lower()
        return None

    def probe_youtube():
        r = run_curl(["-L", "-H", "Accept-Language: en-US,en;q=0.9", "https://www.youtube.com/"])
        if r.returncode != 0:
            return None
        m = re.search(r'"(?:INNERTUBE_CONTEXT_GL|GL)":"([A-Z]{2})"', r.stdout)
        return m.group(1) if m else None

    def probe_reach(url):
        r = run_curl(["-D", "-", "-o", "/dev/null", url])
        if r.returncode != 0:
            return False
        http_l = [l.strip() for l in r.stdout.splitlines() if l.strip().startswith("HTTP/")]
        if not http_l:
            return False
        parts = http_l[-1].split()
        code = int(parts[1]) if len(parts) >= 2 and parts[1].isdigit() else 0
        return 0 < code < 500

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as inner_pool:
        f_terms = inner_pool.submit(probe_terms)
        f_google = inner_pool.submit(probe_google)
        f_var = inner_pool.submit(probe_variations)
        f_yt = inner_pool.submit(probe_youtube)
        f_gem = inner_pool.submit(probe_reach, "https://gemini.google.com/")
        f_agy = inner_pool.submit(probe_reach, "https://antigravity.google/")

        terms_country, terms_detail = f_terms.result()
        google_ok, google_desc = f_google.result()
        x_country = f_var.result()
        yt_gl = f_yt.result()
        gemini_ok = f_gem.result()
        antigravity_ok = f_agy.result()

    score = 0
    if terms_country and "china" not in terms_country.lower():
        score += 35
    if google_ok:
        score += 20
    if x_country and x_country != "cn":
        score += 20
    if yt_gl and yt_gl != "CN":
        score += 10
    if gemini_ok:
        score += 8
    if antigravity_ok:
        score += 7

    clean = bool(
        terms_country
        and "china" not in terms_country.lower()
        and google_ok
        and x_country
        and x_country != "cn"
        and gemini_ok
        and antigravity_ok
    )

    country_code = x_country or (yt_gl.lower() if yt_gl else None) or ""
    return {
        "target": target,
        "sources": sources,
        "score": score,
        "clean": clean,
        "terms_country": terms_country,
        "terms_detail": terms_detail,
        "google_ok": google_ok,
        "google_desc": google_desc,
        "x_country": x_country,
        "yt_gl": yt_gl,
        "gemini_ok": gemini_ok,
        "antigravity_ok": antigravity_ok,
        "country_code": country_code,
    }

results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for r in pool.map(probe_target, dedup.items()):
        results.append(r)

results.sort(key=lambda x: (x["clean"], x["score"], x["target"] != "DIRECT"), reverse=True)
best = results[0] if results and results[0]["clean"] else None

payload = {
    "dns_info": dns_info,
    "dns_warnings": dns_warnings,
    "candidates": results,
    "best": best,
}

if json_mode:
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    sys.exit(0)

print("=== 1. 本机 Google 后台 DNS 核查 ===")
for h, ips in dns_info.items():
    print(f"  {h}: {ips}")
for w in dns_warnings:
    print(f"  [告警] {w}")
if not dns_warnings:
    print("  未发现本地 DNS 将 Google 后台指回国内节点。")

print(f"\n=== 2. 本机合法网络出口并发嗅探结果（共 {len(results)} 个候选） ===")
for r in results:
    status = "CLEAN" if r["clean"] else "DIRTY/UNREACHABLE"
    srcs = ", ".join(sorted(set(r["sources"])))
    print(
        f"  [{status:17s} | {r['score']:3d}分] {r['target']}\n"
        f"     来源: {srcs}\n"
        f"     条款地区: {r['terms_country'] or '未知'} | google.com: {r['google_desc']} | "
        f"x-country: {r['x_country'] or '-'} | YouTube GL: {r['yt_gl'] or '-'} | "
        f"Gemini: {'OK' if r['gemini_ok'] else 'FAIL'} | Antigravity: {'OK' if r['antigravity_ok'] else 'FAIL'}"
    )

print("\n=== 3. 推荐决策 ===")
if best is None:
    print("未探测到满足全部条件的干净出口。")
    print("建议检查 VPN/代理客户端是否已启动，或显式指定代理重试：")
    print("  bash google-clean-kit.sh discover --candidate http://<host>:<port>")
    sys.exit(2)

if best["target"] == "DIRECT":
    print(f"当前网络直连已经干净（条款地区: {best['terms_country']}，x-country: {best['x_country']}），无需配置额外浏览器代理。")
    print("建议执行清定位脚本：")
    print("  bash google-clean-kit.sh clean-chrome")
else:
    p = urllib.parse.urlparse(best["target"])
    ptype = "socks5" if p.scheme == "socks5h" else p.scheme
    kw = best["terms_country"] or "Singapore"
    cc = best["country_code"] or "sg"
    print(f"最佳干净出口: {best['target']}（来源: {', '.join(sorted(set(best['sources'])))} | 识别地区: {kw} / {cc}）")
    print("可一键生成 FoxyProxy 全量分流配置并完成 4 项验收：")
    print(f"  bash google-clean-kit.sh auto --candidate {best['target']}")
    print("或分步执行：")
    print(f"  bash google-clean-kit.sh build-foxyproxy {p.hostname} {p.port} {ptype} ./foxyproxy-google-full.json")
    print(f"  bash google-clean-kit.sh verify {best['target']} \"{kw}\" {cc}")
PY
}

cmd_discover() {
  run_discover_py "$@"
}

cmd_auto() {
  local output_json="./foxyproxy-google-full.json"
  local candidates=()
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --output)
        shift
        output_json="${1:-}"
        [ -n "$output_json" ] || { echo "--output 需要文件路径参数" >&2; exit 1; }
        ;;
      --output=*)
        output_json="${1#*=}"
        ;;
      --candidate)
        shift
        [ -n "${1:-}" ] || { echo "--candidate 需要代理地址参数" >&2; exit 1; }
        candidates+=("--candidate" "$1")
        ;;
      --candidate=*)
        candidates+=("$1")
        ;;
      *)
        echo "未知参数: $1" >&2
        exit 1
        ;;
    esac
    shift || true
  done

  local discover_json
  discover_json="$(run_discover_py --json ${candidates[@]+"${candidates[@]}"})"

  local decision
  decision="$(python3 - "$discover_json" <<'PY'
import json, sys, urllib.parse
data = json.loads(sys.argv[1])
best = data.get("best")
if not best:
    print("NONE")
    sys.exit(0)
t = best["target"]
if t == "DIRECT":
    print(f"DIRECT\t{best.get('terms_country') or ''}\t{best.get('country_code') or ''}")
    sys.exit(0)
p = urllib.parse.urlparse(t)
ptype = "socks5" if p.scheme == "socks5h" else p.scheme
kw = best.get("terms_country") or "Singapore"
cc = best.get("country_code") or "sg"
print(f"PROXY\t{t}\t{p.hostname}\t{p.port}\t{ptype}\t{kw}\t{cc}")
PY
)"

  local kind
  kind="$(printf '%s' "$decision" | cut -f1)"
  if [ "$kind" = "NONE" ]; then
    echo "=== auto 自动执行中止：未探测到干净出口 ==="
    run_discover_py ${candidates[@]+"${candidates[@]}"} || true
    exit 2
  fi

  if [ "$kind" = "DIRECT" ]; then
    local kw cc
    kw="$(printf '%s' "$decision" | cut -f2)"
    cc="$(printf '%s' "$decision" | cut -f3)"
    echo "=== auto 判断结果：当前网络直连已干净（${kw} / ${cc}） ==="
    echo "无需生成浏览器分流代理；如需清理本机 Chrome 定位，请运行："
    echo "  bash $0 clean-chrome"
    exit 0
  fi

  local proxy_url host port ptype kw cc
  proxy_url="$(printf '%s' "$decision" | cut -f2)"
  host="$(printf '%s' "$decision" | cut -f3)"
  port="$(printf '%s' "$decision" | cut -f4)"
  ptype="$(printf '%s' "$decision" | cut -f5)"
  kw="$(printf '%s' "$decision" | cut -f6)"
  cc="$(printf '%s' "$decision" | cut -f7)"

  echo "=== auto 步骤 1/2：命中干净出口 ${proxy_url}（识别地区: ${kw} / ${cc}），开始探测并生成 FoxyProxy 配置 ==="
  cmd_build_foxyproxy "$host" "$port" "$ptype" "$output_json" "Google 全量 · ${kw} 分流代理"
  echo ""
  echo "=== auto 步骤 2/2：执行 4 项出口硬指标验收 ==="
  cmd_verify "$proxy_url" "$kw" "$cc"
  echo ""
  echo "=== auto 就绪摘要 ==="
  echo "  FoxyProxy 配置文件: $(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$output_json")"
  echo "  目标区校验: ${kw} (${cc}) 全部通过"
  echo "  下一步: 在 Chrome FoxyProxy「选项 → 导入」选择上述 JSON，切到「代理」点保存，并确认模式为「按规则代理」。"
}

cmd_clean_chrome() {
  python3 - <<'PY'
import datetime
import glob
import json
import os
import shutil
import subprocess
import sys
import time

home = os.path.expanduser("~")
chrome_base = os.path.join(home, "Library/Application Support/Google/Chrome")
if not os.path.isdir(chrome_base):
    print(f"未找到 Chrome 配置目录: {chrome_base}")
    sys.exit(1)

pref_files = sorted(glob.glob(os.path.join(chrome_base, "*", "Preferences")))
if not pref_files:
    print("未发现任何 Chrome Profile Preferences 文件。")
    sys.exit(1)

ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = os.path.join(home, ".google-clean-kit-backups", ts)
os.makedirs(backup_dir, exist_ok=True)

print(f"=== 1. 备份 Chrome 配置到 {backup_dir} ===")
for src in pref_files:
    prof = os.path.basename(os.path.dirname(src))
    dst = os.path.join(backup_dir, prof.replace(" ", "_") + "_Preferences.bak")
    shutil.copy2(src, dst)
    print(f"  [备份] {prof}")

def is_chrome_running():
    proc = subprocess.run(["pgrep", "-x", "Google Chrome"], capture_output=True, text=True)
    return proc.returncode == 0 and bool(proc.stdout.strip())

was_running = is_chrome_running()
if was_running:
    print("\n=== 2. 优雅退出 Chrome ===")
    subprocess.run(["osascript", "-e", 'tell application "Google Chrome" to quit'], capture_output=True, text=True)
    exited = False
    for i in range(15):
        time.sleep(1)
        if not is_chrome_running():
            exited = True
            print(f"  Chrome 已在 {i + 1}s 后安全退出。")
            break
    if not exited:
        print("ERROR: Chrome 在 15 秒内未退出（可能被网页未保存弹窗阻塞）。请手动关闭 Chrome 后重试。")
        sys.exit(2)
else:
    print("\n=== 2. Chrome 当前未运行，可直接修改配置 ===")

print("\n=== 3. 全局禁止定位并清空允许白名单 ===")
for src in pref_files:
    prof = os.path.basename(os.path.dirname(src))
    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)

    profile = data.setdefault("profile", {})
    defaults = profile.setdefault("default_content_setting_values", {})
    cs = profile.setdefault("content_settings", {})
    exceptions = cs.setdefault("exceptions", {})
    geo = exceptions.setdefault("geolocation", {})

    defaults["geolocation"] = 2
    removed = []
    for origin in list(geo.keys()):
        val = geo.get(origin)
        if isinstance(val, dict) and val.get("setting") == 1:
            del geo[origin]
            removed.append(origin)

    tmp = src + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, src)
    print(f"  [{prof}] default=2 | 移除允许站点={removed}")

if was_running:
    print("\n=== 4. 恢复 Chrome 并等待 5s 复核持久化 ===")
    subprocess.run(["open", "-a", "Google Chrome", "--args", "--restore-last-session"], check=False)
    time.sleep(5)
else:
    print("\n=== 4. 复核配置 ===")

total_allowed = 0
for src in sorted(glob.glob(os.path.join(chrome_base, "*", "Preferences"))):
    prof = os.path.basename(os.path.dirname(src))
    with open(src, "r", encoding="utf-8") as f:
        d = json.load(f)
    p = d.get("profile", {})
    def_geo = p.get("default_content_setting_values", {}).get("geolocation")
    geo_ex = p.get("content_settings", {}).get("exceptions", {}).get("geolocation", {})
    allowed = [k for k, v in geo_ex.items() if isinstance(v, dict) and v.get("setting") == 1]
    total_allowed += len(allowed)
    print(f"  [{prof}] default={def_geo} | allowed={len(allowed)}")
    if def_geo != 2 or allowed:
        print(f"ERROR: {prof} 复核未通过！")
        sys.exit(3)

print(f"\nChrome 定位清零完成：全部 {len(pref_files)} 个配置允许站点数={total_allowed}")

print("\n=== 5. 打开 macOS 定位服务设置页 ===")
subprocess.run(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices"], check=False)
print("请在弹出的「定位服务」窗口中确认关闭 Google Chrome 与其他 Google 系应用的总开关。")
PY
}

cmd_build_foxyproxy() {
  if [ "$#" -lt 2 ]; then
    echo "用法: google-clean-kit.sh build-foxyproxy <proxy_host> <proxy_port> [proxy_type] [output_json] [title]" >&2
    exit 1
  fi
  local host="$1"
  local port="$2"
  local ptype="${3:-http}"
  local out_file="${4:-./foxyproxy-google-full.json}"
  local title="${5:-Google 全量 · 分流代理}"

  python3 - "$host" "$port" "$ptype" "$out_file" "$title" <<'PY'
import concurrent.futures
import json
import os
import subprocess
import sys

host, port, ptype, out_file, title = sys.argv[1:6]
ptype_lower = ptype.lower()
curl_scheme = "socks5h" if ptype_lower == "socks5" else ptype_lower
proxy_url = f"{curl_scheme}://{host}:{port}"

candidates = [
    ("google.com", "https://www.google.com/", "Google 主域全站（搜索/登录/账号/条款申诉/Gemini/One/Play/Maps）"),
    ("googleapis.com", "https://clientservices.googleapis.com/chrome-variations/seed?osname=mac", "Google APIs（含 clientservices/update/fonts）"),
    ("gstatic.com", "https://www.gstatic.com/generate_204", "Google 静态资源 (gstatic)"),
    ("googleusercontent.com", "https://lh3.googleusercontent.com/", "Google 用户内容 (googleusercontent)"),
    ("antigravity.google", "https://antigravity.google/", "Antigravity 官方与登录"),
    ("youtube.com", "https://www.youtube.com/", "YouTube 主站与登录同步"),
    ("googlevideo.com", "https://manifest.googlevideo.com/", "YouTube 视频流 (googlevideo)"),
    ("withgoogle.com", "https://experiments.withgoogle.com/", "WithGoogle"),
    ("recaptcha.net", "https://www.recaptcha.net/recaptcha/api.js", "Google reCAPTCHA"),
    ("gvt1.com", "https://edgedl.me.gvt1.com/", "Chrome 组件与更新 (gvt1)"),
    ("appspot.com", "https://appengine.google.com/", "Google App Engine (appspot)"),
    ("firebaseapp.com", "https://firebase.google.com/", "Firebase 应用与认证"),
    ("chromium.org", "https://www.chromium.org/", "Chromium 官方"),
    ("ytimg.com", "https://i.ytimg.com/", "YouTube 缩略图 (ytimg)"),
    ("ggpht.com", "https://yt3.ggpht.com/", "Google 头像与图片 (ggpht)"),
    ("youtu.be", "https://youtu.be/", "YouTube 短链 (youtu.be)"),
    ("google.dev", "https://ai.google.dev/", "Google 开发者站点 (google.dev)"),
    ("chrome.com", "https://www.chrome.com/", "Chrome 官网 (chrome.com)"),
]

def probe(item):
    domain, url, desc = item
    res = subprocess.run(
        ["curl", "-sS", "--max-time", "5", "-x", proxy_url, "-D", "-", "-o", "/dev/null", url],
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        err = res.stderr.strip().splitlines()[-1] if res.stderr.strip() else f"exit={res.returncode}"
        return domain, desc, False, err[:80]
    http_lines = [l.strip() for l in res.stdout.splitlines() if l.strip().startswith("HTTP/")]
    status_line = http_lines[-1] if http_lines else ""
    parts = status_line.split()
    code = int(parts[1]) if len(parts) >= 2 and parts[1].isdigit() else 0
    if code == 0 or code >= 500:
        return domain, desc, False, status_line or "invalid status"
    return domain, desc, True, status_line

print(f"=== 正在通过 {proxy_url} 并发探测 {len(candidates)} 个 Google 域名 ===")
included = []
excluded = []
with concurrent.futures.ThreadPoolExecutor(max_workers=9) as pool:
    for domain, desc, ok, detail in pool.map(probe, candidates):
        if ok:
            included.append((domain, desc, detail))
        else:
            excluded.append((domain, desc, detail))

print(f"\n[已纳入规则: {len(included)} 条]")
for domain, _, detail in included:
    print(f"  + *://*.{domain}/*  ({detail})")

print(f"\n[已自动排除（代理不兼容或超时）: {len(excluded)} 条]")
for domain, _, detail in excluded:
    print(f"  - {domain}  ({detail})")

if not any(d == "google.com" for d, _, _ in included):
    print("\nERROR: 代理未能打通 google.com，请检查代理地址、端口或当前网络是否可达。")
    sys.exit(2)

config = {
    "mode": "pattern",
    "sync": False,
    "autoBackup": False,
    "passthrough": "",
    "theme": "",
    "container": {},
    "commands": {},
    "data": [
        {
            "active": True,
            "title": title,
            "type": ptype_lower,
            "hostname": host,
            "port": str(port),
            "username": "",
            "password": "",
            "cc": "",
            "city": "",
            "color": "#3b82f6",
            "pac": "",
            "pacString": "",
            "proxyDNS": True,
            "include": [
                {
                    "active": True,
                    "title": desc,
                    "pattern": f"*://*.{domain}/*",
                    "type": "match",
                }
                for domain, desc, _ in included
            ],
            "exclude": [],
            "tabProxy": [],
        }
    ],
}

out_abs = os.path.abspath(out_file)
os.makedirs(os.path.dirname(out_abs), exist_ok=True)
with open(out_abs, "w", encoding="utf-8") as f:
    json.dump(config, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"\n已生成 FoxyProxy 配置文件: {out_abs}")
PY
}

cmd_verify() {
  if [ "$#" -lt 1 ]; then
    echo "用法: google-clean-kit.sh verify <proxy_url> [expected_country_keyword] [expected_country_code]" >&2
    exit 1
  fi
  local proxy_url="$1"
  local expected_kw="${2:-Singapore}"
  local expected_code="${3:-sg}"
  local expected_code_upper
  expected_code_upper="$(printf '%s' "$expected_code" | tr '[:lower:]' '[:upper:]')"

  local pass_count=0
  local fail_count=0

  echo "=== Google 出口地区自检 (${proxy_url} | 期望: ${expected_kw} / ${expected_code}) ==="

  local terms_snippet
  terms_snippet="$(curl -sS -L --max-time 8 -x "$proxy_url" \
    -H "Accept-Language: en-US,en;q=0.9" \
    "https://policies.google.com/terms" \
    | python3 -c 'import re,sys; s=sys.stdin.read(); i=s.find("Country version"); print(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s[i:i+220])).strip() if i!=-1 else "")' || true)"

  if echo "$terms_snippet" | grep -q "Country version:" \
    && echo "$terms_snippet" | grep -qi "$expected_kw" \
    && (echo "$expected_kw" | grep -qi "China" || ! echo "$terms_snippet" | grep -qi "China"); then
    echo "[PASS] policies.google.com/terms -> ${terms_snippet:0:60}"
    pass_count=$((pass_count + 1))
  else
    echo "[FAIL] policies.google.com/terms 未命中 ${expected_kw} (${terms_snippet:-empty})"
    fail_count=$((fail_count + 1))
  fi

  local g_headers g_status g_loc
  g_headers="$(curl -sS --max-time 8 -x "$proxy_url" -D - -o /dev/null "https://www.google.com/" || true)"
  g_status="$(printf '%s\n' "$g_headers" | grep -E '^HTTP/' | tail -n 1 | tr -d '\r' || true)"
  g_loc="$(printf '%s\n' "$g_headers" | grep -i '^location:' | head -n 1 | tr -d '\r' || true)"
  if echo "$g_status" | grep -qE ' 200' && ! echo "$g_loc" | grep -qi 'google\.com\.hk'; then
    echo "[PASS] www.google.com -> ${g_status} (未跳转 .hk)"
    pass_count=$((pass_count + 1))
  else
    echo "[FAIL] www.google.com 异常 -> ${g_status:-empty} ${g_loc}"
    fail_count=$((fail_count + 1))
  fi

  local v_headers x_country
  v_headers="$(curl -sS --max-time 8 -x "$proxy_url" -D - -o /dev/null "https://clientservices.googleapis.com/chrome-variations/seed?osname=mac" || true)"
  x_country="$(printf '%s\n' "$v_headers" | grep -i '^x-country:' | head -n 1 | tr -d '\r' || true)"
  if echo "$x_country" | grep -qiE "^x-country:\s*${expected_code}\b"; then
    echo "[PASS] chrome-variations/seed -> ${x_country}"
    pass_count=$((pass_count + 1))
  else
    echo "[FAIL] chrome-variations/seed 未返回 x-country: ${expected_code} (${x_country:-empty})"
    fail_count=$((fail_count + 1))
  fi

  local yt_gl
  yt_gl="$(curl -sS -L --max-time 8 -x "$proxy_url" \
    -H "Accept-Language: en-US,en;q=0.9" \
    "https://www.youtube.com/" \
    | grep -oE '"(INNERTUBE_CONTEXT_GL|GL)":"[^"]+"' | head -n 1 || true)"
  if echo "$yt_gl" | grep -qE "\"(INNERTUBE_CONTEXT_GL|GL)\":\"${expected_code_upper}\""; then
    echo "[PASS] www.youtube.com -> ${yt_gl}"
    pass_count=$((pass_count + 1))
  else
    echo "[FAIL] www.youtube.com 未返回 ${expected_code_upper} (${yt_gl:-empty})"
    fail_count=$((fail_count + 1))
  fi

  echo ""
  echo "汇总: PASS=${pass_count}, FAIL=${fail_count}"
  [ "$fail_count" -eq 0 ]
}

case "${1:-}" in
  discover)
    shift
    cmd_discover "$@"
    ;;
  auto)
    shift
    cmd_auto "$@"
    ;;
  clean-chrome)
    shift
    cmd_clean_chrome "$@"
    ;;
  build-foxyproxy)
    shift
    cmd_build_foxyproxy "$@"
    ;;
  verify)
    shift
    cmd_verify "$@"
    ;;
  -h|--help|"")
    usage
    ;;
  *)
    echo "未知子命令: $1" >&2
    usage >&2
    exit 1
    ;;
esac
```

# 六、换新电脑 / 换新公司 10 分钟落地清单

以后换一台新 Mac 或者去到一家新公司，不用靠猜，按下面顺序直接跑通：

1. **先主动嗅探可用出口：**
   ```bash
   bash ~/antify-network-setup/google-clean-kit.sh discover
   ```
   如果新公司提供了研发代理或本地 VPN 端口，可追加 `--candidate http://proxy.example.com:8118` 一并打分对比，确认哪条出口干净以及被 Google 识别成了哪个国家。
2. **一键清零浏览器与系统定位：**
   ```bash
   bash ~/antify-network-setup/google-clean-kit.sh clean-chrome
   ```
   脚本会自动备份并清空全部 Chrome Profile 的定位白名单、设为默认禁止，最后弹出 macOS「定位服务」窗口，关闭 Chrome 和桌面 AI 应用的总开关。
3. **拆开工作与个人 Chrome Profile：** 确保工作 Profile 只登录工作号，个人 Google 账号单独放在独立个人 Profile 里，不要在同一窗口挂多个账号。
4. **一键探测并生成分流规则（如果直连尚不干净）：**
   ```bash
   bash ~/antify-network-setup/google-clean-kit.sh auto --output ~/antify-network-setup/foxyproxy-google-full.json
   ```
   脚本会自动选择最优干净出口，并发筛选兼容域名生成 JSON，再顺便跑完 4 项出口验收。然后在个人 Profile 安装 FoxyProxy 扩展导入该 JSON、保存并切到「按规则代理」；桌面端按需在 Antify 配好应用级分流（开启远程 DNS、关闭派生子进程继承）。
5. **逐个个人号检查云端与手机端残留：**
   - 打开 [Google 活动控件](https://myactivity.google.com/activitycontrols) 关闭时间轴 / 位置记录并清理历史位置数据；
   - 打开 [Google 数据与隐私](https://myaccount.google.com/data-and-privacy) 确认关闭位置信息共享；
   - 打开 [Google 已登录设备](https://myaccount.google.com/device-activity) 排查手机登录态并按需关闭手机端 Google 应用定位；
   - 打开 [Google Payments](https://pay.google.com/) 确认无多余中国区付款资料（保留已有海外付费钱包）；
   - 打开 [Google 服务条款](https://policies.google.com/terms) 确认页面国家版本已显示为目标国。

# 七、实战避坑：6 个最容易踩翻车的细节

1. **误踢挂着终端 CLI 授权的旧设备会话，命令行会立刻报 `401`：** 在 Google「您的设备」页清理历史 Mac 会话时，如果那条旧会话下面列着 `Google Antigravity` 等本地开发工具，退出它会当场吊销本机正在用的 OAuth Token，终端工具会立刻出现 `UNAUTHENTICATED (code 401)`。真要洗掉旧会话，先确认海外代理已经接稳，再退出旧会话并立即重跑终端命令重新授权，新的授权记录就会挂到干净的目标国家会话上。
2. **网页登了个人号，不等于 Chrome 书签就会同步过去：** 在 Google 网页右上角切换成个人号，影响的只是网页里的登录态；书签、历史和密码归 Chrome 最右上角「Profile 顶层同步账号」管。换绑前先到 `chrome://bookmarks/` 导出一份书签备份，再去 `chrome://settings/people` 关闭原同步（弹窗里别勾清除本地数据），重新登录个人号合并同步，避免换机丢书签。
3. **排查 Google Payments 时留住海外付费钱包：** 打开付款设置页检查国家时，如果账号原本就绑着海外付款资料和在用付费订阅（例如美区订阅），千万别误点关闭；只确认账号下没有多余的中国区付款资料即可。
4. **刚切到新出口连续进敏感页，高频弹二次验证是正常现象：** 代理刚切到海外，短时间内连续点进活动控件、设备管理和付款设置等高敏页面，Google 会频繁要求手机确认数字或验证码。不用怀疑规则写错，只要「您的设备」里当前会话已经标出目标国，过几天风控降下来就会恢复正常；另外，短期过渡用的公用电脑或公司电脑没必要绑定 Touch ID 通行密钥（Passkey），等换到长期自用的新主力机再加。
5. **手机端把「国内收验证」和「出国开导航」拆开管：** 人在国内时，用来收登录确认通知的 Google 主应用、Chrome、Gmail、YouTube 和 Photos 定位权限全设成「永不」；Google Maps 可以平时设「永不」（出国落地后再改「使用 App 期间」），或者保持「使用 App 期间」但国内绝不点开，同时关掉 Maps 里的时间轴备份。等真正在海外旅行或出差时开定位导航，GPS 本来就在海外，不会拖累地区判定。
6. **分清「出口秒变」和「账号地区慢变」两套节奏：** 分流生效后，未登录时看服务条款和「您的设备」当前会话里的地点都会立刻切到代理所在国；但账号自身历史绑定的归属地不会秒改，往往要在干净出口下稳跑 1～2 周再提交切区申诉，通过率才高。
