---
title: PNG Compress
kind: skill
eyebrow: Local Image Compression Skill
description: 一个在本地批量压缩 App 工程 PNG 的 Agent Skill。用公开算法组合完成量化、无损收尾、质量门禁、增量缓存和失败回退。
statement: 把 TinyPNG 同类的公开压缩路线，做成能在工程里持续运行、压坏自动回退的本地能力。
github: https://github.com/Job-Yang/jobbyang-ai-skills/tree/main/skills/png-compress-skill
install: cp -R jobbyang-ai-skills/skills/png-compress-skill ~/.claude/skills/png-compress-skill
tags:
  - Agent Skill
  - Image Compression
  - Package Size
order: 4
featured: true
draft: false
visual: generic
---

# png-compress：PNG 压缩技能说明

<figure view-type="Card"><source name="png-compress-skill.zip" mime="application/zip" size="7531" token="T9BEbRTrFoykOLxUI1DcfbuYnmd"/></figure>

## 怎么用起来

包里是一整套本地脚本（见上方附件 `png-compress-skill.zip`），挂成对话技能或者直接进命令行执行，底下跑的都是同一份工具链：

**方式一，直接装进技能平台（例如 Mira）：**装完后对话里说一句「帮我压一下这个 iOS 工程里的 PNG」附上目录路径即可，缺的依赖会自检补装，压过的图自动跳过。

**方式二，纯脚本原地批处理：**解压后按下面几行命令跑；`.png_compress_cache.json` 建议随代码一起提交，免得团队和 CI 反复白算一遍：

```bash
unzip png-compress-skill.zip && cd png-compress-skill
./compress.sh                          # 压当前目录
./compress.sh /path/to/iOSProject      # 压指定工程
./compress.sh /path/to/proj --dry-run  # 只预估省下多少体积，不动原图
```

---

## 为什么这套方案能看齐 TinyPNG

TinyPNG 的核心其实不神秘：有损量化用的就是开源的 **pngquant / libimagequant**，差别在官网默认参数调得好。三条资料把这件事说透了：

- [TinyPNG 官网说明](https://tinify.cn/)写明了原理：用量化（quantization）把 24 位 PNG 归并成 8 位索引色并清空多余元数据，干的事跟 pngquant 一模一样。
- pngquant 作者自己在[官方示例页](https://pngquant.org/php.html)明写：「TinyPNG、Kraken 这类服务底层就是这么跑的，你完全能自己搭。」
- [QQ 音乐技术团队的对比实测](https://cloud.tencent.com/developer/article/1034208)测出过具体差异：默认参数下 TinyPNG 确实比 pngquant 少大约 10% 至 12%；但把 pngquant 质量参数提到 90 之后，压缩率反而追平并超过 TinyPNG。

所以真正落后的不是开源算法，只是默认参数保守。至于网上常传的「TinyPNG 后面还挂了一道 optipng」，多是二手猜测缺少一手实证；我们干脆在脚本里明明白白叠上一层 oxipng 无损收尾，把能省的比特全挤出来。

---

## 只用了两个独立开源工具

常见文档里经常同时冒出 `pngquant`、`libimagequant` 和 `oxipng` 三个词，其实一共只用了两件独立软件：[libimagequant](https://github.com/ImageOptim/libimagequant) 是底层量化算法库，[pngquant](https://github.com/kornelski/pngquant) 只是包在外面的命令行入口；而 [oxipng](https://github.com/oxipng/oxipng) 则是完全独立的无损压缩器。两段配合各有分工：

| 对比项 | pngquant（有损） | oxipng（无损） |
|-|-|-|
| 主要动什么 | 砍颜色：把 24/32 位色压成 8 位调色板 | 挤编码：重排滤波方式并重新跑 DEFLATE |
| 能省多少 | 挑大头，体积缩减主力靠它 | 抠尾巴，顺手再压出几个百分点 |
| 能不能单用 | 单用行不通：只降色深不重压编码，水分留着 | 单用幅度有限：不敢减颜色，压缩率远逊有损量化 |

执行顺序永远先 `pngquant` 后 `oxipng`，因为后者完全不动像素，跟在有损后面收口最安全。

---

## 两段式压缩的内部门道

先做有损量化砍掉色彩冗余，再用无损编码压干存储水分：

![PNG 压缩处理流程](/assets/content/png-compress/processing-flow.webp)

### 有损量化：体积主要在这里砍下来

目标是把 24 或 32 位真彩色压成 8 位调色板（最多 256 色）。`pngquant` 与内核 `libimagequant` 做了几处精细改进（见[pngquant 算法说明](https://pngquant.org/)）：

- **改进中值切割：**不再挑颜色数或体积最大的色盒来切，改成切完后色彩方差最小的选盒方案。
- **加入人眼感知权重：**建直方图时调低杂乱噪点权重，让平坦大色块分到更多代表色。
- **迭代聚类加自适应抖动：**反复补齐偏差较大的色簇，同时用比标准 Floyd-Steinberg 更轻的自适应抖动抹平渐变边界（详见 [libimagequant 文档](https://pngquant.org/lib/)）。
- **Alpha 与 Gamma 联合校准：**算上 sRGB Gamma 和透明度预乘，半透明图边缘不易发灰发脏。

此外，脚本依赖 `--quality min-max`：`pngquant` 会尽量用最少颜色去够 `max` 质量线；一旦发现怎么压都达不到 `min` 质量线就直接退出（返回码 99）而不覆盖原图，防止把精细图标压糊。

### 无损收尾：不动像素，再抠编码水分

PNG 存储时，每行像素会先经过预测滤波变成与邻近像素的差值，再套一层 `DEFLATE`（LZ77 加 Huffman）压缩（参考 [How PNG compression works](https://theimagecdn.com/docs/is-png-lossy-or-lossless)）。

`oxipng` 负责多线程遍历各种预测滤波组合并重新挑更紧的 DEFLATE 参数，加上 `--strip all` 清理冗余块并拉满 `-o max` 压缩档位；如果追求极致还不介意耗时慢，还能另开 `--zopfli`（说明见 [oxipng man page](https://www.mankier.com/1/oxipng)）。因为它完全不碰像素矩阵，放在有损后面绝对安全。

---

## 主要参数设定

| 参数项 | 脚本取值 | 实际考虑 |
|-|-|-|
| 普通大图质量 | `65-85` | 上限抬到 85（高于默认的 65-80），观感贴近 TinyPNG |
| 小图质量（小于 20KB） | `70-90` | 抬高下限，防止小 icon 被压成糊片 |
| 抖动强度（floyd） | `1.0` | 开满自适应抖动，保证渐变过渡平滑 |
| speed 与 oxipng 级别 | `speed 1`，`max` | 挑画质最好的一档运行；若图太多嫌慢，oxipng 可降到 `4` |

配合 `--skip-if-larger`（越压越大直接放弃）和 `.png_compress_cache.json` 内容哈希缓存，整套流水线压过不再重复压，跑起来零心理负担。

---

## 本地依赖安装

| 工具 | 分工 | macOS | Linux |
|-|-|-|-|
| pngquant | 有损量化 | `brew install pngquant` | `apt-get install pngquant` |
| oxipng | 无损重压 | `brew install oxipng` | `cargo install oxipng` 或下官方 release 二进制 |

`compress.sh` 首次执行时会自动检测并借助 Homebrew 补装缺失工具，没装 Homebrew 时会打印手动指令。

---

**开源协议提醒：**`pngquant` 与 `libimagequant` 采用 GPL v3 协议。如果只是在打包构建期运行命令行压图、包里只产出了压缩后的 PNG 图片，通常不触发 GPL 传染；但若把它们的源码静态链进分发客户端，需要另买商业授权（详情见 [pngquant 官网协议说明](https://pngquant.org/)）。
