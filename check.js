// 檢查 products.js 的資料是否完整（圖片存在、分類正確）。執行：node check.js
const fs = require("fs"), vm = require("vm");
const ctx = { console, fs };
vm.runInNewContext(fs.readFileSync("js/products.js", "utf8") + `
  const miss = [];
  PRODUCTS.forEach(p => p.images.forEach(i => { if (!fs.existsSync(i)) miss.push(p.id + ": " + i); }));
  console.log("products", PRODUCTS.length, "| missing images", miss.length);
  miss.forEach(m => console.log("  MISSING", m));
  const badCat = PRODUCTS.filter(p => !CATEGORIES[p.category]).map(p => p.id);
  if (badCat.length) console.log("  BAD CATEGORY", badCat.join(", "));
  const ids = PRODUCTS.map(p => p.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) console.log("  DUPLICATE ID", dup.join(", "));
  console.log("per category", JSON.stringify(Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, PRODUCTS.filter(p => p.category === k).length]))));
`, ctx);
new vm.Script(fs.readFileSync("js/app.js", "utf8"));
console.log("app.js syntax ok");
