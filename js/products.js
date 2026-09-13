/* =====================================================================
   商品資料檔  —  要新增 / 修改商品，只需要改這個檔案
   ---------------------------------------------------------------------
   每個商品的欄位說明：
   id        : 英文代號（網址會用到，不可重複）
   name      : 商品名稱
   category  : 分類代號，必須是 CATEGORIES 裡的其中一個 key
   tagline   : 一句話簡介（卡片上顯示）
   price     : 數字（新台幣），填 null 代表「價格請洽詢」
   unit      : 價格單位，例如 "套"、"輛"、"個"
   badge     : 卡片右上角標籤，例如 "主打"、"新品"、"熱門"，不需要就填 ""
   version   : 版本號（選填）
   images    : 圖片路徑陣列，第一張為封面
   features  : 特色清單（陣列）
   details   : 詳細說明（可用多段文字，陣列每一項是一段）
   notes     : 注意事項（陣列，選填）
   ===================================================================== */

const STUDIO = {
  name: "善武工作室",
  // 首頁最上面的自我介紹，用自己的口吻寫就好
  intro: "我們做 GTA V 的台灣警車模型：Blender 從頭建模，塗裝照台灣現役警車來，分局跟車號都能改。車都在下面，看上哪台直接在 Discord 找我們。",
  // 首圖用哪張照片（放在 assets/img 裡）
  heroImage: "assets/img/tps-refuel.jpg",
  // 「其他商品與服務」區塊的說明
  otherDesc: "除了車以外也有做這些，需要的話一起問。",
  orderNote: "採優先付款後交貨",
  pricingNote: "本工作室商品提供免費代裝服務，其餘服務及價格如下",
  contactText: "有問題或想買，用下面任一種方式找我們，通常當天會回。",
  // 聯絡方式請換成自己的。第一個會當作「我要買」按鈕的連結。
  contacts: [
    { label: "Discord", url: "https://discord.gg/your-invite", display: "善武工作室 Discord 伺服器" },
    { label: "Email", url: "mailto:studio@example.com", display: "studio@example.com" },
  ],
};

const CATEGORIES = {
  all:      { label: "全部" },
  suite:    { label: "巡邏套組", desc: "本工作室自己寫的 LSPDFR 插件。" },
  vehicle:  { label: "台灣警車", desc: "全部 Blender 自製，不是套現成模型改的。塗裝、分局、車號都可以照你要的做，點進去看更多角度的圖。" },
  plugin:   { label: "插件中文化", desc: "把常用插件翻成繁體中文，安裝時會確認版本。" },
  tool:     { label: "工具與選單", desc: "Trainer、場景編輯這類非警察用途的工具。" },
  service:  { label: "代裝與維修", desc: "不會裝、裝壞了、遊戲閃退，都可以找我們。" },
};

/* 怎麼買（首頁「怎麼買」區塊，一行一個步驟） */
const HOW_TO_BUY = [
  "到 Discord 或寄信告訴我們你要哪個商品，順便說一下你的 GTA V 跟 LSPDFR 版本。",
  "我們確認內容跟價格後，你先付款。",
  "付款後交檔案，並幫你裝到能正常進遊戲。裝完之後有問題再回來找我們。",
];

const PRODUCTS = [
  /* ------------------------------------------------------------ 套組 */
  {
    id: "taiwan-patrol-suite",
    name: "台灣巡邏套組 TaiwanPatrolSuite",
    category: "suite",
    tagline: "一套裝完，台灣員警的巡邏日常全部搬進 GTA V。",
    price: null,
    unit: "套",
    badge: "主打",
    version: "v1.1.0",
    images: [
      "assets/img/tps-alpr.jpg",
      "assets/img/tps-menu.jpg",
      "assets/img/tps-refuel.jpg",
      "assets/img/tps-map.jpg",
      "assets/img/tps-cone.jpg",
      "assets/img/plugins-loaded.jpg",
    ],
    features: [
      "車牌辨識系統：自動掃描路過車輛，顯示車主、牌照狀態、強制險、未繳罰單",
      "車輛控制選單：36 項功能，配件 1–12 切換、修復、清洗、翻正本車",
      "安全帶系統：上下車自動提示，HUD 即時顯示安全帶 / 引擎狀態",
      "加油系統：停在加油站即可加油，油量百分比即時顯示",
      "台灣化 HUD：區域、街道、方位、時間、車速、速限、呼號一目瞭然",
      "全繁體中文地圖標記：警局、商店、改裝廠、靶場全部中文化",
      "電擊槍與三角錐放置等執勤道具",
      "所有選項變更立即套用並自動儲存",
    ],
    details: [
      "台灣巡邏套組是本工作室的核心作品，專為 LSPDFR 玩家打造。它把台灣警察執勤時會用到的功能整合在一個插件裡，安裝後打開選單就能使用，不需要再東拼西湊其他插件。",
      "套組包含 TaiwanPatrolSuite.Core 核心與相關資源檔，搭配本工作室的台灣警車模型使用效果最佳。",
    ],
    notes: [
      "需先安裝 LSPDFR 與 RagePluginHook",
      "購買後提供免費代裝，安裝問題可直接聯絡工作室",
    ],
  },

  /* ------------------------------------------------------------ 車輛 */
  {
    id: "outlander-police",
    name: "Mitsubishi Outlander 台灣警車",
    category: "vehicle",
    tagline: "大安分局 021 塗裝，Blender 手工建模、細節到位的台灣制式警車。",
    price: null,
    unit: "輛",
    badge: "熱門",
    version: "",
    images: [
      "assets/img/tps-refuel.jpg",
      "assets/img/tps-alpr.jpg",
      "assets/img/outlander-ingame.jpg",
      "assets/img/outlander-blender-front.jpg",
      "assets/img/outlander-blender-detail.jpg",
      "assets/img/outlander-blender-rear.jpg",
      "assets/img/outlander-livery.jpg",
    ],
    features: [
      "依照實車比例建模，前後保桿、水箱罩、尾燈均獨立製作",
      "台灣警用黑白塗裝（大安分局 021），可客製分局與車號",
      "車頂警示燈條，紅藍閃光效果",
      "可搭配台灣巡邏套組使用車輛控制、配件切換功能",
      "支援自訂車牌（例：BFV-3882）",
    ],
    details: [
      "Outlander 是台灣各分局最常見的巡邏車之一。這台模型在 Blender 中從頭製作，車頭三菱標誌、鍍鉻飾條、霧燈細節都完整重現。",
      "除了台灣塗裝之外，也可以依需求製作其他國家或單位的塗裝（塗裝更改請參考價目表）。",
    ],
    notes: ["提供免費代裝服務", "塗裝更改：NTD 50 / 張"],
  },
  {
    id: "camry-police",
    name: "Toyota Camry 台灣警車",
    category: "vehicle",
    tagline: "紅藍警示燈條、警察字樣塗裝，Camry 巡邏車完整重現。",
    price: null,
    unit: "輛",
    badge: "",
    version: "",
    images: [
      "assets/img/drugtest-2.jpg",
      "assets/img/drugtest-3.jpg",
      "assets/img/camry-blender.jpg",
      "assets/img/camry-blender-2.jpg",
    ],
    features: [
      "Blender 建模，車頂警示燈條為獨立模型",
      "台灣警察塗裝，含車門「警察」字樣",
      "後車廂可開啟，支援搜索與道具互動",
      "可客製車牌與分局編號",
    ],
    details: [
      "Camry 警車是許多分局的主力巡邏車。這台模型在建模階段就把燈條、後視鏡、輪圈分開處理，遊戲中的開門、後車廂動畫都正常運作。",
    ],
    notes: ["提供免費代裝服務", "塗裝更改：NTD 50 / 張"],
  },
  {
    id: "outlander-police-equipment",
    name: "Outlander 警用裝備車（後廂裝備版）",
    category: "vehicle",
    tagline: "後車廂內建完整警用裝備：三角錐、急救箱、指揮棒、電腦。",
    price: null,
    unit: "輛",
    badge: "",
    version: "",
    images: [
      "assets/img/drugtest-1.jpg",
      "assets/img/outlander-ingame.jpg",
    ],
    features: [
      "後車廂內置警用裝備模型，開廂即見",
      "車身「警察」字樣與側面塗裝",
      "可搭配毒品現場測試、Stop The Ped 等插件做現場搜證",
    ],
    details: [
      "在 Outlander 警車基礎上，追加後廂裝備版本，適合喜歡 RP 沉浸感的玩家。",
    ],
    notes: ["提供免費代裝服務"],
  },

  /* ------------------------------------------------------------ 插件 */
  {
    id: "drug-field-test",
    name: "毒品現場測試模組",
    category: "plugin",
    tagline: "八種試劑、現場鑑定，讓臨檢搜索有結果可查。",
    price: null,
    unit: "個",
    badge: "新品",
    version: "",
    images: [
      "assets/img/drugtest-3.jpg",
      "assets/img/drugtest-2.jpg",
      "assets/img/drugtest-1.jpg",
    ],
    features: [
      "Duquenois-Levine、Scott、Mecke、Mandelin、Mollies、Ehrlich、Fentanyl、PCP 共 8 種試劑",
      "搜索到可疑物品後，選擇對應試劑進行測試並顯示結果",
      "測試結果以通知顯示，包含物品、試劑與結果",
      "全繁體中文介面",
    ],
    details: [
      "搭配 Stop The Ped 的搜索功能，搜到不明粉末或晶體時，可以打開毒品現場測試選單，用正確的試劑鑑定是大麻、甲基安非他命或其他毒品。",
    ],
    notes: ["需先安裝 LSPDFR"],
  },
  {
    id: "lspdfr-zh-pack",
    name: "LSPDFR 核心繁體中文化",
    category: "plugin",
    tagline: "LSPDFR 0.4 本體與互動選單、警用無線電、追捕系統全面中文化。",
    price: null,
    unit: "套",
    badge: "免費代裝",
    version: "LSPDFR 0.4",
    images: [
      "assets/img/menu-interaction.jpg",
      "assets/img/radio.jpg",
      "assets/img/pursuit.jpg",
      "assets/img/menu-vehicle.jpg",
      "assets/img/settings.jpg",
      "assets/img/dispatch.jpg",
      "assets/img/lspdfr-locker.jpg",
    ],
    features: [
      "互動選單：快速導航、警用無線電、車輛、裝備、設定、動作、對話、表情、走路風格",
      "警用無線電：可接受派遣、請求資料查詢、封閉附近道路",
      "車輛追捕選項：單位、行為、戰術、致命武力政策、終止追捕",
      "車輛選項：引擎、車燈、車門、警示燈與警笛、警車收音機",
      "調度中心 911 通知：追捕結束統計、逮捕與擊斃嫌犯數",
      "出生角色、出生地點、擁有公寓等設定項目",
    ],
    details: [
      "把 LSPDFR 的所有選單與提示翻成通順的繁體中文，不再需要邊玩邊查英文。翻譯內容依照台灣警察用語調整，例如「派遣」「臨檢」「致命武力」。",
    ],
    notes: ["警察模組及核心插件代裝：免費"],
  },
  {
    id: "callouts-zh-pack",
    name: "Callouts 插件中文化包",
    category: "plugin",
    tagline: "686 Callouts、MCCallouts、Stop The Ped、CompuLite 等熱門插件繁體中文化。",
    price: null,
    unit: "個",
    badge: "",
    version: "",
    images: [
      "assets/img/plugins-loaded-2.jpg",
      "assets/img/plugins-loaded.jpg",
    ],
    features: [
      "686 Callouts 2.1.2.0：任務、職業統計（完成任務、交火、追捕、逮捕）中文化",
      "MCCallouts 1.8.5.0：載入訊息與任務內容中文化",
      "Stop The Ped 4.9.5.2：搜索結果、臨檢對話中文化",
      "CompuLite 1.5.2.6：車輛與人員查詢介面中文化",
      "Grammar Police、Riskier Traffic Stops、AutoPursuitBackupDisabler 相容性測試",
    ],
    details: [
      "每個 Callouts 插件的語言檔獨立翻譯，可以只買需要的，也可以整包購買。安裝時會一併確認版本相容性，避免載入衝突。",
    ],
    notes: ["插件代裝：NTD 10 / 個", "購買前請告知你目前的 LSPDFR 版本"],
  },

  /* ------------------------------------------------------------ 工具 */
  {
    id: "trainer-zh",
    name: "Enhanced Native Trainer 繁體中文化",
    category: "tool",
    tagline: "玩家、載具、其他選項全部中文化，功能名稱一看就懂。",
    price: null,
    unit: "個",
    badge: "",
    version: "",
    images: [
      "assets/img/ent-vehicle.jpg",
      "assets/img/ent-player.jpg",
      "assets/img/ent-misc.jpg",
    ],
    features: [
      "玩家選項：水下行走、力場、衝撞能力、通緝等級、燃燒模式 等 39 項",
      "載具選項：自動修復、自動翻正、彩虹模式、拖車模式、飛行模式 等 38 項",
      "其他選項：自由鏡頭、俯視視角、流星雨、EMP、煙火大會 等 29 項",
      "保留原版快捷鍵與操作方式",
    ],
    details: [
      "Enhanced Native Trainer 功能很多，但英文名稱常常讓人搞不清楚在做什麼。中文化後每個功能都有清楚的中文名稱，適合拍片、測試模組或單純想玩的玩家。",
    ],
    notes: [],
  },
  {
    id: "weather-menu-zh",
    name: "天氣與環境選單中文化",
    category: "tool",
    tagline: "十六種天氣一鍵切換，拍攝取景更方便。",
    price: null,
    unit: "個",
    badge: "",
    version: "",
    images: ["assets/img/weather.jpg"],
    features: [
      "晴朗無雲、晴天、多雲、霧霾、起霧、陰天、下雨、雷雨、雨後轉晴、中性",
      "下雪、暴風雪、小雪、聖誕雪景",
      "強風開關、天氣持續（鎖定）開關",
    ],
    details: ["適合搭配 Trainer 中文化一起使用，拍攝警察 RP 影片時可以快速切換到想要的氛圍。"],
    notes: [],
  },
  {
    id: "map-editor-setup",
    name: "Map Editor 場景編輯代裝",
    category: "tool",
    tagline: "自建場景、擺放物件與車輛，打造專屬執勤現場。",
    price: null,
    unit: "個",
    badge: "",
    version: "",
    images: ["assets/img/mapeditor.jpg"],
    features: [
      "物件、行人、車輛生成與擺放",
      "加入資料庫、複製、移動、屬性選單、標記放置",
      "可儲存場景並在下次遊戲載入",
    ],
    details: ["適合想自己布置車禍現場、臨檢站或分局場景的玩家，代裝時會一併確認與其他插件的相容性。"],
    notes: ["插件代裝：NTD 10 / 個"],
  },

  /* ------------------------------------------------------------ 服務 */
  {
    id: "svc-core-install",
    name: "警察模組及核心插件代裝",
    category: "service",
    tagline: "LSPDFR、RagePluginHook 與核心插件，幫你裝到能開玩。",
    price: 0,
    unit: "次",
    badge: "免費",
    version: "",
    images: ["assets/img/lspdfr-locker.jpg"],
    features: ["LSPDFR 本體與 RagePluginHook 安裝", "核心相依插件設定", "第一次啟動測試"],
    details: ["購買本工作室任何商品皆附贈，也可單獨申請。"],
    notes: [],
  },
  {
    id: "svc-plugin-install",
    name: "插件代裝",
    category: "service",
    tagline: "Callouts、功能插件，一個 10 元幫你裝好裝對。",
    price: 10,
    unit: "個",
    badge: "",
    version: "",
    images: ["assets/img/plugins-loaded-2.jpg"],
    features: ["確認版本相容性", "設定 INI 檔", "載入測試"],
    details: [],
    notes: [],
  },
  {
    id: "svc-vehicle-install",
    name: "車輛代裝",
    category: "service",
    tagline: "警車、民車模型安裝，含 vehicles.meta 與 carvariations 設定。",
    price: 10,
    unit: "輛",
    badge: "",
    version: "",
    images: ["assets/img/outlander-ingame.jpg"],
    features: ["Add-on 或替換安裝", "handling、carvariations 設定", "警示燈與警笛對應"],
    details: [],
    notes: [],
  },
  {
    id: "svc-outfit-install",
    name: "服飾代裝",
    category: "service",
    tagline: "警察制服、背心、配件安裝。",
    price: 10,
    unit: "件",
    badge: "",
    version: "",
    images: ["assets/img/drugtest-3.jpg"],
    features: ["EUP 服飾安裝", "Outfit 設定檔"],
    details: [],
    notes: [],
  },
  {
    id: "svc-weapon-install",
    name: "武器代裝",
    category: "service",
    tagline: "武器模型替換與 Add-on 安裝。",
    price: 15,
    unit: "把",
    badge: "",
    version: "",
    images: ["assets/img/tps-refuel.jpg"],
    features: ["武器模型與貼圖安裝", "weapons.meta 設定"],
    details: [],
    notes: [],
  },
  {
    id: "svc-siren-install",
    name: "警笛包代裝",
    category: "service",
    tagline: "整包警笛音效安裝與對應設定。",
    price: 20,
    unit: "包",
    badge: "",
    version: "",
    images: ["assets/img/pursuit.jpg"],
    features: ["警笛音效包安裝", "SirenSetting 對應"],
    details: [],
    notes: [],
  },
  {
    id: "svc-siren-edit",
    name: "警笛更改",
    category: "service",
    tagline: "把指定車輛的警笛換成你要的音效。",
    price: 50,
    unit: "個",
    badge: "",
    version: "",
    images: ["assets/img/dispatch.jpg"],
    features: ["單一車輛警笛替換", "音量與循環設定"],
    details: [],
    notes: [],
  },
  {
    id: "svc-livery-edit",
    name: "塗裝更改",
    category: "service",
    tagline: "客製分局、車號、單位塗裝，一張 50 元。",
    price: 50,
    unit: "張",
    badge: "",
    version: "",
    images: ["assets/img/outlander-livery.jpg", "assets/img/tps-alpr.jpg"],
    features: ["分局名稱、車號客製", "其他國家 / 單位塗裝製作", "提供貼圖檔（DDS / PNG）"],
    details: [],
    notes: [],
  },
  {
    id: "svc-vehicle-fix",
    name: "車輛修復",
    category: "service",
    tagline: "車輛模型破圖、燈光異常、無法生成等問題修復。",
    price: 10,
    unit: "個",
    badge: "",
    version: "",
    images: ["assets/img/outlander-blender-detail.jpg"],
    features: ["破圖與貼圖遺失修復", "碰撞與燈光修正", "生成失敗排查"],
    details: [],
    notes: [],
  },
  {
    id: "svc-crash-fix",
    name: "崩潰修復",
    category: "service",
    tagline: "遊戲閃退、ERR_GEN_ZLIB、插件衝突，找出原因並修好。",
    price: 30,
    unit: "個",
    badge: "",
    version: "",
    images: ["assets/img/plugins-loaded.jpg"],
    features: ["讀取 RagePluginHook / ScriptHook 日誌", "插件版本衝突排查", "遊戲檔案驗證與修復建議"],
    details: [],
    notes: [],
  },
];

/* 價目表（服務） */
const PRICE_LIST = [
  { item: "警察模組及核心插件代裝", price: 0,  unit: "" },
  { item: "插件代裝",               price: 10, unit: "個" },
  { item: "車輛代裝",               price: 10, unit: "輛" },
  { item: "服飾代裝",               price: 10, unit: "件" },
  { item: "武器代裝",               price: 15, unit: "把" },
  { item: "警笛包代裝",             price: 20, unit: "包" },
  { item: "警笛更改",               price: 50, unit: "個" },
  { item: "塗裝更改",               price: 50, unit: "張" },
  { item: "車輛修復",               price: 10, unit: "個" },
  { item: "崩潰修復",               price: 30, unit: "個" },
];

/* 常見問題 */
const FAQ = [
  { q: "完全不會裝模組也能買嗎？", a: "可以，買了我們就幫你裝到能玩。" },
  { q: "要先準備什麼？", a: "正版 GTA V（Steam、Rockstar、Epic 都行）。LSPDFR 跟 RagePluginHook 沒裝的話我們免費幫你裝。" },
  { q: "警車可以換分局、車號嗎？", a: "可以，塗裝更改一張 50 元，跟我們說要哪個分局、幾號車就好。" },
  { q: "遊戲閃退、跳 ERR_GEN_ZLIB 怎麼辦？", a: "找我們做崩潰修復（30 元一次），會看 log 找出是哪個插件或檔案的問題。" },
  { q: "付款方式？", a: "跟我們聯絡時會告訴你，先付款後交貨。" },
];
