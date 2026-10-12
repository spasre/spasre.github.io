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
  // 推荐阅读的来源。全部是公开文档，链接在 2026-10 逐个确认能打开；
  // tags 用来跟任务标题 / 分类做关键词匹配，命中的 tag 越多排得越靠前。
  const ARTICLE_SOURCES = [
    {
      title: "LLVM Language Reference：IR 语法与指令参考",
      url: "https://llvm.org/docs/LangRef.html",
      tags: ["llvm", "ir", "ssa", "指令", "语言参考", "汇编"]
    },
    {
      title: "LLVM IR：未定义值 undef 与 poison",
      url: "https://llvm.org/docs/LangRef.html#undefined-values",
      tags: ["ub", "未定义行为", "undef", "poison", "undefined", "未定义值"]
    },
    {
      title: "LLVM IR：指针别名与 provenance 溯源",
      url: "https://llvm.org/docs/LangRef.html#pointeraliasing",
      tags: ["provenance", "溯源", "指针", "别名", "alias", "getelementptr"]
    },
    {
      title: "LLVM IR：调用约定（Calling Conventions）",
      url: "https://llvm.org/docs/LangRef.html#calling-conventions",
      tags: ["abi", "调用约定", "calling", "约定", "传参"]
    },
    {
      title: "LLVM Programmer's Manual：源码结构与常用 API",
      url: "https://llvm.org/docs/ProgrammersManual.html",
      tags: ["llvm", "源码", "数据结构", "api", "阅读源码"]
    },
    {
      title: "Writing an LLVM Pass：写一个 Pass",
      url: "https://llvm.org/docs/WritingAnLLVMPass.html",
      tags: ["pass", "pass manager", "优化", "分层"]
    },
    {
      title: "LLVM Analysis and Transform Passes：Pass 清单",
      url: "https://llvm.org/docs/Passes.html",
      tags: ["pass", "优化", "清单", "列表", "分析"]
    },
    {
      title: "Alias Analysis Infrastructure：别名分析",
      url: "https://llvm.org/docs/AliasAnalysis.html",
      tags: ["别名分析", "alias analysis", "指针", "优化"]
    },
    {
      title: "The LLVM Target-Independent Code Generator：后端与指令选择",
      url: "https://llvm.org/docs/CodeGenerator.html",
      tags: ["代码生成", "寄存器分配", "指令选择", "后端", "合法化", "legalization"]
    },
    {
      title: "MIR Language Reference：机器层中间表示",
      url: "https://llvm.org/docs/MIRLangRef.html",
      tags: ["mir", "机器指令", "指令选择", "寄存器", "machineir"]
    },
    {
      title: "LLVM Testing Infrastructure Guide：lit 与测试用例写法",
      url: "https://llvm.org/docs/TestingGuide.html",
      tags: ["测试", "lit", "测试用例", "dts", "用例"]
    },
    {
      title: "LLVM Release Notes：版本变化与迁移说明",
      url: "https://llvm.org/docs/ReleaseNotes.html",
      tags: ["版本升级", "升级", "迁移", "release", "release notes", "版本"]
    },
    {
      title: "Clang Diagnostics Reference：告警诊断参考",
      url: "https://clang.llvm.org/docs/DiagnosticsReference.html",
      tags: ["clang", "告警", "诊断", "warning", "diagnostic", "werror", "告警对齐"]
    },
    {
      title: "Clang Internals Manual：诊断与前端实现",
      url: "https://clang.llvm.org/docs/InternalsManual.html",
      tags: ["clang", "诊断", "diagnostic", "实现", "源码", "前端"]
    },
    {
      title: "LLVM Command Guide：opt 命令",
      url: "https://llvm.org/docs/CommandGuide/opt.html",
      tags: ["opt", "o2", "优化", "命令行", "指令折叠", "折叠"]
    },
    {
      title: "LLVM Command Guide：FileCheck",
      url: "https://llvm.org/docs/CommandGuide/FileCheck.html",
      tags: ["filecheck", "测试", "用例", "断言", "匹配"]
    },
    {
      title: "Getting Started with the LLVM System：编译与目录结构",
      url: "https://llvm.org/docs/GettingStarted.html",
      tags: ["构建", "入门", "build", "cmake", "编译"]
    },
    {
      title: "How to Update Debug Info：调试信息的修改",
      url: "https://llvm.org/docs/HowToUpdateDebugInfo.html",
      tags: ["调试信息", "debug", "dwarf", "调试"]
    },
    {
      title: "GDB 官方文档：断点、观察点与调试脚本",
      url: "https://www.gnu.org/software/gdb/documentation/",
      tags: ["gdb", "调试", "断点", "观察点", "watchpoint", "调试器"]
    },
    {
      title: "cppreference：C++ 未定义行为",
      url: "https://en.cppreference.com/w/cpp/language/ub",
      tags: ["ub", "未定义行为", "c++", "行为"]
    },
    {
      title: "MDN：JavaScript 参考",
      url: "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript",
      tags: ["javascript", "js", "前端", "网页", "脚本"]
    },
    {
      title: "Jekyll 文档：静态站点与文章",
      url: "https://jekyllrb.com/docs/",
      tags: ["jekyll", "博客", "静态站点", "文章", "站点"]
    },
    {
      title: "Markdown 基本语法",
      url: "https://www.markdownguide.org/basic-syntax/",
      tags: ["markdown", "写作", "排版", "语法"]
    },
    {
      title: "Git 官方文档",
      url: "https://git-scm.com/docs",
      tags: ["git", "版本控制", "提交", "分支"]
    }
  ];
  const LINK_LIMIT = 3;
  const DEFAULT_SETTINGS = {
    defaultCategory: "学习",
    pinnedCategories: ["学习", "每日推荐"],
    dailyRecommendation: true,
    agentBaseUrl: "",
    agentModel: "",
    agentApiKey: "",
    agentRememberKey: true,
    agentEndpoint: "",
    agentSetupDone: false,
    agentVerifiedAt: "",
    agentPasswordHash: "",
    agentPasswordSalt: ""
  };
  const AGENT_KEY_STORAGE = "spasre-agent-key";
  const AGENT_TIMEOUT = 60000;
  const AGENT_PBKDF2_ROUNDS = 150000;
  const AGENT_ENV_FILE = "spasre-agent.env";
  const AGENT_PASSWORD_MIN = 4;

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
    board: { view: "active", category: "all", urgency: "all", scope: "all", editingId: "" },
    agent: { unlocked: false, gate: "" }
  };

  let store = load();

  /* ---------- storage ---------- */

  function emptyStore() {
    return { tasks: [], trash: [], goals: [], settings: Object.assign({}, DEFAULT_SETTINGS), meta: { categories: [] } };
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
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
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

  /* ---------- agent password ---------- */

  function subtleCrypto() {
    return window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
  }

  function base64FromBytes(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return window.btoa(binary);
  }

  function bytesFromBase64(text) {
    const binary = window.atob(String(text || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function newSalt() {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return base64FromBytes(bytes);
  }

  // 只存 PBKDF2-SHA256 的派生结果，原文不落盘。纯前端挡不住懂行的人，
  // 但能挡住随手改设置和旁观。
  async function hashPassword(password, saltBase64) {
    const subtle = subtleCrypto();
    if (!subtle) throw new Error("这个浏览器不给用加密接口（需要 https），没法安全地存密码。");
    const material = await subtle.importKey(
      "raw",
      new TextEncoder().encode(String(password)),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await subtle.deriveBits(
      { name: "PBKDF2", salt: bytesFromBase64(saltBase64), iterations: AGENT_PBKDF2_ROUNDS, hash: "SHA-256" },
      material,
      256
    );
    return base64FromBytes(new Uint8Array(bits));
  }

  function hasAgentPassword() {
    return Boolean(store.settings.agentPasswordHash && store.settings.agentPasswordSalt);
  }

  /* ---------- agent env file ---------- */

  function envValue(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[\r\n]+/g, " ").trim();
  }

  function agentEnvText() {
    const settings = store.settings;
    return (
      [
        "# spasre 博客 · 任务板助手配置",
        "# 里面有密钥，别提交到 git（仓库的 .gitignore 已经忽略 .env）",
        "SPASRE_AGENT_BASE_URL=" + envValue(settings.agentBaseUrl),
        "SPASRE_AGENT_MODEL=" + envValue(settings.agentModel),
        "SPASRE_AGENT_API_KEY=" + envValue(readAgentKey()),
        "SPASRE_AGENT_REMEMBER_KEY=" + (settings.agentRememberKey ? "true" : "false"),
        "SPASRE_AGENT_ENDPOINT=" + envValue(settings.agentEndpoint),
        "SPASRE_AGENT_PASSWORD_HASH=" + envValue(settings.agentPasswordHash),
        "SPASRE_AGENT_PASSWORD_SALT=" + envValue(settings.agentPasswordSalt)
      ].join("\n") + "\n"
    );
  }

  function parseAgentEnv(text) {
    const map = {};
    String(text || "")
      .split(/\r?\n/)
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const at = trimmed.indexOf("=");
        if (at === -1) return;
        const key = trimmed.slice(0, at).trim();
        let value = trimmed.slice(at + 1).trim();
        const quoted =
          (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
        if (quoted && value.length >= 2) value = value.slice(1, -1);
        map[key] = value;
      });
    return map;
  }

  function applyAgentEnv(map) {
    const patch = {};
    if (map.SPASRE_AGENT_BASE_URL !== undefined) patch.agentBaseUrl = map.SPASRE_AGENT_BASE_URL;
    if (map.SPASRE_AGENT_MODEL !== undefined) patch.agentModel = map.SPASRE_AGENT_MODEL;
    if (map.SPASRE_AGENT_ENDPOINT !== undefined) patch.agentEndpoint = map.SPASRE_AGENT_ENDPOINT;
    if (map.SPASRE_AGENT_REMEMBER_KEY !== undefined) patch.agentRememberKey = map.SPASRE_AGENT_REMEMBER_KEY !== "false";
    if (map.SPASRE_AGENT_PASSWORD_HASH !== undefined) patch.agentPasswordHash = map.SPASRE_AGENT_PASSWORD_HASH;
    if (map.SPASRE_AGENT_PASSWORD_SALT !== undefined) patch.agentPasswordSalt = map.SPASRE_AGENT_PASSWORD_SALT;
    const complete = Boolean(patch.agentBaseUrl && patch.agentModel) || Boolean(patch.agentEndpoint);
    if (complete) patch.agentSetupDone = true;
    updateSettings(patch);
    if (map.SPASRE_AGENT_API_KEY !== undefined) writeAgentKey(map.SPASRE_AGENT_API_KEY);
    state.agent.unlocked = false;
    state.agent.gate = "";
    return complete;
  }

  function agentConfigured() {
    const settings = store.settings;
    if (!settings.agentSetupDone) return false;
    const hasModel = Boolean(String(settings.agentBaseUrl || "").trim() && String(settings.agentModel || "").trim());
    return hasModel || Boolean(String(settings.agentEndpoint || "").trim());
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

  /* ---------- 推荐阅读 ---------- */

  function linkHost(url) {
    const match = String(url || "").match(/^https?:\/\/([^/?#]+)/i);
    return match ? match[1].replace(/^www\./i, "") : "";
  }

  // 英文 tag 按词边界匹配，免得 "ir" 命中 "first" 这种词里的片段；中文直接看包含。
  function tagHit(haystack, tag) {
    if (/^[a-z0-9+#.-]+$/.test(tag)) {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)").test(haystack);
    }
    return haystack.includes(tag);
  }

  function matchArticles(text, limit) {
    const haystack = String(text || "").toLowerCase();
    if (!haystack) return [];
    return ARTICLE_SOURCES.map((entry) => {
      let score = 0;
      entry.tags.forEach((tag) => {
        if (tagHit(haystack, tag)) score += tag.length >= 3 ? 3 : 2;
      });
      return { entry, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "zh-CN"))
      .slice(0, limit || LINK_LIMIT)
      .map((item) => ({ title: item.entry.title, url: item.entry.url, source: linkHost(item.entry.url) }));
  }

  // 助手给的链接要过一遍：只收 http/https，去重，最多 3 条。
  function normalizeLinks(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((item) => {
      if (!item) return;
      const raw = typeof item === "string" ? { url: item } : item;
      const url = String(raw.url || raw.link || raw.href || "").trim();
      if (!/^https?:\/\/\S+$/i.test(url)) return;
      if (out.some((entry) => entry.url === url)) return;
      const title = String(raw.title || raw.name || "").trim() || linkHost(url) || url;
      out.push({ title: title.slice(0, 120), url: url, source: linkHost(url) });
    });
    return out.slice(0, LINK_LIMIT);
  }

  // 任务自己带链接就用任务的（助手挑的），否则按标题和分类去目录里找。
  function linksForTask(task) {
    if (!task) return [];
    const stored = normalizeLinks(task.links);
    if (stored.length > 0) return stored;
    return matchArticles(String(task.title || "") + " " + String(task.category || ""), LINK_LIMIT);
  }

  /* ---------- 推荐阅读弹窗 ---------- */

  let linkDialog = null;
  let linkDialogReturn = null;

  function ensureLinkDialog() {
    if (linkDialog) return linkDialog;

    const overlay = el("div", "task-link-overlay");
    overlay.id = "task-link-dialog";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "task-link-dialog-title");

    const panel = el("div", "task-link-panel");
    const head = el("div", "task-link-head");
    const heading = el("h2", "task-link-dialog-title");
    heading.id = "task-link-dialog-title";
    const close = el("button", "task-link-close", "×");
    close.type = "button";
    close.dataset.role = "link-close";
    close.setAttribute("aria-label", "关闭推荐阅读");
    head.append(heading, close);

    const note = el("p", "task-link-note");
    note.dataset.role = "link-note";
    const list = el("ul", "task-link-list");
    list.dataset.role = "link-list";

    panel.append(head, note, list);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-role=link-close]")) closeLinkDialog();
    });

    document.body.append(overlay);
    linkDialog = overlay;
    return overlay;
  }

  function openLinkDialog(task) {
    if (!task) return false;
    const links = linksForTask(task);
    return openLinkList(task.title, links, {
      empty: "没找到对得上的延伸阅读。标题写具体一点，或者填上模型接口让助手来找。",
      taskId: task.id
    });
  }

  // 目标节点也复用这个弹窗，所以拆出「标题 + 链接数组」的版本。
  function openLinkList(title, links, options) {
    const config = options || {};
    const overlay = ensureLinkDialog();
    const heading = overlay.querySelector("#task-link-dialog-title");
    const note = overlay.querySelector("[data-role=link-note]");
    const list = overlay.querySelector("[data-role=link-list]");
    const items = normalizeLinks(links);

    if (heading) heading.textContent = String(title || "推荐阅读");
    if (note) {
      note.textContent =
        items.length > 0
          ? config.note || "都是公开文档，点开是新窗口。"
          : config.empty || "这里还没有可推荐的资料。";
    }
    if (list) {
      list.replaceChildren();
      items.forEach((link) => {
        const item = el("li", "task-link-item");
        const anchor = el("a", "task-link", link.title);
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        item.append(anchor);
        const host = link.source || linkHost(link.url);
        if (host) item.append(el("span", "task-link-host", host));
        list.append(item);
      });
    }

    linkDialogReturn = document.activeElement;
    overlay.hidden = false;
    overlay.dataset.taskId = config.taskId || "";
    const focusTarget = overlay.querySelector(".task-link-close");
    if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus();
    return true;
  }

  function closeLinkDialog() {
    if (!linkDialog || linkDialog.hidden) return false;
    linkDialog.hidden = true;
    linkDialog.dataset.taskId = "";
    const back = linkDialogReturn;
    linkDialogReturn = null;
    if (back && typeof back.focus === "function") back.focus();
    return true;
  }

  function linkDialogOpen() {
    return Boolean(linkDialog && !linkDialog.hidden);
  }

  /* ---------- 长期目标 ---------- */

  // 目标里每个节点：{ id, title, brief, deps[], links[], date, done }
  // deps 存的是同一目标内其它节点的 id，整张图必须是 DAG（有环会在 normalize 阶段断掉）。

  function cloneGoal(goal) {
    return JSON.parse(JSON.stringify(goal));
  }

  function findGoal(id) {
    return store.goals.find((goal) => goal.id === id) || null;
  }

  function cleanGoalNode(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const title = String(raw.title || "").trim();
    if (!id || !title) return null;
    const date = String(raw.date || "").trim();
    const node = {
      id: id,
      title: title,
      brief: String(raw.brief || "").trim(),
      deps: (Array.isArray(raw.deps) ? raw.deps : []).map((dep) => String(dep).trim()).filter(Boolean),
      links: normalizeLinks(raw.links),
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
      done: Boolean(raw.done)
    };
    return node;
  }

  // 任务完成 / 恢复时把对应节点点亮或熄灭。
  function setGoalNodeDone(task, done) {
    if (!task || !task.goalId || !task.nodeId) return false;
    const goal = findGoal(task.goalId);
    if (!goal) return false;
    const node = (goal.nodes || []).find((item) => item.id === task.nodeId);
    if (!node) return false;
    node.done = Boolean(done);
    goal.updatedAt = new Date().toISOString();
    return true;
  }

  function createGoal(input) {
    const source = input || {};
    const title = String(source.title || "").trim();
    if (!title) return null;
    const category = registerCategory(source.category || store.settings.defaultCategory) || store.settings.defaultCategory;
    const pace = Number(source.pace);
    const goal = {
      id: newId(),
      title: title,
      detail: String(source.detail || "").trim(),
      category: category,
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(source.startDate || "")) ? String(source.startDate) : todayKey(),
      pace: Number.isFinite(pace) && pace >= 1 && pace <= 8 ? Math.round(pace) : 1,
      nodes: [],
      planSource: "",
      planNote: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.goals.unshift(goal);
    save();
    return goal;
  }

  function updateGoal(id, patch) {
    const goal = findGoal(id);
    if (!goal) return null;
    const source = patch || {};
    if (source.title !== undefined) {
      const title = String(source.title).trim();
      if (!title) return null;
      goal.title = title;
    }
    if (source.detail !== undefined) goal.detail = String(source.detail || "").trim();
    if (source.category !== undefined) goal.category = registerCategory(source.category) || goal.category;
    if (source.startDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(source.startDate))) goal.startDate = String(source.startDate);
    if (source.pace !== undefined) {
      const pace = Number(source.pace);
      if (Number.isFinite(pace) && pace >= 1 && pace <= 8) goal.pace = Math.round(pace);
    }
    if (source.planNote !== undefined) goal.planNote = String(source.planNote || "").trim();
    if (source.planSource !== undefined) goal.planSource = String(source.planSource || "").trim();
    if (source.nodes !== undefined) {
      const nodes = (Array.isArray(source.nodes) ? source.nodes : []).map(cleanGoalNode).filter(Boolean);
      // 重规划时节点 id 会变，标题没变的沿用原来的完成状态
      const previous = new Map((goal.nodes || []).map((node) => [node.title, Boolean(node.done)]));
      goal.nodes = nodes.map((node) => Object.assign({}, node, { done: node.done || previous.get(node.title) === true }));
    }
    goal.updatedAt = new Date().toISOString();
    save();
    return goal;
  }

  function removeGoal(id, options) {
    const index = store.goals.findIndex((goal) => goal.id === id);
    if (index === -1) return false;
    store.goals.splice(index, 1);
    if (options && options.withTasks) {
      // 完成过的节点任务躺在回收站里，也得一起清掉
      store.tasks = store.tasks.filter((task) => task.goalId !== id);
      store.trash = store.trash.filter((task) => task.goalId !== id);
    }
    save();
    return true;
  }

  function goalTasks(goalId) {
    return store.tasks.filter((task) => task.goalId === goalId);
  }

  // 按节点补任务：已有对应节点任务的不动，节点没了的老任务清掉。
  function syncGoalTasks(goalId) {
    const goal = findGoal(goalId);
    if (!goal) return [];
    const ids = new Set((goal.nodes || []).map((node) => node.id));
    const stale = new Set(
      store.tasks.filter((task) => task.goalId === goalId && !ids.has(task.nodeId)).map((task) => task.id)
    );
    if (stale.size > 0) store.tasks = store.tasks.filter((task) => !stale.has(task.id));
    const existing = new Map(
      store.tasks.filter((task) => task.goalId === goalId).map((task) => [task.nodeId, task])
    );
    const created = [];
    (goal.nodes || []).forEach((node) => {
      const task = existing.get(node.id);
      if (task) {
        // 节点改名、换日期或换了资料，对应的任务跟着走
        const title = "【" + goal.title + "】" + node.title;
        if (task.title !== title) task.title = title;
        if (task.date !== (node.date || "")) task.date = node.date || "";
        if (node.links && node.links.length > 0) task.links = normalizeLinks(node.links);
        return;
      }
      const fresh = createTask({
        title: "【" + goal.title + "】" + node.title,
        category: goal.category,
        urgency: "normal",
        date: node.date,
        links: node.links,
        source: "goal",
        goalId: goal.id,
        nodeId: node.id
      });
      if (fresh) created.push(fresh);
    });
    save();
    return created;
  }

  function toggleGoalNode(goalId, nodeId, done) {
    const goal = findGoal(goalId);
    if (!goal) return null;
    const node = (goal.nodes || []).find((item) => item.id === nodeId);
    if (!node) return null;
    node.done = done === undefined ? !node.done : Boolean(done);
    goal.updatedAt = new Date().toISOString();
    const task = store.tasks.concat(store.trash).find((item) => item.goalId === goalId && item.nodeId === nodeId);
    if (task) {
      if (node.done && !task.trashReason) completeTask(task.id, "done");
      else if (!node.done && task.trashReason) restoreTask(task.id);
    }
    save();
    return node.done;
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
    const links = normalizeLinks(input && input.links);
    if (links.length > 0) task.links = links;
    // 目标节点生成的 task 会记住自己属于哪个目标的哪个节点，完成时好把节点点亮。
    if (input && input.goalId) {
      task.goalId = String(input.goalId);
      if (input.nodeId) task.nodeId = String(input.nodeId);
    }
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
    if (task.trashReason === "done") setGoalNodeDone(task, true);
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
    setGoalNodeDone(task, false);
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
    if (patch.links !== undefined) {
      const links = normalizeLinks(patch.links);
      if (links.length > 0) task.links = links;
      else delete task.links;
    }
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
    const task = {
      id: newId(),
      title: "今日知识点：" + point,
      category: DAILY_CATEGORY,
      urgency: "low",
      date: today,
      source: "daily",
      createdAt: new Date().toISOString()
    };
    // 每天顺手把匹配到的延伸阅读挂在任务上，点任务卡片就能看。
    const links = matchArticles(point, LINK_LIMIT);
    if (links.length > 0) task.links = links;
    store.tasks.push(task);
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
    body.dataset.action = "open-links";
    body.dataset.id = task.id;
    const title = el("button", "task-title task-title-btn", task.title);
    title.type = "button";
    title.dataset.action = "open-links";
    title.dataset.id = task.id;
    title.title = "看推荐阅读";
    title.setAttribute("aria-label", "查看「" + task.title + "」的推荐阅读");
    body.append(title);
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

    renderAgentPanel();

    const addCategory = document.getElementById("task-category");
    if (addCategory && !addCategory.value) addCategory.value = store.settings.defaultCategory;
  }

  function renderAgentPanel() {
    const setup = document.getElementById("agent-setup");
    const summary = document.getElementById("agent-summary");
    const gate = document.getElementById("agent-gate");
    if (!setup && !summary) return;

    const configured = agentConfigured();
    const editing = state.agent.unlocked || !configured;

    const endpoint = document.getElementById("agent-endpoint");
    if (endpoint) endpoint.value = store.settings.agentEndpoint || "";

    const baseInput = document.getElementById("agent-base");
    if (baseInput) baseInput.value = store.settings.agentBaseUrl || "";

    const modelInput = document.getElementById("agent-model");
    if (modelInput) modelInput.value = store.settings.agentModel || "";

    const keyInput = document.getElementById("agent-key");
    if (keyInput && editing && !keyInput.value) keyInput.value = readAgentKey();

    const rememberBox = document.getElementById("agent-remember-key");
    if (rememberBox) rememberBox.checked = Boolean(store.settings.agentRememberKey);

    // 密码门开着的时候先把表单收起来，过了门再露出来
    if (setup) setup.hidden = !editing || Boolean(state.agent.gate);
    if (summary) summary.hidden = editing || Boolean(state.agent.gate);

    const summaryTitle = document.getElementById("agent-summary-title");
    const summaryDetail = document.getElementById("agent-summary-detail");
    if (summaryTitle) {
      const model = String(store.settings.agentModel || "").trim();
      summaryTitle.textContent = configured
        ? "已连接" + (model ? " · " + model : "")
        : "还没配置助手";
    }
    if (summaryDetail) {
      const pieces = [];
      const base = String(store.settings.agentBaseUrl || "").trim();
      const custom = String(store.settings.agentEndpoint || "").trim();
      if (base) pieces.push(base);
      if (custom) pieces.push("自定义接口 " + custom);
      pieces.push(readAgentKey() ? "密钥已保存" : "无密钥");
      if (hasAgentPassword()) pieces.push("已设密码");
      if (store.settings.agentVerifiedAt) pieces.push("验证于 " + String(store.settings.agentVerifiedAt).slice(0, 16).replace("T", " "));
      summaryDetail.textContent = pieces.join(" · ");
    }

    const collapseButton = document.getElementById("agent-collapse");
    if (collapseButton) collapseButton.hidden = !configured || !state.agent.unlocked;

    if (gate) gate.hidden = !state.agent.gate;
    const setting = state.agent.gate === "set";
    const confirmField = document.getElementById("agent-pw-confirm-field");
    if (confirmField) confirmField.hidden = !setting;
    if (!state.agent.gate) {
      // 门关着就把密码框清空，免得残留上一次的输入
      ["agent-password", "agent-password-confirm"].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = "";
      });
    }
    if (state.agent.gate) {
      const hint = document.getElementById("agent-gate-hint");
      const label = document.getElementById("agent-pw-label");
      const submit = document.getElementById("agent-gate-submit");
      if (hint) {
        hint.textContent = setting
          ? "第一次进设置，先定一个密码。以后改这些设置都要先输它，密码只在本机保存哈希值。"
          : "改这些设置要先输密码。";
      }
      if (label) label.textContent = setting ? "设置密码" : "密码";
      if (submit) submit.textContent = setting ? "保存密码并继续" : "解锁";
      const passwordInput = document.getElementById("agent-password");
      if (passwordInput && typeof passwordInput.focus === "function") passwordInput.focus();
    }
  }

  async function submitAgentGate() {
    const passwordInput = document.getElementById("agent-password");
    const confirmInput = document.getElementById("agent-password-confirm");
    const status = document.getElementById("agent-gate-status");
    const password = passwordInput ? passwordInput.value : "";
    const fail = (message) => {
      if (status) status.textContent = message;
      if (passwordInput) passwordInput.value = "";
    };

    if (status) status.textContent = "处理中…";
    try {
      if (!hasAgentPassword()) {
        if (password.length < AGENT_PASSWORD_MIN) {
          fail("密码至少 " + AGENT_PASSWORD_MIN + " 位。");
          return;
        }
        if (password !== (confirmInput ? confirmInput.value : "")) {
          fail("两次输入不一样。");
          return;
        }
        const salt = newSalt();
        const hash = await hashPassword(password, salt);
        updateSettings({ agentPasswordSalt: salt, agentPasswordHash: hash });
      } else {
        const hash = await hashPassword(password, store.settings.agentPasswordSalt);
        if (hash !== store.settings.agentPasswordHash) {
          fail("密码不对。");
          return;
        }
      }
      state.agent.unlocked = true;
      state.agent.gate = "";
      if (passwordInput) passwordInput.value = "";
      if (confirmInput) confirmInput.value = "";
      if (status) status.textContent = "";
      renderAll();
    } catch (error) {
      if (status) status.textContent = String(error.message || error);
    }
  }

  function downloadAgentEnv() {
    const blob = new Blob([agentEnvText()], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = AGENT_ENV_FILE;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return AGENT_ENV_FILE;
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
    const catalog = ARTICLE_SOURCES.map((entry) => "- " + entry.title + "  " + entry.url).join("\n");
    return [
      "你是一个任务规划助手，把用户说的话拆成可执行的任务。",
      "今天是 " + today + "（星期" + weekday + "）。",
      "category 必须从这些里选一个：" + names.join("、") + "；拿不准就用 " + store.settings.defaultCategory + "。",
      "urgency 只能是 urgent / high / normal / low 之一，分别代表紧急 / 重要 / 普通 / 不急。",
      "date 用 YYYY-MM-DD，只在确实和日期有关时才给，今天就是 " + today + "；不确定就省略这个字段。",
      "已经有这些任务，不要重复添加：" + (existing.length > 0 ? existing.join("；") : "（还没有）"),
      "如果用户是在问问题（例如今天有什么任务、这周该怎么安排），就把回答写进 reply，不要凭空造任务。",
      "如果任务是学某个知识点，或者用户让你找资料、推荐文章，就给这个任务挑 1-3 条延伸阅读，只能从下面这份目录里选，url 原样照抄，不要自己编：",
      catalog,
      "如果目录里没有对得上的，links 就给空数组。",
      '只输出一个 JSON 对象，不要写解释，也不要用 markdown 代码块。格式是：{"reply": "给用户看的一两句话", "tasks": [{"title": "任务标题", "category": "分类", "urgency": "normal", "date": "YYYY-MM-DD", "links": [{"title": "文档名", "url": "https://..."}]}]}',
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
          date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
          links: normalizeLinks(item.links)
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

  // 低层入口：自己拼 messages，拿回模型的正文。目标页规划计划时用它。
  async function agentChat(messages, options) {
    const config = options || {};
    const body = { temperature: config.temperature === undefined ? 0.2 : config.temperature, messages: messages };
    if (config.maxTokens) body.max_tokens = config.maxTokens;
    return agentFetch(body);
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
        links: item.links,
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
    renderAgentPanel();
    // 目标页挂在同一个 store 上，改完数据广播一声让它自己重画。
    if (typeof document.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
      document.dispatchEvent(new window.CustomEvent("spasre:change"));
    }
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
    } else if (action === "open-links") {
      const task = store.tasks.find((item) => item.id === id);
      if (task) openLinkDialog(task);
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
      endpoint.addEventListener("change", () => {
        updateSettings({ agentEndpoint: endpoint.value.trim() });
        if (endpoint.value.trim()) updateSettings({ agentSetupDone: true });
        renderAll();
      });
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
          // 测试过了就把凭据收起来，避免一直摊在页面上
          updateSettings({ agentSetupDone: true, agentVerifiedAt: new Date().toISOString() });
          state.agent.unlocked = false;
          state.agent.gate = "";
          if (status) status.textContent = message + " 凭据已收好，要改点「设置」。";
          renderAll();
        } catch (error) {
          if (status) status.textContent = String(error.message || error);
        } finally {
          testButton.disabled = false;
        }
      });
    }

    const collapseButton = document.getElementById("agent-collapse");
    if (collapseButton) {
      collapseButton.addEventListener("click", () => {
        state.agent.unlocked = false;
        state.agent.gate = "";
        renderAll();
      });
    }

    const editButton = document.getElementById("agent-edit");
    if (editButton) {
      editButton.addEventListener("click", () => {
        state.agent.gate = hasAgentPassword() ? "enter" : "set";
        const status = document.getElementById("agent-gate-status");
        if (status) status.textContent = "";
        renderAgentPanel();
      });
    }

    const gateSubmit = document.getElementById("agent-gate-submit");
    if (gateSubmit) {
      gateSubmit.addEventListener("click", () => {
        submitAgentGate();
      });
    }

    const gateCancel = document.getElementById("agent-gate-cancel");
    if (gateCancel) {
      gateCancel.addEventListener("click", () => {
        state.agent.gate = "";
        const passwordInput = document.getElementById("agent-password");
        const confirmInput = document.getElementById("agent-password-confirm");
        if (passwordInput) passwordInput.value = "";
        if (confirmInput) confirmInput.value = "";
        renderAll();
      });
    }

    ["agent-password", "agent-password-confirm"].forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitAgentGate();
        }
      });
    });

    const exportButton = document.getElementById("agent-export");
    if (exportButton) {
      exportButton.addEventListener("click", () => {
        const status = document.getElementById("agent-status");
        const name = downloadAgentEnv();
        if (status) status.textContent = "已导出 " + name + "，存到本地后可以改名叫 .env（.gitignore 已经忽略，不会提交）。";
      });
    }

    const importButton = document.getElementById("agent-import");
    const importFile = document.getElementById("agent-import-file");
    if (importButton && importFile) {
      importButton.addEventListener("click", () => importFile.click());
      importFile.addEventListener("change", async () => {
        const status = document.getElementById("agent-status");
        const file = importFile.files && importFile.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const ok = applyAgentEnv(parseAgentEnv(text));
          if (status) status.textContent = ok ? "已从 " + file.name + " 读入配置。" : "读到了文件，但里面没有完整的接口地址和模型名。";
        } catch (error) {
          if (status) status.textContent = "读不了这个文件：" + String(error.message || error);
        } finally {
          importFile.value = "";
          renderAll();
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

  function wireLinkDialog() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !linkDialogOpen()) return;
      event.preventDefault();
      closeLinkDialog();
    });
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
  ensureLinkDialog();
  wireHome();
  wireBoard();
  wireLinkDialog();
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
      if (config.setupDone !== undefined) patch.agentSetupDone = Boolean(config.setupDone);
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
    agentConfigured: agentConfigured,
    hasAgentPassword: hasAgentPassword,
    agentEnvText: agentEnvText,
    importAgentEnv: function (text) {
      const ok = applyAgentEnv(parseAgentEnv(text));
      renderAll();
      return ok;
    },
    exportAgentEnv: downloadAgentEnv,
    unlockAgent: function (password) {
      return (async () => {
        if (!hasAgentPassword()) {
          const salt = newSalt();
          const hash = await hashPassword(password, salt);
          updateSettings({ agentPasswordSalt: salt, agentPasswordHash: hash });
        } else {
          const hash = await hashPassword(password, store.settings.agentPasswordSalt);
          if (hash !== store.settings.agentPasswordHash) return false;
        }
        state.agent.unlocked = true;
        state.agent.gate = "";
        renderAll();
        return true;
      })();
    },
    lockAgent: function () {
      state.agent.unlocked = false;
      state.agent.gate = "";
      renderAll();
    },
    requestPlan: requestPlan,
    ask: ask,
    plan: localPlan,
    answer: localAnswer,
    linksFor: function (id) {
      const task = store.tasks.concat(store.trash).find((item) => item.id === id);
      return task ? linksForTask(task) : [];
    },
    matchArticles: matchArticles,
    openLinks: function (id) {
      const task = store.tasks.concat(store.trash).find((item) => item.id === id);
      return openLinkDialog(task);
    },
    closeLinks: closeLinkDialog,
    linksOpen: linkDialogOpen,
    openLinkList: function (title, links, options) {
      return openLinkList(title, links, options);
    },
    articleSources: function () {
      return ARTICLE_SOURCES.map((entry) => ({ title: entry.title, url: entry.url }));
    },
    refresh: renderAll,
    goals: function () {
      return store.goals.map(cloneGoal);
    },
    goal: function (id) {
      const goal = findGoal(id);
      return goal ? cloneGoal(goal) : null;
    },
    addGoal: function (input) {
      const goal = createGoal(input);
      renderAll();
      return goal ? cloneGoal(goal) : null;
    },
    updateGoal: function (id, patch) {
      const goal = updateGoal(id, patch);
      renderAll();
      return goal ? cloneGoal(goal) : null;
    },
    removeGoal: function (id, options) {
      const ok = removeGoal(id, options);
      renderAll();
      return ok;
    },
    goalTasks: function (goalId) {
      return goalTasks(goalId);
    },
    syncGoalTasks: function (goalId) {
      const created = syncGoalTasks(goalId);
      renderAll();
      return created;
    },
    toggleGoalNode: function (goalId, nodeId, done) {
      const value = toggleGoalNode(goalId, nodeId, done);
      renderAll();
      return value;
    },
    agentChat: agentChat
  };
})();
