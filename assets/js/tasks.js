(function () {
  "use strict";

  const STORE_KEY = "spasre-tasks-v1";
  const DAILY_CATEGORY = "每日推荐";
  const DEFAULT_CATEGORIES = ["学习", "工作", "生活", "每日推荐"];
  const URGENCY_KEYS = ["urgent", "high", "normal", "low"];
  const URGENCY_LABEL = { urgent: "紧急", high: "重要", normal: "普通", low: "不急" };
  const URGENCY_WEIGHT = { urgent: 0, high: 1, normal: 2, low: 3 };
  const BUCKETS = [
    ["overdue", "已逾期"],
    ["today", "今天"],
    ["tomorrow", "明天"],
    ["week", "本周内"],
    ["later", "以后"],
    ["someday", "未排期"]
  ];
  const DAILY_LIMIT = 200;
  const KNOWLEDGE_POINTS = [
    "复习 LLVM IR 的 SSA 形式与 phi 节点",
    "读一段 Clang 诊断（Diagnostic）实现，理清告警触发链路",
    "弄懂 provenance 指针溯源如何支撑更激进的优化",
    "复习 GDB 观察点（watchpoint）与条件断点用法",
    "整理 C++ 未定义行为（UB）的常见来源",
    "了解 LLVM Pass Manager 的分层与执行顺序",
    "读一个优化 pass 的源码（如 InstCombine）",
    "复习 ABI 与调用约定对代码生成的影响",
    "了解 -O2 下常见的指令折叠与合法化流程",
    "复习 DTS（Diagnostic Test Suite）用例的写法",
    "弄懂 -Werror 下版本升级的告警对齐思路",
    "复习寄存器分配与指令选择的基本流程"
  ];
  const DEFAULT_SETTINGS = {
    defaultCategory: "学习",
    pinnedCategories: ["学习", "每日推荐"],
    dailyRecommendation: true,
    agentBaseUrl: "",
    agentModel: "",
    agentApiKey: "",
    agentRememberKey: true,
    agentEndpoint: ""
  };
  const AGENT_KEY_STORAGE = "spasre-agent-key";
  const AGENT_TIMEOUT = 60000;

  const DOG_ICON =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">' +
    '<path d="M6.6 3.7 4.1 6.4c-.4.5-.6 1.1-.4 1.7l1 2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M17.4 3.7l2.5 2.7c.4.5.6 1.1.4 1.7l-1 2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M12 4.6c3.5 0 6.3 2.6 6.3 6.2 0 3.8-2.8 6.8-6.3 6.8s-6.3-3-6.3-6.8c0-3.6 2.8-6.2 6.3-6.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="9.7" cy="10.4" r="1" fill="currentColor"/>' +
    '<circle cx="14.3" cy="10.4" r="1" fill="currentColor"/>' +
    '<path d="M12 12.8c-.8 0-1.4.5-1.4 1.1 0 .6.6 1.1 1.4 1.1s1.4-.5 1.4-1.1c0-.6-.6-1.1-1.4-1.1Z" fill="currentColor"/>' +
    "</svg>";

  const state = {
    homeCategory: "",
    board: { view: "active", category: "all", urgency: "all", scope: "all", editingId: "" }
  };

  let store = load();

  /* ---------- storage ---------- */

  function emptyStore() {
    return { tasks: [], trash: [], settings: Object.assign({}, DEFAULT_SETTINGS), meta: { categories: [] } };
  }

  function load() {
    const fresh = emptyStore();
    let raw = null;
    try {
      raw = window.localStorage.getItem(STORE_KEY);
    } catch (error) {
      console.warn("无法读取本地任务数据，将使用临时数据。", error);
      return fresh;
    }
    if (!raw) return fresh;
    try {
      const parsed = JSON.parse(raw);
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        trash: Array.isArray(parsed.trash) ? parsed.trash : [],
        settings: Object.assign({}, DEFAULT_SETTINGS, parsed.settings || {}),
        meta: { categories: Array.isArray(parsed.meta && parsed.meta.categories) ? parsed.meta.categories : [] }
      };
    } catch (error) {
      console.error("任务数据解析失败，已重置。", error);
      return fresh;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (error) {
      console.error("无法保存任务数据。", error);
    }
  }

  /* ---------- agent key ---------- */

  // 勾了「记住密钥」才写进 localStorage；否则只放 sessionStorage，关掉标签页就没了。
  function readAgentKey() {
    try {
      const session = window.sessionStorage.getItem(AGENT_KEY_STORAGE);
      if (session) return session;
    } catch (error) {
      /* 隐私模式下 sessionStorage 可能不可用 */
    }
    return String(store.settings.agentApiKey || "");
  }

  function writeAgentKey(value) {
    const clean = String(value || "").trim();
    store.settings.agentApiKey = store.settings.agentRememberKey ? clean : "";
    save();
    try {
      if (store.settings.agentRememberKey) window.sessionStorage.removeItem(AGENT_KEY_STORAGE);
      else window.sessionStorage.setItem(AGENT_KEY_STORAGE, clean);
    } catch (error) {
      /* 同上 */
    }
  }

  /* ---------- helpers ---------- */

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function todayKey(date) {
    const now = date || new Date();
    return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  }

  function parseDay(key) {
    const parts = String(key).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function dayDiff(key) {
    return Math.round((parseDay(key) - parseDay(todayKey())) / 86400000);
  }

  function dayOfYear() {
    const now = new Date();
    return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function categories() {
    const found = [];
    const push = (name) => {
      const clean = String(name || "").trim();
      if (clean && !found.includes(clean)) found.push(clean);
    };
    DEFAULT_CATEGORIES.forEach(push);
    store.settings.pinnedCategories.forEach(push);
    store.meta.categories.forEach(push);
    store.tasks.concat(store.trash).forEach((task) => push(task.category));
    return found;
  }

  function registerCategory(name) {
    const clean = String(name || "").trim();
    if (!clean || DEFAULT_CATEGORIES.includes(clean) || store.meta.categories.includes(clean)) return clean;
    store.meta.categories.push(clean);
    return clean;
  }

  function bucketOf(task) {
    if (!task.date) return "someday";
    const diff = dayDiff(task.date);
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff <= 7) return "week";
    return "later";
  }

  function sortTasks(list) {
    return list.slice().sort((a, b) => {
      const bucketA = BUCKETS.findIndex((entry) => entry[0] === bucketOf(a));
      const bucketB = BUCKETS.findIndex((entry) => entry[0] === bucketOf(b));
      if (bucketA !== bucketB) return bucketA - bucketB;
      const weightA = URGENCY_WEIGHT[a.urgency] === undefined ? 2 : URGENCY_WEIGHT[a.urgency];
      const weightB = URGENCY_WEIGHT[b.urgency] === undefined ? 2 : URGENCY_WEIGHT[b.urgency];
      if (weightA !== weightB) return weightA - weightB;
      return String(a.title).localeCompare(String(b.title), "zh-CN");
    });
  }

  function activeTasks(category) {
    const list = store.tasks.filter((task) => !category || category === "all" || task.category === category);
    return sortTasks(list);
  }

  /* ---------- mutations ---------- */

  function createTask(input) {
    const title = String((input && input.title) || "").trim();
    if (!title) return null;
    const category = registerCategory((input && input.category) || store.settings.defaultCategory) || "未分类";
    const urgency = URGENCY_KEYS.includes(input && input.urgency) ? input.urgency : "normal";
    const task = {
      id: newId(),
      title,
      category,
      urgency,
      date: input && input.date ? String(input.date) : "",
      source: (input && input.source) || "manual",
      createdAt: new Date().toISOString()
    };
    store.tasks.push(task);
    save();
    return task;
  }

  function completeTask(id, reason) {
    const index = store.tasks.findIndex((task) => task.id === id);
    if (index === -1) return false;
    const task = store.tasks.splice(index, 1)[0];
    task.trashedAt = new Date().toISOString();
    task.trashReason = reason === "removed" ? "removed" : "done";
    store.trash.unshift(task);
    if (store.trash.length > DAILY_LIMIT) store.trash.length = DAILY_LIMIT;
    save();
    return true;
  }

  function restoreTask(id) {
    const index = store.trash.findIndex((task) => task.id === id);
    if (index === -1) return false;
    const task = store.trash.splice(index, 1)[0];
    delete task.trashedAt;
    delete task.trashReason;
    store.tasks.push(task);
    save();
    return true;
  }

  function purgeTask(id) {
    const before = store.trash.length;
    store.trash = store.trash.filter((task) => task.id !== id);
    if (store.trash.length === before) return false;
    save();
    return true;
  }

  function emptyTrash() {
    if (store.trash.length === 0) return 0;
    const count = store.trash.length;
    store.trash = [];
    save();
    return count;
  }

  function updateTask(id, patch) {
    const task = store.tasks.find((item) => item.id === id);
    if (!task) return false;
    if (patch.title !== undefined) {
      const title = String(patch.title).trim();
      if (!title) return false;
      task.title = title;
    }
    if (patch.category !== undefined) task.category = registerCategory(patch.category) || task.category;
    if (patch.urgency !== undefined && URGENCY_KEYS.includes(patch.urgency)) task.urgency = patch.urgency;
    if (patch.date !== undefined) task.date = patch.date ? String(patch.date) : "";
    save();
    return true;
  }

  function updateSettings(patch) {
    store.settings = Object.assign({}, store.settings, patch);
    save();
  }

  function ensureDailyRecommendation() {
    if (!store.settings.dailyRecommendation) return false;
    const today = todayKey();
    const exists = store.tasks.some(
      (task) => task.category === DAILY_CATEGORY && task.date === today && task.source === "daily"
    );
    if (exists) return false;
    const point = KNOWLEDGE_POINTS[dayOfYear() % KNOWLEDGE_POINTS.length];
    store.tasks.push({
      id: newId(),
      title: "今日知识点：" + point,
      category: DAILY_CATEGORY,
      urgency: "low",
      date: today,
      source: "daily",
      createdAt: new Date().toISOString()
    });
    save();
    return true;
  }

  /* ---------- shared pieces ---------- */

  function dogButton(task, size) {
    const button = el("button", "task-dog" + (size === "small" ? " task-dog-sm" : ""));
    button.type = "button";
    button.dataset.action = "complete";
    button.dataset.id = task.id;
    button.title = "完成（小狗叼走）";
    button.setAttribute("aria-label", "完成任务：" + task.title);
    button.innerHTML = DOG_ICON;
    return button;
  }

  function chip(text, className) {
    return el("span", "task-chip " + (className || ""), text);
  }

  function taskMeta(task) {
    const meta = el("div", "task-meta");
    meta.append(chip(task.category, "chip-category"));
    meta.append(chip(URGENCY_LABEL[task.urgency] || URGENCY_LABEL.normal, "chip-urgency urgency-" + (task.urgency || "normal")));
    if (task.date) {
      const diff = dayDiff(task.date);
      const suffix = diff < 0 ? "（逾期）" : diff === 0 ? "（今天）" : diff === 1 ? "（明天）" : "";
      meta.append(chip(task.date + suffix, "chip-date" + (diff < 0 ? " is-overdue" : "")));
    } else {
      meta.append(chip("未排期", "chip-date"));
    }
    if (task.source === "daily") meta.append(chip("每日推荐", "chip-daily"));
    if (task.source === "agent") meta.append(chip("助手添加", "chip-agent"));
    return meta;
  }

  function taskItem(task, options) {
    const item = el("li", "task-item" + (options && options.compact ? " task-item-compact" : ""));
    item.dataset.id = task.id;

    if (!options || options.dog !== false) item.append(dogButton(task, options && options.compact ? "small" : ""));

    const body = el("div", "task-body");
    body.append(el("span", "task-title", task.title));
    body.append(taskMeta(task));
    item.append(body);

    if (!options || options.actions !== false) {
      const actions = el("div", "task-actions");
      const edit = el("button", "task-action", "编辑");
      edit.type = "button";
      edit.dataset.action = "edit";
      edit.dataset.id = task.id;
      const remove = el("button", "task-action task-action-danger", "删除");
      remove.type = "button";
      remove.dataset.action = "remove";
      remove.dataset.id = task.id;
      actions.append(edit, remove);
      item.append(actions);
    }
    return item;
  }

  function emptyNote(text) {
    return el("p", "task-empty", text);
  }

  /* ---------- home widget ---------- */

  function pinnedCategories() {
    const list = [];
    const push = (name) => {
      if (name && categories().includes(name) && !list.includes(name)) list.push(name);
    };
    push(store.settings.defaultCategory);
    store.settings.pinnedCategories.forEach(push);
    return list;
  }

  function renderHome() {
    const root = document.getElementById("home-tasks");
    if (!root) return;

    const pinned = pinnedCategories();
    if (!pinned.includes(state.homeCategory)) state.homeCategory = pinned[0] || "";
    const current = state.homeCategory;
    const all = activeTasks(current);

    root.replaceChildren();

    const tabs = el("div", "task-tabs");
    pinned.forEach((name) => {
      const tab = el("button", "task-tab", name);
      tab.type = "button";
      tab.dataset.action = "home-category";
      tab.dataset.category = name;
      tab.setAttribute("aria-pressed", String(name === current));
      if (name === current) tab.classList.add("is-active");
      tabs.append(tab);
    });
    if (tabs.childElementCount > 0) root.append(tabs);

    const overdue = all.filter((task) => bucketOf(task) === "overdue").length;
    const today = all.filter((task) => bucketOf(task) === "today").length;
    if (current) {
      const summary = el("p", "task-summary");
      summary.append(el("span", "task-count", all.length + " 个未完成"));
      if (overdue > 0) summary.append(chip(overdue + " 个逾期", "chip-urgency urgency-urgent"));
      if (today > 0) summary.append(chip(today + " 个今天到期", "chip-urgency urgency-high"));
      root.append(summary);
    }

    if (all.length === 0) {
      root.append(emptyNote(current ? "「" + current + "」还没有未完成的任务，在下面加一个吧。" : "还没有任务，去任务板添加第一个吧。"));
    } else {
      const list = el("ul", "task-list");
      all.slice(0, 6).forEach((task) => list.append(taskItem(task, { compact: true, actions: false })));
      root.append(list);
      if (all.length > 6) root.append(el("p", "task-more", "还有 " + (all.length - 6) + " 个任务，去任务板查看全部。"));
    }

    const quick = el("form", "task-quick");
    quick.dataset.role = "quick-add";
    const quickInput = el("input", "task-input");
    quickInput.type = "text";
    quickInput.placeholder = current ? "加一个「" + current + "」任务，回车添加" : "加一个任务，回车添加";
    quickInput.setAttribute("aria-label", "快速添加任务");
    const quickButton = el("button", "task-submit", "添加");
    quickButton.type = "submit";
    quick.append(quickInput, quickButton);
    root.append(quick);

    const foot = el("div", "task-home-foot");
    const boardLink = el("a", "section-link", current ? "在任务板中查看「" + current + "」→" : "打开任务板 →");
    boardLink.href = current ? tasksHref({ category: current }) : tasksHref();
    foot.append(boardLink);
    root.append(foot);
  }

  function tasksHref(params) {
    const base = document.body.dataset.tasksUrl || "/tasks/";
    if (!params || !params.category) return base;
    return base + "?category=" + encodeURIComponent(params.category);
  }

  /* ---------- board ---------- */

  function renderBoard() {
    const root = document.getElementById("task-board");
    if (!root) return;

    renderCategoryOptions();
    renderBoardTabs();
    renderBoardList();
    renderTrash();
  }

  function renderCategoryOptions() {
    const list = document.getElementById("task-category-options");
    if (!list) return;
    list.replaceChildren();
    categories().forEach((name) => {
      const option = el("option", null, name);
      option.value = name;
      list.append(option);
    });

    const filter = document.getElementById("task-filter-category");
    if (filter) {
      const previous = filter.value || state.board.category;
      filter.replaceChildren();
      const all = el("option", null, "全部分类");
      all.value = "all";
      filter.append(all);
      categories().forEach((name) => {
        const option = el("option", null, name);
        option.value = name;
        filter.append(option);
      });
      filter.value = categories().includes(previous) ? previous : "all";
      state.board.category = filter.value;
    }

    const defaultSelect = document.getElementById("task-default-category");
    if (defaultSelect) {
      defaultSelect.replaceChildren();
      categories().forEach((name) => {
        const option = el("option", null, name);
        option.value = name;
        defaultSelect.append(option);
      });
      defaultSelect.value = store.settings.defaultCategory;
    }

    const pinnedBox = document.getElementById("task-pinned-categories");
    if (pinnedBox) {
      pinnedBox.replaceChildren();
      categories().forEach((name) => {
        const label = el("label", "task-check");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = name;
        input.dataset.action = "toggle-pinned";
        input.checked = store.settings.pinnedCategories.includes(name);
        label.append(input, el("span", null, name));
        pinnedBox.append(label);
      });
    }

    const dailyToggle = document.getElementById("task-daily-toggle");
    if (dailyToggle) dailyToggle.checked = Boolean(store.settings.dailyRecommendation);

    const endpoint = document.getElementById("agent-endpoint");
    if (endpoint) endpoint.value = store.settings.agentEndpoint || "";

    const baseInput = document.getElementById("agent-base");
    if (baseInput) baseInput.value = store.settings.agentBaseUrl || "";

    const modelInput = document.getElementById("agent-model");
    if (modelInput) modelInput.value = store.settings.agentModel || "";

    const keyInput = document.getElementById("agent-key");
    if (keyInput && !keyInput.value) keyInput.value = readAgentKey();

    const rememberBox = document.getElementById("agent-remember-key");
    if (rememberBox) rememberBox.checked = Boolean(store.settings.agentRememberKey);

    const addCategory = document.getElementById("task-category");
    if (addCategory && !addCategory.value) addCategory.value = store.settings.defaultCategory;
  }

  function renderBoardTabs() {
    const scopeBar = document.getElementById("task-scope");
    if (scopeBar) {
      scopeBar.replaceChildren();
      [["all", "全部"], ["today", "今天"], ["overdue", "逾期"]].forEach((entry) => {
        const tab = el("button", "task-tab", entry[1]);
        tab.type = "button";
        tab.dataset.action = "scope";
        tab.dataset.scope = entry[0];
        const active = state.board.scope === entry[0];
        tab.setAttribute("aria-pressed", String(active));
        if (active) tab.classList.add("is-active");
        scopeBar.append(tab);
      });
    }

    const viewBar = document.getElementById("task-view");
    if (viewBar) {
      viewBar.replaceChildren();
      [["active", "任务"], ["trash", "回收站"]].forEach((entry) => {
        const tab = el("button", "task-tab", entry[1]);
        tab.type = "button";
        tab.dataset.action = "view";
        tab.dataset.view = entry[0];
        const active = state.board.view === entry[0];
        tab.setAttribute("aria-pressed", String(active));
        if (active) tab.classList.add("is-active");
        if (entry[0] === "trash" && store.trash.length > 0) tab.textContent = "回收站（" + store.trash.length + "）";
        viewBar.append(tab);
      });
    }

    const activePanel = document.getElementById("task-active-panel");
    const trashPanel = document.getElementById("task-trash-panel");
    if (activePanel) activePanel.hidden = state.board.view !== "active";
    if (trashPanel) trashPanel.hidden = state.board.view !== "trash";
  }

  function renderBoardList() {
    const groups = document.getElementById("task-groups");
    if (!groups) return;
    groups.replaceChildren();

    const filterCategory = state.board.category;
    const filterUrgency = state.board.urgency;
    const scope = state.board.scope;

    let list = activeTasks(filterCategory);
    if (filterUrgency !== "all") list = list.filter((task) => task.urgency === filterUrgency);
    if (scope === "today") list = list.filter((task) => bucketOf(task) === "today");
    if (scope === "overdue") list = list.filter((task) => bucketOf(task) === "overdue");

    if (list.length === 0) {
      groups.append(emptyNote("这里还没有任务。用上面的表单添加一个，或者换个筛选条件看看。"));
      return;
    }

    const buckets = scope === "all" ? BUCKETS : BUCKETS.filter((entry) => entry[0] === scope);
    buckets.forEach((entry) => {
      const bucketTasks = list.filter((task) => bucketOf(task) === entry[0]);
      if (bucketTasks.length === 0) return;
      const section = el("section", "task-group");
      const heading = el("h3", "task-group-title");
      heading.append(el("span", null, entry[1]), el("span", "task-group-count", String(bucketTasks.length)));
      section.append(heading);
      const items = el("ul", "task-list");
      bucketTasks.forEach((task) => items.append(taskItem(task)));
      section.append(items);
      groups.append(section);
    });
  }

  function renderTrash() {
    const panel = document.getElementById("task-trash-panel");
    if (!panel) return;
    const list = document.getElementById("task-trash-list");
    const summary = document.getElementById("task-trash-summary");
    const clearButton = document.getElementById("task-trash-clear");

    if (summary) {
      summary.textContent =
        store.trash.length === 0
          ? "回收站是空的。点任务旁边的小狗，任务就会被叼到这里。"
          : "回收站里有 " + store.trash.length + " 个任务，可以恢复，也可以永久清除。";
    }
    if (clearButton) clearButton.disabled = store.trash.length === 0;
    if (!list) return;

    list.replaceChildren();
    if (store.trash.length === 0) return;

    store.trash.forEach((task) => {
      const item = el("li", "task-item task-item-trash");
      item.dataset.id = task.id;
      const body = el("div", "task-body");
      body.append(el("span", "task-title", task.title));
      body.append(taskMeta(task));
      body.append(
        task.trashReason === "removed" ? chip("已删除", "chip-removed") : chip("已完成", "chip-done")
      );
      item.append(body);

      const actions = el("div", "task-actions");
      const restore = el("button", "task-action", "恢复");
      restore.type = "button";
      restore.dataset.action = "restore";
      restore.dataset.id = task.id;
      const purge = el("button", "task-action task-action-danger", "永久清除");
      purge.type = "button";
      purge.dataset.action = "purge";
      purge.dataset.id = task.id;
      actions.append(restore, purge);
      item.append(actions);
      list.append(item);
    });
  }

  function fillForm(task) {
    const form = document.getElementById("task-add-form");
    if (!form) return;
    form.elements.title.value = task ? task.title : "";
    form.elements.category.value = task ? task.category : store.settings.defaultCategory;
    form.elements.urgency.value = task ? task.urgency : "normal";
    form.elements.date.value = task ? task.date || "" : todayKey();
    const submit = form.querySelector("[type=submit]");
    if (submit) submit.textContent = task ? "保存修改" : "添加任务";
    const cancel = document.getElementById("task-add-cancel");
    if (cancel) cancel.hidden = !task;
    state.board.editingId = task ? task.id : "";
  }

  /* ---------- 助手：内置规划 ---------- */

  const WEEKDAY_INDEX = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
  const PLAN_LEAD = /^(?:请|麻烦|帮忙)?(?:帮我|帮忙|给我)?\s*(?:规划|安排|拆分|拆解|排一下|排个|列出|列一下)\s*(?:一下|下)?\s*[:：,，、]?\s*/;
  const DATE_LEAD = /^(?:大后天|后天|明天|明日|今天|今日|今晚|本周|这周|这星期|本星期|下周|下星期|下礼拜|周[一二三四五六日天]|星期[一二三四五六日天]|礼拜[一二三四五六日天]|\d{4}\s*[-\/年.]\s*\d{1,2}\s*[-\/月.]\s*\d{1,2}|\d{1,2}\s*[-\/月]\s*\d{1,2}\s*[日号]?)\s*[，,、:：的]?\s*/;
  const URGENCY_LEAD = /^(?:紧急|很急|重要|不急|优先|尽快|马上|立刻)\s*[:：,，]\s*/;
  const QUESTION_HINT = /[?？]|吗|什么|哪些|多少|几个|怎么样|状态|进度|看看|看一下|列一下|列出|统计|有哪|有没有|有没|是否|情况|概览|总结|还剩|剩下|还有/;
  const PLAN_HINT = /规划|安排|拆解|拆分|添加|加进|新建|记一下|提醒我|排一下/;

  function shiftDay(base, offset) {
    return todayKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset));
  }

  function resolveDate(text, base) {
    const now = base || new Date();
    let match = text.match(/(\d{4})\s*[-\/年.]\s*(\d{1,2})\s*[-\/月.]\s*(\d{1,2})/);
    if (match) return todayKey(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    match = text.match(/(\d{1,2})\s*[-\/月]\s*(\d{1,2})\s*[日号]?/);
    if (match) {
      const month = Number(match[1]);
      const day = Number(match[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return todayKey(new Date(now.getFullYear(), month - 1, day));
      }
    }
    if (/大后天/.test(text)) return shiftDay(now, 3);
    if (/后天/.test(text)) return shiftDay(now, 2);
    if (/明天|明日|明早|明晚/.test(text)) return shiftDay(now, 1);
    if (/今天|今日|今晚|当天/.test(text)) return todayKey(now);

    const nextWeek = /下(?:个)?(?:周|星期|礼拜)/.test(text);
    const thisWeek = /(?:本|这)(?:个)?(?:周|星期|礼拜)/.test(text);
    const weekday = text.match(/(?:下(?:个)?|本|这(?:个)?)?(?:周|星期|礼拜)\s*([一二三四五六日天])/);
    if (weekday) {
      let diff = (WEEKDAY_INDEX[weekday[1]] - now.getDay() + 7) % 7;
      if (nextWeek) diff = diff === 0 ? 7 : diff + 7;
      return shiftDay(now, diff);
    }
    if (nextWeek) return shiftDay(now, ((7 - now.getDay()) % 7) + 7);
    if (thisWeek) return shiftDay(now, (7 - now.getDay()) % 7);
    return "";
  }

  function resolveUrgency(text) {
    if (/不急|有空|随缘|闲了|之后再说/.test(text)) return "low";
    if (/紧急|很急|急用|马上|立刻|立即|尽快|赶紧|优先做/.test(text)) return "urgent";
    if (/重要|优先|务必|关键/.test(text)) return "high";
    return "normal";
  }

  function resolveCategory(text) {
    let best = "";
    categories().forEach((name) => {
      if (name !== DAILY_CATEGORY && name.length >= best.length && text.includes(name)) best = name;
    });
    return best;
  }

  function splitPlanItems(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[；;]/g, "\n")
      .replace(/(^|\s)\d{1,2}\s*[.、)）]\s+/g, "\n")
      .replace(/^\s*[-*•·—–]\s+/gm, "")
      .split(/\n|。|！|!/)
      .map((part) => {
        const cleaned = part
          .replace(PLAN_LEAD, "")
          .replace(/^[:：,，、]+/, "")
          .replace(/[:：,，、;；]+$/, "")
          .trim();
        const withoutDate = cleaned.replace(DATE_LEAD, "").replace(URGENCY_LEAD, "").trim();
        return { title: withoutDate.length >= 2 ? withoutDate : cleaned, raw: cleaned };
      })
      .filter((item) => item.title.length >= 2);
  }

  function localPlan(prompt) {
    const text = String(prompt || "").trim();
    const items = splitPlanItems(text);
    // 日期 / 紧急程度 / 分类写在开头（列表之前）时，当作整段共享的条件。
    const shell = text.split(/\n|；|;|。|！|!/)[0] || "";
    const sharedDate = resolveDate(shell);
    const sharedUrgency = resolveUrgency(shell);
    const sharedCategory = resolveCategory(shell);
    const seen = [];
    const plans = [];
    items.forEach((item) => {
      if (seen.includes(item.title)) return;
      seen.push(item.title);
      const urgency = resolveUrgency(item.raw);
      plans.push({
        title: item.title,
        category: resolveCategory(item.raw) || sharedCategory || store.settings.defaultCategory,
        urgency: urgency === "normal" ? sharedUrgency : urgency,
        date: resolveDate(item.raw) || sharedDate
      });
    });
    return plans;
  }

  function looksLikeQuestion(text) {
    return QUESTION_HINT.test(text) && !PLAN_HINT.test(text);
  }

  function describeTask(task) {
    const bits = [task.category, URGENCY_LABEL[task.urgency] || URGENCY_LABEL.normal];
    if (task.date) bits.push(task.date);
    return "・" + task.title + "（" + bits.join("・") + "）";
  }

  function describeList(list, limit) {
    const shown = list.slice(0, limit).map(describeTask);
    if (list.length > shown.length) shown.push("…还有 " + (list.length - shown.length) + " 条");
    return shown.join("\n");
  }

  function localAnswer(prompt) {
    const text = String(prompt || "");
    const active = sortTasks(store.tasks);
    const today = todayKey();
    const overdue = active.filter((task) => task.date && dayDiff(task.date) < 0);
    const todays = active.filter((task) => task.date === today);
    const tomorrows = active.filter((task) => task.date && dayDiff(task.date) === 1);
    const week = active.filter((task) => task.date && dayDiff(task.date) >= 0 && dayDiff(task.date) <= 7);

    if (/回收站|删掉|删除|已完成/.test(text)) {
      if (store.trash.length === 0) return "回收站是空的。";
      return "回收站里有 " + store.trash.length + " 条：\n" + describeList(store.trash, 6) + "\n可以恢复，也可以永久清除。";
    }
    if (/分类|几类|哪些类/.test(text)) {
      return "现有分类：" + categories().join("、") + "。首页固定显示：" + pinnedCategories().join("、") + "。";
    }
    if (/紧急|重要|优先/.test(text)) {
      const hot = active.filter((task) => task.urgency === "urgent" || task.urgency === "high");
      if (hot.length === 0) return "没有标记为紧急或重要的任务。";
      return "紧急或重要的有 " + hot.length + " 条：\n" + describeList(hot, 6);
    }
    if (/逾期|过期|超期|拖了/.test(text)) {
      if (overdue.length === 0) return "没有逾期的任务。";
      return "逾期 " + overdue.length + " 条：\n" + describeList(overdue, 6);
    }
    if (/明天|明日/.test(text)) {
      if (tomorrows.length === 0) return "明天没有排任务。";
      return "明天有 " + tomorrows.length + " 条：\n" + describeList(tomorrows, 6);
    }
    if (/今天|今日|当天/.test(text)) {
      if (todays.length === 0) return "今天没有排任务，未完成一共 " + active.length + " 条。";
      return "今天有 " + todays.length + " 条：\n" + describeList(todays, 6);
    }
    if (/本周|这周|这星期|一周|七天/.test(text)) {
      if (week.length === 0) return "本周内（含今天）没有排任务。";
      return "本周内有 " + week.length + " 条：\n" + describeList(week, 8);
    }
    if (/多少|几个|数量|统计/.test(text)) {
      return (
        "未完成 " + active.length + " 条，其中今天 " + todays.length + " 条、逾期 " + overdue.length +
        " 条、本周内 " + week.length + " 条；回收站 " + store.trash.length + " 条。"
      );
    }

    const lines = ["未完成 " + active.length + " 条，今天 " + todays.length + " 条，逾期 " + overdue.length + " 条。"];
    if (active.length === 0) {
      lines.push("任务板是空的。可以直接加一条，或者写一句话让我拆成几条。");
      return lines.join("\n");
    }
    if (overdue.length > 0) lines.push("逾期：\n" + describeList(overdue, 3));
    if (todays.length > 0) lines.push("今天：\n" + describeList(todays, 5));
    if (overdue.length === 0 && todays.length === 0) lines.push("接下来：\n" + describeList(active, 5));
    return lines.join("\n");
  }

  /* ---------- 助手：接口调用 ---------- */

  /* ---------- model api (openai compatible) ---------- */

  function agentChatUrl(base) {
    const trimmed = String(base || "").trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    if (/\/chat\/completions$/.test(trimmed)) return trimmed;
    return trimmed + "/chat/completions";
  }

  function agentSystemPrompt() {
    const today = todayKey();
    const weekday = "日一二三四五六"[new Date().getDay()];
    const names = categories();
    const existing = store.tasks.map((task) => task.title).slice(0, 60);
    return [
      "你是一个任务规划助手，把用户说的话拆成可执行的任务。",
      "今天是 " + today + "（星期" + weekday + "）。",
      "category 必须从这些里选一个：" + names.join("、") + "；拿不准就用 " + store.settings.defaultCategory + "。",
      "urgency 只能是 urgent / high / normal / low 之一，分别代表紧急 / 重要 / 普通 / 不急。",
      "date 用 YYYY-MM-DD，只在确实和日期有关时才给，今天就是 " + today + "；不确定就省略这个字段。",
      "已经有这些任务，不要重复添加：" + (existing.length > 0 ? existing.join("；") : "（还没有）"),
      "如果用户是在问问题（例如今天有什么任务、这周该怎么安排），就把回答写进 reply，不要凭空造任务。",
      '只输出一个 JSON 对象，不要写解释，也不要用 markdown 代码块。格式是：{"reply": "给用户看的一两句话", "tasks": [{"title": "任务标题", "category": "分类", "urgency": "normal", "date": "YYYY-MM-DD"}]}',
      "没有新任务时 tasks 就是空数组。"
    ].join("\n");
  }

  function extractJson(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1].trim() : raw;
    try {
      return JSON.parse(body);
    } catch (error) {
      /* 模型爱在 JSON 前后加话，下面按括号截取 */
    }
    const candidates = [
      [body.indexOf("{"), body.lastIndexOf("}")],
      [body.indexOf("["), body.lastIndexOf("]")]
    ];
    for (const pair of candidates) {
      if (pair[0] === -1 || pair[1] <= pair[0]) continue;
      try {
        return JSON.parse(body.slice(pair[0], pair[1] + 1));
      } catch (error) {
        /* 试下一种 */
      }
    }
    return null;
  }

  function normalizePlan(list) {
    const allowed = categories();
    return (Array.isArray(list) ? list : [])
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.name || "").trim();
        if (!title) return null;
        const date = String(item.date || "").trim();
        return {
          title: title,
          category: allowed.includes(item.category) ? item.category : store.settings.defaultCategory,
          urgency: URGENCY_KEYS.includes(item.urgency) ? item.urgency : "normal",
          date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ""
        };
      })
      .filter(Boolean);
  }

  function agentHttpMessage(status, detail) {
    const tail = detail ? "：" + detail : "";
    if (status === 401 || status === 403) return "密钥不对或者没权限（" + status + "）" + tail;
    if (status === 404) return "接口地址不对（404），根路径一般要带 /v1" + tail;
    if (status === 429) return "请求太频繁，或者额度用完了（429）" + tail;
    if (status === 400) return "请求被接口拒绝（400）" + tail;
    if (status >= 500) return "接口自己出错了（" + status + "）" + tail;
    return "接口返回 " + status + tail;
  }

  async function agentFetch(body) {
    const url = agentChatUrl(store.settings.agentBaseUrl);
    if (!url) throw new Error("先把模型接口地址填上。");
    const model = String(store.settings.agentModel || "").trim();
    if (!model) throw new Error("把模型名填上，比如 deepseek-chat。");

    const headers = { "Content-Type": "application/json" };
    const key = readAgentKey();
    if (key) headers.Authorization = "Bearer " + key;

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), AGENT_TIMEOUT) : 0;
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: headers,
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify(Object.assign({ model: model }, body))
      });
    } catch (error) {
      if (controller && error && error.name === "AbortError") throw new Error("请求超时了，模型太慢或者地址不通。");
      throw new Error(
        "连不上接口：地址写错了、网络不通，或者这家接口不允许网页直连（跨域 CORS）。可以换本地 Ollama，或者把地址指向自己的代理。"
      );
    } finally {
      if (timer) window.clearTimeout(timer);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload && payload.error ? payload.error.message || payload.error.type : "";
      throw new Error(agentHttpMessage(response.status, detail));
    }
    const choice = payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
    const content = choice && choice.message && typeof choice.message.content === "string" ? choice.message.content : "";
    if (!content.trim()) throw new Error("模型没有返回内容。");
    return content;
  }

  async function askAgent(text) {
    const content = await agentFetch({
      temperature: 0.2,
      messages: [
        { role: "system", content: agentSystemPrompt() },
        { role: "user", content: text }
      ]
    });

    const parsed = extractJson(content);
    const plan = normalizePlan(parsed ? (Array.isArray(parsed) ? parsed : parsed.tasks) : null);
    const added = addPlanned(plan);
    const remoteReply = parsed && typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    let reply = remoteReply;
    if (!reply) reply = added.length > 0 ? "助手添加了 " + added.length + " 个任务。" : "助手没有返回新任务。";
    if (added.length > 0) reply += "\n" + describeList(added, 10);
    return { source: "api", reply, added };
  }

  async function testAgent() {
    const model = String(store.settings.agentModel || "").trim();
    await agentFetch({
      max_tokens: 8,
      temperature: 0,
      messages: [{ role: "user", content: "ping" }]
    });
    return "连接正常，" + model + " 可以用了。";
  }

  function addPlanned(list) {
    const added = [];
    const known = store.tasks.map((task) => String(task.title).trim());
    (list || []).forEach((item) => {
      if (!item || !item.title) return;
      if (known.includes(String(item.title).trim())) return;
      const task = createTask({
        title: item.title,
        category: item.category || store.settings.defaultCategory,
        urgency: item.urgency,
        date: item.date,
        source: "agent"
      });
      if (task) {
        added.push(task);
        known.push(String(task.title).trim());
      }
    });
    if (added.length > 0) renderAll();
    return added;
  }

  async function askRemote(text) {
    const response = await fetch(String(store.settings.agentEndpoint).trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        today: todayKey(),
        categories: categories(),
        tasks: store.tasks.map((task) => ({
          title: task.title,
          category: task.category,
          urgency: task.urgency,
          date: task.date
        }))
      })
    });
    if (!response.ok) throw new Error("接口返回 " + response.status);
    const data = await response.json();
    const incoming = Array.isArray(data) ? data : Array.isArray(data && data.tasks) ? data.tasks : [];
    const added = addPlanned(incoming);
    const remoteReply = data && typeof data.reply === "string" ? data.reply.trim() : "";
    let reply = remoteReply;
    if (!reply) reply = added.length > 0 ? "助手添加了 " + added.length + " 个任务。" : "助手没有返回新任务。";
    return { source: "remote", reply, added };
  }

  async function ask(prompt) {
    const text = String(prompt || "").trim();
    if (!text) throw new Error("先写点想做的事，或者想问的问题。");
    if (String(store.settings.agentBaseUrl || "").trim()) return askAgent(text);
    if (String(store.settings.agentEndpoint || "").trim()) return askRemote(text);

    if (looksLikeQuestion(text)) {
      return { source: "local", reply: localAnswer(text), added: [] };
    }
    const added = addPlanned(localPlan(text));
    if (added.length === 0) {
      return {
        source: "local",
        reply: "没看明白要做什么。一条一条写会更准：用换行、分号或「1. 2. 3.」分开。",
        added
      };
    }
    const dated = added.filter((task) => task.date).length;
    const reply =
      "内置规划加了 " + added.length + " 个任务" + (dated > 0 ? "，其中 " + dated + " 条带日期" : "") + "：\n" +
      describeList(added, 10) +
      "\n（想换成自己的模型，把接口地址填上就行。）";
    return { source: "local", reply, added };
  }

  async function requestPlan(prompt) {
    const result = await ask(prompt);
    return result.added;
  }

  /* ---------- wiring ---------- */

  function renderAll() {
    renderHome();
    renderBoard();
  }

  function handleAction(event) {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;
    const id = trigger.dataset.id;

    if (action === "complete" && completeTask(id, "done")) {
      renderAll();
    } else if (action === "remove" && completeTask(id, "removed")) {
      renderAll();
    } else if (action === "restore" && restoreTask(id)) {
      renderAll();
    } else if (action === "purge" && purgeTask(id)) {
      renderAll();
    } else if (action === "edit") {
      const task = store.tasks.find((item) => item.id === id);
      if (task) {
        fillForm(task);
        const form = document.getElementById("task-add-form");
        if (form) {
          if (typeof form.scrollIntoView === "function") form.scrollIntoView({ block: "center" });
          form.elements.title.focus();
        }
      }
    } else if (action === "home-category") {
      state.homeCategory = trigger.dataset.category;
      renderHome();
    } else if (action === "scope") {
      state.board.scope = trigger.dataset.scope;
      renderBoard();
    } else if (action === "view") {
      state.board.view = trigger.dataset.view;
      renderBoard();
    } else if (action === "toggle-pinned") {
      const name = trigger.value;
      const pinned = store.settings.pinnedCategories.slice();
      const index = pinned.indexOf(name);
      if (index === -1) pinned.push(name);
      else pinned.splice(index, 1);
      updateSettings({ pinnedCategories: pinned });
      renderHome();
    }
  }

  function wireHome() {
    const root = document.getElementById("home-tasks");
    if (!root) return;
    root.addEventListener("click", handleAction);
    root.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-role=quick-add]");
      if (!form) return;
      event.preventDefault();
      const input = form.querySelector("input");
      const created = createTask({
        title: input.value,
        category: state.homeCategory || store.settings.defaultCategory,
        urgency: "normal",
        date: todayKey()
      });
      if (created) {
        input.value = "";
        renderAll();
      }
    });
  }

  function wireBoard() {
    const root = document.getElementById("task-board");
    if (!root) return;

    root.addEventListener("click", handleAction);

    const clearButton = document.getElementById("task-trash-clear");
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        if (window.confirm("永久清除回收站里的全部任务？此操作不可恢复。")) {
          emptyTrash();
          renderAll();
        }
      });
    }

    const addForm = document.getElementById("task-add-form");
    if (addForm) {
      addForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = {
          title: addForm.elements.title.value,
          category: addForm.elements.category.value,
          urgency: addForm.elements.urgency.value,
          date: addForm.elements.date.value
        };
        if (state.board.editingId) {
          updateTask(state.board.editingId, values);
        } else {
          createTask(values);
        }
        fillForm(null);
        renderAll();
        addForm.elements.title.focus();
      });
    }

    const cancel = document.getElementById("task-add-cancel");
    if (cancel) {
      cancel.addEventListener("click", () => fillForm(null));
    }

    const filterCategory = document.getElementById("task-filter-category");
    if (filterCategory) {
      filterCategory.addEventListener("change", () => {
        state.board.category = filterCategory.value;
        renderBoardList();
      });
    }

    const filterUrgency = document.getElementById("task-filter-urgency");
    if (filterUrgency) {
      filterUrgency.addEventListener("change", () => {
        state.board.urgency = filterUrgency.value;
        renderBoardList();
      });
    }

    const defaultSelect = document.getElementById("task-default-category");
    if (defaultSelect) {
      defaultSelect.addEventListener("change", () => {
        updateSettings({ defaultCategory: defaultSelect.value });
        renderAll();
      });
    }

    const dailyToggle = document.getElementById("task-daily-toggle");
    if (dailyToggle) {
      dailyToggle.addEventListener("change", () => {
        updateSettings({ dailyRecommendation: dailyToggle.checked });
        if (dailyToggle.checked && ensureDailyRecommendation()) renderAll();
      });
    }

    const endpoint = document.getElementById("agent-endpoint");
    if (endpoint) {
      endpoint.addEventListener("change", () => updateSettings({ agentEndpoint: endpoint.value.trim() }));
    }

    const baseInput = document.getElementById("agent-base");
    if (baseInput) {
      baseInput.addEventListener("change", () => updateSettings({ agentBaseUrl: baseInput.value.trim() }));
    }

    const modelInput = document.getElementById("agent-model");
    if (modelInput) {
      modelInput.addEventListener("change", () => updateSettings({ agentModel: modelInput.value.trim() }));
    }

    const keyInput = document.getElementById("agent-key");
    if (keyInput) {
      keyInput.addEventListener("change", () => {
        store.settings.agentApiKey = store.settings.agentRememberKey ? keyInput.value.trim() : "";
        writeAgentKey(keyInput.value);
      });
    }

    const rememberBox = document.getElementById("agent-remember-key");
    if (rememberBox) {
      rememberBox.addEventListener("change", () => {
        updateSettings({ agentRememberKey: rememberBox.checked });
        writeAgentKey(keyInput ? keyInput.value : "");
      });
    }

    const testButton = document.getElementById("agent-test");
    if (testButton) {
      testButton.addEventListener("click", async () => {
        const status = document.getElementById("agent-status");
        if (baseInput) updateSettings({ agentBaseUrl: baseInput.value.trim() });
        if (modelInput) updateSettings({ agentModel: modelInput.value.trim() });
        writeAgentKey(keyInput ? keyInput.value : "");
        if (testButton.disabled) return;
        testButton.disabled = true;
        if (status) status.textContent = "正在测试连接…";
        try {
          const message = await testAgent();
          if (status) status.textContent = message;
        } catch (error) {
          if (status) status.textContent = String(error.message || error);
        } finally {
          testButton.disabled = false;
        }
      });
    }

    const runButton = document.getElementById("agent-run");
    if (runButton) {
      runButton.addEventListener("click", async () => {
        const status = document.getElementById("agent-status");
        const prompt = document.getElementById("agent-prompt");
        updateSettings({ agentEndpoint: endpoint ? endpoint.value.trim() : "" });
        if (baseInput) updateSettings({ agentBaseUrl: baseInput.value.trim() });
        if (modelInput) updateSettings({ agentModel: modelInput.value.trim() });
        writeAgentKey(keyInput ? keyInput.value : "");
        if (runButton.disabled) return;
        runButton.disabled = true;
        if (status) status.textContent = "正在处理…";
        try {
          const result = await ask(prompt ? prompt.value : "");
          if (status) status.textContent = result.reply;
        } catch (error) {
          if (status) status.textContent = String(error.message || error);
        } finally {
          runButton.disabled = false;
        }
      });
    }
  }

  function applyInitialFilters() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    if (category) state.board.category = category;
    const view = params.get("view");
    if (view === "trash" || view === "active") state.board.view = view;
  }

  /* ---------- boot ---------- */

  ensureDailyRecommendation();
  applyInitialFilters();
  wireHome();
  wireBoard();
  renderAll();

  window.spasreTasks = {
    version: 2,
    storageKey: STORE_KEY,
    today: todayKey,
    list: function (options) {
      const category = options && options.category;
      const includeTrash = options && options.includeTrash;
      return (includeTrash ? store.tasks.concat(store.trash) : store.tasks).filter(
        (task) => !category || category === "all" || task.category === category
      );
    },
    categories: categories,
    add: function (task) {
      const created = createTask(task);
      renderAll();
      return created;
    },
    addMany: function (tasks) {
      const added = (tasks || []).map((task) => createTask(task)).filter(Boolean);
      renderAll();
      return added;
    },
    complete: function (id) {
      const ok = completeTask(id, "done");
      renderAll();
      return ok;
    },
    restore: function (id) {
      const ok = restoreTask(id);
      renderAll();
      return ok;
    },
    purge: function (id) {
      const ok = purgeTask(id);
      renderAll();
      return ok;
    },
    emptyTrash: function () {
      const count = emptyTrash();
      renderAll();
      return count;
    },
    settings: function () {
      const snapshot = Object.assign({}, store.settings);
      // 控制台里不直接吐明文密钥，避免顺手复制分享出去
      snapshot.agentApiKey = snapshot.agentApiKey ? "已设置" : "";
      return snapshot;
    },
    updateSettings: function (patch) {
      updateSettings(patch);
      renderAll();
      return Object.assign({}, store.settings);
    },
    setAgentEndpoint: function (url) {
      return this.updateSettings({ agentEndpoint: String(url || "").trim() });
    },
    setAgent: function (options) {
      const config = options || {};
      const patch = {};
      if (config.baseUrl !== undefined) patch.agentBaseUrl = String(config.baseUrl || "").trim();
      if (config.model !== undefined) patch.agentModel = String(config.model || "").trim();
      if (config.rememberKey !== undefined) patch.agentRememberKey = Boolean(config.rememberKey);
      updateSettings(patch);
      if (config.apiKey !== undefined) writeAgentKey(config.apiKey);
      renderAll();
      return {
        baseUrl: store.settings.agentBaseUrl,
        model: store.settings.agentModel,
        rememberKey: store.settings.agentRememberKey,
        hasKey: Boolean(readAgentKey())
      };
    },
    testAgent: testAgent,
    requestPlan: requestPlan,
    ask: ask,
    plan: localPlan,
    answer: localAnswer,
    refresh: renderAll
  };
})();
