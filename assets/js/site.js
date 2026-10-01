(function () {
  const root = document.documentElement;
  const themeToggle = document.querySelector(".theme-toggle");
  const moonIcon = document.querySelector(".moon-icon");
  const sunIcon = document.querySelector(".sun-icon");
  const themeColor = document.querySelector('meta[name="theme-color"]');

  function isDarkTheme() {
    return root.dataset.theme
      ? root.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function updateThemeToggle() {
    const dark = isDarkTheme();
    themeToggle.setAttribute("aria-pressed", String(dark));
    themeToggle.setAttribute("aria-label", dark ? "切换日间模式" : "切换夜间模式");
    themeToggle.title = dark ? "切换日间模式" : "切换夜间模式";
    moonIcon.hidden = dark;
    sunIcon.hidden = !dark;
    themeColor.content = dark ? "#111a27" : "#f5f8fc";
  }

  themeToggle.addEventListener("click", () => {
    const theme = isDarkTheme() ? "light" : "dark";
    root.dataset.theme = theme;
    try {
      localStorage.setItem("spasre-theme", theme);
    } catch (error) {
      console.error("Unable to save the theme preference.", error);
    }
    updateThemeToggle();
  });

  updateThemeToggle();

  const searchForm = document.querySelector(".search-form");
  const searchInput = document.querySelector(".search-input");
  const searchResults = document.querySelector("#search-results");
  const searchIndex = [];

  const postData = document.querySelector("#post-search-data");
  if (postData) {
    try {
      searchIndex.push(...JSON.parse(postData.textContent));
    } catch (error) {
      console.error("Unable to read the article index.", error);
    }
  }

  for (const node of document.querySelectorAll("[data-search]")) {
    searchIndex.push({
      title: node.dataset.search,
      detail: node.dataset.searchDetail || "",
      href: node.dataset.searchHref || "#top",
      type: node.dataset.searchType || "页面"
    });
  }

  function tokenize(query) {
    const terms = [];
    const parts = query.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|[a-z0-9]+/giu) || [];

    for (const part of parts) {
      if (/^[a-z0-9]+$/i.test(part)) {
        terms.push(part);
      } else if (part.length === 1) {
        terms.push(part);
      } else {
        for (let i = 0; i < part.length - 1; i += 1) {
          terms.push(part.slice(i, i + 2));
        }
      }
    }

    return [...new Set(terms)];
  }

  function search(query) {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const terms = tokenize(normalizedQuery);
    if (!normalizedQuery || terms.length === 0) return [];

    return searchIndex
      .map((item) => {
        const title = item.title.toLocaleLowerCase();
        const detail = item.detail.toLocaleLowerCase();
        const searchable = `${title} ${detail} ${item.type.toLocaleLowerCase()}`;
        if (!terms.every((term) => searchable.includes(term))) return null;

        const score = (title.includes(normalizedQuery) ? 100 : 0)
          + terms.reduce((total, term) => total + (title.includes(term) ? 10 : 0), 0)
          + (detail.includes(normalizedQuery) ? 5 : 0);
        return { ...item, score };
      })
      .filter((item) => item !== null)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh-CN"))
      .slice(0, 5);
  }

  function closeSearchResults() {
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
  }

  function renderSearchResults(query) {
    searchResults.replaceChildren();
    if (!query.trim()) {
      closeSearchResults();
      return;
    }

    const results = search(query);
    if (results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "没有找到相关内容，试试其他关键词。";
      searchResults.append(empty);
    } else {
      for (const result of results) {
        const link = document.createElement("a");
        link.className = "search-result";
        link.href = result.href;

        const title = document.createElement("span");
        title.className = "search-result-title";
        title.textContent = result.title;

        const detail = document.createElement("span");
        detail.className = "search-result-detail";
        detail.textContent = result.detail ? `${result.type} · ${result.detail}` : result.type;

        link.append(title, detail);
        link.addEventListener("click", closeSearchResults);
        searchResults.append(link);
      }
    }

    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const firstResult = searchResults.querySelector(".search-result");
    if (firstResult) firstResult.click();
    else renderSearchResults(searchInput.value);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSearchResults();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".header-actions")) closeSearchResults();
  });
})();
