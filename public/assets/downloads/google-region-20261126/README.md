# Google 地区与 agy 1.5.18 工具包

更新：2026-11-26。对应文章：

https://jobyang.cn/writing/google-region-clean-split-tunnel-macos/

## 文件

- `google-clean-kit.sh`：从文章原七合一代码移出的网络与定位工具。
- `reapply_checked.py`：本机保守地区补丁工具，版本 `1.0.0`。
- `SHA256SUMS.txt`：两份脚本和本说明的 SHA-256。

文件不含代理账号、令牌、私人配置、原会话或改好的客户端二进制。目录中的 ZIP 包与单文件下载提供相同脚本。

## 先检查网络

需要 Bash、Python 3 和 curl；定位设置相关命令还需 macOS osascript。

```bash
bash google-clean-kit.sh --help
bash google-clean-kit.sh status --json
bash google-clean-kit.sh discover --json
```

`status` 与 `discover` 用于只读检查，但会访问公开探测端点。配置快照可能过期，Antify 的当前生效策略要在应用内核对。

`clean-chrome` 会备份并修改浏览器偏好；`auto`、`build-foxyproxy` 和 `build-antify` 会生成配置文件。执行前阅读帮助，并保存当前工作。不要将修改类命令当成只读体检。

`verify` 的网页与出口结果不代表模型 API 一定可用，仍需真实目标模型请求。

## 再检查本地资格补丁

已验证的平台为 macOS Apple Silicon ARM64，CLI 1.5.13 与 1.5.18。本文没有验证所有 GUI、Intel Mac、Windows 或 Linux 版本。

依赖 Python 3.9 或更新版本；生成副本时需要 macOS codesign，不依赖第三方 Python 包。

先准备官方原件，核对官方发布包哈希，运行：

```bash
python3 reapply_checked.py --source "/路径/官方/agy"
```

输出为 `needs_patch` 时，预先创建一个新目录，再生成副本：

```bash
python3 reapply_checked.py --source "/路径/官方/agy" \
  --output "/已创建的新目录/agy" \
  --report "/已创建的新目录/patch-report.json"
```

输出文件和报告必须不存在。脚本不覆盖正式入口，不退出或重启其他进程，不修改账号，也不安装自动更新任务。

脚本根据 Mach-O、Go 函数表、完整字符串及控制流定位唯一候选，不直接照搬旧版地址。未知结构或额外分支改动会拒绝处理，不能为了出包放宽这些检查。

`already_applied` 表示已识别到该处补丁，不必重打；`rejected` 时保留原件并进一步分析。只改一条4字节程序指令，重签名元数据会另行变化。

## 独立验证

普通 CLI 的 `--gemini_dir` 使用绝对路径，`--app_data_dir` 使用相对目录。工作目录也应独立：

```bash
AGY_CLI_DISABLE_AUTO_UPDATE=true "/新副本目录/agy" \
  --gemini_dir "/绝对路径/测试配置" \
  --app_data_dir antigravity-cli \
  --model "Orchestrator (Neon)" \
  --print "兼容性验证，只回复验证通过，不调用工具。" \
  --output-format json
```

核对日志中的 appDataDir，再验证主力模型、工具和恢复。仅设置目录环境变量不等于已隔离。

## 本次验证

2026-11-26，同一份1.5.18地区补丁副本在原分流下生成地区400，切新加坡全局后 Neon／Carbon、文件工具、跨版本测试会话恢复及 ACP 历史回放通过。

正式升级后给 Antify 补入 `managed-1.5.18/agy` 真实路径，统一入口请求成功。旧版任务继续运行，未加入实验性的 Orchestrator 改动。

长时间运行、每小时 OAuth 续期以及所有 Antify 分流规则未逐条验证。这份工具包不保证未来版本或服务端始终可用。

## 升级与回退

真实验收通过后，将新程序放在单独版本目录，原子切换统一入口，保留禁自动更新设置及旧版备份：

```sh
#!/bin/sh
export AGY_CLI_DISABLE_AUTO_UPDATE=true
exec "$HOME/.gemini/antigravity-cli/bin/managed-1.5.18/agy" "$@"
```

Antify 规则同时覆盖真实新版路径；按路径匹配时不能只保留包装脚本或旧版本规则。现有任务无需因入口切换而退出。回退只恢复入口，之后新启动的任务再使用旧程序。

## 来源

- https://github.com/cli117/antigravity-hakimi
- https://gist.github.com/liuhanzhang/bd36e89cce9a4354898b9c2c2ec0ccca
- https://antigravity.google/cli/install.sh

`reapply_checked.py` 是结合上述机制编写的保守封装，本次使用 `1.0.0`。完整网站文章解释了桌面前端方案与 Go 二进制补丁的区别。
