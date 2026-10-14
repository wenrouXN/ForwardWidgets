#!/usr/bin/env node
/**
 * test-widget-template.js — ForwardWidget 模块本地回测模板
 *
 * 用法:
 *   node test-widget-template.js <widget.js>            # offline 断言模式（默认）
 *   LIVE=1 node test-widget-template.js <widget.js>     # live 模式（Widget.http 代理到真实 fetch）
 *
 * 原理（官方确立的模式，见上游 README「本地回测」）:
 *   App 在注入了 `Widget` 全局的 JS bridge 里跑模块。本地复刻 = mock `Widget`
 *   → eval 模块文件 → 直接调 handler。
 *
 * 两种 mock 风格:
 *   - Live      : Widget.http 代理真实 fetch（返回 {data,status,headers}），端到端验真实端点
 *   - Offline   : 按 URL 返回硬编码响应 + assert + 记 calls[]，无网络、确定性、可 CI
 *
 * ⚠️ 让测试真的有牙齿（否则改了字段名测试照样绿）:
 *   1. 断言你发出去的请求，不只是拿到的返回值（mock 里记 calls[]）
 *   2. 每个改名陷阱配对正反断言（真名在、错名不在）
 *   3. mock 返回「看似合理的错数据」而非 undefined
 *   4. 变异自测：临时改错一个字段名，确认测试会红
 *
 * 写自己的测试时：复制本文件，改 MOCK_RESPONSES 和下面的断言。
 * 测试脚本放仓库根目录（node_modules 在那解析），离线测试零依赖。
 */
"use strict";
const fs = require("fs");
const assert = require("assert/strict");

const widgetPath = process.argv[2];
if (!widgetPath) {
  console.error("用法: node test-widget-template.js <widget.js>");
  process.exit(2);
}
const LIVE = process.env.LIVE === "1";

// ---------------------------------------------------------------- mock 响应
// key = URL 子串，value = 该 URL 要返回的 body（“看似合理的错数据”，不是 undefined）
const MOCK_RESPONSES = {
  "api.dandanplay.net/api/v2/search/anime": {
    animes: [
      { bangumiId: 42, animeId: 99, animeTitle: "测试番剧", type: "tv" },
      { bangumiId: 43, animeId: 100, animeTitle: "另一部", type: "tv" },
    ],
  },
  "api.dandanplay.net/api/v2/bangumi/": {
    bangumi: {
      episodes: [
        { episodeId: 4201, episodeTitle: "第1集" },
        { episodeId: 4202, episodeTitle: "第2集" },
      ],
    },
  },
  "api.dandanplay.net/api/v2/comment/": {
    count: 2,
    comments: [
      { cid: 1, p: "1.0,1,16777215", m: "第一条弹幕" },
      { cid: 2, p: "2.5,1,16777215", m: "第二条弹幕" },
    ],
  },
  "example.com/list": {
    results: [
      { id: 550, title: "Fight Club", poster_path: "/fc.jpg", vote_average: 8.4 },
      { id: 27205, title: "Inception", poster_path: "/inc.jpg", vote_average: 8.3 },
    ],
  },
};

const calls = []; // 记录所有请求，用于「断言发出去的请求」

// ---------------------------------------------------------------- mock Widget
global.Widget = {
  http: {
    async get(url) {
      calls.push(url);
      if (LIVE) {
        const r = await fetch(url);
        return { data: await r.json(), status: r.status, headers: {} };
      }
      for (const [k, v] of Object.entries(MOCK_RESPONSES)) {
        if (url.includes(k)) return { data: v, status: 200, headers: {} };
      }
      throw new Error("unmocked url: " + url);
    },
    async post(url, body) {
      calls.push("POST " + url);
      if (LIVE) {
        const r = await fetch(url, {
          method: "POST",
          body: typeof body === "string" ? body : JSON.stringify(body),
        });
        return { data: await r.json().catch(() => ({})), status: r.status, headers: {} };
      }
      return { data: { ok: true }, status: 200, headers: {} };
    },
  },
  tmdb: {
    // ⚠️ tmdb.get 直接返回 TMDB body（没有 .data 包装）
    async get(api) {
      calls.push("tmdb:" + api);
      if (LIVE) {
        const r = await fetch("https://api.themoviedb.org/3/" + api);
        return await r.json();
      }
      if (api.includes("movie/popular")) return MOCK_RESPONSES["example.com/list"];
      throw new Error("unmocked tmdb api: " + api);
    },
  },
  storage: {
    _m: {},
    get(k) { return this._m[k]; },
    set(k, v) { this._m[k] = v; },
    remove(k) { delete this._m[k]; },
  },
  sharedCache: {
    _m: new Map(),
    get(ns, k) { return this._m.get(ns + ":" + k) ?? null; },
    set(ns, k, v) { this._m.set(ns + ":" + k, v); },
    remove(ns, k) { this._m.delete(ns + ":" + k); },
  },
  html: {
    // 离线模式 stub；live 爬页面时改成 require('cheerio').load(h)
    load(h) {
      if (LIVE) return require("cheerio").load(h);
      throw new Error("html.load 在离线模板里未 stub，按需实现");
    },
  },
};
global.WidgetMetadata = {}; // eval 需要该全局存在

// ---------------------------------------------------------------- 载入被测模块
// ⚠️ 用「间接 eval」(0,eval) 在全局作用域执行，模块里的 function 声明才会挂成全局；
// 本文件顶部不要写 "use strict"（严格模式下 eval 有独立作用域，函数不会溢出为全局）。
const geval = eval;
geval(fs.readFileSync(widgetPath, "utf8"));

// ---------------------------------------------------------------- 断言
(async () => {
  const failures = [];
  const t = async (name, fn) => {
    try { await fn(); console.log("  ✅", name); }
    catch (e) { failures.push(name); console.log("  ❌", name, "->", e.message); }
  };

  console.log("模式:", LIVE ? "LIVE（真实网络）" : "OFFLINE（硬编码 mock）");
  console.log("模块:", widgetPath);

  // --- 元数据契约 ---
  await t("WidgetMetadata 是裸全局对象且带 id/title/modules", () => {
    assert.ok(global.WidgetMetadata && typeof global.WidgetMetadata === "object");
    assert.ok(global.WidgetMetadata.id, "缺 id");
    assert.ok(global.WidgetMetadata.title, "缺 title");
    assert.ok(Array.isArray(global.WidgetMetadata.modules), "modules 必须是数组");
  });

  await t("每个 module 的 functionName 都指向已定义的全局函数", () => {
    for (const m of global.WidgetMetadata.modules || []) {
      assert.ok(m.functionName, "module 缺 functionName: " + JSON.stringify(m));
      assert.equal(typeof global[m.functionName], "function",
        "functionName=" + m.functionName + " 没有对应全局函数");
    }
  });

  // --- loadList（若存在）---
  if (typeof global.loadList === "function") {
    await t("loadList 返回 VideoItem[] 且字段名正确", async () => {
      const list = await global.loadList({ page: 1, language: "zh-CN" });
      assert.ok(Array.isArray(list), "必须返回数组");
      assert.ok(list.length > 0, "不应返回空数组（mock 有数据）");
      const it = list[0];
      assert.ok(it.id !== undefined, "缺 id");
      assert.ok(it.type, "缺 type");
      assert.ok(it.title, "缺 title");
      // 改名陷阱：正反断言
      assert.equal(it.stills, undefined, "不该出现 stills（真名是 backdropPaths）");
      assert.equal(it.recommendations, undefined, "不该出现 recommendations（真名是 relatedItems）");
      assert.equal(it.poster_path, undefined, "原始 API 键不该泄漏到 VideoItem");
    });
  }

  // --- loadDetail（若存在）：收 link 字符串，不是 params ---
  if (typeof global.loadDetail === "function") {
    await t("loadDetail(link) 收字符串并返回 VideoItem 或 null", async () => {
      const d = await global.loadDetail("demo-detail-1");
      // 未知 link 应返回 null 而不是抛
      const none = await global.loadDetail("不存在的link");
      assert.ok(none === null || none === undefined, "未知 link 应返回 null");
      if (d) {
        assert.ok(d.title, "详情缺 title");
        assert.equal(d.stills, undefined, "详情不该用 stills");
        assert.equal(d.recommendations, undefined, "详情不该用 recommendations");
      }
    });
  }

  // --- 弹幕三段链（若存在）---
  if (typeof global.searchDanmu === "function") {
    await t("弹幕链: searchDanmu → getDetailById → getCommentsById id 正确传递", async () => {
      const { animes } = await global.searchDanmu({ seriesName: "测试番剧", season: 1, type: "tv" });
      assert.ok(Array.isArray(animes) && animes.length > 0, "searchDanmu 应返回 animes[]");
      const animeId = animes[0].animeId;
      assert.ok(animeId, "animeId 不能空");

      if (typeof global.getDetailById === "function") {
        const eps = await global.getDetailById({ animeId });
        assert.ok(Array.isArray(eps), "getDetailById 应返回裸数组");
        assert.ok(eps[0].episodeId, "缺 episodeId");
        // 关键：断言请求里真的带了上游 id（不是只断言返回值）
        assert.ok(calls.some(u => String(u).includes(String(animeId))),
          "searchDanmu 返回的 animeId 必须出现在 stage2 的请求 URL 里");

        if (typeof global.getCommentsById === "function") {
          const cmt = await global.getCommentsById({ commentId: eps[0].episodeId });
          assert.ok(cmt && Array.isArray(cmt.comments) && cmt.comments.length > 0,
            "getCommentsById 应返回 {count, comments[]}");
          assert.ok(calls.some(u => String(u).includes(String(eps[0].episodeId))),
            "episodeId 必须出现在 stage3 的请求 URL 里");
        }
      }
    });
  }

  // --- loadResource（若存在）：起播动态取链 ---
  if (typeof global.loadResource === "function") {
    await t("loadResource 返回 VideoResource[]（url 必填）", async () => {
      const rs = await global.loadResource({ tmdbId: "550", type: "movie", link: "x" });
      assert.ok(Array.isArray(rs), "必须返回数组");
      for (const r of rs) {
        assert.ok(r.url, "VideoResource 缺 url");
        assert.ok(r.name, "VideoResource 缺 name");
      }
    });
  }

  console.log("\n请求记录 (%d):", calls.length);
  calls.slice(0, 10).forEach(u => console.log("   ", u));
  if (calls.length > 10) console.log("    ... 其余", calls.length - 10, "条");

  if (failures.length) {
    console.error("\n❌ FAIL:", failures.length, "项 ->", failures.join(", "));
    process.exit(1);
  }
  console.log("\n✅ PASS");
})().catch((e) => { console.error("❌ 未捕获异常:", e); process.exit(1); });
