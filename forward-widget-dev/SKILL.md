---
name: forward-widget-dev
description: "写/改 Forward（新视界）播放器的 WidgetMetadata JS 模块——列表、详情、搜索、弹幕、字幕、起播动态取链（loadResource）；含官方规范速查、字段约定陷阱、本地回测法，以及本机红果 Worker / HDHive 秒播直链两个已落地场景。触发：forward 模块、WidgetMetadata、forward widget、写个 forward 榜单/播放源、红果 short drama 播放源、hdhive 直链、forward.hongguo.full、起播取链 loadResource、forward 模块加密。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    tags: [forward, widget, javascript, player, ios, media, hongguo, hdhive]
    related_skills: [nextfind-ops, open-source-skill-intake, media-mgmt]
---

# Forward Widget 开发（Forward 播放器自定义模块）

Forward（新视界，iOS/iPadOS/tvOS）的第三方模块生态。每个模块是**一个独立 JS 文件**：
一个全局 `WidgetMetadata` 对象（声明模块 + UI 参数）+ 若干同名 async handler。
App 按 `functionName` 调用 handler，传入单个 `params` 对象。

**核心原则：框架靠「精确约定」接线**——模块 id、函数名、VideoItem 字段名都不是自由命名。
不确定时**抄 `widgets/demo.js` 的形状**，别发明名字。

## 官方资产（本机已 fork + 装好）

| 资产 | 地址 | 本机位置 |
|---|---|---|
| 规范仓库（文档+示例+脚手架） | https://github.com/InchStudio/ForwardWidgets | 真源 `/vol1/1000/config/share/projects/ForwardWidgets/`（fork 到 `wenrouXN/ForwardWidgets`，`git pull` 更新） |
| **官方 AI 编写技能** | https://flux.inch.red/skills/writing-forward-widgets.zip | `references/upstream-official-skill.md`（上游 SKILL.md 原文） |
| 上游 README（完整规范） | 仓库 `README.md` 591 行 | `references/upstream-readme.md` |
| 官方模块索引 | `forward-widgets.fwd` | tmdb / trendingmedia / bangumi / danmu / AI搜索 5 个 |
| 在线加密工具 | https://forward.vvebo.vip/encrypt/ | 可选（加密后 App 导入自动解密，不加密也能用） |
| Widget Hub（托管分享） | https://github.com/InchStudio/forward-widget-hub | 一键部署 CF，把模块链接分享给朋友 |

**官方 5 个内置模块**：TMDB 榜单、影视数据、动漫数据、自定义弹幕、AI 自然语言搜索。
**没有**：红果短剧、HDHive、115 —— 这三类自己写（见「本机已落地场景」）。

**上游是 source of truth**：本 skill 只蒸馏约定，字段/行为有变化以上游 README + `widgets/` 为准。

## WidgetMetadata 骨架

```javascript
WidgetMetadata = {                    // 裸全局赋值，不需要 var，必须是第一条语句
  id: "forward.example",              // 全局唯一，反向域名风
  title: "示例",
  version: "1.0.0",
  requiredVersion: "0.0.1",           // 所需 ForwardWidget 版本
  description: "...",
  author: "Forward",
  site: "https://github.com/InchStudio/ForwardWidgets",
  icon: "https://assets.vvebo.vip/scripts/icon.png",   // 可选
  detailCacheDuration: 60,            // 详情缓存秒数
  globalParams: [ /* 可选：整个 widget 共享、注入每个 handler 的 params */ ],
  modules: [ /* 见下 */ ],
  search: { /* 可选：顶层搜索，不是 module */ },
};
```

模块条目：

```javascript
{
  id: "loadList",               // 稳定 id；danmu 类是固定值（见下）
  title: "热门影片",
  functionName: "loadList",     // 指向全局 async function loadList(params)
  type: "stream",               // 列表模块省略；"stream"|"subtitle"|"danmu" 才有
  cacheDuration: 3600,
  requiresWebView: false,
  sectionMode: false,
  params: [ /* 见参数类型 */ ],
}
```

### 参数类型

| type | UI | 注意 |
|---|---|---|
| `input` | 文本框 | 可加 `placeholders:[{title,value}]` |
| `enumeration` | 选择器 | 必须 `enumOptions:[{title,value}]` |
| `page` | 分页 | App 传 `params.page` |
| `count` | 数字 | `value` 设默认 |
| `offset` | 位置 | |
| `constant` | 隐藏常量 | |
| `language` | 语言选择 | `value:"zh-CN"` |
| `userId` | 注入设备/用户 id | 后端限流/Pro 检测用 |

`belongTo:{paramName, value:[...]}` = 仅当某参数值在列表内时才显示本参数（条件 UI）。

## VideoItem 模型（字段名必须一字不差）

直觉会发明 `stills`/`recommendations`/`detailFunctionName`——**全是错的**。真名：

```javascript
{
  id: 550,                  // tmdb 数字 id。type:"url" 时任意稳定串（可与 link 不同，路由用 link）
  type: "tmdb",             // "tmdb" | "url" | "douban" | "imdb" | "forward"
  mediaType: "movie",       // "movie" | "tv" —— tmdb 条目必填，否则 App 解析不了
  title: "Fight Club",
  posterPath: "url",        // 竖图。tmdb 类型传原始路径 "/abc.jpg"，App 自己拼全 URL
  backdropPath: "url",      // 横图（tmdb 同样传原始路径）
  backdropPaths: ["url"],   // ← 剧照/截图列表（不是 "stills"）
  relatedItems: [VideoItem],// ← 相关推荐（不是 "recommendations"）
  episodeItems: [VideoItem],// 剧集列表
  childItems: [VideoItem],  // 嵌套，最多一层
  trailers: [{ coverUrl: "url", url: "videoUrl" }],   // 对象格式优先
  genreItems: [{ id: "action", title: "动作" }],      // id 必填，否则详情页打不开分类列表
  peoples: [{ id, title, avatar, role }],             // id 必填，同理
  releaseDate: "2025-01-01",
  rating: 8.4,
  description: "...",
  videoUrl: "url",
  previewUrl: "url",
  duration: 123,
  durationText: "00:00",
  link: "detail-key",       // ← 打开详情页（机制见下）
  playerType: "system",     // "system" | "app"
}
```

`loadList` 与 `loadDetail` 必须共用同一套 VideoItem 模型；`loadDetail` 可只返回要补充的字段，但不能改名。

### 图片字段与展示位置（回退链，左→右取第一个非空）

| 展示位置 | 回退链 |
|---|---|
| 详情页顶部大图 / 横向列表缩略图 | `backdropPath` → `coverUrl` → `posterPath` |
| 纵向海报墙 | `posterPath` → `backdropPath` → `coverUrl` |
| 详情页海报位 | `detailPoster`（缺省回退竖图位） |
| 详情页剧照横滑 | `backdropPaths`（数组，独立字段，不参与回退） |
| 预告片封面 | `trailers[].coverUrl` → `coverUrl` → `backdropPath` → `posterPath` |

- `coverUrl` 是通用兜底：只填它，横图位（第二）和竖图位（最后）都能出图。
- 别名：`posterPath` 也认 `posterUrl`/`poster_url`；`backdropPaths` 也认 `backdropImageUrls`。
- `tmdb`/`douban`/`imdb` 不走这套（走内置详情页）；对 tmdb 的 poster/backdrop 传原始路径。
- 经验：横图位填 `backdropPath`、竖图位填 `posterPath`；只有一张图就填 `coverUrl` 全位置兜底。

## 详情页机制：`link` + 顶层 `loadDetail(link)`

**没有 `detailFunctionName` 这个东西。** 流程：

1. `link` **只能配在 `type:"url"` 的自有条目上**。tmdb/douban/imdb 条目**不带 link**——App 用 id 打开内置详情页，`loadDetail` 永不被调用。
2. 点 `type:"url"` 条目 → 调用**顶层** `loadDetail(link)`：不是 module、没有 params、**直接收 link 字符串**。
3. link 字符串自己设计，与 id 无强制关系；编码你需要的信息再解析回来，按值路由。
4. `loadDetail` 返回 VideoItem 或 VideoItem[]，补 `backdropPaths`/`trailers`/`genreItems`/`peoples`/`relatedItems`/`videoUrl`；未知 link 返回 `null`。

```javascript
async function loadDetail(link) {
  const key = String(link).split(":")[1];     // link 例："detail:movie-1"
  const data = await fetchDetail(key);
  if (!data) return null;
  return { id: link, type: "url", title: data.title, link,
           backdropPaths: data.stills,        // 剧照
           relatedItems: data.recs,           // 推荐
           genreItems: data.genres.map(g => ({ id: String(g.id), title: g.name })) };
}
```

详情页点分类/演员 → App 回到该条目所属**列表模块**，把 `params.genreId`/`params.peopleId`
设成你写在 `genreItems[].id`/`peoples[].id` 的**字符串值**（字符串比较）。列表里要按它过滤。

### Forward 类型（网盘资源身份）

列表项代表稳定的 Forward 网盘资源时：`type:"forward"` + `id` 与 `link` 用**同一个资源 ID**。
客户端自动归一为 `fw-<id>`，详情页资源模式里按需匹配网盘文件/文件夹，无需额外开关。

## 搜索：顶层 `search`，不是 module

```javascript
search: {
  title: "搜索",
  functionName: "search",        // 全局 async function search(params) → VideoItem[]
  params: [
    { name: "keyword", title: "关键词", type: "input" },   // 用户输入 → params.keyword
    { name: "page", title: "页码", type: "page" },         // 要分页必须在这里声明 page
  ],
}
```

⚠️ 不声明 `page` 参数，App 就从不发 `params.page`，你代码里的翻页是死代码。

## 起播动态取链：`loadResource`（type: "stream"）

播放地址要在**真正起播时**才生成（直播签名、短期 token、多 CDN 线路）时，
不要把一次性 URL 写死在 `loadDetail` 的 `videoUrl` 里。声明固定 id 模块：

```javascript
modules: [{ id: "loadResource", title: "加载资源", functionName: "loadResource",
            type: "stream", cacheDuration: 0, params: [] }]

async function loadResource(params) {
  // params 携带 tmdbId / imdbId / id / type / seriesName / episodeName / season / episode / link / videoUrl
  const liveUrl = await getFreshPlaybackUrl(params.link);
  return [{
    name: "直播线路",
    description: "HTTP-FLV",
    url: liveUrl,
    customHeaders: {
      "User-Agent": "Mozilla/5.0 ...",
      Referer: "https://example.com/",
      "X-Forward-Skip-Redirect-Probe": "1",   // 仅用于不能被起播前 GET 探测消耗的资源
    },
    playerType: "app",                        // "system" | "app"
  }];
}
```

`VideoResource[]` 字段：`name`（线路名，显示用）、`description`（可选）、`url`（必填）、
`customHeaders`/`headers`（可选）、`playerType`（可选）。

**`X-Forward-Skip-Redirect-Probe: "1"`** 是播放器内部控制 header：跳过起播前重定向探测，
真正发请求前会被过滤掉、不会送给 CDN。适用于 HTTP-FLV 直播、一次性签名 URL、长连接直播流。
**不要给所有资源都加**：普通 mp4、稳定直链、m3u8/HLS 应保持默认探测。

## 弹幕：三个固定 id 模块，type: "danmu"

三段链，每段一个模块，**id 是 App 匹配的固定值不能改**（`functionName` 你自己起），
全部 `type:"danmu"` + `params: []`（输入自动注入）。

| 阶段 | 固定 `id` | functionName | params 收到 | 返回 |
|---|---|---|---|---|
| 1 搜索 | `searchDanmu` | `searchDanmu` | `title, seriesName, season, type, tmdbId` | `{ animes:[{animeId, animeTitle, type}] }` |
| 2 剧集 | `getDetail` | `getDetailById` | `animeId`（你上步返回的）, `seriesName, season, episode` | `[{episodeId, episodeTitle}]`（裸数组） |
| 3 弹幕 | `getComments` | `getCommentsById` | `commentId`（= 用户选的 episodeId） | 服务端原生 `{count, comments:[...]}` |

**数据流就是全部的窍门**：stage1 返回 `animes[].animeId` → 用户选番 → App 用该 animeId 调
stage2 → 你返回 `episodes[].episodeId` → 用户选集 → App 用该 episodeId **作为 `params.commentId`**
调 stage3。所以一段吐出的 id 就是下一段收到的 id。

参考实现 `widgets/danmu.js`（dandanplay/Misaka 多源）。最小 dandanplay：

```javascript
const SERVER = "https://api.dandanplay.net";   // 可用 globalParams 的 server 覆盖
async function searchDanmu(params = {}) {
  const res = await Widget.http.get(`${params.server || SERVER}/api/v2/search/anime?keyword=${encodeURIComponent(params.seriesName || params.title)}`);
  return { animes: (res.data.animes || []).map(a => ({ animeId: a.bangumiId || a.animeId, animeTitle: a.animeTitle, type: a.type })) };
}
async function getDetailById(params = {}) {
  const res = await Widget.http.get(`${params.server || SERVER}/api/v2/bangumi/${params.animeId}`);
  return (res.data.bangumi?.episodes || []).map(e => ({ episodeId: e.episodeId, episodeTitle: e.episodeTitle }));
}
async function getCommentsById(params = {}) {
  const res = await Widget.http.get(`${params.server || SERVER}/api/v2/comment/${params.commentId}?withRelated=true&chConvert=1`);
  return res.data;   // 内置解析器直接吃 dandanplay JSON/XML
}
```

**已知陷阱（Misaka/bangumi）**：优先用 `bangumiId` 而非 `animeId`（多季番会选错季）；
stage2 匹配用原始 `seriesName`，不要用被 App 覆盖过的 `title`。

**自定义弹幕格式**（不返回服务端原生）必须遵循两种之一：
`[{p:"", m:"", cid:""}]` 或 `[[时间, 位置, 颜色, "", 内容]]`。

另有可选 `getDanmuWithSegmentTime` 模块（同样 `type:"danmu"`，收 `segmentTime`）做按时间分片加载，
参考 `widgets/segmentDanmuExample.js`。

## 字幕压缩包

`loadSubtitle` 返回 `.zip` 字幕包 URL，客户端下载解压；若定义了顶层 `resolveSubtitleArchive(params)`，
客户端会把解压后的文件列表传给它，由你返回真正要用的**相对路径**（不要构造绝对路径）：

```javascript
async function resolveSubtitleArchive(params) {
  const files = JSON.parse(params.subtitleFiles || "[]");
  const best = files.find(f => f.name.includes("简体")) || files[0];
  return best ? best.path : null;   // 相对 path；可返回串/数组/{path}/{files:[...]}
}
```

## 运行时 API

```javascript
const res = await Widget.http.get(url, { headers:{...}, params:{...}, allow_redirects:false });
const res = await Widget.http.post(url, body, { headers:{...} });
const data = res.data;                        // ← http.* 把 body 包在 .data 里

const res = await Widget.tmdb.get(api, { params });   // api 不带前导斜杠："movie/now_playing"
const list = res.results;                     // ⚠️ tmdb.get 直接返回 TMDB body，不是 res.data.results

const $ = Widget.html.load(htmlContent);      // cheerio 句柄，可爬页面

Widget.storage.get(key); Widget.storage.set(key, value); Widget.storage.remove(key);  // 本脚本私有持久缓存
const v = Widget.sharedCache.get(ns, key); Widget.sharedCache.set(ns, key, v);        // 显式共享缓存（必带 namespace）
```

**不要假设存在 `fetch` / `URLSearchParams` / Node API**——用 `Widget.http`，查询串走 `params` 选项。

- `Widget.storage`：当前脚本自己的 KV，同脚本多模块共享，不跨脚本。
- `Widget.sharedCache`：跨模块/跨脚本共享稳定数据，**必须带 namespace**，不自动过期；
  失效靠写带版本号的 key 或 `remove(ns, key)`；App 设置里「模块缓存」清理会一并清掉。
- 兼容旧客户端先判存在：`if (Widget.sharedCache && typeof Widget.sharedCache.get === "function")`。

## Handler 写法范式

```javascript
async function loadList(params = {}) {
  try {
    const page = Number(params.page || 1);
    const res = await Widget.tmdb.get("movie/popular", { params: { page, language: params.language || "zh-CN" } });
    if (!res || !res.results) throw new Error("空响应");
    return res.results.map(m => ({ id: m.id, type: "tmdb", mediaType: "movie",
                                   title: m.title, posterPath: m.poster_path, rating: m.vote_average }));
  } catch (error) {
    console.error("[loadList] 失败:", error.message || error);
    throw error;          // 抛给 App；日志可在 App 内建模测工具看
  }
}
```

## 本地回测（没有 test runner，自己 mock `Widget`）

App 在注入了 `Widget` 全局的 JS bridge 里跑模块。本地复刻 = Node 脚本 mock `Widget`
→ `eval` 模块文件 → 直接调 handler。模板见 `scripts/test-widget-template.js`。

两种 mock 风格：
- **Live**：`Widget.http` 代理到真实 `fetch`（返回 `{data,status,headers}`），端到端验真实端点。
- **Offline / 断言**：按 URL 返回硬编码响应 + `assert/strict` + 记 `calls[]`，无网络、确定性、可 CI。

**让测试真的有牙齿**（否则改了字段名测试照样绿）：
- **断言你发出去的请求**，不只是拿到的返回值：mock 里记 `calls[]`，
  断言上游 id 出现在下一阶段 URL 里（如 `calls.some(u => u.includes("/comment/"+episodeId))`）。
- **每个改名陷阱配对正反断言**：`assert.ok(Array.isArray(d.backdropPaths)); assert.equal(d.stills, undefined);`
  顺带断言原始 API 键没泄漏（`assert.equal(item.poster_path, undefined)`）。
- **mock 返回「看似合理的错数据」而非 `undefined`**——返回 undefined 会让模块抛异常、测试意外红，等于什么都没测。
- **变异自测**：临时改错一个字段名/一个线程 id，确认测试会红；还红就说明测试太弱，改完再还原。

```bash
node scripts/test-widget-template.js /path/to/widget.js   # 用法见脚本头部注释
```

## Common Mistakes（10 条直觉陷阱）

| 错误 | 正确 |
|---|---|
| 发明 `type:"search"` 模块 | 用顶层 `search` 块 |
| 弹幕写成 1–2 个模块 / 改 id / object functionName | 三个模块，固定 id `searchDanmu`→`getDetail`→`getComments`，各 `type:"danmu"`，线程 `animeId`→`episodeId`(→`commentId`) |
| `Widget.tmdb.get()` 后取 `res.data.results` | `tmdb.get` 直接返回 body → `res.results`；只有 `Widget.http.*` 才包 `.data` |
| tmdb api 路径带前导斜杠 | `Widget.tmdb.get("movie/popular")`，不带 `/` |
| `stills` / `recommendations` / `detailFunctionName` | 真名 `backdropPaths`、`relatedItems`；详情走 `link` + 顶层 `loadDetail(link)` |
| `loadDetail(params)` | 收的是 link **字符串** |
| 给 tmdb/douban/imdb 条目加 `link` | `link`+`loadDetail` 只服务于 `type:"url"` 自有条目 |
| 到处拼 `"movie.123"` | 常规：数字 `id` + `mediaType`；只有混合列表才需要 `"tv.123"`/`"movie.234"` |
| `genreItems`/`peoples` 不带 `id` | 详情页打不开它们的列表；必须带 `id`，`params.genreId` 等于该 id（字符串比） |
| 用 `fetch`/`URLSearchParams` | 用 `Widget.http` + `params` 选项 |
| 文件中间再写 `var WidgetMetadata` | 全文一条裸 `WidgetMetadata = {...}`，第一条语句 |

## 加密（可选）

加密后 App 导入自动解密，不加密也能正常工作。加密方式：
- 在线：https://forward.vvebo.vip/encrypt/
- API：`curl -X POST https://widgetencrypt.inchmade.ai --data-binary @widget.js -o widget.js`
- Claude Code：`/fw-encrypt widgets/<file>.js`

## 本机已落地场景

### 1. 红果短剧（forward.hongguo.full）

- **API Base**：`https://hongguo-api.guofukun94508.workers.dev`（Cloudflare Worker，2704 行 JS）
  ——插件设置里 `apiBase` 填这个地址，**不带尾部斜杠、不带 `/api/v1`，插件自己拼**；弹幕模块填同一个。
- 自托管备选：同仓库 `node-server.js`（默认 `127.0.0.1:25566`）。
- Worker 负责：设备指纹/签名（hongguo-signing.js）、CENC 解密（cenc.js）、季度聚合、
  弹幕（misaka/dandanplay）、播放直链签发（**TTL 6 小时**）。
- ⚠️ 直链 TTL 6 小时对 Forward 无感（会重新请求），但**落成 STRM 给 Emby/Rex 会变死链**——
  要入库走 juku 下载/转存落盘，别把红果直链写进 strm。
- Rex 播放器没有 HTTP API 自定义源入口，不能直接用 hongguo.js；要接 Rex 需把 Worker
  改造成 Emby 兼容层（工作量按天算）。

### 2. HDHive / 115 秒播直链（nextfind Forward 链路）

nextfind（1.3:8092）的 `[Forward]` 模块就是这套机制的生产实例，已实证：

```
HDHive 点秒播预览 → nextfind 拿 hdhive://<资源>（内含 share_code + file_id）
  → 查神盾/直链缓存，未命中 → 凭 share_code+file_id 向 115 要 CDN 直链
  → 拿到 cdnfhnfile.115cdn.net 302 地址 → 写缓存 → 把用户重定向到 CDN
```

**关键结论（2026-10-14 定案）：拿 115 播放直链不需要先转存。** 115 分享链接的鉴权对象是
「分享关系」（share_code + file_id），不是「本盘所有权」；文件始终在分享者盘上，访问者被 302
送到 CDN，零字节经过本机 NAS。判据：`transfer_history` 无该片记录 + 本盘按标题/fid 搜索为空
+ 日志只有「取直链成功 → 302」无任何转存/归档字样。

⇒ 自己写「115 分享直链」型 `loadResource` 时，正确形状是**分享接口 + 302 交给播放器**，
不要先调转存 API（那会真的把文件写进 `share/unsorted`，触发 Symedia 归档整条链）。

## 关联

- 上游规范与示例：`/vol1/1000/config/share/projects/ForwardWidgets/`（`widgets/demo.js` 是所有模块类型的活参考）
- nextfind/nextemby 运维与 HDHive/115 链路：skill `nextfind-ops`
- 第三方 skill 安装与验证流程：skill `open-source-skill-intake`
- 影音资源搜索/转存/媒体库：skill `media-mgmt`
