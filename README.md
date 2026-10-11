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

`_config.yml` 里开启了 `future: true`，所以文章日期即使晚于推送时间（例如当天晚上 20:00）也会立刻发布，不必等到那个时间点。

## 任务板

站点自带一个纯前端的任务板（`/tasks/`），数据保存在浏览器的 localStorage 里，键名 `spasre-tasks-v1`，不需要后端。

- 页眉的「任务」进入任务板；首页也有一块任务板摘要，可以直接快速添加。
- 任务有标题、分类、紧急程度（紧急 / 较高 / 普通 / 较低）和日期。日期会按 已逾期 / 今天 / 明天 / 本周 / 以后 / 未排期 自动分组，所以任务会自动往前滚。
- 点任务旁边的小狗表示完成，任务会被叼进回收站；回收站里可以恢复或永久清除，也可以一键清空。
- 首页默认显示「默认分类」和「固定到首页」的分类；在任务板设置里可以改默认分类、勾选要固定到首页的分类。
- 「每日推荐」分类每天自动生成一条知识点任务（按当天日期取），可以在设置里关掉。
- 分类是自己填的，填新的分类会自动进入分类列表。
- 任务板里有「助手」区块：可以直接写一段话让它拆成任务，也可以问它当前任务情况。

### 助手

助手区块不填接口地址也能用，走内置规划（纯前端、不上网）：

- 写一段话就会拆成任务，用换行、分号、句号或「1. 2. 3.」分隔，例如
  `帮我规划这周：复习 IR；周三整理周报；今天把周报写完` → 3 条任务，其中「周三」「今天」会覆盖开头写的「这周」。
- 认日期：今天 / 明天 / 后天 / 本周 / 下周 / 周三 / 10-12 / 2026-10-12，认紧急程度：紧急 / 重要 / 不急，也会按文字里出现的分类归类。
- 问句会去读任务板再回答，例如「今天有什么任务」「有没有逾期的」「这周有什么」「一共多少任务」「回收站里有什么」。
- 在「接口地址」里填上自己的接口后，就改由那个接口处理：请求体是 `{ prompt, today, categories, tasks }`，返回 `{ "tasks": [{ "title", "category", "urgency", "date" }] }` 会写进任务板，返回 `{ "reply": "..." }` 会显示在状态栏；只返回数组也可以。接口地址留空就退回内置规划。

### 给助手 / 脚本用的接口

任务板把接口挂在 `window.spasreTasks` 上，方便以后接一个 agent 来读任务、往里加任务：

```js
spasreTasks.list();                                  // 全部未完成任务
spasreTasks.add({ title: "写周报", category: "工作", urgency: "high", date: "2026-10-12" });
spasreTasks.addMany([{ title: "A" }, { title: "B" }]);
spasreTasks.complete(id);                            // 小狗叼走
spasreTasks.restore(id);                             // 从回收站恢复
spasreTasks.purge(id);                               // 永久清除
spasreTasks.updateSettings({ defaultCategory: "工作" });
spasreTasks.plan("复习 IR；整理周报");                 // 只算计划，不落库
await spasreTasks.ask("帮我规划这周");                 // → { source, reply, added }，接口留空就用内置规划
await spasreTasks.answer("今天有什么任务");            // 读任务板回答
await spasreTasks.requestPlan("帮我排一下本周任务");    // 同上，但只返回新增的任务数组
```

## 界面

界面参考 WordPress 的 Sakura 主题，用一套共用样式实现：渐变页眉、毛玻璃顶栏、大圆角卡片、药丸标签，加上花瓣飘落、阅读进度条、回到顶部和滚动入场动画。

- 配色全部走 CSS 变量，改颜色只需要动 `assets/css/style.css` 顶部的三个主题块（`:root`、`:root[data-theme="dark"]`、`@media (prefers-color-scheme: dark)`）。**改一处要三处同步**，否则明暗模式会不一致。
- 明暗模式的偏好存在 localStorage 的 `spasre-theme` 里，页头内联脚本会在渲染前先套用，所以切换页面不会闪回白天模式。
- 正文里的装饰元素（搜索无结果、空任务列表、空分类、404）都复用了下面这套贴纸。

### 贴纸素材

`assets/images/mascot/` 里的 21 张静态贴纸和 1 个动画都是从 `D:\emoji\Kipfei\Kipfei` 里的微信表情处理来的：原图是无透明通道的调色板 GIF，处理时用边框环出现最多的颜色作背景色，再做泛洪填充抠图、边缘高斯模糊、按 alpha 裁剪，最后导出成 WebP，整体只有 0.65MB。

页面里的用法：

| 文件 | 用在哪 |
| --- | --- |
| `happy.webp` | 首页大标题旁的吉祥物 |
| `spin.webp` | 页脚（旋转动画） |
| `hug.webp` | 文章页页脚 |
| `shrug.webp` | 搜索无结果、空分类、404 页 |
| `bored.webp` | 空任务列表 |
| `approach.webp` | 右下角回到顶部按钮 |
| `hero-backdrop.webp` | 首页大卡片的背景纹理 |

`favicon.ico`、`favicon.png`、`apple-touch-icon.png` 是拿 `happy.webp` 合成的。

## 目录结构

```
index.html                首页（Jekyll 模板，含文章列表、任务板与搜索数据）
tasks.html                任务板页面（/tasks/）
404.html                  404 页
_layouts/post.html        文章页模板
_includes/                页眉、页脚、head 公共片段、首页任务板片段
assets/css/style.css      全站样式（首页、文章页与任务板共用）
assets/js/site.js         主题切换、搜索、花瓣与滚动动画（全站共用）
assets/js/tasks.js        任务板逻辑与 window.spasreTasks 接口
assets/images/mascot/     贴纸吉祥物与首页背景图
_posts/                   Markdown 文章
```

页眉、样式和脚本都是全站共用的：要调整导航、搜索框或配色，改 `_includes/` 与 `assets/` 下的文件即可，首页、文章页、任务板和 404 页会同步生效。

