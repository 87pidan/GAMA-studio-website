/* 網站邏輯：車輛展示、其他商品清單、詳情視窗。內容請改 js/products.js */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);

  const state = { product: null, index: 0, lastFocus: null };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const priceHtml = (p) => {
    if (p.priceText) return `NT$ ${esc(p.priceText)}`;
    if (p.price === null || p.price === undefined) return "價格請洽詢";
    if (p.price === 0) return `<span class="free">免費</span>`;
    return `NT$ ${p.price.toLocaleString("zh-TW")}${p.unit ? `<small>/ ${esc(p.unit)}</small>` : ""}`;
  };

  let toastTimer;
  const toast = (msg) => {
    const el = $("#toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2000);
  };

  const vehicles = () => PRODUCTS.filter((p) => p.category === "vehicle");
  const others = () => PRODUCTS.filter((p) => p.category !== "vehicle");

  /* ---------- 固定內容 ---------- */
  function renderStatic() {
    document.title = `${STUDIO.name} · 台灣警車`;
    $("#brand-name").textContent = STUDIO.name;
    $("#intro-title").textContent = STUDIO.name;
    $("#footer-name").textContent = STUDIO.name;
    $("#intro-text").textContent = STUDIO.intro;
    $("#order-note").textContent = STUDIO.orderNote;
    $("#pricing-note").textContent = STUDIO.pricingNote || "";
    $("#contact-text").textContent = STUDIO.contactText || "";
    $("#vehicle-desc").textContent = CATEGORIES.vehicle?.desc || "";
    $("#other-desc").textContent = STUDIO.otherDesc || "";
    $("#year").textContent = new Date().getFullYear();
    $("#hud-name").textContent = STUDIO.name;
    $("#hud-count").textContent = vehicles().length;
    $("#poster-name").textContent = STUDIO.name;
    if (STUDIO.heroImage) $("#hero-img").src = STUDIO.heroImage;

    const main = STUDIO.contacts[0];
    if (main) { $("#hero-contact").href = main.url; $("#hero-contact").textContent = `${main.label} 找我們`; }
    $("#contact-links").innerHTML = STUDIO.contacts.map((c) => `<li>${esc(c.label)}：<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.display || c.url)}</a></li>`).join("");

    $("#price-body").innerHTML = PRICE_LIST.map((r) => `
      <li>${esc(r.item)}:${r.price === 0 ? `<span class="free">免費</span>` : `<b>NTD${r.price}</b>${r.unit ? `/${esc(r.unit)}` : ""}`}</li>`).join("");
    $("#how-steps").innerHTML = HOW_TO_BUY.map((s) => `<li>${esc(s)}</li>`).join("");
    $("#faq-list").innerHTML = FAQ.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join("");
  }

  /* ---------- 車輛（主要） ---------- */
  const coverHtml = (p) => p.images && p.images.length
    ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">`
    : `<div class="noimg"><span>${esc(CATEGORIES[p.category]?.label || "")}</span><b>${esc(p.name)}</b></div>`;

  function renderVehicles() {
    const list = vehicles();
    $("#vehicle-count").textContent = `${list.length} 台`;
    $("#vehicle-list").innerHTML = list.map((p) => `
      <button type="button" class="vcard" data-id="${p.id}" aria-label="查看 ${esc(p.name)}">
        <div class="vcard-media">
          ${coverHtml(p)}
          ${p.images.length > 1 ? `<span class="vcard-count">${p.images.length} 張圖</span>` : ""}
          ${p.badge ? `<span class="vcard-badge">${esc(p.badge)}</span>` : ""}
        </div>
        <div class="vcard-body">
          <h3 class="vcard-name">${esc(p.name)}</h3>
          <p class="vcard-desc">${esc(p.tagline)}</p>
          ${p.features && p.features.length ? `<ul class="vcard-spec">${p.features.slice(0, 3).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
          <div class="vcard-foot">
            <span class="vcard-price ${p.price === null ? "ask" : ""}">${priceHtml(p)}</span>
            <span class="vcard-more">看詳情與更多圖 ›</span>
          </div>
        </div>
      </button>`).join("");
  }

  /* ---------- 其他商品（次要，小清單） ---------- */
  function renderOthers() {
    const list = others();
    $("#other-count").textContent = `${list.length} 項`;
    const cats = Object.keys(CATEGORIES).filter((k) => k !== "all" && k !== "vehicle");
    $("#other-list").innerHTML = cats.map((k) => {
      const items = list.filter((p) => p.category === k);
      if (!items.length) return "";
      return `<div class="ogroup">
        <h3>${esc(CATEGORIES[k].label)}<small>${CATEGORIES[k].desc ? esc(CATEGORIES[k].desc) : ""}</small></h3>
        <ul class="orows">${items.map((p) => `
          <li><button type="button" class="orow" data-id="${p.id}">
            <span class="orow-name">${esc(p.name)}</span>
            <span class="orow-desc">${esc(p.tagline)}</span>
            <span class="orow-price ${p.price === null ? "ask" : ""}">${priceHtml(p)}</span>
          </button></li>`).join("")}</ul>
      </div>`;
    }).join("");
  }

  /* ---------- 詳情視窗 ---------- */
  function openModal(id, { pushHash = true } = {}) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    state.product = p; state.index = 0; state.lastFocus = document.activeElement;

    $("#modal-cat").textContent = CATEGORIES[p.category]?.label || "";
    $("#modal-version").textContent = p.version || "";
    $("#modal-title").textContent = p.name;
    $("#modal-tagline").textContent = p.tagline;
    const price = $("#modal-price");
    price.innerHTML = priceHtml(p);
    price.classList.toggle("ask", p.price === null);

    $("#modal-details").innerHTML =
      (p.video ? `<p><a href="${esc(p.video)}" target="_blank" rel="noopener">▶ 展示影片</a></p>` : "") +
      (p.details || []).map((d) => `<p>${esc(d)}</p>`).join("");
    $("#modal-features").innerHTML = (p.features || []).map((f) => `<li>${esc(f)}</li>`).join("");
    $("#modal-features-wrap").hidden = !(p.features && p.features.length);
    $("#modal-notes").innerHTML = (p.notes || []).map((n) => `<li>${esc(n)}</li>`).join("");
    $("#modal-notes-wrap").hidden = !(p.notes && p.notes.length);

    const order = $("#modal-order");
    const main = STUDIO.contacts[0];
    order.href = main ? main.url : "#contact";
    order.target = main && !main.url.startsWith("#") ? "_blank" : "";
    order.textContent = p.category === "vehicle" ? "我要這台" : "我要這個";

    renderGallery();
    $("#modal").hidden = false;
    document.body.classList.add("modal-open");
    $("#modal-title").setAttribute("tabindex", "-1");
    $("#modal-title").focus({ preventScroll: true });
    $(".modal-body").scrollTop = 0;
    if (pushHash) history.pushState({ product: id }, "", `#product/${id}`);
  }

  function closeModal({ popHash = true } = {}) {
    const m = $("#modal");
    if (m.hidden) return;
    m.hidden = true;
    document.body.classList.remove("modal-open");
    state.product = null;
    if (state.lastFocus?.focus) state.lastFocus.focus({ preventScroll: true });
    if (popHash && location.hash.startsWith("#product/")) history.pushState({}, "", location.pathname + location.search + "#vehicles");
  }

  function renderGallery() {
    const p = state.product, imgs = p.images || [], i = state.index;
    const img = $("#gallery-img");
    const main = $(".gallery-main");
    main.querySelector(".noimg")?.remove();
    if (!imgs.length) {
      img.removeAttribute("src"); img.hidden = true;
      main.insertAdjacentHTML("beforeend", `<div class="noimg big"><span>${esc(CATEGORIES[p.category]?.label || "")}</span><b>${esc(p.name)}</b><small>Discord 上沒有圖片${p.video ? "，有展示影片" : ""}</small></div>`);
    } else {
      img.hidden = false; img.src = imgs[i]; img.alt = `${p.name} 圖片 ${i + 1}`;
    }
    $("#gallery-counter").textContent = imgs.length > 1 ? `${i + 1} / ${imgs.length}` : "";
    $("#gallery-prev").disabled = imgs.length <= 1;
    $("#gallery-next").disabled = imgs.length <= 1;
    $("#gallery-thumbs").innerHTML = imgs.length > 1
      ? imgs.map((s, k) => `<button type="button" role="tab" aria-selected="${k === i}" data-index="${k}" aria-label="第 ${k + 1} 張"><img src="${esc(s)}" alt="" loading="lazy"></button>`).join("")
      : "";
    if (imgs.length > 1) { const pre = new Image(); pre.src = imgs[(i + 1) % imgs.length]; }
  }

  function step(d) {
    const n = state.product?.images?.length || 0;
    if (n <= 1) return;
    state.index = (state.index + d + n) % n;
    renderGallery();
  }

  /* ---------- 事件 ---------- */
  function bind() {
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".vcard, .orow");
      if (b) openModal(b.dataset.id);
    });
    $("#modal").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
    $("#gallery-prev").addEventListener("click", () => step(-1));
    $("#gallery-next").addEventListener("click", () => step(1));
    $("#gallery-thumbs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-index]");
      if (b) { state.index = Number(b.dataset.index); renderGallery(); }
    });
    $("#modal-share").addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}#product/${state.product.id}`;
      try { await navigator.clipboard.writeText(url); toast("連結已複製"); } catch { toast(url); }
    });
    let tx = null;
    $(".gallery-main").addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true });
    $(".gallery-main").addEventListener("touchend", (e) => {
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
    });
    window.addEventListener("popstate", handleHash);
  }

  function handleHash() {
    const m = location.hash.match(/^#product\/([\w-]+)$/);
    if (m) openModal(m[1], { pushHash: false });
    else closeModal({ popHash: false });
  }

  renderStatic(); renderVehicles(); renderOthers(); bind(); handleHash();
})();
