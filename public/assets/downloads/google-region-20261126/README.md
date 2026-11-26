# Google 地区与 agy 1.5.18 工具包

更新：2026-11-26。对应文章：

https://jobyang.cn/writing/google-region-clean-split-tunnel-macos/

## 文件

- `google-clean-kit.sh`：网络体检、定位和分流配置工具。
- `reapply_checked.py`：本机保守地区补丁工具，版本 `1.0.0`。
- `agy-1.5.18-darwin-arm64.json`：固定版本官方原件下载地址、包与二进制校验值。
- `SHA256SUMS.txt`：两份脚本、本说明和固定版本信息的 SHA-256。

文件不含代理账号、令牌、私人配置、原会话或改好的客户端二进制。目录中的 ZIP 包与单文件下载提供相同脚本。

## 新 Mac 安装顺序

两份脚本都是完整源文件。ZIP 内包含全部脚本、说明和固定版本信息，不依赖作者电脑上的仓库、旧会话、内部工具或飞书登录。

只覆盖 Apple Silicon（`uname -m` 为 `arm64`）上的 agy CLI 1.5.18。准备 Python 3.9+、Bash、curl、unzip、tar、shasum 和 macOS codesign；浏览器定位工具另需 osascript。直连、Antify 或 TUN 选一种。代理配置、符合条件的 Google 账号和系统授权由本人准备；缺一项就停在对应步骤。

若还没有 ZIP，在新目录下载、解压和校验：

```bash
tool_dir="$(mktemp -d "${TMPDIR:-/tmp}/google-region-tools.XXXXXX")" &&
  curl -fL "https://jobyang.cn/assets/downloads/google-region-20261126/google-region-tools-20261126.zip" \
    -o "$tool_dir/tools.zip" &&
  unzip -q "$tool_dir/tools.zip" -d "$tool_dir" &&
  (cd "$tool_dir" && shasum -a 256 -c SHA256SUMS.txt) &&
  printf '校验通过，目录：%s\n' "$tool_dir"
```

只在校验通过后继续。进入打印出的目录并阅读源码，按下面的顺序操作：

1. 获取并校验固定 1.5.18 原件。准备好实际程序并放到版本目录，暂不启用统一入口。
2. 如需 Antify，程序落盘后再生成配置；批准扩展、导入规则，核对实际程序路径。只用已确认可用的直连时不生成代理配置。
3. 独立目录启动，由本人完成 Google 登录、MFA 与必要权限，再做真实模型验收。
4. 验收通过并获确认后才启用固定入口。在新终端检查路径、版本、禁更新日志和真实模型回执。

## 固定原件与实际程序路径

在工具包的工作目录运行以下命令。`official` 必须尚不存在；两层校验有一层失败就停，不能使用留下的文件。

```bash
meta=agy-1.5.18-darwin-arm64.json
url="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["url"])' "$meta")" &&
  archive_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sha512"])' "$meta")" &&
  binary_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["original_binary_sha256"])' "$meta")" &&
  mkdir official &&
  curl -fL "$url" -o official/agy.tar.gz &&
  printf '%s  %s\n' "$archive_sha" official/agy.tar.gz | shasum -a 512 -c &&
  tar -xf official/agy.tar.gz -C official antigravity &&
  install -m 0755 official/antigravity official/agy &&
  printf '%s  %s\n' "$binary_sha" official/agy | shasum -a 256 -c &&
  codesign --verify --strict official/agy &&
  printf '原件校验通过：%s/official/agy\n' "$PWD"
```

优先使用官方原件。维护自用副本时，按下文准备候选。把选定且校验通过的程序放到 `~/.gemini/antigravity-cli/bin/managed-1.5.18/agy`，确认可执行。如果同路径已有不同程序，先保留原文件，停下来核对。此时不启动程序、不改正式入口。

以下是首次落盘的例子，`program` 指向选定且已校验的文件。如果使用定制副本，改为该副本的实际路径。

```bash
program="$PWD/official/agy"
managed="$HOME/.gemini/antigravity-cli/bin/managed-1.5.18"
codesign --verify --strict "$program" &&
  mkdir -p "$managed" &&
  test ! -e "$managed/agy" && test ! -L "$managed/agy" &&
  install -m 0755 "$program" "$managed/agy" &&
  cmp "$program" "$managed/agy" &&
  test -x "$managed/agy"
```

## 检查网络并绑定实际路径

需要 Bash、Python 3 和 curl；定位设置相关命令还需 macOS osascript。

```bash
bash google-clean-kit.sh --help
bash google-clean-kit.sh status --json
bash google-clean-kit.sh discover --json
```

`status` 与 `discover` 用于只读检查，但会访问公开探测端点。配置快照可能过期，Antify 的当前生效策略要在应用内核对。

程序落盘后才生成 Antify 配置：`build-antify` 只收录已经存在且可执行的路径。`auto` 如果选中可用直连，会返回成功但不生成分流配置。需要导入时先导出现有设置到私有目录，由本人授权网络扩展，在生效规则里确认 `managed-1.5.18/agy` 指向获准使用的代理。浏览器如需分流，再给个人 Profile 配 FoxyProxy。

`clean-chrome` 会备份并修改浏览器偏好；`auto`、`build-foxyproxy` 和 `build-antify` 会生成配置文件。执行前阅读帮助，并保存当前工作。不要将修改类命令当成只读体检。

`verify` 的网页与出口结果不代表模型 API 一定可用，仍需真实目标模型请求。

## 本地副本（按需）

适用范围是 Apple Silicon 的 CLI 1.5.18；需要 macOS codesign，不依赖第三方 Python 包。

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

`already_applied` 不必重打；`rejected` 时停止并保留原件。副本的签名、指纹和运行结果分别检查，不因版本字符串相同就跳过。

## 独立验证

普通 CLI 的 `--gemini_dir` 使用绝对路径，`--app_data_dir` 使用相对目录。切到独立工作目录，以同一程序和目录参数交互启动（不加 `--print`）并请本人登录。完成后执行：

```bash
AGY_CLI_DISABLE_AUTO_UPDATE=true "$HOME/.gemini/antigravity-cli/bin/managed-1.5.18/agy" \
  --gemini_dir "/绝对路径/测试配置" \
  --app_data_dir antigravity-cli \
  --model "Orchestrator (Neon)" \
  --print "兼容性验证，只回复验证通过，不调用工具。" \
  --output-format json
```

核对日志中的 `appDataDir` 确实位于测试区；目录参数不隔离系统钥匙串。目标模型必须真正返回响应，且 JSON 含 `status: SUCCESS`。按用途再验文件工具、会话恢复或 ACP。

已在已有 Mac 的独立目录验证下载、校验、体检、示例配置生成和候选签名；另有 1.5.18 的真实模型回执。没有验证全新 Mac 的首次授权、跨机迁移或长时间运行。

## 升级与回退

**固定已验证版本，持续禁止自动更新。** 官方更新或重装覆盖二进制会丢失本地补丁，不能让后台更新器直接替换正式程序。

每次升级先阅读发布说明，判断新增功能或修复对当前使用是否有明确收益。没有明确收益就保留现版；值得升级时，按新版二进制特征重新定位、检查并适配补丁，不照搬旧偏移。

记录目标版本、升级理由、原件与补丁指纹、验收结果和回退入口。未知结构或隔离验证失败时保留现版；验证通过并获得用户确认后才切换，切换后继续禁自动更新。

真实验收通过并经确认后，在 `~/.local/bin/agy` 创建固定入口。先建立 `~/.local/bin`，将下面内容保存为同目录的临时文件，设为可执行后再替换；已有入口时先保存一份可恢复的备份：

```sh
#!/bin/sh
export AGY_CLI_DISABLE_AUTO_UPDATE=true
exec "$HOME/.gemini/antigravity-cli/bin/managed-1.5.18/agy" "$@"
```

把 `~/.local/bin` 加到当前 shell 启动文件的 PATH 前部，例如在 zsh 的 `~/.zshrc` 中添加 `export PATH="$HOME/.local/bin:$PATH"`。新开终端执行 `command -v agy` 和 `type -a agy`，确认优先使用该入口；再核对版本、禁更新日志与模型响应。

失败时恢复原入口和导入前的网络配置；新机没有旧入口时，只撤销本次新增的入口、PATH 行和规则。不清空 Google 账号数据，不退出正常任务。历史会话迁移单独处理，只有会话 ID 不能把旧记录带到新机。

## 来源

- https://github.com/cli117/antigravity-hakimi
- https://antigravity.google/cli/install.sh
