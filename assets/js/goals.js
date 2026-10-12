/* 长期目标页：把一条长期目标拆成知识点图（DAG），再摊成每天的任务。
   数据存在 tasks.js 的同一个 store 里（localStorage），所以任务板上勾掉一条
   任务，这张图上的节点就会跟着点亮。 */
(function () {
  "use strict";

  const api = window.spasreTasks;
  if (!api) {
    console.warn("目标页需要 tasks.js 先加载。");
    return;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const NODE_W = 168;
  const NODE_H = 68;
  const H_GAP = 26;
  const V_GAP = 62;
  const PAD = 18;
  const TITLE_UNITS = 12;
  const TITLE_LINES = 2;
  const MAX_NODES = 40;
  const MAX_DEPS = 6;

  const state = { editingId: "" };

  /* ---------- 小工具 ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svgEl(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, String(attrs[key])));
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function chip(text, className) {
    return el("span", "task-chip" + (className ? " " + className : ""), text);
  }

  function setStatus(text) {
    const node = document.getElementById("goal-status");
    if (node) node.textContent = String(text || "");
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function shiftDate(key, days) {
    const parts = String(key || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return String(key || "");
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + days);
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  /* ---------- DAG：清洗、拓扑序、分层 ---------- */

  // 只保留能用的节点：补 id、去重、丢掉不认识的前置、断掉环。
  function sanitizeNodes(list) {
    const raw = Array.isArray(list) ? list : [];
    const used = new Set();
    const nodes = [];
    raw.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const title = String(item.title || item.name || "").trim();
      if (!title) return;
      let id = String(item.id || "").trim();
      if (!id || used.has(id)) id = "n" + (nodes.length + 1);
      while (used.has(id)) id += "_";
      used.add(id);
      const date = String(item.date || "").trim();
      nodes.push({
        id: id,
        title: title,
        brief: String(item.brief || item.detail || "").trim(),
        rawDeps: Array.isArray(item.deps) ? item.deps : [],
        links: item.links,
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
        done: Boolean(item.done)
      });
    });

    const ids = new Set(nodes.map((node) => node.id));
    nodes.forEach((node) => {
      const seen = [];
      node.rawDeps.forEach((dep) => {
        const key = String(dep || "").trim();
        if (!key || key === node.id || !ids.has(key) || seen.includes(key)) return;
        seen.push(key);
      });
      node.deps = seen;
      delete node.rawDeps;
    });
    return breakCycles(nodes);
  }

  // DFS 断回边：保证结果一定是 DAG，不然分层会算不出来。
  function breakCycles(nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const color = new Map();
    const visit = (node) => {
      color.set(node.id, 1);
      const kept = [];
      node.deps.forEach((dep) => {
        const parent = byId.get(dep);
        if (!parent) return;
        const mark = color.get(parent.id) || 0;
        if (mark === 1) return;
        if (mark === 0) visit(parent);
        kept.push(dep);
      });
      node.deps = kept;
      color.set(node.id, 2);
    };
    nodes.forEach((node) => {
      if ((color.get(node.id) || 0) === 0) visit(node);
    });
    return nodes;
  }

  // 层号 = 最长前置链的长度，等于「这一层最早能排到第几批」。
  function topoLayers(nodes) {
    const list = Array.isArray(nodes) ? nodes : [];
    const byId = new Map(list.map((node) => [node.id, node]));
    const memo = new Map();
    const depth = (node) => {
      if (memo.has(node.id)) return memo.get(node.id);
      memo.set(node.id, 0);
      let value = 0;
      (node.deps || []).forEach((dep) => {
        const parent = byId.get(dep);
        if (parent && parent !== node) value = Math.max(value, depth(parent) + 1);
      });
      memo.set(node.id, value);
      return value;
    };
    let max = 0;
    list.forEach((node) => {
      max = Math.max(max, depth(node));
    });
    const layers = [];
    for (let index = 0; index <= max; index += 1) layers.push([]);
    list.forEach((node) => layers[depth(node)].push(node));
    return layers.filter((row) => row.length > 0);
  }

  function topoOrder(nodes) {
    return topoLayers(nodes).reduce((acc, row) => acc.concat(row), []);
  }

  // Kahn 算法：全部节点都能出队才说明没有环。
  function isAcyclic(nodes) {
    const list = Array.isArray(nodes) ? nodes : [];
    const byId = new Map(list.map((node) => [node.id, node]));
    const indeg = new Map(list.map((node) => [node.id, 0]));
    list.forEach((node) => {
      (node.deps || []).forEach((dep) => {
        if (byId.has(dep) && dep !== node.id) indeg.set(node.id, indeg.get(node.id) + 1);
      });
    });
    const queue = list.filter((node) => indeg.get(node.id) === 0).map((node) => node.id);
    let seen = 0;
    while (queue.length > 0) {
      const id = queue.shift();
      seen += 1;
      list.forEach((node) => {
        if (!(node.deps || []).includes(id)) return;
        indeg.set(node.id, indeg.get(node.id) - 1);
        if (indeg.get(node.id) === 0) queue.push(node.id);
      });
    }
    return seen === list.length;
  }

  // 按拓扑序铺日期：第 i 个知识点落在 startDate + floor(i / pace) 天。
  // 拓扑序保证前置一定排在前面的日期，所以每天的活不会依赖还没做的活。
  function assignDates(nodes, startDate, pace) {
    const step = Math.max(1, Math.min(8, Math.round(Number(pace) || 1)));
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "")) ? String(startDate) : api.today();
    topoOrder(nodes).forEach((node, index) => {
      node.date = shiftDate(start, Math.floor(index / step));
    });
    return nodes;
  }

  // 分层布局：一层一行，行内水平居中，行间距固定。
  function layoutGoal(nodes) {
    const layers = topoLayers(nodes);
    const cols = layers.reduce((max, row) => Math.max(max, row.length), 0);
    const width = PAD * 2 + cols * NODE_W + Math.max(0, cols - 1) * H_GAP;
    const height = PAD * 2 + layers.length * NODE_H + Math.max(0, layers.length - 1) * V_GAP;
    const placed = new Map();
    layers.forEach((row, rowIndex) => {
      const rowWidth = row.length * NODE_W + Math.max(0, row.length - 1) * H_GAP;
      const startX = PAD + (width - PAD * 2 - rowWidth) / 2;
      row.forEach((node, colIndex) => {
        placed.set(node.id, {
          node: node,
          layer: rowIndex,
          x: startX + colIndex * (NODE_W + H_GAP),
          y: PAD + rowIndex * (NODE_H + V_GAP)
        });
      });
    });
    return { width: width, height: height, layers: layers, placed: placed };
  }

  /* ---------- 内置规划 ---------- */

  function topicOf(text) {
    const raw = String(text || "").trim();
    const stripped = raw
      .replace(/^(?:长期目标|目标|计划)\s*[：:，,、]?\s*/, "")
      .replace(/^(?:系统|好好|认真)?(?:学习|掌握|精通|入门|了解|熟悉|搞懂|研究|练习|提升|进阶|学)\s*/, "")
      .replace(/^[的：:，,、\s]+/, "")
      .trim();
    return stripped || raw || "这个方向";
  }

  // 每层一个数组，层内顺序就是横向顺序；依赖只连到上一层，天然是 DAG。
  function chainLayers(layers) {
    const nodes = [];
    const idsPerLayer = [];
    layers.forEach((row, rowIndex) => {
      const rowIds = row.map((node, colIndex) => {
        const id = "n" + (nodes.length + 1);
        node.id = id;
        node.deps = [];
        if (rowIndex > 0) {
          const prev = idsPerLayer[rowIndex - 1];
          if (prev.length === 1) {
            node.deps = prev.slice();
          } else if (row.length === 1) {
            node.deps = prev.slice();
          } else {
            const same = prev[Math.min(colIndex, prev.length - 1)];
            if (same) node.deps.push(same);
            const left = prev[colIndex - 1];
            if (left && left !== same) node.deps.push(left);
          }
        }
        nodes.push(node);
        return id;
      });
      idsPerLayer.push(rowIds);
    });
    return nodes;
  }

  function localGoalPlan(goal) {
    const topic = topicOf(goal.title);
    const refs = api.matchArticles(goal.title + " " + String(goal.detail || ""), 6);
    const make = (title, brief, links) => ({ title: title, brief: brief, deps: [], links: links || [], date: "", done: false });
    const doc = (ref) => make("读《" + ref.title + "》", ref.title, [ref]);

    const layers = [
      [make("搞清「" + topic + "」的核心概念与术语", "先建立整体印象，别急着抠细节")].concat(refs.slice(0, 2).map(doc)),
      [
        make("跟着资料跑一遍「" + topic + "」的最小例子", "跑通一遍比读十遍管用"),
        make("记下「" + topic + "」容易踩的坑", "把报错和弯路记成清单")
      ],
      [make("弄懂「" + topic + "」最关键的一个机制", "挑一个核心机制，读到能讲给别人听")].concat(refs.slice(2, 4).map(doc)),
      [
        make("用「" + topic + "」完成一个小项目", "范围定小一点，能跑起来就行"),
        make("拿「" + topic + "」解决一个真实问题", "最好是自己手头正烦的那件事")
      ],
      [make("写一篇「" + topic + "」的笔记", "讲清来龙去脉，写不出来的地方就是还没懂")]
    ];
    return chainLayers(layers);
  }

  /* ---------- 交给模型规划 ---------- */

  function parseJson(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1].trim() : raw;
    try {
      return JSON.parse(body);
    } catch (error) {
      /* 模型爱在 JSON 前后加话，下面按括号截取 */
    }
    const pairs = [
      [body.indexOf("{"), body.lastIndexOf("}")],
      [body.indexOf("["), body.lastIndexOf("]")]
    ];
    for (const pair of pairs) {
      if (pair[0] === -1 || pair[1] <= pair[0]) continue;
      try {
        return JSON.parse(body.slice(pair[0], pair[1] + 1));
      } catch (error) {
        /* 试下一种 */
      }
    }
    return null;
  }

  function goalSystemPrompt() {
    const catalog = api.articleSources().map((entry) => "- " + entry.title + "  " + entry.url).join("\n");
    return [
      "你在帮用户把一条长期目标拆成一张学习计划的知识点图（DAG）。",
      "今天是 " + api.today() + "。",
      "只输出一个 JSON 对象，不要写解释，也不要用 markdown 代码块。格式是：",
      '{"reply": "给用户看的一两句话", "nodes": [{"title": "知识点", "brief": "一句话说明", "deps": ["前置知识点的 title"], "links": [{"title": "资料名", "url": "https://..."}]}]}',
      "要求：",
      "1. 8-14 个节点，从打基础一路排到实践和总结。",
      "2. deps 里只能写这份计划里出现过的 title；最基础的节点 deps 给空数组。",
      "3. 学习顺序必须满足拓扑序：每个节点只能依赖排在它前面的节点，绝对不要出现环。",
      "4. links 只能从下面这份目录里挑 0-2 条，url 原样照抄，不要自己编：",
      catalog,
      "目录里没有对得上的就给空数组。"
    ].join("\n");
  }

  // 模型的 deps 可能写成 title，也可能写成 1 开始的序号，两种都认。
  function normalizeModelNodes(raw) {
    const list = (Array.isArray(raw) ? raw : [])
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const title = String(item.title || item.name || "").trim();
        if (!title) return null;
        const deps = Array.isArray(item.deps)
          ? item.deps
          : Array.isArray(item.dependsOn)
          ? item.dependsOn
          : Array.isArray(item.requires)
          ? item.requires
          : [];
        return {
          title: title,
          brief: String(item.brief || item.detail || item.summary || "").trim(),
          deps: deps,
          links: item.links
        };
      })
      .filter(Boolean)
      .slice(0, MAX_NODES);

    const byTitle = new Map();
    list.forEach((node, index) => {
      if (!byTitle.has(node.title)) byTitle.set(node.title, index);
      const lower = node.title.toLowerCase();
      if (!byTitle.has(lower)) byTitle.set(lower, index);
    });

    return list.map((node, index) => {
      const deps = [];
      node.deps.forEach((dep) => {
        let target = -1;
        if (typeof dep === "number" && Number.isFinite(dep)) {
          const guess = dep >= 1 && dep <= list.length ? dep - 1 : dep >= 0 && dep < list.length ? dep : -1;
          target = guess;
        } else {
          const text = String(dep || "").trim();
          if (!text) return;
          if (byTitle.has(text)) target = byTitle.get(text);
          else if (byTitle.has(text.toLowerCase())) target = byTitle.get(text.toLowerCase());
        }
        if (target < 0 || target === index) return;
        const id = "m" + (target + 1);
        if (!deps.includes(id)) deps.push(id);
      });
      return {
        id: "m" + (index + 1),
        title: node.title,
        brief: node.brief,
        deps: deps.slice(0, MAX_DEPS),
        links: node.links,
        date: "",
        done: false
      };
    });
  }

  async function modelGoalPlan(goal) {
    const content = await api.agentChat(
      [
        { role: "system", content: goalSystemPrompt() },
        {
          role: "user",
          content:
            "长期目标：" +
            goal.title +
            (goal.detail ? "\n补充说明：" + goal.detail : "") +
            "\n请把它拆成一张学习计划的知识点图。"
        }
      ],
      { temperature: 0.3, maxTokens: 2400 }
    );
    const parsed = parseJson(content);
    const raw = parsed && Array.isArray(parsed.nodes) ? parsed.nodes : Array.isArray(parsed) ? parsed : [];
    const nodes = sanitizeNodes(normalizeModelNodes(raw));
    if (nodes.length === 0) throw new Error("模型没给出可用的知识点");
    const note = parsed && typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    return { nodes: nodes, note: note };
  }

  /* ---------- 排计划 ---------- */

  async function planGoal(goalId) {
    const goal = api.goal(goalId);
    if (!goal) return null;
    setStatus("正在排「" + goal.title + "」的学习计划…");
    let nodes = null;
    let note = "";
    let source = "local";

    if (api.agentConfigured()) {
      try {
        const result = await modelGoalPlan(goal);
        nodes = result.nodes;
        note = result.note;
        source = "api";
      } catch (error) {
        note = "模型这次没给出计划（" + (error && error.message ? error.message : "未知错误") + "），先用内置规划顶上。";
      }
    }

    if (!nodes || nodes.length === 0) {
      nodes = localGoalPlan(goal);
      source = "local";
      if (!note) {
        note = "内置规划按「打基础 → 上手练习 → 深入原理 → 综合实践 → 输出总结」五步排，顺序满足拓扑序。填上模型接口后会改由你自己的模型来排。";
      }
    }

    const paced = assignDates(nodes, goal.startDate, goal.pace);
    const saved = api.updateGoal(goalId, { nodes: paced, planSource: source, planNote: note });
    const created = api.syncGoalTasks(goalId);
    setStatus(
      "排好了：" +
        paced.length +
        " 个知识点" +
        (created.length > 0 ? "，顺手加了 " + created.length + " 条每日任务" : "") +
        "。点节点标记完成，再点一下取消。"
    );
    return saved;
  }

  /* ---------- 文字换行（SVG 里得自己折行） ---------- */

  function textUnits(text) {
    let width = 0;
    Array.from(String(text || "")).forEach((char) => {
      width += /[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f]/.test(char) ? 1 : 0.56;
    });
    return width;
  }

  function wrapText(text, maxUnits, maxLines) {
    const chars = Array.from(String(text || "").trim());
    const lines = [];
    let current = "";
    let truncated = false;
    for (const char of chars) {
      if (current && textUnits(current + char) > maxUnits) {
        if (lines.length === maxLines - 1) {
          truncated = true;
          break;
        }
        lines.push(current);
        current = "";
      }
      current += char;
    }
    if (truncated) {
      let last = current;
      while (last && textUnits(last + "…") > maxUnits) last = last.slice(0, -1);
      lines.push(last + "…");
    } else if (current) {
      lines.push(current);
    }
    if (lines.length === 0) lines.push("");
    return lines.slice(0, maxLines);
  }

  /* ---------- 渲染 ---------- */

  function goalGraph(goal) {
    const nodes = goal.nodes || [];
    const wrap = el("div", "goal-graph-wrap");
    if (nodes.length === 0) {
      wrap.append(el("p", "task-empty", "还没有计划，点「重新规划」让助手排一张知识点图。"));
      return wrap;
    }

    const layout = layoutGoal(nodes);
    const doneCount = nodes.filter((node) => node.done).length;
    const svg = svgEl("svg", {
      class: "goal-graph",
      viewBox: "0 0 " + layout.width + " " + layout.height,
      width: layout.width,
      height: layout.height,
      role: "img",
      "aria-label": goal.title + " 的知识点图：" + nodes.length + " 个节点，已完成 " + doneCount + " 个"
    });

    const edgeLayer = svgEl("g", { class: "goal-edges" });
    layout.placed.forEach((place) => {
      (place.node.deps || []).forEach((dep) => {
        const from = layout.placed.get(dep);
        if (!from) return;
        const lit = from.node.done;
        const x1 = from.x + NODE_W / 2;
        const y1 = from.y + NODE_H;
        const x2 = place.x + NODE_W / 2;
        const y2 = place.y;
        const mid = (y1 + y2) / 2;
        edgeLayer.append(
          svgEl("path", {
            class: "goal-edge" + (lit ? " is-lit" : ""),
            d: "M" + x1 + " " + y1 + " C" + x1 + " " + mid + " " + x2 + " " + mid + " " + x2 + " " + y2
          })
        );
        edgeLayer.append(
          svgEl("polygon", {
            class: "goal-arrow" + (lit ? " is-lit" : ""),
            points: x2 - 5 + "," + (y2 - 9) + " " + (x2 + 5) + "," + (y2 - 9) + " " + x2 + "," + (y2 - 2)
          })
        );
      });
    });
    svg.append(edgeLayer);

    const nodeLayer = svgEl("g", { class: "goal-nodes" });
    const badgeLayer = svgEl("g", { class: "goal-badges" });

    layout.placed.forEach((place) => {
      const node = place.node;
      const ready = (node.deps || []).every((dep) => {
        const parent = layout.placed.get(dep);
        return !parent || parent.node.done;
      });
      const stateClass = node.done ? "is-done" : ready ? "is-ready" : "is-locked";
      const group = svgEl("g", {
        class: "goal-node " + stateClass,
        role: "button",
        tabindex: "0",
        "aria-label": (node.done ? "已完成：" : "未完成：") + node.title
      });
      group.dataset.action = "goal-node";
      group.dataset.id = goal.id;
      group.dataset.node = node.id;
      group.append(
        svgEl("title", null, node.title + (node.brief ? " —— " + node.brief : "") + "（" + (node.done ? "已完成" : "未完成") + "）")
      );
      group.append(svgEl("rect", { class: "goal-node-box", x: place.x, y: place.y, width: NODE_W, height: NODE_H, rx: 12 }));

      const lines = wrapText(node.title, TITLE_UNITS, TITLE_LINES);
      const text = svgEl("text", { class: "goal-node-text", x: place.x + 12, y: place.y + 22 });
      lines.forEach((line, index) => {
        text.append(svgEl("tspan", { x: place.x + 12, dy: index === 0 ? 0 : 15 }, line));
      });
      group.append(text);
      if (node.date) {
        group.append(svgEl("text", { class: "goal-node-date", x: place.x + 12, y: place.y + 59 }, node.date.slice(5)));
      }
      nodeLayer.append(group);

      if ((node.links || []).length > 0) {
        const badge = svgEl("g", {
          class: "goal-node-badge",
          role: "button",
          tabindex: "0",
          "aria-label": "查看「" + node.title + "」的推荐资料"
        });
        badge.dataset.action = "goal-links";
        badge.dataset.id = goal.id;
        badge.dataset.node = node.id;
        badge.append(
          svgEl("rect", {
            class: "goal-node-badge-box",
            x: place.x + NODE_W - 46,
            y: place.y + 46,
            width: 38,
            height: 18,
            rx: 9
          })
        );
        badge.append(
          svgEl("text", { class: "goal-node-badge-text", x: place.x + NODE_W - 27, y: place.y + 59 }, "资料")
        );
        badgeLayer.append(badge);
      }
    });

    svg.append(nodeLayer);
    svg.append(badgeLayer);
    wrap.append(svg);
    return wrap;
  }

  function goalCard(goal) {
    const nodes = goal.nodes || [];
    const done = nodes.filter((node) => node.done).length;
    const card = el("article", "goal-card");
    card.dataset.id = goal.id;

    const head = el("div", "goal-head");
    const heading = el("div", "goal-heading");
    heading.append(el("h3", "goal-title", goal.title));
    const meta = el("div", "goal-meta");
    meta.append(chip(goal.category, "chip-category"));
    meta.append(chip("开始 " + goal.startDate, "chip-date"));
    meta.append(chip("每天 " + goal.pace + " 个"));
    meta.append(chip(done + " / " + nodes.length + " 完成", done > 0 && done === nodes.length ? "chip-done" : ""));
    if (goal.planSource === "api") meta.append(chip("模型规划", "chip-agent"));
    else if (goal.planSource === "local") meta.append(chip("内置规划", ""));
    heading.append(meta);
    head.append(heading);

    const actions = el("div", "task-actions");
    [
      ["goal-plan", "重新规划", false],
      ["goal-tasks", "同步任务", false],
      ["goal-edit", "编辑", false],
      ["goal-remove", "删除", true]
    ].forEach((entry) => {
      const button = el("button", "task-action" + (entry[2] ? " task-action-danger" : ""), entry[1]);
      button.type = "button";
      button.dataset.action = entry[0];
      button.dataset.id = goal.id;
      actions.append(button);
    });
    head.append(actions);
    card.append(head);

    if (goal.detail) card.append(el("p", "goal-detail", goal.detail));

    const bar = el("div", "goal-progress");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(nodes.length));
    bar.setAttribute("aria-valuenow", String(done));
    bar.setAttribute("aria-label", goal.title + " 的完成进度");
    const fill = el("span", "goal-progress-fill");
    fill.style.width = nodes.length > 0 ? Math.round((done / nodes.length) * 100) + "%" : "0%";
    bar.append(fill);
    card.append(bar);

    card.append(goalGraph(goal));
    if (goal.planNote) card.append(el("p", "goal-note", goal.planNote));
    return card;
  }

  function renderGoals() {
    const root = document.getElementById("goal-list");
    if (!root) return;
    renderCategoryOptions();
    const list = api.goals();
    const summary = document.getElementById("goal-summary");
    root.replaceChildren();

    if (list.length === 0) {
      root.append(el("p", "task-empty", "还没有长期目标。上面填一条，助手会把它拆成一张知识点图，再摊成每天的任务。"));
      if (summary) summary.textContent = "";
      return;
    }
    if (summary) {
      const nodes = list.reduce((sum, goal) => sum + (goal.nodes || []).length, 0);
      const done = list.reduce((sum, goal) => sum + (goal.nodes || []).filter((node) => node.done).length, 0);
      summary.textContent = list.length + " 个目标 · " + nodes + " 个知识点 · 已完成 " + done + " 个";
    }
    list.forEach((goal) => root.append(goalCard(goal)));
  }

  function renderCategoryOptions() {
    const list = document.getElementById("goal-category-options");
    if (!list) return;
    list.replaceChildren();
    api.categories().forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      list.append(option);
    });
  }

  function renderAgentHint() {
    const hint = document.getElementById("goal-agent-hint");
    if (!hint) return;
    hint.textContent = api.agentConfigured()
      ? "已经配好模型接口，规划交给你的模型来做：它负责挑资料、定顺序、给节点。"
      : "还没配模型接口，现在用的是内置规划（按主题关键词从站内文档目录里挑资料）。想让它按你自己的思路来，去任务板的「助手」里填接口地址和模型名。";
  }

  /* ---------- 表单 ---------- */

  function fillGoalForm(goal) {
    const form = document.getElementById("goal-form");
    if (!form || !goal) return;
    form.elements.title.value = goal.title;
    form.elements.detail.value = goal.detail || "";
    form.elements.category.value = goal.category || "";
    form.elements.startDate.value = goal.startDate || api.today();
    form.elements.pace.value = String(goal.pace || 1);
    state.editingId = goal.id;
    const submit = form.querySelector("[type=submit]");
    if (submit) submit.textContent = "保存目标";
    const cancel = document.getElementById("goal-cancel");
    if (cancel) cancel.hidden = false;
    if (typeof form.scrollIntoView === "function") form.scrollIntoView({ block: "center" });
    form.elements.title.focus();
  }

  function resetGoalForm() {
    state.editingId = "";
    const form = document.getElementById("goal-form");
    if (!form) return;
    form.reset();
    if (form.elements.startDate) form.elements.startDate.value = api.today();
    const submit = form.querySelector("[type=submit]");
    if (submit) submit.textContent = "添加目标";
    const cancel = document.getElementById("goal-cancel");
    if (cancel) cancel.hidden = true;
  }

  function readGoalForm(form) {
    const pace = Number(form.elements.pace.value);
    return {
      title: String(form.elements.title.value || "").trim(),
      detail: String(form.elements.detail.value || "").trim(),
      category: String(form.elements.category.value || "").trim(),
      startDate: String(form.elements.startDate.value || "").trim() || api.today(),
      pace: Number.isFinite(pace) && pace >= 1 && pace <= 8 ? Math.round(pace) : 1
    };
  }

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = readGoalForm(form);
    if (!values.title) {
      setStatus("先写一个目标，比如「学习 LLVM 优化」。");
      form.elements.title.focus();
      return;
    }

    if (state.editingId) {
      const id = state.editingId;
      const before = api.goal(id);
      const updated = api.updateGoal(id, values);
      resetGoalForm();
      if (!updated) {
        setStatus("没保存成功，标题不能为空。");
        return;
      }
      if ((before.nodes || []).length === 0) {
        await planGoal(id);
        return;
      }
      // 图本身不动，只把日期按新的开始时间和节奏重铺一遍
      api.updateGoal(id, { nodes: assignDates(updated.nodes || [], updated.startDate, updated.pace) });
      api.syncGoalTasks(id);
      setStatus("改好了，日期按新的节奏重铺了一遍。");
      return;
    }

    const goal = api.addGoal(values);
    resetGoalForm();
    if (!goal) {
      setStatus("没建成，标题不能为空。");
      return;
    }
    await planGoal(goal.id);
  }

  /* ---------- 事件 ---------- */

  function handleAction(event) {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;
    const id = trigger.dataset.id;

    if (action === "goal-node") {
      const done = api.toggleGoalNode(id, trigger.dataset.node);
      if (done === null) return;
      setStatus(done ? "点亮了，对应的任务也一起勾掉了。" : "又熄灭了，任务回到了列表里。");
      return;
    }

    if (action === "goal-links") {
      const goal = api.goal(id);
      const node = goal ? (goal.nodes || []).find((item) => item.id === trigger.dataset.node) : null;
      if (!node) return;
      api.openLinkList(node.title, node.links || [], {
        note: node.brief || "这个知识点相关的公开文档。",
        empty: "这个知识点还没配资料。填上模型接口重排一次，或者去任务板看看有没有对得上的文章。"
      });
      return;
    }

    if (action === "goal-plan") {
      planGoal(id);
      return;
    }

    if (action === "goal-tasks") {
      const created = api.syncGoalTasks(id);
      setStatus(created.length > 0 ? "加了 " + created.length + " 条每日任务。" : "任务已经和计划对上了，没有漏的。");
      return;
    }

    if (action === "goal-edit") {
      fillGoalForm(api.goal(id));
      return;
    }

    if (action === "goal-remove") {
      const goal = api.goal(id);
      if (!goal) return;
      if (!window.confirm("删除目标「" + goal.title + "」？它生成的每日任务会一起删掉。")) return;
      api.removeGoal(id, { withTasks: true });
      resetGoalForm();
      setStatus("删掉了。");
    }
  }

  function wireGoals() {
    const root = document.getElementById("goal-board");
    if (root) {
      root.addEventListener("click", handleAction);
      root.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const trigger = event.target.closest("[data-action]");
        if (!trigger) return;
        event.preventDefault();
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }
    const form = document.getElementById("goal-form");
    if (form) form.addEventListener("submit", onSubmit);
    const cancel = document.getElementById("goal-cancel");
    if (cancel) cancel.addEventListener("click", resetGoalForm);
    document.addEventListener("spasre:change", renderGoals);
  }

  /* ---------- boot ---------- */

  const form = document.getElementById("goal-form");
  if (form && form.elements.startDate && !form.elements.startDate.value) form.elements.startDate.value = api.today();
  wireGoals();
  renderAgentHint();
  renderGoals();

  window.spasreGoals = {
    version: 1,
    goals: api.goals,
    goal: api.goal,
    plan: localGoalPlan,
    planGoal: planGoal,
    modelPlan: modelGoalPlan,
    sanitize: sanitizeNodes,
    layers: topoLayers,
    order: topoOrder,
    acyclic: isAcyclic,
    assignDates: assignDates,
    layout: layoutGoal,
    wrapText: wrapText,
    render: renderGoals,
    status: setStatus,
    editing: function () {
      return state.editingId;
    }
  };
})();
