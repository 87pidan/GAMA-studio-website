// 檢查 data/site.json 是否完整（圖片、縮圖存在、分類正確、影片網址看得懂）。執行：node check.js
const fs = require("fs"), vm = require("vm");
const d = JSON.parse(fs.readFileSync("data/site.json", "utf8"));
const problems = [];
const catIds = new Set(d.categories.map((c) => c.id));
const ids = d.products.map((p) => p.id);
ids.filter((x, i) => ids.indexOf(x) !== i).forEach((x) => problems.push(`重複的商品 id：${x}`));
let noThumb = 0;
d.products.forEach((p) => {
  if (!catIds.has(p.category)) problems.push(`${p.id}：分類「${p.category}」不存在`);
  (p.images || []).forEach((i) => {
    if (!/^https?:/.test(i) && !fs.existsSync(i)) problems.push(`${p.id}：找不到圖片 ${i}`);
    const t = i.replace(/\.(jpe?g|png|webp)$/i, ".thumb.jpg");
    if (!/^https?:/.test(i) && !fs.existsSync(t)) noThumb++;
  });
  if (p.video && !/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/.test(p.video)) problems.push(`${p.id}：看不懂影片網址 ${p.video}`);
});
console.log(`商品 ${d.products.length}（下架 ${d.products.filter((p) => p.hidden).length}）｜分類 ${d.categories.length}｜更新時間 ${d.updatedAt}`);
console.log("各分類：" + d.categories.map((c) => `${c.label} ${d.products.filter((p) => p.category === c.id).length}`).join("、"));
if (noThumb) console.log(`沒有縮圖的圖片 ${noThumb} 張（網站會自動改用原圖）`);
problems.forEach((m) => console.log("  ✗ " + m));
for (const f of ["js/app.js", "admin/admin.js"]) new vm.Script(fs.readFileSync(f, "utf8"), { filename: f });
console.log(problems.length ? `有 ${problems.length} 個問題` : "全部正常 ✓");
process.exitCode = problems.length ? 1 : 0;
