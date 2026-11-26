# Google 地区与 agy 1.5.18 工具包

更新：2026-11-26。对应文章：

https://jobyang.cn/writing/google-region-clean-split-tunnel-macos/

## 文件

- `google-clean-kit.sh`：从文章原七合一代码移出的网络与定位工具。
- `reapply_checked.py`：本机保守地区补丁工具，版本 `1.0.0`。
- `agy-1.5.18-darwin-arm64.json`：固定版本官方原件下载地址、包与二进制校验值。
- `SHA256SUMS.txt`：两份脚本、本说明和固定版本信息的 SHA-256。

文件不含代理账号、令牌、私人配置、原会话或改好的客户端二进制。目录中的 ZIP 包与单文件下载提供相同脚本。

## 新 AI 从网站开始运行

两份脚本都是完整源文件。ZIP 内包含全部脚本、说明和固定版本信息，不依赖作者电脑上的仓库、旧会话、内部工具或飞书登录。

在 macOS 新建独立目录，下载、解压和校验：

```bash
tool_dir="$(mktemp -d "${TMPDIR:-/tmp}/google-region-tools.XXXXXX")"
curl -fL "https://jobyang.cn/assets/downloads/google-region-20261126/google-region-tools-20261126.zip" \
  -o "$tool_dir/tools.zip"
unzip "$tool_dir/tools.zip" -d "$tool_dir"
cd "$tool_dir"
shasum -a 256 -c SHA256SUMS.txt
bash google-clean-kit.sh --help
bash google-clean-kit.sh status --json
python3 reapply_checked.py --help
```

校验失败时停止。`status` 可正常执行但仍报告网络配置问题；这是诊断结果，不等于脚本没有运行。

如果新机还没有官方原件，从 `agy-1.5.18-darwin-arm64.json` 读取 `url` 与 `sha512`，下载并校验归档，再只解包其中的 `antigravity` 到新目录 `official/agy`，按 `original_binary_sha256` 复核。它是固定1.5.18，不要改成安装脚本的最新版本或执行 `agy update`。

之后按下方“再检查本地资格补丁”生成副本并重签，按“独立验证”核对目录和真实模型回执。代理、账号登录和系统权限需要在新机按实际情况准备，不能从本文凭空推定已就绪。

## 源码已实际执行验证

2026-11-26，从公开网站下载源文件到一个新目录，验证网络脚本的帮助、只读JSON体检及示例Antify配置生成；下载的补丁源码对官方1.5.18完成原件检查、副本生成、严格签名验证和已修补状态识别。

生成副本的SHA-256与已通过模型验证的候选一致。示例代理配置没有导入，未执行浏览器偏好修改，也未重新登录；实际网络可用性仍以新机目标模型回执为准。

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

**固定已验证版本，持续禁止自动更新。** 官方更新或重装覆盖二进制会丢失本地补丁，不能让后台更新器直接替换正式程序。

每次升级先阅读发布说明，判断新增功能或修复对当前使用是否有明确收益。没有明确收益就保留现版；值得升级时，按新版二进制特征重新定位、检查并适配补丁，不照搬旧偏移。

记录目标版本、升级理由、原件与补丁指纹、验收结果和回退入口。未知结构或隔离验证失败时保留现版；验证通过并获得用户确认后才切换，切换后继续禁自动更新。

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
