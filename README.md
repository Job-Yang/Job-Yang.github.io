# Job Yang Personal Site

个人文章、项目记录与长期实验的公开站点。

## 本地开发

```bash
npm install
npm run dev
```

生产验证：

```bash
npm run test:audit
npm run audit:public
npm run build
npm run preview
```

## 内容结构

- `src/content/posts/`：经过脱敏和公开化改写的文章
- `src/content/projects/`：项目与阶段记录
- `_posts/`：2015–2016 年早期 Jekyll 文章，仅作历史存档
- `src/pages/`：首页、文章、项目、关于、RSS、404 与旧 URL 兼容路由

旧 Jekyll 主题代码已移除；`_posts/` 由 Astro 兼容路由读取，不再参与 Jekyll 构建。

## 发布规则

非公开文档不能直接进入公开仓库。每篇内容必须经过：

1. 从对外内容总表选择候选；
2. 导出源材料到仓库外的私有 DATA；
3. 删除组织专名、来源标识、业务数据、任务状态、运行记录、Token 与未公开细节；
4. 把案例改写为公开读者可独立理解的通用说明或明确标注的合成示例；
5. 人工确认；
6. 加入 `src/content/posts/`。

`npm run audit:public` 会扫描全部受 Git 跟踪的文本文件，拦截内部链接、组织专名、
私有来源投影、编辑工作流元数据、运行产物路径、疑似 Token 和本机私有路径。
`npm run build` 会在构建前检查源码，并在构建后再次扫描 `dist`。

源稿与公开 Markdown 的映射、revision、规范化基线和待审核更新包只保存在仓库外的
私有 DATA。源稿变化后只生成差异包，不直接覆盖公开文章。完整流程见
`.trae/skills/public-release-redactor/SKILL.md`。

## 技术

- Astro 静态站点
- Three.js WebGPU 黑洞与 GLB 飞船
- GitHub Actions + GitHub Pages
- RSS 与 sitemap 自动生成

黑洞渲染基于 [dgreenheck/webgpu-black-hole](https://github.com/dgreenheck/webgpu-black-hole)，采用 MIT License，许可证见 `public/blackhole-LICENSE.txt`。
