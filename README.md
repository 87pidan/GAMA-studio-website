# 善武工作室 GAMA Studio 商品展示網站

正式網址：https://87pidan.github.io/GAMA-studio-website/
網站後台：https://87pidan.github.io/GAMA-studio-website/admin/

網站放在 GitHub Pages，電腦關機也會一直在。倉庫必須維持**公開**（免費方案的私人倉庫不能用 Pages）。

## 平常怎麼上架商品：用後台

1. 打開網站後台（上面的網址，或網站最下面的「後台」連結）。
2. 第一次用要貼 GitHub 金鑰，後台畫面上有一步一步的說明（只要做一次）。
3. 新增、修改、下架商品；圖片直接拖進去或 Ctrl+V 貼上，會自動縮小、自動做縮圖。
4. 按「預覽修改」看看，沒問題就按「發佈到網站」，大約 1～2 分鐘後網站更新。

還沒發佈的修改存在那台電腦的瀏覽器裡，關掉視窗也不會不見。
分類、價目表、購買方式、常見問題、首頁文字、Discord 連結也都能在後台改。

## 檔案結構

```
index.html          網站頁面
css/style.css       網站樣式
js/app.js           網站程式（讀 data/site.json 畫出畫面）
data/site.json      ★ 所有商品與文字 —— 後台就是在改這個檔案
admin/              網站後台
assets/img/dc/      從 Discord 抓下來的商品介紹圖（*.thumb.jpg 是清單用的小圖）
assets/img/p/       從後台上傳的圖片（後台自己管理，不用手動動）
assets/img/logo.png 工作室 logo
check.js            檢查 data/site.json：node check.js
```

## 本機預覽

雙擊 `開啟網站.bat`，會自動開瀏覽器。關掉黑色視窗就會停止。
（不能直接雙擊 index.html，瀏覽器會擋住讀取 data/site.json。）

## 手動改檔案（進階）

直接改 `data/site.json` 也可以，改完執行 `node check.js` 檢查，再：

```
git add -A
git commit -m "更新商品"
git push
```

注意：如果有人同時在後台改了東西還沒發佈，後台發佈時會跳出提醒，問要不要蓋掉。

## 網站功能

- 首頁大圖輪播工作室的車輛；車輛用大圖＋縮圖列展示，價格做成車牌的樣子
- 其他商品可以依分類篩選，沒圖片的商品用工作室 logo 代替，只有影片的直接播 YouTube
- 商品詳情視窗：多圖瀏覽（鍵盤 ← → 切換、Esc 關閉、手機可滑動）
- 每個商品有獨立連結 `#product/<id>`，可以直接分享
- 手機、平板、桌機自適應；系統設定「減少動態效果」時會關掉動畫
