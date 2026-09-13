# 善武工作室 GAMA Studio 商品展示網站

純靜態網站（HTML + CSS + JavaScript），不需要安裝任何套件，直接開 `index.html` 就能看。

## 檔案結構

```
index.html          頁面骨架
css/style.css       樣式
js/products.js      ★ 商品資料、價目表、FAQ、聯絡方式 —— 平常只需要改這個
js/app.js           搜尋 / 篩選 / 商品視窗邏輯（不用動）
assets/img/         商品圖片
```

## 本機預覽

最簡單：雙擊 `開啟網站.bat`，會自動開瀏覽器。關掉黑色視窗就會停止。

或者直接雙擊 `index.html` 也能看（不需要伺服器）。

## 網站重心

首頁以「車輛」為主，每台車一張大卡片，點進去有多張圖。其他商品（套組、中文化、代裝服務）收在下方「其他商品與服務」的小清單。
`category` 是 `vehicle` 的商品會出現在車輛區，其他分類自動排到下面。

## 上線前一定要改的地方（都在 `js/products.js` 最上面）

1. `STUDIO.intro`、`orderNote`：首頁的自我介紹，用自己的話寫。
2. `STUDIO.contacts`：把 Discord、Email 換成自己的。第一個會當作「我要買」按鈕的連結。
3. 每個商品的 `price`：目前商品本身都是 `null`（顯示「價格請洽詢」），填數字就會顯示 NT$。

## 新增商品

在 `js/products.js` 的 `PRODUCTS` 陣列裡複製一個物件，改內容即可：

```js
{
  id: "my-new-car",              // 英文代號，不可重複
  name: "Toyota Altis 台灣警車",
  category: "vehicle",           // suite / vehicle / plugin / tool / service
  tagline: "一句話簡介",
  price: 150,                    // 或 null
  unit: "輛",
  badge: "新品",                 // 可留空 ""
  version: "",
  images: ["assets/img/altis-1.jpg", "assets/img/altis-2.jpg"],
  features: ["特色一", "特色二"],
  details: ["一段說明"],
  notes: ["注意事項"],
},
```

圖片放到 `assets/img/`，建議寬度 1600px 以內的 JPG。

## 部署到 GitHub Pages

1. 把專案 push 到 GitHub。
2. Repo → Settings → Pages → Source 選 `main` 分支、根目錄。
3. 幾分鐘後網址會是 `https://<帳號>.github.io/<repo>/`。

## 功能

- 分類篩選、關鍵字搜尋（按 `/` 直接聚焦搜尋框）、價格 / 名稱排序
- 商品詳情視窗：多圖瀏覽（鍵盤 ← → 切換、Esc 關閉、手機可滑動）
- 每個商品有獨立連結 `#product/<id>`，可直接分享
- 手機、平板、桌機自適應
