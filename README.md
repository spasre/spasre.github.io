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
spasreTasks.requestPlan("帮我排一下本周任务");          // POST 到设置里填的助手接口
```

`requestPlan` 会把 `{ prompt, today, categories, tasks }` POST 到任务板设置里的接口地址，接口返回数组或 `{ tasks: [...] }`，返回的任务会以「助手添加」的来源写进任务板。接口地址留空时只会提示还没有配置。

## 目录结构

```
index.html                首页（Jekyll 模板，含文章列表、任务板与搜索数据）
tasks.html                任务板页面（/tasks/）
_layouts/post.html        文章页模板
_includes/                页眉、页脚、head 公共片段、首页任务板片段
assets/css/style.css      全站样式（首页、文章页与任务板共用）
assets/js/site.js         主题切换与搜索（全站共用）
assets/js/tasks.js        任务板逻辑与 window.spasreTasks 接口
_posts/                   Markdown 文章
```

页眉、样式和脚本都是全站共用的：要调整导航、搜索框或配色，改 `_includes/` 与 `assets/` 下的文件即可，首页和文章页会同步生效。

