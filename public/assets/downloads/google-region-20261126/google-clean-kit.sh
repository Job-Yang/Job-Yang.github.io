#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Google 账号定位清零、出口主动嗅探、状态体检与精细分流复用工具 (macOS)

用法:
  google-clean-kit.sh status [--json]
      只读环境体检：核查 Antify、OpenSurge / Mihomo TUN、系统代理、全 Chrome Profile 定位与 FoxyProxy、
      agy 路径覆盖度与本地 DNS，识别当前工作模式并拦截双代理冲突或断线残留。

  google-clean-kit.sh discover [--json] [--candidate <proxy_url>]...
      主动嗅探本机所有合法出口候选（直连、环境变量、系统代理/PAC、git/curl 配置、常见本地代理端口及已有分流配置），
      并发探测各出口在 Google / Gemini / Antigravity 官方端点的真实国家判定与连通性，给出推荐排序与命令。

  google-clean-kit.sh auto [--candidate <proxy_url>]... [--output <json_path>] [--antify-output <json_path>]
      一键串行跑通：自动执行 discover 选出最优干净出口 -> 探测并生成 FoxyProxy 全量配置 -> 跑 4 项硬指标验收。
      传入 --antify-output 时同步生成桌面端 Antify 备份配置。
      - output 默认: ./foxyproxy-google-full.json

  google-clean-kit.sh clean-chrome
      备份全部 Chrome Profile 的 Preferences，优雅退出 Chrome，将所有 Profile 的默认定位设为禁止并清空允许列表，
      重启 Chrome 复核持久化生效后，自动打开 macOS 定位服务设置页。

  google-clean-kit.sh build-foxyproxy <proxy_host> <proxy_port> [proxy_type] [output_json] [title]
      并发探测 5 个防漂移核心 Google 域名在指定代理下的连通性，写入 FoxyProxy v8/v9 配置文件；
      刻意排除流媒体与无 Cookie 下载 CDN，避免轮换代理池导致 YouTube 播放失败或 Chrome 应用商店下载 504 超时。
      - proxy_type  默认: http（可选: http / https / socks5 / socks4）
      - output_json 默认: ./foxyproxy-google-full.json
      - title       默认: Google 核心 · 分流代理

  google-clean-kit.sh build-antify <proxy_host> <proxy_port> [proxy_type] [output_json] [proxy_name]
      动态扫描本机实际安装的 Antigravity / Antigravity IDE / Gemini 及其 Helper、内置可执行文件与 agy CLI 路径，
      生成可直接导入 Antify 的完整分流备份 JSON（远程 DNS、屏蔽失败连接、关闭派生子进程继承）。
      - proxy_type  默认: http（可选: http / https / socks5 / socks5h）
      - output_json 默认: ./antify-backup-generated.json
      - proxy_name  默认: Google AI · 分流代理

  google-clean-kit.sh verify <proxy_url> [expected_country_keyword] [expected_country_code]
      通过 4 项硬指标检验出口被 Google 识别的真实国家/地区（例如 Singapore / sg，或 Japan / jp）。
      - expected_country_keyword 默认: Singapore
      - expected_country_code    默认: sg

示例:
  bash google-clean-kit.sh status
  bash google-clean-kit.sh discover --candidate http://proxy.example.com:8118
  bash google-clean-kit.sh auto --output ~/antify-network-setup/foxyproxy-google-full.json --antify-output ~/antify-network-setup/antify-backup.json
  bash google-clean-kit.sh build-antify proxy.example.com 8118 http ~/antify-network-setup/antify-backup.json
  bash google-clean-kit.sh clean-chrome
  bash google-clean-kit.sh verify http://proxy.example.com:8118 Singapore sg
EOF
}

cmd_status() {
  python3 - "$@" <<'PY'
import base64
import glob
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import urllib.parse

json_mode = "--json" in sys.argv[1:]
home = os.path.expanduser("~")

def run_cmd(cmd, timeout=3):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except Exception:
        return None

def tcp_reachable(host, port, timeout=1.5):
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except Exception:
        return False

# 1. Process inspection (generic proxy / Antify / TUN cores only)
ps_res = run_cmd(["ps", "-eo", "pid,comm"], timeout=3)
proc_lines = ps_res.stdout.splitlines()[1:] if ps_res and ps_res.returncode == 0 else []

antify_gui_pids = []
antify_core_pids = []
standby_control_procs = []
active_tun_cores = []

standby_basenames = {"opensurge-control", "com.opensurge.helper"}
core_exact_basenames = {"mihomo", "clash", "clash-meta", "clash-verge", "sing-box", "surge", "surge-cli", "v2ray", "xray", "stash"}

for line in proc_lines:
    parts = line.strip().split(None, 1)
    if len(parts) < 2:
        continue
    pid, comm = parts[0], parts[1].strip()
    base = os.path.basename(comm).lower()
    comm_lower = comm.lower()
    if comm_lower.endswith("/antify.app/contents/macos/antify") or base == "antify":
        antify_gui_pids.append(f"{pid}:{comm}")
    elif "antifycore" in base or "com.lester.antify.antifycore" in comm_lower:
        antify_core_pids.append(f"{pid}:{comm}")
    elif base in standby_basenames or base.startswith("opensurge"):
        standby_control_procs.append(base)
    elif (base in core_exact_basenames or base.startswith(("mihomo", "clash", "sing-box"))) and not base.startswith(("opensurge", "com.opensurge")):
        active_tun_cores.append(f"{pid}:{base}")

# Antify live config inspection
antify_config_candidates = []
snap_path = os.path.join(home, "Library/Group Containers/group.app.com.lester.Antify/Library/Application Support/config-snapshot.json")
if os.path.isfile(snap_path):
    antify_config_candidates.append(("config-snapshot", snap_path))
bak_files = sorted(glob.glob(os.path.join(home, "Library/Application Support/com.lester.Antify/Backups/*.json")))
if bak_files:
    antify_config_candidates.append(("latest-backup", bak_files[-1]))
alt_files = sorted(glob.glob(os.path.join(home, "Library/Application Support/Antify/*.json")))
if alt_files:
    antify_config_candidates.append(("antify-support", alt_files[-1]))

antify_config_source = None
antify_proxies = []
antify_rules = []
for label, cfg_path in antify_config_candidates:
    try:
        jd = json.load(open(cfg_path, encoding="utf-8"))
        cfg = jd.get("configuration") if isinstance(jd.get("configuration"), dict) else jd
        if isinstance(cfg, dict) and ("proxies" in cfg or "rules" in cfg):
            antify_config_source = f"{label}:{cfg_path}"
            antify_proxies = cfg.get("proxies") or []
            antify_rules = cfg.get("rules") or []
            break
    except Exception:
        continue

antify_enabled_rules = [r for r in antify_rules if isinstance(r, dict) and r.get("isEnabled", True)]
antify_rule_paths = [r.get("appPath") for r in antify_enabled_rules if isinstance(r, dict) and r.get("appPath")]
missing_rule_paths = [p for p in antify_rule_paths if not os.path.exists(p)]

antify_proxy_checks = []
for px in antify_proxies:
    if not isinstance(px, dict):
        continue
    if not px.get("isEnabled", True):
        continue
    host = px.get("host")
    port = px.get("port")
    ptype = str(px.get("type", "HTTP"))
    name = px.get("name") or f"{host}:{port}"
    if host and port:
        ok = tcp_reachable(host, port)
        antify_proxy_checks.append({
            "name": name,
            "type": ptype,
            "host": host,
            "port": port,
            "reachable": ok,
        })

antify_active = bool(antify_gui_pids or antify_core_pids)

# 2. TUN / OpenSurge / System Proxy / Env Proxy state
sources_path = os.path.join(home, "Library/Application Support/OpenSurge/sources.json")
opensurge_sources_applied = False
opensurge_sources_names = []
if os.path.isfile(sources_path):
    try:
        sd = json.load(open(sources_path, encoding="utf-8"))
        items = sd if isinstance(sd, list) else (sd.get("sources") if isinstance(sd, dict) and isinstance(sd.get("sources"), list) else ([sd] if isinstance(sd, dict) else []))
        for item in items:
            if isinstance(item, dict):
                if item.get("name"):
                    opensurge_sources_names.append(str(item.get("name")))
                if item.get("applied") is True or item.get("isApplied") is True:
                    opensurge_sources_applied = True
    except Exception:
        pass

utun_with_ipv4 = []
ifc_res = run_cmd(["ifconfig", "-l"], timeout=2)
if ifc_res and ifc_res.returncode == 0:
    for iface in ifc_res.stdout.split():
        if iface.startswith("utun"):
            det = run_cmd(["ifconfig", iface], timeout=2)
            if det and det.returncode == 0:
                for l in det.stdout.splitlines():
                    if re.search(r"^\s*inet\s+\d+\.", l):
                        utun_with_ipv4.append(f"{iface} ({l.strip().split()[1]})")
                        break

route_iface = ""
route_gateway = ""
rt_res = run_cmd(["route", "-n", "get", "8.8.8.8"], timeout=2)
if rt_res and rt_res.returncode == 0:
    for l in rt_res.stdout.splitlines():
        ls = l.strip()
        if ls.startswith("interface:"):
            route_iface = ls.split(":", 1)[1].strip()
        elif ls.startswith("gateway:"):
            route_gateway = ls.split(":", 1)[1].strip()

route_via_utun = route_iface.startswith("utun")
tun_active = bool(active_tun_cores or opensurge_sources_applied or route_via_utun)

scutil_proxies = {}
sc_res = run_cmd(["scutil", "--proxy"], timeout=2)
if sc_res and sc_res.returncode == 0:
    kv = {}
    for l in sc_res.stdout.splitlines():
        if ":" in l:
            k, v = l.split(":", 1)
            kv[k.strip()] = v.strip()
    if kv.get("HTTPEnable") == "1":
        scutil_proxies["HTTP"] = f"{kv.get('HTTPProxy', '')}:{kv.get('HTTPPort', '')}"
    if kv.get("HTTPSEnable") == "1":
        scutil_proxies["HTTPS"] = f"{kv.get('HTTPSProxy', '')}:{kv.get('HTTPSPort', '')}"
    if kv.get("SOCKSEnable") == "1":
        scutil_proxies["SOCKS"] = f"{kv.get('SOCKSProxy', '')}:{kv.get('SOCKSPort', '')}"
    if kv.get("ProxyAutoConfigEnable") == "1":
        scutil_proxies["PAC"] = kv.get("ProxyAutoConfigURLString", "")

sys_proxy_active = bool(scutil_proxies)
env_proxies = {k: os.environ[k] for k in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"] if os.environ.get(k)}

# 3. Chrome all-profile geolocation & FoxyProxy status
FOXYPROXY_EXT_ID = "gcknhkkoolaabfmlnjonogaaifnjlfnp"
chrome_base = os.path.join(home, "Library/Application Support/Google/Chrome")
chrome_profiles = []
chrome_geo_leaks = []
foxyproxy_active_profiles = []
unreachable_targets = []

for px in antify_proxy_checks:
    if antify_active and not px["reachable"]:
        unreachable_targets.append(f"Antify -> {px['host']}:{px['port']} ({px['name']})")

def inspect_pac_text(pac_txt):
    proxies = sorted(set(re.findall(r"\b(PROXY|HTTPS|SOCKS5|SOCKS)\s+([A-Za-z0-9._-]+:\d+)", pac_txt)))
    has_google = bool(re.search(r"google\\*\.com", pac_txt))
    has_googleapis = bool(re.search(r"googleapis\\*\.com", pac_txt))
    return proxies, has_google, has_googleapis

if os.path.isdir(chrome_base):
    for pref_path in sorted(glob.glob(os.path.join(chrome_base, "*", "Preferences"))):
        prof = os.path.basename(os.path.dirname(pref_path))
        try:
            d = json.load(open(pref_path, encoding="utf-8"))
        except Exception:
            continue
        p = d.get("profile", {})
        def_geo = p.get("default_content_setting_values", {}).get("geolocation")
        geo_ex = p.get("content_settings", {}).get("exceptions", {}).get("geolocation", {})
        allowed_sites = [k for k, v in geo_ex.items() if isinstance(v, dict) and v.get("setting") == 1]

        geo_clean = (def_geo == 2 and len(allowed_sites) == 0)
        if not geo_clean:
            chrome_geo_leaks.append(f"{prof} (default={def_geo}, allowed={len(allowed_sites)})")

        sp_path = os.path.join(os.path.dirname(pref_path), "Secure Preferences")
        fp_installed = False
        fp_enabled = False
        proxy_mode = None
        pac_proxies = []
        pac_has_core_domains = False
        if os.path.isfile(sp_path):
            try:
                sd = json.load(open(sp_path, encoding="utf-8"))
                exts = sd.get("extensions", {}).get("settings", {})
                fp_ext = exts.get(FOXYPROXY_EXT_ID)
                if isinstance(fp_ext, dict):
                    fp_installed = True
                    dis = fp_ext.get("disable_reasons")
                    state = fp_ext.get("state", 1)
                    fp_enabled = (not dis) and (state != 0)
                    pref_proxy = (fp_ext.get("preferences") or {}).get("proxy") or {}
                    proxy_mode = pref_proxy.get("mode")
                    pac_url = pref_proxy.get("pac_url") or ""
                    if proxy_mode == "pac_script" and pac_url.startswith("data:") and "," in pac_url:
                        header, body = pac_url.split(",", 1)
                        try:
                            if ";base64" in header:
                                pac_txt = base64.b64decode(body).decode("utf-8", errors="ignore")
                            else:
                                pac_txt = urllib.parse.unquote(body)
                            raw_px, has_g, has_ga = inspect_pac_text(pac_txt)
                            pac_has_core_domains = has_g and has_ga
                            for kind, hostport in raw_px:
                                h, prt = hostport.rsplit(":", 1)
                                ok = tcp_reachable(h, prt)
                                pac_proxies.append({
                                    "kind": kind,
                                    "host": h,
                                    "port": int(prt),
                                    "reachable": ok,
                                })
                                if fp_enabled and not ok:
                                    unreachable_targets.append(f"FoxyProxy [{prof}] -> {hostport}")
                        except Exception:
                            pass
                    elif proxy_mode == "fixed_servers":
                        rules = pref_proxy.get("rules") or {}
                        for _, rv in rules.items():
                            if isinstance(rv, dict) and rv.get("host") and rv.get("port"):
                                ok = tcp_reachable(rv["host"], rv["port"])
                                pac_proxies.append({
                                    "kind": rv.get("scheme", "HTTP").upper(),
                                    "host": rv["host"],
                                    "port": int(rv["port"]),
                                    "reachable": ok,
                                })
                                if fp_enabled and not ok:
                                    unreachable_targets.append(f"FoxyProxy [{prof}] -> {rv['host']}:{rv['port']}")
            except Exception:
                pass

        fp_active = bool(fp_installed and fp_enabled and proxy_mode in ("pac_script", "fixed_servers"))
        if fp_active:
            foxyproxy_active_profiles.append(prof)

        chrome_profiles.append({
            "profile": prof,
            "geo_default": def_geo,
            "geo_allowed_count": len(allowed_sites),
            "geo_clean": geo_clean,
            "foxyproxy_installed": fp_installed,
            "foxyproxy_enabled": fp_enabled,
            "foxyproxy_mode": proxy_mode,
            "foxyproxy_active": fp_active,
            "foxyproxy_has_core_domains": pac_has_core_domains,
            "foxyproxy_proxies": pac_proxies,
        })

# 4. agy paths & Antify rule coverage + local DNS check
agy_candidates = []
which_agy = shutil.which("agy")
for p in [
    which_agy,
    os.path.join(home, ".local/bin/agy"),
    os.path.realpath(which_agy) if which_agy else None,
    *sorted(glob.glob(os.path.join(home, ".gemini/antigravity-cli/bin/managed-*/agy"))),
    os.path.join(home, ".gemini/antigravity-cli/bin/agy"),
]:
    if p and os.path.isfile(p) and os.access(p, os.X_OK):
        ap = os.path.abspath(p)
        if ap not in agy_candidates:
            agy_candidates.append(ap)

uncovered_agy_paths = []
if antify_active and antify_rule_paths:
    covered_set = set(os.path.abspath(p) for p in antify_rule_paths)
    for ap in agy_candidates:
        if ap not in covered_set:
            uncovered_agy_paths.append(ap)

dns_info = {}
dns_warnings = []
for host in ["clientservices.googleapis.com", "update.googleapis.com"]:
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
        ips = sorted(set(x[4][0] for x in infos))
        dns_info[host] = ips[:3]
        if any(ip.startswith(("203.208.", "120.253.")) for ip in ips):
            dns_warnings.append(f"{host} 解析到本地国内节点 {ips[:2]}（直连会判为 CN；使用 Antify/FoxyProxy 时必须开启远程 DNS）")
    except Exception as e:
        dns_info[host] = [f"ERR:{e}"]

# 5. Dual-proxy conflict & current mode classification
foxyproxy_active = bool(foxyproxy_active_profiles)
dual_proxy_conflict = bool((antify_active or foxyproxy_active) and (tun_active or sys_proxy_active))

warnings = []
if dual_proxy_conflict:
    left = []
    if antify_active:
        left.append("Antify")
    if foxyproxy_active:
        left.append(f"FoxyProxy({', '.join(foxyproxy_active_profiles)})")
    right = []
    if tun_active:
        right.append("TUN/规则代理")
    if sys_proxy_active:
        right.append("macOS系统代理")
    warnings.append(("冲突告警", f"检测到双代理叠加风险：{' + '.join(left)} 与 {' + '.join(right)} 同时处于开启状态，极易导致死循环或假死。"))

for tgt in sorted(set(unreachable_targets)):
    warnings.append(("切换提醒", f"{tgt} 当前 TCP 不可达（可能已离开公司内网或代理已关闭）；请切换代理模式或在 FoxyProxy/Antify 中停用该代理。"))

if chrome_geo_leaks:
    warnings.append(("定位告警", f"以下 Chrome Profile 存在定位权限残留：{'; '.join(chrome_geo_leaks)}。建议运行 clean-chrome 清零。"))

for dw in dns_warnings:
    warnings.append(("DNS 告警", dw))

if uncovered_agy_paths:
    warnings.append(("版本提示", f"Antify 活跃但以下本机 agy 路径未被最新备份规则覆盖：{', '.join(uncovered_agy_paths)}。建议用 build-antify 重新生成并导入。"))

if antify_active and missing_rule_paths:
    warnings.append(("版本提示", f"Antify 最新配置中存在 {len(missing_rule_paths)} 条已失效路径（例如 {missing_rule_paths[0]}），建议用 build-antify 刷新规则。"))

if dual_proxy_conflict or unreachable_targets:
    current_mode = "异常或冲突状态（需处理）"
elif tun_active or sys_proxy_active:
    current_mode = "模式 2（独立个人 TUN/全局代理）"
elif antify_active or foxyproxy_active:
    current_mode = "模式 1（办公网精细分流）"
else:
    current_mode = "模式 3（干净直连 / 未启用分流）"

payload = {
    "current_mode": current_mode,
    "dual_proxy_conflict": dual_proxy_conflict,
    "antify": {
        "active": antify_active,
        "gui_pids": antify_gui_pids,
        "core_pids": antify_core_pids,
        "config_source": antify_config_source,
        "enabled_rules_count": len(antify_enabled_rules),
        "missing_rule_paths": missing_rule_paths,
        "proxies": antify_proxy_checks,
    },
    "tun_and_system_proxy": {
        "tun_active": tun_active,
        "standby_controls": sorted(set(standby_control_procs)),
        "active_tun_cores": active_tun_cores,
        "opensurge_sources_applied": opensurge_sources_applied,
        "opensurge_sources_names": opensurge_sources_names,
        "route_8888_interface": route_iface,
        "route_8888_gateway": route_gateway,
        "route_via_utun": route_via_utun,
        "utun_with_ipv4": utun_with_ipv4,
        "system_proxy_active": sys_proxy_active,
        "scutil_proxies": scutil_proxies,
        "env_proxies": env_proxies,
    },
    "chrome_profiles": chrome_profiles,
    "agy_paths": agy_candidates,
    "uncovered_agy_paths": uncovered_agy_paths,
    "dns_info": dns_info,
    "warnings": [{"level": lvl, "message": msg} for lvl, msg in warnings],
}

if json_mode:
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    sys.exit(1 if (dual_proxy_conflict or unreachable_targets) else 0)

print(f"=== 本机网络与防送中体检结论: {current_mode} ===")

print("\n[1] 桌面应用级分流 (Antify)")
print(f"  进程状态: GUI={'运行中' if antify_gui_pids else '未运行'} | 系统扩展(AntifyCore)={'运行中' if antify_core_pids else '未运行'}")
if antify_config_source:
    print(f"  配置来源: {antify_config_source}（启用规则 {len(antify_enabled_rules)} 条，失效路径 {len(missing_rule_paths)} 条）")
    for px in antify_proxy_checks:
        st = "TCP 可达" if px["reachable"] else "TCP 不可达"
        print(f"  代理出口: {px['name']} ({px['type']}://{px['host']}:{px['port']}) -> {st}")
else:
    print("  配置来源: 未发现本地 Antify 备份/快照文件")

print("\n[2] TUN / 规则代理 / 系统代理 (OpenSurge / Mihomo / scutil)")
if tun_active:
    print(f"  TUN/内核: 活跃接管中 | cores={active_tun_cores or 'none'} | sources_applied={opensurge_sources_applied} | route_8.8.8.8={route_iface}")
elif standby_control_procs:
    print(f"  OpenSurge 状态: 待机（未接管流量，控制进程={', '.join(sorted(set(standby_control_procs)))}，sources_applied={opensurge_sources_applied}）")
else:
    print("  TUN/内核: 未运行")
print(f"  8.8.8.8 路由出口: {route_iface or '未知'} (网关: {route_gateway or '-'}) | 含 IPv4 的 utun: {utun_with_ipv4 or '无'}")
print(f"  macOS 系统代理 (scutil --proxy): {scutil_proxies if scutil_proxies else '未开启'}")
if env_proxies:
    print(f"  当前 Shell 代理变量: {env_proxies}")

print("\n[3] Chrome 全 Profile 定位与 FoxyProxy 状态")
if not chrome_profiles:
    print("  未发现 Chrome Profile。")
for cp in chrome_profiles:
    geo_s = f"default={cp['geo_default']}, allowed={cp['geo_allowed_count']} ({'干净' if cp['geo_clean'] else '有残留'})"
    if not cp["foxyproxy_installed"]:
        fp_s = "FoxyProxy 未安装"
    elif not cp["foxyproxy_enabled"]:
        fp_s = "FoxyProxy 已安装但被禁用"
    else:
        px_desc = ", ".join(
            f"{px['kind']} {px['host']}:{px['port']}({'可达' if px['reachable'] else '不可达'})"
            for px in cp["foxyproxy_proxies"]
        ) or "无代理地址"
        core_desc = "含核心域名" if cp["foxyproxy_has_core_domains"] else "未确认核心域名"
        fp_s = f"FoxyProxy 已启用 (mode={cp['foxyproxy_mode']}, {core_desc}, {px_desc})"
    print(f"  [{cp['profile']}] 定位: {geo_s} | {fp_s}")

print("\n[4] agy CLI 路径与 Google 后台 DNS")
print(f"  本机 agy 路径 ({len(agy_candidates)}): {agy_candidates if agy_candidates else '未检测到'}")
if antify_active and agy_candidates:
    print(f"  Antify 覆盖状态: {'全部已覆盖' if not uncovered_agy_paths else f'缺少 {len(uncovered_agy_paths)} 项: {uncovered_agy_paths}'}")
for h, ips in dns_info.items():
    print(f"  本地 DNS {h}: {ips}")

print("\n[5] 告警与处置建议")
if not warnings:
    print("  未发现冲突或残留告警。如需检查出口国家识别，可运行 verify；切换网络后请重开正在进行的 CLI 会话并用目标模型发 1 条真实请求验收。")
else:
    for lvl, msg in warnings:
        print(f"  [{lvl}] {msg}")

if dual_proxy_conflict or unreachable_targets:
    sys.exit(1)
PY
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

# 1. Environment variables
for env_k in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"]:
    val = os.environ.get(env_k)
    if val:
        add_candidate(val, f"env:{env_k}")

# 2. macOS scutil --proxy + PAC
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

# 3. git global proxy & ~/.curlrc
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

# 4. Local loopback proxy ports (127.0.0.1 only; never scans remote networks)
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

# 5. Existing local FoxyProxy / Antify config files (generic paths only)
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
snap_file = os.path.join(home, "Library/Group Containers/group.app.com.lester.Antify/Library/Application Support/config-snapshot.json")
if os.path.isfile(snap_file):
    extract_from_json_file(snap_file, "antify:snapshot")
for p in sorted(glob.glob(os.path.join(home, "Library/Application Support/Antify/*.json"))):
    extract_from_json_file(p, "antify:config")
bak_files = sorted(glob.glob(os.path.join(home, "Library/Application Support/com.lester.Antify/Backups/*.json")))
if bak_files:
    extract_from_json_file(bak_files[-1], "antify:latest-backup")

# 6. CLI --candidate arguments
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
    print("可一键生成 FoxyProxy + Antify 双配置并完成 4 项验收：")
    print(f"  bash google-clean-kit.sh auto --candidate {best['target']} --output ./foxyproxy-google-full.json --antify-output ./antify-backup-generated.json")
    print("或分步执行：")
    print(f"  bash google-clean-kit.sh build-foxyproxy {p.hostname} {p.port} {ptype} ./foxyproxy-google-full.json")
    print(f"  bash google-clean-kit.sh build-antify {p.hostname} {p.port} {ptype} ./antify-backup-generated.json")
    print(f"  bash google-clean-kit.sh verify {best['target']} \"{kw}\" {cc}")
PY
}

cmd_discover() {
  run_discover_py "$@"
}

cmd_auto() {
  local output_json="./foxyproxy-google-full.json"
  local antify_output_json=""
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
      --antify-output)
        shift
        antify_output_json="${1:-}"
        [ -n "$antify_output_json" ] || { echo "--antify-output 需要文件路径参数" >&2; exit 1; }
        ;;
      --antify-output=*)
        antify_output_json="${1#*=}"
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
    echo "无需生成浏览器与桌面分流代理；如需清理本机 Chrome 定位，请运行："
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
  cmd_build_foxyproxy "$host" "$port" "$ptype" "$output_json" "Google 核心 · ${kw} 分流代理"
  if [ -n "$antify_output_json" ]; then
    echo ""
    echo "=== auto 附加步骤：动态扫描本机客户端路径并生成 Antify 备份配置 ==="
    cmd_build_antify "$host" "$port" "$ptype" "$antify_output_json" "Google AI · ${kw} 分流代理"
  fi
  echo ""
  echo "=== auto 步骤 2/2：执行 4 项出口硬指标验收 ==="
  cmd_verify "$proxy_url" "$kw" "$cc"
  echo ""
  echo "=== auto 就绪摘要 ==="
  echo "  FoxyProxy 配置文件: $(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$output_json")"
  if [ -n "$antify_output_json" ]; then
    echo "  Antify 备份文件   : $(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$antify_output_json")"
  else
    echo "  生成桌面端 Antify 配置: bash $0 build-antify ${host} ${port} ${ptype} ./antify-backup-generated.json"
  fi
  echo "  目标区校验: ${kw} (${cc}) 全部通过"
  echo "  下一步: 在 Chrome FoxyProxy「选项 → 导入」选择上述 JSON，切到「代理」点保存，确认模式为「按规则代理」；桌面端在 Antify「从备份恢复」导入配置后重启客户端与 CLI 会话。"
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
  local title="${5:-Google 核心 · 分流代理}"

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
    ("google.com", "https://www.google.com/", "Google 主域全站（搜索/登录/账号/服务条款与切区申诉/Gemini/AI Studio/One/Mail/Drive/Docs/Maps/应用商店页面）"),
    ("googleapis.com", "https://clientservices.googleapis.com/chrome-variations/seed?osname=mac", "Google APIs（含 clientservices 变体/Gemini/CloudCode/更新与字体 API）"),
    ("gstatic.com", "https://www.gstatic.com/generate_204", "Google 核心静态资源与连通检测 (gstatic)"),
    ("antigravity.google", "https://antigravity.google/", "Antigravity 官方与 OAuth 登录"),
    ("recaptcha.net", "https://www.recaptcha.net/recaptcha/api.js", "Google reCAPTCHA 人机校验"),
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

print(f"=== 正在通过 {proxy_url} 并发探测 {len(candidates)} 个防漂移核心 Google 域名 ===")
included = []
excluded = []
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    for domain, desc, ok, detail in pool.map(probe, candidates):
        if ok:
            included.append((domain, desc, detail))
        else:
            excluded.append((domain, desc, detail))

print(f"\n[已纳入规则: {len(included)} 条]")
for domain, _, detail in included:
    print(f"  + *://*.{domain}/*  ({detail})")

if excluded:
    print(f"\n[探测失败（未纳入）: {len(excluded)} 条]")
    for domain, _, detail in excluded:
        print(f"  - {domain}  ({detail})")

print("\n[已刻意排除（不承载账号地区且易在轮换/白名单代理上失效）]")
print("  - 流媒体: youtube.com / googlevideo.com / ytimg.com / ggpht.com / youtu.be（避免轮换出口破坏视频流 IP 绑定导致无法播放）")
print("  - 无 Cookie 下载 CDN: googleusercontent.com / gvt1.com（避免 clients2.googleusercontent.com 504 卡死 Chrome 应用商店与组件更新）")
print("  - 非账号核心/三方托管: withgoogle.com / appspot.com / firebaseapp.com / chromium.org / google.dev / chrome.com")

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

cmd_build_antify() {
  if [ "$#" -lt 2 ]; then
    echo "用法: google-clean-kit.sh build-antify <proxy_host> <proxy_port> [proxy_type] [output_json] [proxy_name]" >&2
    exit 1
  fi
  local host="$1"
  local port="$2"
  local ptype="${3:-http}"
  local out_file="${4:-./antify-backup-generated.json}"
  local proxy_name="${5:-Google AI · 分流代理}"

  python3 - "$host" "$port" "$ptype" "$out_file" "$proxy_name" <<'PY'
import datetime
import glob
import json
import os
import plistlib
import shutil
import sys
import uuid

host, port_raw, ptype_raw, out_file, proxy_name = sys.argv[1:6]

try:
    port = int(port_raw)
    if not (1 <= port <= 65535):
        raise ValueError
except ValueError:
    print(f"ERROR: 无效代理端口 '{port_raw}'（需为 1-65535 整数）。", file=sys.stderr)
    sys.exit(1)

type_map = {
    "http": "HTTP",
    "https": "HTTPS",
    "socks5": "SOCKS5",
    "socks5h": "SOCKS5",
}
antify_type = type_map.get(ptype_raw.strip().lower())
if not antify_type:
    print(f"ERROR: 不支持的 Antify 代理类型 '{ptype_raw}'（可选: http / https / socks5 / socks5h）。", file=sys.stderr)
    sys.exit(1)

def gen_uuid():
    return str(uuid.uuid4()).upper()

now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
config_id = gen_uuid()
proxy_id = gen_uuid()
home = os.path.expanduser("~")

def read_bundle_meta(bundle_path, fallback_name):
    plist_path = os.path.join(bundle_path, "Contents/Info.plist")
    name = fallback_name
    bundle_id = fallback_name
    if os.path.isfile(plist_path):
        try:
            with open(plist_path, "rb") as f:
                pl = plistlib.load(f)
            name = pl.get("CFBundleDisplayName") or pl.get("CFBundleName") or fallback_name
            bundle_id = pl.get("CFBundleIdentifier") or fallback_name
        except Exception:
            pass
    return name, bundle_id

rules = []
seen_paths = set()
skip_bin_exts = (".dylib", ".so", ".plist", ".json", ".txt", ".md")

def add_rule(rule):
    ap = rule["appPath"]
    if ap in seen_paths:
        return False
    seen_paths.add(ap)
    rules.append(rule)
    return True

app_names = ["Antigravity.app", "Antigravity IDE.app", "Gemini.app"]
search_roots = ["/Applications", os.path.join(home, "Applications")]

for app_name in app_names:
    for root in search_roots:
        app_path = os.path.join(root, app_name)
        if not os.path.isdir(app_path):
            continue
        fallback = app_name[:-4] if app_name.endswith(".app") else app_name
        disp_name, bid = read_bundle_meta(app_path, fallback)
        parent_id = gen_uuid()
        if not add_rule({
            "appName": disp_name,
            "appPath": app_path,
            "appType": "App",
            "bundleID": bid,
            "childrenInherit": True,
            "configurationID": config_id,
            "createdAt": now_utc,
            "id": parent_id,
            "isEnabled": True,
            "killSwitch": False,
            "proxyMode": "proxy",
            "spawnedProcessesInherit": False,
            "targetProxyID": proxy_id,
        }):
            continue

        # Embedded Helper .app bundles
        for helper_path in sorted(glob.glob(os.path.join(app_path, "Contents/Frameworks/*.app"))):
            h_fallback = os.path.basename(helper_path)[:-4]
            h_name, h_bid = read_bundle_meta(helper_path, h_fallback)
            add_rule({
                "appName": h_name,
                "appPath": helper_path,
                "appType": "Helper",
                "bundleID": h_bid,
                "childrenInherit": False,
                "configurationID": config_id,
                "createdAt": now_utc,
                "id": gen_uuid(),
                "isEnabled": True,
                "killSwitch": False,
                "parentRuleID": parent_id,
                "proxyMode": "proxy",
                "spawnedProcessesInherit": False,
                "targetProxyID": proxy_id,
            })

        # Embedded CLI binaries inside Contents/Resources/bin
        bin_dir = os.path.join(app_path, "Contents/Resources/bin")
        if os.path.isdir(bin_dir):
            for entry in sorted(os.listdir(bin_dir)):
                bp = os.path.join(bin_dir, entry)
                if entry.lower().endswith(skip_bin_exts) or entry == ".DS_Store":
                    continue
                if os.path.isfile(bp) and os.access(bp, os.X_OK):
                    add_rule({
                        "appName": entry,
                        "appPath": bp,
                        "appType": "CLI",
                        "bundleID": entry,
                        "childrenInherit": False,
                        "configurationID": config_id,
                        "createdAt": now_utc,
                        "id": gen_uuid(),
                        "isEnabled": True,
                        "killSwitch": False,
                        "parentRuleID": parent_id,
                        "proxyMode": "proxy",
                        "spawnedProcessesInherit": False,
                        "targetProxyID": proxy_id,
                    })

# CLI paths: wrapper + managed binary + official install locations
cli_raw = []
which_agy = shutil.which("agy")
if which_agy:
    cli_raw.append((which_agy, "agy", "cli"))
    rp = os.path.realpath(which_agy)
    if rp != os.path.abspath(which_agy):
        parent_tag = os.path.basename(os.path.dirname(rp))
        lbl = f"agy ({parent_tag})" if parent_tag.startswith("managed-") else "agy"
        cli_raw.append((rp, lbl, "agy"))

local_agy = os.path.join(home, ".local/bin/agy")
cli_raw.append((local_agy, "agy", "cli"))
for mp in sorted(glob.glob(os.path.join(home, ".gemini/antigravity-cli/bin/managed-*/agy"))):
    parent_tag = os.path.basename(os.path.dirname(mp))
    cli_raw.append((mp, f"agy ({parent_tag})", "agy"))
cli_raw.append((os.path.join(home, ".gemini/antigravity-cli/bin/agy"), "agy (bin)", "agy"))

for cpath, cname, cbid in cli_raw:
    if cpath and os.path.isfile(cpath) and os.access(cpath, os.X_OK):
        ap = os.path.abspath(cpath)
        add_rule({
            "appName": cname,
            "appPath": ap,
            "appType": "CLI",
            "bundleID": cbid,
            "childrenInherit": True,
            "configurationID": config_id,
            "createdAt": now_utc,
            "id": gen_uuid(),
            "isEnabled": True,
            "killSwitch": False,
            "proxyMode": "proxy",
            "spawnedProcessesInherit": False,
            "targetProxyID": proxy_id,
        })

backup = {
    "appVersion": "0.0.94",
    "configuration": {
        "appVersion": "0.0.94",
        "configurations": [
            {
                "createdAt": now_utc,
                "defaultMode": "direct",
                "icon": "network",
                "id": config_id,
                "isActive": True,
                "name": "General",
                "proxySettings": {
                    "bypassPrivateNetworks": True,
                    "dnsRedirectMode": "proxyAppsOnly",
                    "dnsResolutionMode": "remote",
                    "interruptsConnectionsOnGroupSwitch": True,
                    "proxyFailureBehavior": "block",
                    "remoteDNSPort": 53,
                    "remoteDNSServer": "8.8.8.8",
                    "timeouts": {
                        "dnsTimeout": 10,
                        "socks5HandshakeTimeout": 10,
                        "tcpConnectTimeout": 30,
                        "udpIdleTimeout": 60,
                    },
                    "virtualDNSIP": "198.18.0.1",
                },
                "sortOrder": 0,
                "updatedAt": now_utc,
            }
        ],
        "exportedAt": now_utc,
        "proxies": [
            {
                "canReachPrivateNetwork": False,
                "createdAt": now_utc,
                "failureBehavior": "block",
                "host": host,
                "id": proxy_id,
                "isEnabled": True,
                "name": proxy_name,
                "passwordInKeychain": False,
                "port": port,
                "supportedProtocols": "TCP",
                "type": antify_type,
                "updatedAt": now_utc,
            }
        ],
        "rules": rules,
        "schemaVersion": "1.0",
    },
    "exportedAt": now_utc,
    "format": "antify-backup",
    "formatVersion": 1,
    "preferences": {
        "appearance": "system",
        "interruptsConnectionsOnGroupSwitch": True,
        "language": "system",
        "latencyTestURL": "http://www.google.com/generate_204",
        "launchAtLogin": True,
        "startProxyOnLaunch": True,
        "switchConfigurationsAutomatically": True,
    },
}

out_abs = os.path.abspath(out_file)
os.makedirs(os.path.dirname(out_abs), exist_ok=True)
tmp = out_abs + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(backup, f, ensure_ascii=False, indent=2)
    f.write("\n")
    f.flush()
    os.fsync(f.fileno())
os.replace(tmp, out_abs)

print(f"=== 动态扫描完成：共生成 {len(rules)} 条 Antify 分流规则 ===")
print(f"  代理出口: {antify_type}://{host}:{port}（名称: {proxy_name}）")
for idx, r in enumerate(rules, 1):
    inherit = "父应用" if r.get("appType") == "App" else ("子进程规则" if "parentRuleID" in r else "独立CLI")
    print(f"  {idx:2d}. [{r['appType']:6s} | {inherit}] {r['appName']} -> {r['appPath']}")

if not rules:
    print("\n[提醒] 当前本机尚未安装 Antigravity / Gemini / agy，已输出仅含代理节点定义的空规则备份；安装客户端后可重跑 build-antify 自动补齐路径。")
print(f"\n已生成 Antify 备份文件: {out_abs}")
print("下一步: 在 Antify 选择「从备份恢复」导入上述 JSON，开启「网络扩展 → Antify」开关并重启客户端与 CLI 会话。")
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
  status)
    shift
    cmd_status "$@"
    ;;
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
  build-antify)
    shift
    cmd_build_antify "$@"
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
