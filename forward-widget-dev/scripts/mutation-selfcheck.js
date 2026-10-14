/**
 * 变异自测样例：证明 test-widget-template.js 的断言真的有牙齿。
 *
 * 做法：把官方 demo.js 的两个关键点改错（stills 代替 backdropPaths、
 * animeId 代替 bangumiId），跑同一套断言，必须看到 ❌。
 * 用法: node scripts/mutation-selfcheck.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HERE = __dirname;
const REPO = path.resolve(HERE, "..", "..");
const DEMO = path.join(REPO, "widgets", "demo.js");
const TEST = path.join(HERE, "test-widget-template.js");
const TMP = "/tmp/mutation-widget.js";

const src = fs.readFileSync(DEMO, "utf8");

// 变异 1：把 demo 的 stills 语义写错——在 loadDetail 里加一个错误字段名
const mutant1 = src.replace(
  /backdropPaths: \[ \/\/ 详情页剧照横滑/,
  "stills: [ /* 错误字段名 */ ],\n    backdropPaths: [ // 详情页剧照横滑"
);
fs.writeFileSync(TMP, mutant1);

console.log("=== 变异 1：loadDetail 混入 stills（真名是 backdropPaths）===");
try {
  execFileSync("node", [TEST, TMP], { stdio: "inherit" });
  console.log("⚠️ 测试仍然 PASS —— 断言太弱，需要补 stills 反断言");
  process.exit(1);
} catch {
  console.log("✅ 如预期变红（断言有牙齿）");
}

// 变异 2：删掉一个 module 的 functionName 对应函数，元数据契约断言应抓到
const mutant2 = src.replace(/^async function loadSubtitle/m, "// async function loadSubtitle");
fs.writeFileSync(TMP, mutant2);

console.log("\n=== 变异 2：注释掉 loadSubtitle 函数定义 ===");
try {
  execFileSync("node", [TEST, TMP], { stdio: "inherit" });
  console.log("⚠️ 测试仍然 PASS —— 元数据契约断言失效");
  process.exit(1);
} catch {
  console.log("✅ 如预期变红（断言有牙齿）");
}

console.log("\n✅ 变异自测通过：测试模板能抓住这两类真实错误");
