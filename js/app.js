/* 善武工作室網站：讀取 data/site.json，畫出車輛、其他商品、價目表等。
   商品與文字請到後台（admin/）修改，不需要改這個檔案。 */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isPreview = new URLSearchParams(location.search).has("preview");

  let D = null;          // 網站資料
  const blobs = {};      // 預覽模式：後台還沒發佈的圖片
  const state = { product: null, index: 0, lastFocus: null };

  /* ---------- 小工具 ---------- */
  const isLocal = (p) => !/^(https?:|data:|blob:)/.test(p);
  const thumbOf = (p) => (isLocal(p) ? p.replace(/\.(jpe?g|png|webp)$/i, ".thumb.jpg") : p);
  const src = (p) => blobs[p] || p;
  const tsrc = (p) => blobs[thumbOf(p)] || blobs[p] || thumbOf(p);
  // 縮圖不存在時自動改用原圖
  const thumbImg = (p, alt = "") =>
    `<img src="${esc(tsrc(p))}" data-full="${esc(src(p))}" alt="${esc(alt)}" loading="lazy" onerror="this.onerror=null;this.src=this.dataset.full">`;
  const logoPh = (extra = "") => `<span class="ph">${extra}<img src="assets/img/logo.png" alt=""></span>`;

  // 從 YouTube 網址取出影片 ID（youtu.be/ID、watch?v=ID、embed/ID、shorts/ID 都可以）
  const youtubeId = (url) => {
    const m = String(url || "").match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
  };
  const ytEmbed = (id, title) =>
    `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0" title="${esc(title)} 展示影片" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`;

  const cat = (id) => D.categories.find((c) => c.id === id);
  const catLabel = (id) => cat(id)?.label || "其他";
  const isShowcase = (p) => !!cat(p.category)?.showcase;
  const visible = () => D.products.filter((p) => !p.hidden);
  const discord = () => D.studio.discord || "#contact";

  /* ---------- 價格 ---------- */
  const priceKind = (p) => {
    if (p.priceText) return "text";
    if (p.price === null || p.price === undefined || p.price === "") return "ask";
    return Number(p.price) === 0 ? "free" : "num";
  };
  const priceInline = (p) => {
    switch (priceKind(p)) {
      case "text": return `NT$ ${esc(p.priceText)}`;
      case "ask": return "價格請洽詢";
      case "free": return `<span class="free">免費</span>`;
      default: return `NT$ ${Number(p.price).toLocaleString("zh-TW")}${p.unit ? `<small>/ ${esc(p.unit)}</small>` : ""}`;
    }
  };
  const plate = (p) => {
    switch (priceKind(p)) {
      case "text": return `<span class="price"><span class="plate text"><small>NT$</small><b>${esc(p.priceText)}</b></span></span>`;
      case "ask": return `<span class="price price-ask">價格請洽詢</span>`;
      case "free": return `<span class="price"><span class="plate free"><b>免費</b></span></span>`;
      default: return `<span class="price"><span class="plate"><small>NT$</small><b>${Number(p.price).toLocaleString("zh-TW")}</b></span>${p.unit ? `<span class="price-unit">/ ${esc(p.unit)}</span>` : ""}</span>`;
    }
  };

  let toastTimer;
  const toast = (msg) => {
    const el = $("#toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2200);
  };

  /* ---------- 讀資料 ---------- */
  function readPendingFiles() {
    return new Promise((resolve) => {
      if (!("indexedDB" in window)) return resolve([]);
      const req = indexedDB.open("gama-admin", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files", { keyPath: "path" });
      req.onerror = () => resolve([]);
      req.onsuccess = () => {
        try {
          const all = req.result.transaction("files").objectStore("files").getAll();
          all.onsuccess = () => resolve(all.result || []);
          all.onerror = () => resolve([]);
        } catch (e) { resolve([]); }
      };
    });
  }

  async function load() {
    if (isPreview) {
      try {
        // 「預覽修改」按鈕存的（含還沒儲存的商品）比草稿新，就用它
        const read = (k) => JSON.parse(localStorage.getItem(k) || "null");
        const pv = read("gama-admin-preview"), dr = read("gama-admin-draft");
        const draft = pv && (!dr || pv.savedAt >= dr.savedAt) ? pv : dr;
        if (draft && draft.data) {
          (await readPendingFiles()).forEach((f) => { blobs[f.path] = URL.createObjectURL(f.blob); });
          $("#preview-banner").hidden = false;
          return draft.data;
        }
      } catch (e) { /* 草稿壞掉就改讀正式資料 */ }
    }
    const res = await fetch("data/site.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function normalize(d) {
    d.studio = d.studio || {};
    d.categories = d.categories || [];
    d.products = (d.products || []).map((p) => ({ images: [], features: [], details: [], notes: [], ...p }));
    d.priceList = d.priceList || [];
    d.howToBuy = d.howToBuy || [];
    d.faq = d.faq || [];
    return d;
  }

  /* ---------- 固定文字 ---------- */
  function renderStatic() {
    const s = D.studio;
    document.title = `${s.name} · GTA V 台灣警車`;
    $$("[data-bind=name]").forEach((el) => (el.textContent = s.name));
    $("#hero-desc").textContent = s.intro || "";
    $$("[data-discord]").forEach((a) => (a.href = discord()));
    $("#year").textContent = new Date().getFullYear();
  }

  /* ---------- 首圖輪播 ---------- */
  const hero = { slides: [], i: 0, timer: null };
  function renderHero() {
    const vs = visible().filter((p) => isShowcase(p) && p.images.length);
    const slides = [];
    for (let k = 0; k < 3; k++) vs.forEach((p) => { if (p.images[k]) slides.push({ p, k }); });
    hero.slides = slides.slice(0, 6);
    if (!hero.slides.length) return;
    $("#hero-slides").innerHTML = hero.slides.map((s, n) =>
      `<img class="hero-slide${n === 0 ? " on" : ""}" ${n === 0 ? "src" : "data-src"}="${esc(src(s.p.images[s.k]))}" alt="" ${n === 0 ? 'fetchpriority="high"' : ""}>`).join("");
    $("#hero-caption").innerHTML = `
      <button type="button" class="hero-cap" id="hero-cap"></button>
      ${hero.slides.length > 1 ? `<div class="hero-dots${reduceMotion ? "" : " auto"}" id="hero-dots">${hero.slides.map((s, n) =>
        `<button type="button" data-slide="${n}" aria-label="第 ${n + 1} 張：${esc(s.p.name)}"><span><i></i></span></button>`).join("")}</div>` : ""}`;
    showSlide(0);
    if (hero.slides.length > 1 && !reduceMotion) {
      $("#hero").addEventListener("mouseenter", () => clearTimeout(hero.timer));
      $("#hero").addEventListener("mouseleave", () => schedule());
      document.addEventListener("visibilitychange", () => (document.hidden ? clearTimeout(hero.timer) : schedule()));
    }
  }
  function loadSlide(n) {
    const img = $$(".hero-slide")[n];
    if (img && img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
  }
  function showSlide(n) {
    hero.i = n;
    loadSlide(n); loadSlide((n + 1) % hero.slides.length);
    $$(".hero-slide").forEach((el, k) => el.classList.toggle("on", k === n));
    $$("#hero-dots button").forEach((el, k) => {
      el.classList.remove("on"); void el.offsetWidth; // 重新開始進度條動畫
      el.classList.toggle("on", k === n);
    });
    const s = hero.slides[n];
    const cap = $("#hero-cap");
    cap.dataset.open = s.p.id; cap.dataset.index = s.k;
    cap.innerHTML = `<span class="hero-cap-k">NOW SHOWING</span><b>${esc(s.p.name)}</b><span class="hero-cap-go">看這台 ›</span>`;
    schedule();
  }
  function schedule() {
    clearTimeout(hero.timer);
    if (hero.slides.length > 1 && !reduceMotion && !document.hidden) hero.timer = setTimeout(() => showSlide((hero.i + 1) % hero.slides.length), 6000);
  }

  /* ---------- 主要內容 ---------- */
  const secBar = (no, title, en) =>
    `<header class="sec-bar reveal"><span class="sec-no">${no}</span><h2>${esc(title)}</h2><span class="sec-en">${en}</span></header>`;

  function spreadHtml(p, k) {
    const imgs = p.images, yt = youtubeId(p.video);
    let media;
    if (imgs.length) {
      const shown = imgs.slice(0, 6);
      media = `
        <button type="button" class="spread-main" data-open="${esc(p.id)}" data-index="0" aria-label="看 ${esc(p.name)} 的大圖">
          <img src="${esc(src(imgs[0]))}" alt="${esc(p.name)}" loading="lazy">
          ${imgs.length > 1 ? `<span class="spread-count">${imgs.length} PHOTOS</span>` : ""}
          <span class="spread-zoom">點圖看大圖</span>
        </button>
        ${imgs.length > 1 ? `<div class="spread-thumbs">${shown.map((s, i) => {
          const more = i === shown.length - 1 && imgs.length > shown.length;
          return `<button type="button" class="${i === 0 ? "on" : ""}" ${more ? `data-open="${esc(p.id)}" data-index="${i}"` : `data-swap="${i}"`} aria-label="第 ${i + 1} 張">${thumbImg(s)}${more ? `<span class="more">+${imgs.length - shown.length}</span>` : ""}</button>`;
        }).join("")}</div>` : ""}`;
    } else if (yt) {
      media = `<div class="spread-video">${ytEmbed(yt, p.name)}</div>`;
    } else {
      media = `<button type="button" class="spread-main" data-open="${esc(p.id)}" aria-label="看 ${esc(p.name)}">${logoPh()}</button>`;
    }
    return `
      <article class="spread reveal${k % 2 ? " flip" : ""}" data-id="${esc(p.id)}">
        <div class="spread-media">${media}</div>
        <div class="spread-info">
          <p class="spread-kicker">${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}<span>NO.${String(k + 1).padStart(2, "0")}</span></p>
          <h3>${esc(p.name)}</h3>
          ${p.tagline ? `<p class="spread-tag">${esc(p.tagline)}</p>` : ""}
          ${p.features.length ? `<ul class="checks">${p.features.slice(0, 5).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
          <div class="spread-buy">
            ${plate(p)}
            <div class="spread-actions">
              <button type="button" class="btn btn-ghost" data-open="${esc(p.id)}">完整介紹</button>
              <a class="btn btn-red" href="${esc(discord())}" target="_blank" rel="noopener">Discord 下單</a>
            </div>
          </div>
        </div>
      </article>`;
  }

  function othersThumb(p) {
    if (p.images.length) return thumbImg(p.images[0]);
    const yt = youtubeId(p.video);
    if (yt) return `<span class="vthumb" style="background-image:url('https://i.ytimg.com/vi/${yt}/mqdefault.jpg')"><i>▶</i></span>`;
    return logoPh();
  }

  function oitemHtml(p) {
    return `<li><button type="button" class="oitem" data-open="${esc(p.id)}">
      <span class="oitem-thumb">${othersThumb(p)}</span>
      <span class="oitem-text">
        <span class="oitem-name">${esc(p.name)}</span>
        ${p.tagline ? `<span class="oitem-desc">${esc(p.tagline)}</span>` : ""}
        <span class="oitem-foot"><span class="oitem-price${priceKind(p) === "ask" ? " ask" : ""}">${priceInline(p)}</span><span class="oitem-go">詳情 ›</span></span>
      </span>
    </button></li>`;
  }

  function renderApp() {
    let n = 0;
    const no = () => String(++n).padStart(2, "0");
    const list = visible();
    const knownCats = new Set(D.categories.map((c) => c.id));
    let html = "";

    // 車輛（大圖展示的分類）
    const showcase = D.categories.filter((c) => c.showcase)
      .map((c) => ({ c, items: list.filter((p) => p.category === c.id) }))
      .filter((g) => g.items.length);
    if (showcase.length) {
      const single = showcase.length === 1;
      html += `<section class="sec" id="vehicles"><div class="wrap">
        ${secBar(no(), single ? showcase[0].c.label : "車輛展示", "VEHICLES")}
        ${single && showcase[0].c.desc ? `<p class="sec-lead reveal">${esc(showcase[0].c.desc)}</p>` : ""}
        ${showcase.map((g) => `
          ${single ? "" : `<div class="sub-head reveal"><h3>${esc(g.c.label)}</h3>${g.c.desc ? `<p>${esc(g.c.desc)}</p>` : ""}</div>`}
          <div class="spreads">${g.items.map(spreadHtml).join("")}</div>`).join("")}
      </div></section>`;
    }

    // 其他商品
    const groups = D.categories.filter((c) => !c.showcase)
      .map((c) => ({ id: c.id, label: c.label, desc: c.desc, items: list.filter((p) => p.category === c.id) }));
    const orphans = list.filter((p) => !knownCats.has(p.category));
    if (orphans.length) groups.push({ id: "_other", label: "其他", desc: "", items: orphans });
    const shownGroups = groups.filter((g) => g.items.length);
    if (shownGroups.length) {
      const total = shownGroups.reduce((a, g) => a + g.items.length, 0);
      html += `<section class="sec" id="others"><div class="wrap">
        ${secBar(no(), "其他商品", "MORE")}
        ${D.studio.otherDesc ? `<p class="sec-lead reveal">${esc(D.studio.otherDesc)}</p>` : ""}
        ${shownGroups.length > 1 ? `<div class="chips reveal" role="toolbar" aria-label="分類篩選">
          <button type="button" class="chip" data-filter="all" aria-pressed="true">全部<i>${total}</i></button>
          ${shownGroups.map((g) => `<button type="button" class="chip" data-filter="${esc(g.id)}" aria-pressed="false">${esc(g.label)}<i>${g.items.length}</i></button>`).join("")}
        </div>` : ""}
        ${shownGroups.map((g) => `
          <div class="ogroup reveal" data-group="${esc(g.id)}">
            <div class="sub-head"><h3>${esc(g.label)}</h3>${g.desc ? `<p>${esc(g.desc)}</p>` : ""}</div>
            <ul class="ogrid">${g.items.map(oitemHtml).join("")}</ul>
          </div>`).join("")}
      </div></section>`;
    }

    // 價目表
    if (D.priceList.length) {
      html += `<section class="sec" id="pricing"><div class="wrap">
        ${secBar(no(), "價目表", "PRICE LIST")}
        <div class="poster-wrap"><div class="poster reveal">
          <p class="poster-brand"><img src="assets/img/logo.png" alt="">${esc(D.studio.name)}</p>
          <h3 class="poster-title">價目表</h3>
          ${D.studio.orderNote ? `<p class="poster-red">${esc(D.studio.orderNote)}</p>` : ""}
          ${D.studio.pricingNote ? `<p class="poster-sub">${esc(D.studio.pricingNote)}</p>` : ""}
          <ol class="poster-list">${D.priceList.map((r) => `
            <li><span>${esc(r.item)}</span><span class="dots"></span>${Number(r.price) === 0
              ? `<span class="free">免費</span>`
              : `<b>NTD ${esc(r.price)}${r.unit ? `<small>/ ${esc(r.unit)}</small>` : ""}</b>`}</li>`).join("")}
          </ol>
        </div></div>
      </div></section>`;
    }

    // 購買方式
    if (D.howToBuy.length) {
      html += `<section class="sec" id="how"><div class="wrap">
        ${secBar(no(), "購買方式", "HOW TO BUY")}
        <ol class="steps">${D.howToBuy.map((s) => `<li class="reveal">${esc(s)}</li>`).join("")}</ol>
      </div></section>`;
    }

    // 常見問題
    if (D.faq.length) {
      html += `<section class="sec" id="faq"><div class="wrap">
        ${secBar(no(), "常見問題", "FAQ")}
        <div class="faq">${D.faq.map((f, i) => `
          <details class="qa reveal"${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><div class="qa-a"><p>${esc(f.a)}</p></div></details>`).join("")}
        </div>
      </div></section>`;
    }

    // 聯絡
    html += `<section class="contact" id="contact"><div class="wrap contact-inner">
      <img class="contact-logo" src="assets/img/logo.png" alt="">
      <div>
        <p class="eyebrow">DISCORD</p>
        <h2>到 Discord 開服務單</h2>
        ${D.studio.contactText ? `<p class="contact-text">${esc(D.studio.contactText)}</p>` : ""}
      </div>
      <div class="contact-go">
        <a class="btn btn-red" href="${esc(discord())}" target="_blank" rel="noopener">加入${esc(D.studio.name)} Discord</a>
        ${D.studio.discord ? `<span class="contact-url">${esc(D.studio.discord.replace(/^https?:\/\//, ""))}</span>` : ""}
      </div>
    </div></section>`;

    $("#app").innerHTML = html;
    // 沒有內容的區塊，選單也一起藏起來
    $$(".nav a").forEach((a) => { a.hidden = !document.getElementById(a.getAttribute("href").slice(1)); });
  }

  /* ---------- 詳情視窗 ---------- */
  function openModal(id, { index = 0, pushHash = true } = {}) {
    const p = D.products.find((x) => x.id === id);
    if (!p) return;
    const wasOpen = !!state.product;
    state.product = p; state.index = Math.min(index, Math.max(0, p.images.length - 1));
    if (!wasOpen) state.lastFocus = document.activeElement;

    const showcase = isShowcase(p);
    $("#modal-cat").textContent = catLabel(p.category);
    $("#modal-body").innerHTML = `
      <p class="m-kicker">${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}${esc(catLabel(p.category))}</p>
      <h2 id="modal-title" tabindex="-1">${esc(p.name)}</h2>
      ${p.tagline ? `<p class="m-tag">${esc(p.tagline)}</p>` : ""}
      <div class="m-price">${plate(p)}</div>
      <div class="m-actions">
        <a class="btn btn-red" href="${esc(discord())}" target="_blank" rel="noopener">${showcase ? "我要這台" : "我要這個"} · Discord 下單</a>
        <button type="button" class="btn btn-ghost" data-share>複製連結</button>
      </div>
      ${p.video ? `<p class="m-video"><a href="${esc(p.video)}" target="_blank" rel="noopener">在 YouTube 看展示影片</a></p>` : ""}
      ${p.details.length ? `<div class="m-sec"><h3>介紹</h3>${p.details.map((d) => `<p>${esc(d)}</p>`).join("")}</div>` : ""}
      ${p.features.length ? `<div class="m-sec"><h3>內容</h3><ul class="checks">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>` : ""}
      ${p.notes.length ? `<div class="m-sec m-notes"><h3>注意事項</h3><ul>${p.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}`;

    renderGallery();
    $("#modal").hidden = false;
    document.body.classList.add("modal-open");
    $("#modal-title").focus({ preventScroll: true });
    $("#modal-body").scrollTop = 0;
    $(".modal-grid").scrollTop = 0;
    if (pushHash) history.pushState({ product: id }, "", `#product/${id}`);
  }

  function closeModal({ popHash = true } = {}) {
    if ($("#modal").hidden) return;
    $("#modal").hidden = true;
    $$("#gallery-main .gallery-video, #gallery-main .gallery-img, #gallery-main .ph").forEach((el) => el.remove()); // 拿掉播放器，影片才會停
    document.body.classList.remove("modal-open");
    const p = state.product;
    state.product = null;
    if (state.lastFocus?.focus) state.lastFocus.focus({ preventScroll: true });
    if (popHash && location.hash.startsWith("#product/")) {
      history.pushState({}, "", location.pathname + location.search + (p && isShowcase(p) ? "#vehicles" : "#others"));
    }
  }

  function renderGallery() {
    const p = state.product, imgs = p.images, i = state.index;
    const main = $("#gallery-main");
    const yt = youtubeId(p.video);
    main.querySelectorAll(".ph, .gallery-video").forEach((el) => el.remove());
    let img = main.querySelector(".gallery-img");
    if (imgs.length) {
      if (!img) { img = document.createElement("img"); img.className = "gallery-img"; main.prepend(img); }
      const next = src(imgs[i]);
      if (img.getAttribute("src") !== next) {
        img.classList.add("loading");
        img.onload = img.onerror = () => img.classList.remove("loading");
        img.src = next;
      }
      img.alt = `${p.name} 圖片 ${i + 1}`;
    } else {
      img?.remove();
      main.insertAdjacentHTML("afterbegin", yt
        ? ytEmbed(yt, p.name).replace("<iframe", '<iframe class="gallery-video"')
        : `<span class="ph big"><img src="assets/img/logo.png" alt=""><b>${esc(p.name)}</b><small>目前沒有圖片</small></span>`);
    }
    $("#gallery-counter").textContent = imgs.length > 1 ? `${i + 1} / ${imgs.length}` : "";
    $("#gallery-prev").disabled = imgs.length <= 1;
    $("#gallery-next").disabled = imgs.length <= 1;
    const thumbs = $("#gallery-thumbs");
    if (imgs.length > 1) {
      if (thumbs.dataset.for !== p.id) {
        thumbs.innerHTML = imgs.map((s, k) => `<button type="button" role="tab" data-index="${k}" aria-label="第 ${k + 1} 張">${thumbImg(s)}</button>`).join("");
        thumbs.dataset.for = p.id;
      }
      $$("button", thumbs).forEach((b, k) => b.setAttribute("aria-selected", String(k === i)));
      thumbs.children[i]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      const pre = new Image(); pre.src = src(imgs[(i + 1) % imgs.length]);
    } else {
      thumbs.innerHTML = ""; thumbs.dataset.for = "";
    }
  }

  function step(d) {
    const n = state.product?.images.length || 0;
    if (n <= 1) return;
    state.index = (state.index + d + n) % n;
    renderGallery();
  }

  /* ---------- 互動 ---------- */
  function bind() {
    document.addEventListener("click", (e) => {
      const swap = e.target.closest("[data-swap]");
      if (swap) {
        const spread = swap.closest(".spread");
        const p = D.products.find((x) => x.id === spread.dataset.id);
        const k = Number(swap.dataset.swap);
        const main = $(".spread-main", spread), img = $("img", main);
        main.dataset.index = k;
        img.classList.add("swap");
        img.onload = () => img.classList.remove("swap");
        img.src = src(p.images[k]);
        $$(".spread-thumbs button", spread).forEach((b) => b.classList.toggle("on", b === swap));
        return;
      }
      const open = e.target.closest("[data-open]");
      if (open) { openModal(open.dataset.open, { index: Number(open.dataset.index || 0) }); return; }
      const slide = e.target.closest("[data-slide]");
      if (slide) { showSlide(Number(slide.dataset.slide)); return; }
      const chip = e.target.closest("[data-filter]");
      if (chip) {
        const f = chip.dataset.filter;
        $$(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        $$(".ogroup").forEach((g) => { g.hidden = f !== "all" && g.dataset.group !== f; g.classList.add("in"); });
        return;
      }
      if (e.target.closest("[data-share]")) {
        const url = `${location.origin}${location.pathname}#product/${state.product.id}`;
        navigator.clipboard?.writeText(url).then(() => toast("連結已複製，可以直接貼給朋友"), () => toast(url));
      }
    });
    $("#modal").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
    $("#gallery-prev").addEventListener("click", () => step(-1));
    $("#gallery-next").addEventListener("click", () => step(1));
    $("#gallery-thumbs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-index]");
      if (b) { state.index = Number(b.dataset.index); renderGallery(); }
    });
    let tx = null;
    $("#gallery-main").addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true });
    $("#gallery-main").addEventListener("touchend", (e) => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      tx = null;
    });
    document.addEventListener("keydown", (e) => {
      if ($("#modal").hidden) return;
      if (e.key === "Escape") closeModal();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Tab") { // 焦點留在視窗裡
        const f = $$('#modal button:not([disabled]), #modal a[href], #modal iframe, #modal [tabindex="-1"]').filter((el) => el.offsetParent !== null);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener("popstate", handleHash);
    const top = $("#top");
    const onScroll = () => top.classList.toggle("scrolled", scrollY > 8);
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  function handleHash() {
    const m = location.hash.match(/^#product\/([\w-]+)$/);
    if (m) openModal(m[1], { pushHash: false });
    else closeModal({ popHash: false });
  }

  // 捲到才淡入；選單標出目前所在的區塊
  function observe() {
    if ("IntersectionObserver" in window) {
      if (!reduceMotion) {
        document.documentElement.classList.add("js-reveal");
        const io = new IntersectionObserver((entries) => entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        }), { rootMargin: "0px 0px -8% 0px" });
        $$(".reveal").forEach((el) => io.observe(el));
      }
      const links = $$(".nav a");
      const spy = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${en.target.id}`));
      }), { rootMargin: "-45% 0px -50% 0px" });
      $$("main section[id]").forEach((s) => spy.observe(s));
    }
  }

  load()
    .then((d) => {
      D = normalize(d);
      renderStatic(); renderHero(); renderApp(); bind(); observe(); handleHash();
    })
    .catch((err) => {
      console.error(err);
      $("#app").innerHTML = `<div class="wrap load-fail"><p>${location.protocol === "file:"
        ? "請用資料夾裡的「開啟網站.bat」開啟網站，直接點兩下 index.html 會讀不到商品資料。"
        : "商品資料載入失敗，請重新整理一次。"}</p></div>`;
    });
})();
