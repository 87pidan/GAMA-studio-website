/* 善武工作室網站後台
   用 GitHub 金鑰登入後，在這裡新增、修改、下架商品。
   按「發佈到網站」會把 data/site.json 和新上傳的圖片（assets/img/p/）直接寫進 GitHub，
   GitHub Pages 大約 1～2 分鐘後就會更新網站。
   還沒發佈的修改存在這台電腦的瀏覽器裡（草稿在 localStorage，圖片在 IndexedDB）。 */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const CFG = {
    owner: "87pidan",
    repo: "GAMA-studio-website",
    branch: params.get("branch") || "main", // 測試用：?branch=xxx 會發佈到別的分支
    dataPath: "data/site.json",
    uploadDir: "assets/img/p/",
  };
  const API = `https://api.github.com/repos/${CFG.owner}/${CFG.repo}`;
  const TOKEN_URL = "https://github.com/settings/personal-access-tokens/new?" + new URLSearchParams({
    name: "善武網站後台", description: "網站後台發佈商品用", target_name: CFG.owner, contents: "write",
  });
  const LS_TOKEN = "gama-admin-token";
  const LS_DRAFT = CFG.branch === "main" ? "gama-admin-draft" : `gama-admin-draft:${CFG.branch}`;
  const LS_PREVIEW = "gama-admin-preview";
  const LS_TIPS = "gama-admin-tips-hidden";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const canon = (d) => JSON.stringify({ ...d, updatedAt: undefined });
  const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmtTime = (t) => new Date(t).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const S = {
    token: localStorage.getItem(LS_TOKEN) || "",
    data: null,       // 正在編輯的資料
    base: "",         // 網站上目前的資料（canon 字串），用來比對哪些改過
    baseObj: null,
    baseSha: "",      // 讀資料時 GitHub 上的版本
    blobUrls: {},     // 還沒發佈（或剛發佈）的圖片：路徑 → 瀏覽器內的網址
    ed: null,         // 正在編輯的商品
    filter: "all",
    query: "",
    flash: null,
    publishing: false,
    watching: null,
    skipRoute: false,
  };

  /* ================= 資料格式 ================= */
  const PRODUCT_DEFAULTS = {
    id: "", name: "", category: "", hidden: false, badge: "", tagline: "",
    price: null, priceText: "", unit: "", images: [], video: "", features: [], details: [], notes: [],
  };
  const arr = (x) => (Array.isArray(x) ? x.slice() : []);
  function normalize(d) {
    d = d || {};
    d.studio = { name: "", intro: "", otherDesc: "", orderNote: "", pricingNote: "", contactText: "", discord: "", ...(d.studio || {}) };
    d.categories = arr(d.categories).map((c) => ({ id: String(c.id), label: c.label || "", desc: c.desc || "", showcase: !!c.showcase }));
    d.products = arr(d.products).map((p) => ({
      ...PRODUCT_DEFAULTS, ...p, hidden: !!p.hidden,
      images: arr(p.images), features: arr(p.features), details: arr(p.details), notes: arr(p.notes),
    }));
    d.howToBuy = arr(d.howToBuy).map(String);
    d.priceList = arr(d.priceList).map((r) => ({ item: r.item || "", price: Number(r.price) || 0, unit: r.unit || "" }));
    d.faq = arr(d.faq).map((f) => ({ q: f.q || "", a: f.a || "" }));
    return d;
  }
  function setBase(str, sha) {
    S.base = str; S.baseObj = JSON.parse(str);
    if (sha !== undefined) S.baseSha = sha;
  }
  const isDirty = () => !!S.data && canon(S.data) !== S.base;

  const priceKind = (p) => {
    if (p.priceText) return "text";
    if (p.price === null || p.price === undefined || p.price === "") return "ask";
    return Number(p.price) === 0 ? "free" : "num";
  };
  const priceInline = (p) => {
    switch (priceKind(p)) {
      case "text": return `NT$ ${esc(p.priceText)}`;
      case "ask": return `<span class="muted">價格請洽詢</span>`;
      case "free": return `<span class="free">免費</span>`;
      default: return `NT$ ${Number(p.price).toLocaleString("zh-TW")}${p.unit ? ` <small>/ ${esc(p.unit)}</small>` : ""}`;
    }
  };
  const youtubeId = (url) => {
    const m = String(url || "").match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
    return m ? m[1] : null;
  };

  /* ================= 圖片 ================= */
  const isLocal = (p) => !/^(https?:|data:|blob:)/.test(p);
  const thumbOf = (p) => (isLocal(p) ? p.replace(/\.(jpe?g|png|webp)$/i, ".thumb.jpg") : p);
  const viewSrc = (p) => S.blobUrls[p] || (isLocal(p) ? "../" + p : p);
  const viewThumb = (p) => S.blobUrls[thumbOf(p)] || S.blobUrls[p] || (isLocal(p) ? "../" + thumbOf(p) : p);
  const imgEl = (p) => `<img src="${esc(viewThumb(p))}" data-full="${esc(viewSrc(p))}" alt="" loading="lazy" onerror="this.onerror=null;this.src=this.dataset.full">`;
  const logoPh = () => `<span class="ph"><img src="../assets/img/logo.png" alt=""></span>`;

  const idb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open("gama-admin", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files", { keyPath: "path" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = (mode, fn) => open().then((db) => new Promise((res, rej) => {
      const tx = db.transaction("files", mode);
      const req = fn(tx.objectStore("files"));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = tx.onabort = () => rej(tx.error);
    }));
    return {
      put: (rec) => run("readwrite", (s) => s.put(rec)),
      all: () => run("readonly", (s) => s.getAll()),
      del: (path) => run("readwrite", (s) => s.delete(path)),
    };
  })();

  function usedPaths() {
    const set = new Set();
    const add = (i) => { set.add(i); if (isLocal(i)) set.add(thumbOf(i)); };
    S.data.products.forEach((p) => p.images.forEach(add));
    if (S.ed) S.ed.p.images.forEach(add);
    return set;
  }

  async function loadBlobs() {
    let files = [];
    try { files = await idb.all(); } catch (e) { return; }
    const used = usedPaths();
    for (const f of files) {
      const expired = f.publishedAt && Date.now() - f.publishedAt > 10 * 60 * 1000;
      if (used.has(f.path) && !expired) S.blobUrls[f.path] = URL.createObjectURL(f.blob);
      else idb.del(f.path).catch(() => {});
    }
  }

  async function decodeImage(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file); } catch (e) { /* 改用 <img> 試試看 */ }
    }
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("decode"));
      im.src = url;
    });
  }
  function toJpeg(src, maxW, maxH, quality) {
    const k = Math.min(1, maxW / src.width, maxH / src.height);
    const w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, w, h);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", quality));
  }

  async function addImages(fileList) {
    if (!S.ed) return;
    const files = [...fileList].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name));
    if (!files.length) return toast("請選擇圖片檔（JPG、PNG、WebP）", "bad");
    const ed = S.ed;
    ed.busy = (ed.busy || 0) + files.length;
    renderImages();
    const slug = ed.p.id.replace(/[^\w-]/g, "").slice(0, 40) || "img";
    for (const f of files) {
      try {
        const bmp = await decodeImage(f);
        const full = await toJpeg(bmp, 1600, 1600, 0.85);
        const thumb = await toJpeg(bmp, 480, 800, 0.8);
        if (bmp.close) bmp.close();
        const base = `${CFG.uploadDir}${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        const path = `${base}.jpg`, tpath = `${base}.thumb.jpg`;
        await idb.put({ path, blob: full });
        await idb.put({ path: tpath, blob: thumb });
        S.blobUrls[path] = URL.createObjectURL(full);
        S.blobUrls[tpath] = URL.createObjectURL(thumb);
        ed.p.images.push(path);
      } catch (e) {
        console.error(e);
        toast(`「${f.name}」讀不出來，請改用 JPG 或 PNG 圖片`, "bad");
      }
      ed.busy--;
      if (S.ed === ed) { renderImages(); renderMini(); }
    }
  }

  /* ================= GitHub ================= */
  async function gh(path, { method = "GET", body, raw = false } = {}) {
    const headers = { Authorization: `Bearer ${S.token}`, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" };
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    if (!res.ok) {
      const err = new Error(`GitHub ${res.status}`);
      err.status = res.status;
      try { err.detail = await res.text(); } catch (e) { err.detail = ""; }
      throw err;
    }
    if (raw) return res.text();
    return res.status === 204 ? null : res.json();
  }

  function explain(e) {
    if (!e.status) return "連不上 GitHub，請確認網路正常後再試一次。";
    if (e.status === 401) return "GitHub 金鑰不正確或已經過期，請重新登入。";
    if (e.status === 403) {
      return /rate limit/i.test(e.detail || "") ? "GitHub 暫時限制了操作次數，請等幾分鐘再試。" : "金鑰的權限不夠：Contents 需要設成「Read and write」。";
    }
    if (e.status === 404) return "找不到網站的儲存庫：金鑰可能沒有選到 GAMA-studio-website。";
    if (e.status === 409 || e.status === 422) return "GitHub 暫時無法寫入，請再按一次發佈。";
    return `發生錯誤（${e.status}），請再試一次。`;
  }

  const blobToBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  /* ================= 草稿 ================= */
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(LS_DRAFT) || "null"); } catch (e) { return null; }
  }
  let saveTimer = null;
  function saveDraft() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(LS_DRAFT, JSON.stringify({ data: S.data, base: S.base, baseSha: S.baseSha, savedAt: Date.now() }));
    } catch (e) {
      toast("瀏覽器的儲存空間滿了，修改沒有存進草稿", "bad");
    }
    renderStatus();
  }
  function changed() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 250);
    renderStatus();
  }

  function describeChanges() {
    if (!S.data || !S.baseObj) return [];
    const base = S.baseObj, now = S.data, out = [];
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const bp = new Map(base.products.map((p) => [p.id, p]));
    const np = new Map(now.products.map((p) => [p.id, p]));
    now.products.forEach((p) => {
      const o = bp.get(p.id);
      if (!o) out.push(`新增商品「${p.name}」`);
      else if (!same(o, p)) {
        if (o.hidden !== p.hidden && same({ ...o, hidden: p.hidden }, p)) out.push(`${p.hidden ? "下架" : "上架"}「${p.name}」`);
        else out.push(`修改商品「${p.name}」`);
      }
    });
    base.products.forEach((o) => { if (!np.has(o.id)) out.push(`刪除商品「${o.name}」`); });
    const bo = base.products.map((p) => p.id).filter((id) => np.has(id)).join();
    const no = now.products.map((p) => p.id).filter((id) => bp.has(id)).join();
    if (bo !== no) out.push("調整商品順序");
    if (!same(base.categories, now.categories)) out.push("修改分類");
    if (!same(base.studio, now.studio)) out.push("修改網站文字");
    if (!same(base.priceList, now.priceList)) out.push("修改價目表");
    if (!same(base.howToBuy, now.howToBuy)) out.push("修改購買方式");
    if (!same(base.faq, now.faq)) out.push("修改常見問題");
    return out;
  }

  /* ================= 共用介面 ================= */
  const view = () => $("#view");
  const showView = (html) => { view().innerHTML = html; };

  let toastTimer = null;
  function toast(msg, kind = "ok", opts = {}) {
    const el = $("#a-toast");
    el.className = `a-toast ${kind}`;
    el.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? `<button type="button">復原</button>` : ""}`;
    el.hidden = false;
    if (opts.undo) el.querySelector("button").onclick = () => { el.hidden = true; opts.undo(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), opts.undo ? 8000 : 3800);
  }

  function dialog({ title, body, buttons, dismissible = true }) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog");
      d.className = "dlg";
      d.innerHTML = `<h2>${esc(title)}</h2><div class="dlg-body">${body}</div>
        <div class="dlg-actions">${buttons.map((b, i) => `<button type="button" class="a-btn ${b.kind || ""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div>`;
      document.body.append(d);
      const done = (v) => { d.close(); d.remove(); resolve(v); };
      d.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) done(buttons[Number(b.dataset.i)].value); });
      d.addEventListener("cancel", (e) => { e.preventDefault(); if (dismissible) done(null); });
      d.showModal();
      (d.querySelector(".a-btn.primary, .a-btn.danger") || d.querySelector(".a-btn"))?.focus();
    });
  }

  function progress(text) {
    const d = document.createElement("dialog");
    d.className = "dlg";
    d.innerHTML = `<h2>發佈中</h2><div class="dlg-body"><p class="prog"><span class="spin"></span><span class="prog-t"></span></p><p class="hint">請不要關掉這個分頁。</p></div>`;
    document.body.append(d);
    d.addEventListener("cancel", (e) => e.preventDefault());
    d.showModal();
    const api = { set: (t) => { $(".prog-t", d).textContent = t; }, close: () => { if (d.open) d.close(); d.remove(); } };
    api.set(text);
    return api;
  }

  function renderStatus() {
    const el = $("#a-status");
    if (!el || !S.data) return;
    const n = describeChanges().length;
    if (S.publishing) el.innerHTML = `<span class="st busy">發佈中…</span>`;
    else if (n) el.innerHTML = `<span class="st dirty">● ${n} 項修改還沒發佈</span><button type="button" class="linkish" data-act="discard">放棄修改</button>`;
    else if (S.watching) el.innerHTML = `<span class="st busy"><span class="spin small"></span>網站更新中，約 1～2 分鐘</span>`;
    else el.innerHTML = `<span class="st ok">✓ 網站是最新內容</span>`;
    $("#btn-publish").disabled = !n || S.publishing;
  }

  const moveBtns = (list, i, len) => `
    <button type="button" class="icon" data-act="li-up" data-list="${list}" data-i="${i}" ${i === 0 ? "disabled" : ""} title="往上移" aria-label="往上移">↑</button>
    <button type="button" class="icon" data-act="li-down" data-list="${list}" data-i="${i}" ${i === len - 1 ? "disabled" : ""} title="往下移" aria-label="往下移">↓</button>`;

  /* ================= 登入 ================= */
  function renderLogin(message = "") {
    $("#a-top").hidden = true;
    showView(`
      <div class="login">
        <div class="login-head">
          <img src="../assets/img/logo.png" alt="">
          <div><h1>網站後台</h1><p>登入後就能自己新增、修改、下架商品，按「發佈」網站就會更新。</p></div>
        </div>

        <section class="card">
          <h2>第一次使用：先建立 GitHub 金鑰<small>只要做一次</small></h2>
          <ol class="howto">
            <li>用 <b>${esc(CFG.owner)}</b> 這個帳號登入 GitHub，然後 <a href="${TOKEN_URL}" target="_blank" rel="noopener">按這裡打開「建立金鑰」的頁面</a>。</li>
            <li><b>Token name</b>（名稱）隨便取，例如「善武網站後台」。<br><b>Expiration</b>（有效期限）選最長的，到期後回來再做一把就好。</li>
            <li><b>Repository access</b> 選 <b>Only select repositories</b>，再從清單選 <code>${esc(CFG.repo)}</code>。</li>
            <li>在 <b>Permissions</b> 找到 <b>Contents</b>（如果看到「Add permissions」按鈕，就先按它，再勾 Contents），把權限改成 <b>Read and write</b>。</li>
            <li>拉到最下面按 <b>Generate token</b>，把出現的那串 <code>github_pat_</code> 開頭的文字複製起來，貼到下面。</li>
          </ol>
        </section>

        <form class="card" id="login-form">
          <label class="f"><span>GitHub 金鑰</span>
            <input type="password" id="token" autocomplete="off" spellcheck="false" placeholder="github_pat_…" required>
          </label>
          <p class="f-err" id="login-err" ${message ? "" : "hidden"}>${esc(message)}</p>
          <button class="a-btn primary big" type="submit" id="login-btn">登入</button>
          <p class="hint">金鑰只會存在這台電腦的瀏覽器裡。不要把金鑰給別人；在別人的電腦用完，記得按右上角的「登出」。</p>
        </form>
        <p class="login-back"><a href="../">← 回網站</a></p>
      </div>`);
    $("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = $("#token").value.trim();
      const err = $("#login-err"), btn = $("#login-btn");
      if (!token) return;
      err.hidden = true;
      btn.disabled = true; btn.textContent = "檢查金鑰中…";
      S.token = token;
      try {
        await gh("");
      } catch (x) {
        err.textContent = x.status === 401 ? "金鑰不正確，請重新複製一次（要整串複製）。"
          : x.status === 404 || x.status === 403 ? `這把金鑰沒有選到 ${CFG.repo}，請看第 3 步。` : explain(x);
        err.hidden = false; btn.disabled = false; btn.textContent = "登入"; S.token = "";
        return;
      }
      try {
        // 測試能不能寫入：只建立一小段資料，不會改到網站
        await gh("/git/blobs", { method: "POST", body: { content: "gama-admin-check", encoding: "utf-8" } });
      } catch (x) {
        err.textContent = x.status === 403 || x.status === 404
          ? "這把金鑰只能讀、不能寫：請看第 4 步，把 Contents 改成 Read and write（可以在 GitHub 編輯這把金鑰）。" : explain(x);
        err.hidden = false; btn.disabled = false; btn.textContent = "登入"; S.token = "";
        return;
      }
      localStorage.setItem(LS_TOKEN, token);
      start();
    });
    $("#token").focus();
  }

  /* ================= 啟動 ================= */
  let bound = false;
  async function start() {
    if (!S.token) return renderLogin();
    $("#a-top").hidden = true;
    showView(`<p class="a-loading"><span class="spin"></span>正在讀取網站資料…</p>`);
    let remote, sha;
    try {
      const ref = await gh(`/git/ref/heads/${CFG.branch}`);
      sha = ref.object.sha;
      remote = normalize(JSON.parse(await gh(`/contents/${CFG.dataPath}?ref=${sha}`, { raw: true })));
    } catch (e) {
      if (e.status === 401) {
        localStorage.removeItem(LS_TOKEN); S.token = "";
        return renderLogin("金鑰已經失效（可能過期了），請照下面的步驟重新建立一把再登入。");
      }
      showView(`<section class="card a-error"><h2>讀取失敗</h2><p>${esc(explain(e))}</p>
        <button type="button" class="a-btn primary" onclick="location.reload()">重新整理</button>
        <button type="button" class="a-btn" data-act="logout">登出</button></section>`);
      bindOnce();
      return;
    }

    const draft = readDraft();
    let useDraft = false;
    if (draft && draft.data && draft.base && canon(normalize(clone(draft.data))) !== draft.base) {
      const moved = canon(remote) !== draft.base;
      useDraft = await dialog({
        title: "你有上次還沒發佈的修改",
        body: `<p>上次在這台電腦改的內容還沒發佈（最後修改：${esc(fmtTime(draft.savedAt))}）。</p>
          ${moved ? `<p class="warn">注意：網站上的資料在那之後有被改過。繼續的話，發佈時會再提醒你。</p>` : ""}`,
        buttons: [{ label: "不要了，用網站上的版本", value: false }, { label: "繼續上次的修改", value: true, kind: "primary" }],
        dismissible: false,
      });
    }
    if (useDraft) { S.data = normalize(draft.data); setBase(draft.base, draft.baseSha); }
    else { S.data = remote; setBase(canon(remote), sha); }
    await loadBlobs();
    saveDraft();

    $("#a-top").hidden = false;
    if (CFG.branch !== "main" && !$(".a-branch")) {
      document.body.insertAdjacentHTML("afterbegin", `<div class="a-branch">測試模式：發佈會寫到「${esc(CFG.branch)}」分支，不會影響正式網站。</div>`);
    }
    bindOnce();
    route();
    renderStatus();
  }

  /* ================= 路由 ================= */
  // keep = true：只是重畫目前的頁面，不要捲回最上面
  function route(keep = false) {
    if (!S.data) return;
    if (S.skipRoute) { S.skipRoute = false; return; }
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    const name = parts[0] || "products";
    const arg = decodeURIComponent(parts[1] || "");
    if (S.ed && !(name === "product" && arg === S.ed.p.id)) {
      if (edDirty() && !confirm("這個商品改的內容還沒儲存，確定要離開嗎？\n（按「取消」回去繼續編輯）")) {
        S.skipRoute = true;
        location.hash = `#/product/${S.ed.p.id}`;
        return;
      }
      S.ed = null;
    }
    const tab = name === "product" || name === "new" ? "products" : name;
    $$("#a-tabs [data-tab]").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
    if (name === "new") return startNew(arg);
    if (name === "product") return openEditor(arg);
    const views = { products: renderProducts, categories: renderCategories, prices: renderPrices, guide: renderGuide, texts: renderTexts };
    const y = scrollY;
    (views[name] || renderProducts)();
    if (keep) scrollTo(0, y);
    else if (!$(".prow.flash")) scrollTo(0, 0);
  }

  /* ================= 商品列表 ================= */
  function renderProducts() {
    const tips = localStorage.getItem(LS_TIPS) ? "" : `
      <section class="card tips">
        <button type="button" class="tips-x" data-act="tips-x" aria-label="關閉說明">✕</button>
        <h2>怎麼用</h2>
        <ol>
          <li><b>新增或修改</b>：按「新增商品」，或直接點下面的商品。</li>
          <li><b>預覽</b>：按上面的「預覽修改」，會開新分頁讓你看改完的網站。</li>
          <li><b>發佈</b>：確定沒問題就按紅色的「發佈到網站」，大約 1～2 分鐘後網站就更新了。</li>
        </ol>
        <p class="hint">還沒發佈的修改會一直留在這台電腦，關掉視窗也不會不見。</p>
      </section>`;
    const firstCat = S.filter !== "all" ? S.filter : S.data.categories[0]?.id || "";
    showView(`${tips}
      <div class="toolbar">
        <a class="a-btn primary big" href="#/new/${esc(firstCat)}">＋ 新增商品</a>
        <div class="toolbar-r">
          <select id="p-filter" aria-label="只看某個分類">
            <option value="all">全部分類</option>
            ${S.data.categories.map((c) => `<option value="${esc(c.id)}"${S.filter === c.id ? " selected" : ""}>${esc(c.label)}</option>`).join("")}
          </select>
          <input id="p-search" type="search" placeholder="搜尋商品名稱" value="${esc(S.query)}" aria-label="搜尋商品">
        </div>
      </div>
      <div id="plist"></div>`);
    renderProductList();
  }

  function renderProductList() {
    const box = $("#plist");
    if (!box) return;
    const q = S.query.trim().toLowerCase();
    const base = new Map(S.baseObj.products.map((p) => [p.id, JSON.stringify(p)]));
    const known = new Set(S.data.categories.map((c) => c.id));
    const groups = S.data.categories.map((c) => ({ c, items: S.data.products.filter((p) => p.category === c.id) }));
    const orphans = S.data.products.filter((p) => !known.has(p.category));
    if (orphans.length) groups.push({ c: { id: "", label: "沒有分類（請重新選分類）", showcase: false }, items: orphans });

    const html = groups.filter((g) => S.filter === "all" || g.c.id === S.filter).map((g) => {
      const items = q ? g.items.filter((p) => `${p.name} ${p.tagline}`.toLowerCase().includes(q)) : g.items;
      if (q && !items.length) return "";
      return `<section class="card group">
        <header class="group-head">
          <h2>${esc(g.c.label)}<small>${g.items.length} 項 · ${g.c.showcase ? "大圖展示" : "清單"}</small></h2>
          ${g.c.id ? `<a class="a-btn small" href="#/new/${esc(g.c.id)}">＋ 新增到這裡</a>` : ""}
        </header>
        ${items.length ? `<ul class="plist">${items.map((p) => prow(p, base, g.items)).join("")}</ul>` : `<p class="empty">這個分類還沒有商品。</p>`}
      </section>`;
    }).join("");
    box.innerHTML = html || `<p class="empty card">找不到符合的商品。</p>`;
    if (S.flash) {
      const row = $(`.prow[data-id="${CSS.escape(S.flash)}"]`);
      if (row) { row.classList.add("flash"); row.scrollIntoView({ block: "center" }); }
      S.flash = null;
    }
  }

  function prow(p, base, siblings) {
    const i = siblings.indexOf(p);
    const o = base.get(p.id);
    const mark = !o ? `<span class="mark">新增，還沒發佈</span>` : o !== JSON.stringify(p) ? `<span class="mark">改過，還沒發佈</span>` : "";
    const cover = p.images[0];
    const yt = youtubeId(p.video);
    const thumb = cover ? imgEl(cover) : yt ? `<img src="https://i.ytimg.com/vi/${yt}/mqdefault.jpg" alt="">` : logoPh();
    const id = esc(p.id);
    return `<li class="prow${p.hidden ? " off" : ""}" data-id="${id}">
      <a class="prow-main" href="#/product/${id}">
        <span class="prow-thumb">${thumb}</span>
        <span class="prow-text"><b>${esc(p.name || "（沒有名稱）")}</b><small>${esc(p.tagline)}</small></span>
      </a>
      <span class="prow-price">${priceInline(p)}</span>
      <span class="prow-state"><span class="pill ${p.hidden ? "off" : "on"}">${p.hidden ? "已下架" : "上架中"}</span>${mark}</span>
      <span class="prow-tools">
        <button type="button" class="icon" data-act="p-up" data-id="${id}" ${i === 0 ? "disabled" : ""} title="往前移" aria-label="往前移">↑</button>
        <button type="button" class="icon" data-act="p-down" data-id="${id}" ${i === siblings.length - 1 ? "disabled" : ""} title="往後移" aria-label="往後移">↓</button>
        <button type="button" class="a-btn small" data-act="p-toggle" data-id="${id}">${p.hidden ? "上架" : "下架"}</button>
        <a class="a-btn small" href="#/product/${id}">編輯</a>
        <button type="button" class="a-btn small danger-text" data-act="p-del" data-id="${id}">刪除</button>
      </span>
    </li>`;
  }

  function moveProduct(id, d) {
    const list = S.data.products;
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return;
    let j = i + d;
    while (j >= 0 && j < list.length && list[j].category !== list[i].category) j += d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    changed();
    renderProductList();
    $(`[data-act="${d < 0 ? "p-up" : "p-down"}"][data-id="${CSS.escape(id)}"]:not([disabled])`)?.focus();
  }

  async function deleteProduct(id, { fromEditor = false } = {}) {
    const i = S.data.products.findIndex((p) => p.id === id);
    const p = S.data.products[i];
    if (!p) return false;
    const choice = await dialog({
      title: `刪除「${p.name}」？`,
      body: `<p>刪除並發佈之後，網站上就看不到這個商品了。</p>
        ${p.hidden ? "" : `<p class="hint">如果只是暫時不賣，可以改成「下架」，之後隨時能再上架。</p>`}`,
      buttons: [{ label: "取消", value: null }, ...(p.hidden ? [] : [{ label: "改成下架", value: "hide" }]), { label: "刪除", value: "del", kind: "danger" }],
    });
    if (choice === "hide") {
      p.hidden = true; changed();
      toast(`已下架「${p.name}」，發佈後網站就看不到了`);
    } else if (choice === "del") {
      S.data.products.splice(i, 1); changed();
      toast(`已刪除「${p.name}」`, "ok", {
        undo: () => { S.data.products.splice(i, 0, p); changed(); if (!S.ed) route(true); },
      });
    } else return false;
    if (fromEditor) { S.ed = null; location.hash = "#/products"; }
    else renderProductList();
    return true;
  }

  /* ================= 商品編輯 ================= */
  function startNew(catId) {
    const cat = S.data.categories.find((c) => c.id === catId) || S.data.categories[0];
    if (!cat) { toast("請先建立至少一個分類", "bad"); location.hash = "#/categories"; return; }
    const p = { ...clone(PRODUCT_DEFAULTS), id: newId("p"), category: cat.id, unit: cat.showcase ? "輛" : "" };
    beginEdit(p, true);
    history.replaceState(null, "", `#/product/${p.id}`);
    renderEditor();
  }

  function openEditor(id) {
    if (S.ed && S.ed.p.id === id) return renderEditor();
    const p = S.data.products.find((x) => x.id === id);
    if (!p) { toast("找不到這個商品", "bad"); location.hash = "#/products"; return; }
    beginEdit(clone(p), false);
    renderEditor();
  }

  function beginEdit(p, isNew) {
    const k = isNew ? "num" : priceKind(p);
    S.ed = { p, isNew, kind: k, num: k === "num" && p.price !== null ? String(p.price) : "", text: p.priceText || "", busy: 0 };
    S.ed.orig = edSnapshot();
  }
  const edSnapshot = () => JSON.stringify([S.ed.p, S.ed.kind, S.ed.num, S.ed.text]);
  const edDirty = () => !!S.ed && edSnapshot() !== S.ed.orig;

  function withPrice(p, ed) {
    const q = { ...p };
    if (ed.kind === "num") { q.price = ed.num === "" ? null : Number(ed.num); q.priceText = ""; }
    else if (ed.kind === "free") { q.price = 0; q.priceText = ""; }
    else if (ed.kind === "text") { q.price = null; q.priceText = ed.text.trim(); }
    else { q.price = null; q.priceText = ""; }
    return q;
  }

  function renderEditor() {
    const ed = S.ed, p = ed.p;
    const catOpts = S.data.categories.map((c) =>
      `<option value="${esc(c.id)}"${c.id === p.category ? " selected" : ""}>${esc(c.label)}${c.showcase ? "（大圖展示）" : ""}</option>`).join("");
    const seg = (v, label) => `<label><input type="radio" name="pk" value="${v}"${ed.kind === v ? " checked" : ""}><span>${label}</span></label>`;
    const lines = (key, label, help, rows) => `
      <label class="f"><span>${label} <em>一行一項</em></span>
        <textarea data-lines="${key}" rows="${rows}">${esc(p[key].join("\n"))}</textarea>${help ? `<small>${help}</small>` : ""}</label>`;
    showView(`
    <div class="ed">
      <div class="ed-head">
        <button type="button" class="a-btn" data-act="ed-cancel">← 回商品列表</button>
        <h1>${ed.isNew ? "新增商品" : "編輯商品"}</h1>
        <button type="button" class="a-btn primary ed-head-save" data-act="ed-save">儲存這個商品</button>
      </div>
      <div class="ed-grid">
        <div class="ed-main">
          <section class="card">
            <h2>基本資料</h2>
            <label class="f"><span>商品名稱 <em>必填</em></span>
              <input data-f="name" value="${esc(p.name)}" maxlength="80" placeholder="例如：Toyota Camry 2021 警車"></label>
            <div class="f-row2">
              <label class="f"><span>分類</span><select data-f="category">${catOpts}</select>
                <small>「大圖展示」的分類會用大圖放在網站最上面，像現在的車輛。</small></label>
              <div class="f"><span>小標籤 <em>可不填</em></span>
                <input data-f="badge" value="${esc(p.badge)}" maxlength="10" placeholder="例如：主打、新品" aria-label="小標籤">
                <div class="presets">${["主打", "新品", "特價", "免費"].map((b) => `<button type="button" class="preset" data-badge="${b}">${b}</button>`).join("")}<button type="button" class="preset" data-badge="">不要標籤</button></div>
              </div>
            </div>
            <label class="f"><span>一句話介紹</span>
              <input data-f="tagline" value="${esc(p.tagline)}" maxlength="120" placeholder="顯示在商品名稱下面，例如：台灣警用黑白塗裝，車牌免費自訂。"></label>
          </section>

          <section class="card">
            <h2>價格</h2>
            <div class="seg" role="radiogroup" aria-label="價格方式">${seg("num", "固定價格")}${seg("free", "免費")}${seg("text", "自己寫價格")}${seg("ask", "價格請洽詢")}</div>
            <div class="pk pk-num"${ed.kind === "num" ? "" : " hidden"}>
              <div class="f-row2 narrow">
                <label class="f"><span>價格（新台幣）</span>
                  <span class="affix"><i>NT$</i><input type="number" min="0" step="1" inputmode="numeric" data-f="price" value="${esc(ed.num)}" placeholder="350"></span></label>
                <label class="f"><span>單位 <em>可不填</em></span>
                  <input data-f="unit" value="${esc(p.unit)}" maxlength="6" placeholder="輛、套、份"></label>
              </div>
            </div>
            <div class="pk pk-text"${ed.kind === "text" ? "" : " hidden"}>
              <label class="f"><span>價格文字</span>
                <input data-f="priceText" value="${esc(ed.text)}" maxlength="60" placeholder="例如：加密 700 / 開源 1200">
                <small>網站會顯示成「NT$ 你寫的文字」。</small></label>
            </div>
            <p class="pk pk-free pk-ask hint"${ed.kind === "free" || ed.kind === "ask" ? "" : " hidden"}>網站會直接顯示「${ed.kind === "free" ? "免費" : "價格請洽詢"}」。</p>
          </section>

          <section class="card">
            <h2>圖片<small id="img-count"></small></h2>
            <p class="hint">第一張是封面。圖片會自動縮成適合網站的大小，直接用原圖就可以。</p>
            <div class="imgs" id="ed-imgs"></div>
            <label class="drop" id="drop">
              <input type="file" id="ed-file" accept="image/*" multiple hidden>
              <b>把圖片拖到這裡</b>
              <span>或 <u>按這裡選擇圖片</u>（可以一次選很多張）</span>
              <small>也可以先複製圖片，再直接按 Ctrl + V 貼上</small>
            </label>
          </section>

          <section class="card">
            <h2>展示影片<small>可不填</small></h2>
            <label class="f"><span>YouTube 影片網址</span>
              <input data-f="video" value="${esc(p.video)}" placeholder="https://youtu.be/…" inputmode="url">
              <small>沒有圖片的商品，網站會直接播放這支影片；有圖片的話會多一個「看展示影片」的連結。</small></label>
            <div id="yt-prev"></div>
          </section>

          <section class="card">
            <h2>詳細內容</h2>
            ${lines("features", "商品內容／特色", "大圖展示的商品，會在大圖旁邊打勾列出前 5 項。", 5)}
            ${lines("details", "介紹", "", 3)}
            ${lines("notes", "注意事項", "", 3)}
          </section>
        </div>

        <aside class="ed-side">
          <section class="card side">
            <h2>上架狀態</h2>
            <label class="switch"><input type="checkbox" data-f="shown"${p.hidden ? "" : " checked"}><span id="shown-t">${p.hidden ? "已下架（網站看不到）" : "上架中（網站看得到）"}</span></label>
            <h2>網站上看起來</h2>
            <div class="mini" id="mini"></div>
            <p class="hint" id="mini-where"></p>
            <button type="button" class="a-btn primary big block" data-act="ed-save">儲存這個商品</button>
            ${ed.isNew ? "" : `
              <button type="button" class="a-btn block" data-act="ed-dup">複製成新商品</button>
              <button type="button" class="a-btn block danger-text" data-act="ed-del">刪除這個商品</button>`}
          </section>
        </aside>
      </div>
      <div class="ed-bar">
        <button type="button" class="a-btn" data-act="ed-cancel">取消</button>
        <button type="button" class="a-btn primary" data-act="ed-save">儲存這個商品</button>
      </div>
    </div>`);
    renderImages(); renderMini(); renderYt();
    scrollTo(0, 0);
    if (ed.isNew) $('[data-f="name"]').focus();
  }

  function renderImages() {
    const box = $("#ed-imgs");
    if (!box || !S.ed) return;
    const imgs = S.ed.p.images;
    box.innerHTML = imgs.map((path, i) => `
      <div class="img-tile${i === 0 ? " cover" : ""}">
        ${imgEl(path)}
        ${i === 0 ? `<span class="cover-tag">封面</span>` : ""}
        <div class="img-tools">
          <button type="button" data-act="img-left" data-i="${i}" ${i === 0 ? "disabled" : ""} title="往前移" aria-label="往前移">←</button>
          <button type="button" data-act="img-right" data-i="${i}" ${i === imgs.length - 1 ? "disabled" : ""} title="往後移" aria-label="往後移">→</button>
          ${i ? `<button type="button" class="wide" data-act="img-cover" data-i="${i}">設成封面</button>` : `<span class="grow"></span>`}
          <button type="button" class="del" data-act="img-del" data-i="${i}" title="刪除這張" aria-label="刪除這張">✕</button>
        </div>
      </div>`).join("") +
      Array.from({ length: S.ed.busy || 0 }, () => `<div class="img-tile busy"><span class="spin"></span>處理中</div>`).join("");
    $("#img-count").textContent = imgs.length ? `${imgs.length} 張` : "還沒有圖片";
  }

  function renderMini() {
    const box = $("#mini");
    if (!box || !S.ed) return;
    const p = withPrice(S.ed.p, S.ed);
    const cat = S.data.categories.find((c) => c.id === p.category);
    const yt = youtubeId(p.video);
    const media = p.images[0] ? imgEl(p.images[0]) : yt ? `<img src="https://i.ytimg.com/vi/${yt}/mqdefault.jpg" alt="">` : logoPh();
    box.innerHTML = `
      ${p.hidden ? `<div class="mini-hidden">已下架：網站上看不到</div>` : ""}
      <div class="mini-img">${media}</div>
      <div class="mini-body">
        ${p.badge ? `<span class="mini-badge">${esc(p.badge)}</span>` : ""}
        <b>${esc(p.name || "（還沒填名稱）")}</b>
        ${p.tagline ? `<small>${esc(p.tagline)}</small>` : ""}
        <div class="mini-price">${priceInline(p)}</div>
      </div>`;
    $("#mini-where").textContent = cat ? (cat.showcase ? `會放在網站上方的「${cat.label}」大圖展示區。` : `會放在「其他商品」的「${cat.label}」裡。`) : "";
  }

  function renderYt() {
    const box = $("#yt-prev");
    if (!box || !S.ed) return;
    const v = S.ed.p.video.trim(), id = youtubeId(v);
    box.innerHTML = !v ? "" : id
      ? `<a class="yt" href="https://youtu.be/${id}" target="_blank" rel="noopener"><img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt=""><span>✓ 找到影片了，點這裡確認是不是這支</span></a>`
      : `<p class="f-err">看不懂這個網址，請貼 YouTube 影片的網址（例如 https://youtu.be/xxxxxxxxxxx）。</p>`;
  }

  function edInput(t) {
    const ed = S.ed, p = ed.p;
    if (t.name === "pk") {
      ed.kind = t.value;
      $$(".pk").forEach((el) => { el.hidden = !el.classList.contains(`pk-${t.value}`); });
      const note = $(".pk-free");
      if (note) note.textContent = `網站會直接顯示「${t.value === "free" ? "免費" : "價格請洽詢"}」。`;
    } else if (t.dataset.f === "price") ed.num = t.value;
    else if (t.dataset.f === "priceText") ed.text = t.value;
    else if (t.dataset.f === "shown") {
      p.hidden = !t.checked;
      $("#shown-t").textContent = p.hidden ? "已下架（網站看不到）" : "上架中（網站看得到）";
    } else if (t.dataset.f) p[t.dataset.f] = t.value;
    else if (t.dataset.lines) p[t.dataset.lines] = t.value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (t.dataset.f === "video") renderYt();
    const f = t.closest(".f");
    if (f && f.classList.contains("err")) { f.classList.remove("err"); f.querySelector(".f-err")?.remove(); }
    renderMini();
  }

  function saveEditor() {
    const ed = S.ed;
    if (!ed) return false;
    if (ed.busy) { toast("圖片還在處理中，請等一下再儲存", "bad"); return false; }
    const p = withPrice(ed.p, ed);
    ["name", "tagline", "badge", "unit", "video"].forEach((k) => { p[k] = String(p[k] || "").trim(); });
    const errs = [];
    if (!p.name) errs.push(["name", "請填商品名稱"]);
    if (ed.kind === "num" && !(Number(ed.num) > 0)) errs.push(["price", "請填價格（數字），或改選「免費」、「價格請洽詢」"]);
    if (ed.kind === "text" && !p.priceText) errs.push(["priceText", "請填要顯示的價格文字"]);
    if (p.video && !youtubeId(p.video)) errs.push(["video", "看不懂這個影片網址，請貼 YouTube 的網址，或是清空"]);
    $$(".f.err").forEach((f) => { f.classList.remove("err"); f.querySelector(".f-err")?.remove(); });
    if (errs.length) {
      errs.forEach(([k, msg]) => {
        const f = $(`[data-f="${k}"]`)?.closest(".f");
        if (f) { f.classList.add("err"); f.insertAdjacentHTML("beforeend", `<p class="f-err">${esc(msg)}</p>`); }
      });
      const first = $(`[data-f="${errs[0][0]}"]`);
      first?.scrollIntoView({ block: "center" }); first?.focus({ preventScroll: true });
      toast(errs[0][1], "bad");
      return false;
    }
    const list = S.data.products;
    const i = list.findIndex((x) => x.id === p.id);
    if (i >= 0) {
      list[i] = p;
    } else {
      // 新商品放在同分類的最後面
      let at = -1;
      list.forEach((x, k) => { if (x.category === p.category) at = k; });
      if (at >= 0) list.splice(at + 1, 0, p); else list.push(p);
    }
    S.ed = null;
    S.flash = p.id;
    saveDraft();
    toast(`已儲存「${p.name}」。要按上面的「發佈到網站」，網站才會更新。`);
    if (location.hash === "#/products") route(); else location.hash = "#/products";
    return true;
  }

  async function cancelEditor() {
    if (edDirty()) {
      const ok = await dialog({
        title: "放棄這次的修改？",
        body: "<p>剛剛改的內容還沒儲存，離開就不見了。</p>",
        buttons: [{ label: "繼續編輯", value: false }, { label: "放棄修改", value: true, kind: "danger" }],
      });
      if (!ok) return;
    }
    S.ed = null;
    location.hash = "#/products";
  }

  function duplicateProduct() {
    if (edDirty()) return toast("請先按「儲存這個商品」，再複製", "bad");
    const copy = clone(S.ed.p);
    copy.id = newId("p");
    copy.name = `${copy.name}（複製）`;
    beginEdit(copy, true);
    S.ed.orig = ""; // 還沒儲存，離開時要提醒
    history.pushState(null, "", `#/product/${copy.id}`);
    renderEditor();
    toast("已複製一份，改好後按「儲存這個商品」");
  }

  /* ================= 分類 ================= */
  function renderCategories() {
    const counts = {};
    S.data.products.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    const cats = S.data.categories;
    showView(`
      <section class="card">
        <h2>分類</h2>
        <p class="hint">分類決定商品放在網站的哪裡。<b>大圖展示</b>：像車輛一樣用大圖排在網站最上面。<b>清單</b>：放在「其他商品」裡，用小圖列出來。上下箭頭可以調整網站上的順序。</p>
        <ul class="elist">${cats.map((c, i) => `
          <li class="erow">
            <div class="erow-fields">
              <div class="f-row2">
                <label class="f"><span>分類名稱</span><input data-list="categories" data-i="${i}" data-k="label" value="${esc(c.label)}" maxlength="30"></label>
                <div class="f"><span>顯示方式</span>
                  <div class="seg">
                    <label><input type="radio" name="show-${i}" data-list="categories" data-i="${i}" data-k="showcase" value="1"${c.showcase ? " checked" : ""}><span>大圖展示</span></label>
                    <label><input type="radio" name="show-${i}" data-list="categories" data-i="${i}" data-k="showcase" value=""${c.showcase ? "" : " checked"}><span>清單</span></label>
                  </div>
                </div>
              </div>
              <label class="f"><span>說明 <em>可不填，顯示在分類標題旁邊</em></span>
                <textarea data-list="categories" data-i="${i}" data-k="desc" rows="2">${esc(c.desc)}</textarea></label>
            </div>
            <div class="erow-tools">
              <span class="count">${counts[c.id] || 0} 個商品</span>
              ${moveBtns("categories", i, cats.length)}
              <button type="button" class="a-btn small danger-text" data-act="cat-del" data-i="${i}">刪除</button>
            </div>
          </li>`).join("")}
        </ul>
        <button type="button" class="a-btn" data-act="li-add" data-list="categories">＋ 新增分類</button>
      </section>`);
  }

  /* ================= 價目表 ================= */
  function renderPrices() {
    const rows = S.data.priceList;
    showView(`
      <section class="card">
        <h2>價目表</h2>
        <p class="hint">網站上「價目表」海報的內容。價格填 <b>0</b> 會顯示「免費」。</p>
        <div class="f-row2">
          <label class="f"><span>紅字標語</span><input data-studio="orderNote" value="${esc(S.data.studio.orderNote)}" placeholder="例如：採優先付款後交貨"></label>
          <label class="f"><span>海報說明</span><input data-studio="pricingNote" value="${esc(S.data.studio.pricingNote)}"></label>
        </div>
        <div class="ptable">
          <div class="ptable-head"><span>項目</span><span>價格（NTD）</span><span>單位</span><span></span></div>
          ${rows.map((r, i) => `
            <div class="ptable-row">
              <input data-list="priceList" data-i="${i}" data-k="item" value="${esc(r.item)}" placeholder="例如：插件代裝" aria-label="項目">
              <input type="number" min="0" step="1" inputmode="numeric" data-list="priceList" data-i="${i}" data-k="price" value="${esc(r.price)}" aria-label="價格">
              <input data-list="priceList" data-i="${i}" data-k="unit" value="${esc(r.unit)}" placeholder="個、輛" maxlength="6" aria-label="單位">
              <span class="row-tools">${moveBtns("priceList", i, rows.length)}<button type="button" class="icon del" data-act="li-del" data-list="priceList" data-i="${i}" title="刪除這一列" aria-label="刪除這一列">✕</button></span>
            </div>`).join("")}
        </div>
        <button type="button" class="a-btn" data-act="li-add" data-list="priceList">＋ 新增一列</button>
      </section>`);
  }

  /* ================= 購買方式、常見問題 ================= */
  function renderGuide() {
    const steps = S.data.howToBuy, faq = S.data.faq;
    showView(`
      <section class="card">
        <h2>購買方式</h2>
        <p class="hint">網站「購買方式」區塊的步驟，一格是一個步驟。</p>
        <ol class="elist">${steps.map((s, i) => `
          <li class="erow">
            <span class="stepno">${i + 1}</span>
            <div class="erow-fields"><textarea data-list="howToBuy" data-i="${i}" rows="2" aria-label="第 ${i + 1} 步">${esc(s)}</textarea></div>
            <div class="erow-tools">${moveBtns("howToBuy", i, steps.length)}<button type="button" class="icon del" data-act="li-del" data-list="howToBuy" data-i="${i}" title="刪除" aria-label="刪除">✕</button></div>
          </li>`).join("")}
        </ol>
        <button type="button" class="a-btn" data-act="li-add" data-list="howToBuy">＋ 新增步驟</button>
      </section>
      <section class="card">
        <h2>常見問題</h2>
        <ul class="elist">${faq.map((f, i) => `
          <li class="erow">
            <div class="erow-fields">
              <label class="f"><span>問題</span><input data-list="faq" data-i="${i}" data-k="q" value="${esc(f.q)}"></label>
              <label class="f"><span>回答</span><textarea data-list="faq" data-i="${i}" data-k="a" rows="2">${esc(f.a)}</textarea></label>
            </div>
            <div class="erow-tools">${moveBtns("faq", i, faq.length)}<button type="button" class="icon del" data-act="li-del" data-list="faq" data-i="${i}" title="刪除" aria-label="刪除">✕</button></div>
          </li>`).join("")}
        </ul>
        <button type="button" class="a-btn" data-act="li-add" data-list="faq">＋ 新增問題</button>
      </section>`);
  }

  /* ================= 網站文字 ================= */
  const TEXT_FIELDS = [
    ["name", "工作室名稱", "顯示在網站最上面、首頁大標題和頁尾。", false],
    ["intro", "首頁介紹", "首頁大圖上的那段話。", true],
    ["otherDesc", "「其他商品」說明", "其他商品區塊最上面的一句話。", true],
    ["contactText", "聯絡區說明", "網站最下面「到 Discord 開服務單」旁邊的說明。", true],
    ["discord", "Discord 邀請連結", "網站上所有「Discord 下單」按鈕都會連到這裡。", false],
  ];
  function renderTexts() {
    showView(`
      <section class="card">
        <h2>網站文字</h2>
        ${TEXT_FIELDS.map(([k, label, help, long]) => `
          <label class="f"><span>${label}</span>
            ${long ? `<textarea data-studio="${k}" rows="3">${esc(S.data.studio[k])}</textarea>` : `<input data-studio="${k}" value="${esc(S.data.studio[k])}">`}
            <small>${help}</small></label>`).join("")}
        <p class="hint">價目表上的紅字標語和說明，在「價目表」分頁修改。</p>
      </section>`);
  }

  /* ================= 清單型資料（分類、價目表、步驟、問答） ================= */
  const LIST_NEW = {
    categories: () => ({ id: newId("c"), label: "新分類", desc: "", showcase: false }),
    priceList: () => ({ item: "", price: 0, unit: "" }),
    howToBuy: () => "",
    faq: () => ({ q: "", a: "" }),
  };
  function listInput(t) {
    const list = S.data[t.dataset.list], i = Number(t.dataset.i), k = t.dataset.k;
    if (!list || !(i in list)) return;
    let v = t.value;
    if (k === "showcase") { if (!t.checked) return; v = t.value === "1"; }
    else if (k === "price") v = t.value === "" ? 0 : Math.max(0, Number(t.value) || 0);
    if (k) list[i][k] = v; else list[i] = v;
    changed();
  }
  function listAction(act, name, i) {
    const list = S.data[name];
    if (act === "li-add") {
      list.push(LIST_NEW[name]());
    } else if (act === "li-up" && i > 0) {
      [list[i - 1], list[i]] = [list[i], list[i - 1]];
    } else if (act === "li-down" && i < list.length - 1) {
      [list[i + 1], list[i]] = [list[i], list[i + 1]];
    } else if (act === "li-del") {
      const [removed] = list.splice(i, 1);
      toast("已刪除", "ok", { undo: () => { list.splice(i, 0, removed); changed(); route(true); } });
    } else return;
    changed();
    route(true);
    if (act === "li-add") {
      const rows = $$(".erow, .ptable-row");
      rows[rows.length - 1]?.querySelector("input, textarea")?.focus();
    } else if (act === "li-up" || act === "li-down") {
      const j = act === "li-up" ? i - 1 : i + 1;
      $(`[data-act="${act}"][data-list="${name}"][data-i="${j}"]:not([disabled])`)?.focus();
    }
  }
  async function deleteCategory(i) {
    const c = S.data.categories[i];
    const n = S.data.products.filter((p) => p.category === c.id).length;
    if (n) {
      await dialog({
        title: `「${c.label}」還有 ${n} 個商品`,
        body: "<p>請先把這些商品改到別的分類（或刪除），才能刪除這個分類。</p>",
        buttons: [{ label: "知道了", value: true, kind: "primary" }],
      });
      return;
    }
    listAction("li-del", "categories", i);
  }

  /* ================= 發佈 ================= */
  function commitMessage(changes) {
    const shown = changes.slice(0, 5).join("、");
    return `後台更新：${shown}${changes.length > 5 ? ` 等 ${changes.length} 項` : ""}`;
  }

  async function publish() {
    if (S.publishing) return;
    if (S.ed && edDirty()) {
      const ok = await dialog({
        title: "這個商品還沒儲存",
        body: "<p>正在編輯的商品有修改還沒儲存，要先儲存再發佈嗎？</p>",
        buttons: [{ label: "先不要發佈", value: false }, { label: "儲存並發佈", value: true, kind: "primary" }],
      });
      if (!ok || !saveEditor()) return;
    }
    const changes = describeChanges();
    if (!changes.length) return toast("沒有需要發佈的修改");
    const go = await dialog({
      title: "發佈到網站",
      body: `<p>這次會更新：</p><ul class="changes">${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        <p class="hint">發佈後大約 1～2 分鐘，網站就會出現新內容。</p>`,
      buttons: [{ label: "再檢查一下", value: false }, { label: "發佈", value: true, kind: "primary" }],
    });
    if (!go) return;

    S.publishing = true; renderStatus();
    let prog = progress("檢查網站目前的版本…");
    try {
      const result = await doPublish(changes, (t) => prog.set(t), async (fn) => {
        prog.close();
        const r = await fn();
        prog = progress("繼續發佈…");
        return r;
      });
      prog.close();
      if (!result) return;
      await dialog({
        title: "發佈完成",
        body: `<p>已經送到 GitHub 了${result.uploaded ? `（含 ${result.uploaded / 2} 張新圖片）` : ""}。</p>
          <p>網站大約 1～2 分鐘後會更新，好了會在上面顯示「✓ 網站是最新內容」。</p>`,
        buttons: [{ label: "好", value: true, kind: "primary" }],
      });
      watchLive(result.updatedAt);
    } catch (e) {
      console.error(e);
      prog.close();
      await dialog({
        title: "發佈失敗",
        body: `<p>${esc(explain(e))}</p><p class="hint">修改都還留著，沒有不見，可以再按一次「發佈到網站」。</p>`,
        buttons: [{ label: "好", value: true, kind: "primary" }],
      });
    } finally {
      S.publishing = false;
      renderStatus();
      if (!S.ed) route(true); // 更新「還沒發佈」的標記
    }
  }

  async function doPublish(changes, step, pause) {
    for (let attempt = 0; attempt < 3; attempt++) {
      step("檢查網站目前的版本…");
      const head = (await gh(`/git/ref/heads/${CFG.branch}`)).object.sha;

      // 編輯期間，網站上的資料被別的地方改過 → 先問
      if (head !== S.baseSha) {
        const remote = normalize(JSON.parse(await gh(`/contents/${CFG.dataPath}?ref=${head}`, { raw: true })));
        if (canon(remote) !== S.base) {
          const ok = await pause(() => dialog({
            title: "網站上的內容剛剛被改過",
            body: `<p>在你編輯的期間，網站上的商品資料被其他地方改過（可能是另一台電腦，或請人幫忙改的）。</p>
              <p>繼續發佈的話，會用你現在的版本<b>蓋掉</b>那些修改。</p>`,
            buttons: [{ label: "先不要", value: false }, { label: "用我的版本發佈", value: true, kind: "danger" }],
            dismissible: false,
          }));
          if (!ok) return null;
        }
        setBase(canon(remote), head);
      }

      step("整理圖片…");
      const commit = await gh(`/git/commits/${head}`);
      const tree = await gh(`/git/trees/${commit.tree.sha}?recursive=1`);
      const existing = new Set(tree.tree.filter((t) => t.type === "blob").map((t) => t.path));
      const pending = new Map((await idb.all().catch(() => [])).map((f) => [f.path, f.blob]));

      // 找不到的圖片（瀏覽器資料被清掉之類）
      const missing = [];
      S.data.products.forEach((p) => p.images.forEach((img) => {
        if (isLocal(img) && !existing.has(img) && !pending.has(img)) missing.push([p, img]);
      }));
      if (missing.length) {
        const ok = await pause(() => dialog({
          title: `有 ${missing.length} 張圖片找不到`,
          body: `<p>這些圖片可能因為瀏覽器資料被清除而不見了：</p>
            <ul class="changes">${[...new Set(missing.map(([p]) => p.name))].map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
            <p>繼續發佈的話，會把這幾張從商品裡拿掉，之後可以再重新上傳。</p>`,
          buttons: [{ label: "先不要", value: false }, { label: "拿掉並繼續", value: true, kind: "primary" }],
          dismissible: false,
        }));
        if (!ok) return null;
        missing.forEach(([p, img]) => { p.images = p.images.filter((x) => x !== img); });
      }

      const used = usedPaths();
      const entries = [];
      const toUpload = [...used].filter((path) => pending.has(path) && !existing.has(path));
      for (let k = 0; k < toUpload.length; k++) {
        step(`上傳圖片 ${k + 1} / ${toUpload.length}…`);
        const content = await blobToBase64(pending.get(toUpload[k]));
        const blob = await gh("/git/blobs", { method: "POST", body: { content, encoding: "base64" } });
        entries.push({ path: toUpload[k], mode: "100644", type: "blob", sha: blob.sha });
      }
      // 後台上傳過、但已經沒有商品在用的圖片，順便刪掉
      tree.tree.forEach((t) => {
        if (t.type === "blob" && t.path.startsWith(CFG.uploadDir) && !used.has(t.path)) {
          entries.push({ path: t.path, mode: "100644", type: "blob", sha: null });
        }
      });

      step("寫入商品資料…");
      const updatedAt = new Date().toISOString();
      const out = { updatedAt, ...JSON.parse(canon(S.data)) };
      entries.push({ path: CFG.dataPath, mode: "100644", type: "blob", content: JSON.stringify(out, null, 2) + "\n" });
      const newTree = await gh("/git/trees", { method: "POST", body: { base_tree: commit.tree.sha, tree: entries } });
      const newCommit = await gh("/git/commits", { method: "POST", body: { message: commitMessage(changes), tree: newTree.sha, parents: [head] } });
      try {
        await gh(`/git/refs/heads/${CFG.branch}`, { method: "PATCH", body: { sha: newCommit.sha, force: false } });
      } catch (e) {
        if (e.status === 422 && attempt < 2) continue; // 剛好有別的更新進來，重來一次
        throw e;
      }

      S.data.updatedAt = updatedAt;
      setBase(canon(S.data), newCommit.sha);
      saveDraft();
      // 圖片已經在 GitHub 上了：用不到的暫存直接刪，剛上傳的多留 10 分鐘，等網站更新好
      for (const [path, blob] of pending) {
        if (used.has(path)) await idb.put({ path, blob, publishedAt: Date.now() }).catch(() => {});
        else await idb.del(path).catch(() => {});
      }
      return { updatedAt, uploaded: toUpload.length };
    }
    throw Object.assign(new Error("retry"), { status: 409 });
  }

  async function watchLive(updatedAt) {
    if (CFG.branch !== "main") return;
    S.watching = updatedAt; renderStatus();
    for (let i = 0; i < 40 && S.watching === updatedAt; i++) {
      await sleep(i < 2 ? 20000 : 10000);
      try {
        const r = await fetch(`../${CFG.dataPath}?t=${Date.now()}`, { cache: "no-store" });
        if (r.ok && (await r.json()).updatedAt === updatedAt) {
          S.watching = null; renderStatus();
          toast("網站已經更新完成 ✓");
          return;
        }
      } catch (e) { /* 再等等 */ }
    }
    if (S.watching === updatedAt) { S.watching = null; renderStatus(); }
  }

  async function discardAll() {
    const ok = await dialog({
      title: "放棄所有還沒發佈的修改？",
      body: "<p>會回到網站目前的內容，這些修改就不見了。</p>",
      buttons: [{ label: "取消", value: false }, { label: "放棄修改", value: true, kind: "danger" }],
    });
    if (!ok) return;
    S.ed = null;
    localStorage.removeItem(LS_DRAFT);
    history.replaceState(null, "", location.pathname + location.search + "#/products");
    location.reload();
  }

  function writePreview() {
    saveDraft();
    let data = S.data;
    if (S.ed) { // 正在編輯、還沒儲存的商品也一起預覽
      data = clone(S.data);
      const p = withPrice(S.ed.p, S.ed);
      const i = data.products.findIndex((x) => x.id === p.id);
      if (i >= 0) data.products[i] = p; else data.products.push(p);
    }
    try { localStorage.setItem(LS_PREVIEW, JSON.stringify({ data, savedAt: Date.now() })); } catch (e) { /* 空間不夠就算了 */ }
  }

  /* ================= 事件 ================= */
  function bindOnce() {
    if (bound) return;
    bound = true;
    addEventListener("hashchange", () => route());

    document.addEventListener("click", async (e) => {
      const el = e.target.closest("[data-act], [data-badge]");
      if (!el) return;
      if (el.hasAttribute("data-badge") && S.ed) {
        S.ed.p.badge = el.dataset.badge;
        $('[data-f="badge"]').value = el.dataset.badge;
        renderMini();
        return;
      }
      const act = el.dataset.act, id = el.dataset.id, i = Number(el.dataset.i);
      switch (act) {
        case "tips-x": localStorage.setItem(LS_TIPS, "1"); el.closest(".tips").remove(); break;
        case "p-up": moveProduct(id, -1); break;
        case "p-down": moveProduct(id, 1); break;
        case "p-toggle": {
          const p = S.data.products.find((x) => x.id === id);
          p.hidden = !p.hidden; changed(); renderProductList();
          toast(p.hidden ? `已下架「${p.name}」` : `已上架「${p.name}」`);
          break;
        }
        case "p-del": deleteProduct(id); break;
        case "ed-save": saveEditor(); break;
        case "ed-cancel": cancelEditor(); break;
        case "ed-dup": duplicateProduct(); break;
        case "ed-del": {
          if (S.data.products.some((x) => x.id === S.ed.p.id)) deleteProduct(S.ed.p.id, { fromEditor: true });
          break;
        }
        case "img-left": case "img-right": case "img-cover": case "img-del": {
          const imgs = S.ed.p.images;
          if (act === "img-left" && i > 0) [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]];
          if (act === "img-right" && i < imgs.length - 1) [imgs[i + 1], imgs[i]] = [imgs[i], imgs[i + 1]];
          if (act === "img-cover") imgs.unshift(imgs.splice(i, 1)[0]);
          if (act === "img-del") imgs.splice(i, 1);
          renderImages(); renderMini();
          break;
        }
        case "li-add": case "li-up": case "li-down": case "li-del": listAction(act, el.dataset.list, i); break;
        case "cat-del": deleteCategory(i); break;
        case "discard": discardAll(); break;
        case "logout": logout(); break;
      }
    });

    const onInput = (e) => {
      const t = e.target;
      if (S.ed && t.closest(".ed")) return edInput(t);
      if (t.dataset.list) return listInput(t);
      if (t.dataset.studio) { S.data.studio[t.dataset.studio] = t.value; changed(); return; }
      if (t.id === "p-search") { S.query = t.value; renderProductList(); }
      if (t.id === "p-filter") { S.filter = t.value; renderProductList(); }
    };
    view().addEventListener("input", onInput);
    view().addEventListener("change", (e) => {
      if (e.target.id === "ed-file") { addImages(e.target.files); e.target.value = ""; return; }
      if (e.target.type === "radio" || e.target.tagName === "SELECT") onInput(e);
    });

    // 圖片：拖曳、貼上
    let dragDepth = 0;
    addEventListener("dragenter", (e) => { if (S.ed && e.dataTransfer?.types.includes("Files")) { dragDepth++; $("#drop")?.classList.add("over"); } });
    addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("#drop")?.classList.remove("over"); } });
    addEventListener("dragover", (e) => e.preventDefault());
    addEventListener("drop", (e) => {
      e.preventDefault();
      dragDepth = 0; $("#drop")?.classList.remove("over");
      if (S.ed && e.dataTransfer?.files.length) addImages(e.dataTransfer.files);
    });
    addEventListener("paste", (e) => {
      if (!S.ed) return;
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); addImages(files); }
    });

    addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && S.ed) { e.preventDefault(); saveEditor(); }
    });

    $("#btn-publish").addEventListener("click", publish);
    $("#btn-preview").addEventListener("click", writePreview);
    $("#btn-logout").addEventListener("click", logout);

    addEventListener("beforeunload", (e) => {
      if (S.publishing || edDirty()) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  async function logout() {
    const ok = await dialog({
      title: "登出？",
      body: `<p>登出後，這台電腦會忘記 GitHub 金鑰，下次要重新貼上。</p>${isDirty() ? `<p class="hint">還沒發佈的修改會留在這台電腦，下次登入可以繼續。</p>` : ""}`,
      buttons: [{ label: "取消", value: false }, { label: "登出", value: true, kind: "primary" }],
    });
    if (!ok) return;
    if (S.ed && edDirty()) saveEditor();
    S.ed = null;
    localStorage.removeItem(LS_TOKEN);
    location.reload();
  }

  start();
})();
