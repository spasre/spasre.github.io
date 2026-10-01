# spasre.github.io

## 写一篇新博客

本博客使用 GitHub Pages 内置的 Jekyll 生成 Markdown 文章，无需手动编译。

1. 在 `_posts` 目录新建文件，文件名格式为 `年-月-日-英文短标题.md`，例如 `_posts/2026-09-29-my-first-post.md`。
2. 在文件开头写上文章信息（Front Matter），空一行后开始正文：

   ```markdown
   ---
   title: 我的第一篇文章
   date: 2026-09-29 10:00:00 +0800
   categories:
     - 随笔
   excerpt: 用一句话介绍这篇文章。
   ---

   这里开始写正文。可以使用 **粗体**、链接和代码等 Markdown 语法。

   ## 小标题

   继续写下去。
   ```

3. 保存并将更改推送到 GitHub。GitHub Pages 会自动构建；文章随后会显示在首页，也会进入搜索结果。

文章使用 `_layouts/post.html` 排版，发布地址默认为 `/年/月/日/文章标题/`。本地预览需要先安装 Ruby 和 Jekyll，再运行 `jekyll serve`；也可以直接推送到 GitHub，由 GitHub Pages 自动构建发布。

## 目录结构

```
index.html            首页（Jekyll 模板，含文章列表与搜索数据）
_layouts/post.html    文章页模板
_includes/            页眉、页脚、head 公共片段
assets/css/style.css  全站样式（首页与文章页共用）
assets/js/site.js     主题切换与搜索（全站共用）
_posts/               Markdown 文章
```

页眉、样式和脚本都是全站共用的：要调整导航、搜索框或配色，改 `_includes/` 与 `assets/` 下的文件即可，首页和文章页会同步生效。
