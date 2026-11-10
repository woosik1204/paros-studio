(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- language ---------- */
  let lang = "ko";
  try {
    lang = localStorage.getItem("lang") || ((navigator.language || "ko").startsWith("ko") ? "ko" : "en");
  } catch (e) { /* storage unavailable */ }
  if (!TEXT[lang]) lang = "ko";
  const t = (k) => TEXT[lang][k] ?? k;

  let filter = "all";
  const galleryAt = {}; // product id -> which photo is showing

  /* ---------- placeholder art (shown until a photo is added) ---------- */
  const ART = {
    cylinder:
      '<ellipse cx="50" cy="26" rx="30" ry="10" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M20 26v48a30 10 0 0 0 60 0V26" fill="url(#ln)" stroke="currentColor" stroke-width="2"/>',
    ribs:
      '<path d="M12 40h76" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
      [22, 34, 46, 58, 70].map((x, i) =>
        `<path d="M${x} 40c-2 ${22 - i * 2} 4 ${34 - i * 3} 12 ${36 - i * 3}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`
      ).join("") +
      '<path d="M88 40l8-8M12 40L4 52" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    layers:
      [0, 1, 2, 3, 4, 5].map((i) =>
        `<rect x="${18 + i * 3}" y="${72 - i * 11}" width="${64 - i * 6}" height="7" rx="3.5" fill="currentColor" opacity="${1 - i * 0.13}"/>`
      ).join(""),
    cube:
      '<path d="M50 14l32 17v38L50 86 18 69V31z" fill="url(#ln)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M18 31l32 17 32-17M50 48v38" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  };
  const art = (name) =>
    `<svg viewBox="0 0 100 100" aria-hidden="true">
       <defs><pattern id="ln" width="6" height="5" patternUnits="userSpaceOnUse"><rect width="6" height="1.6" fill="currentColor" opacity=".55"/></pattern></defs>
       ${ART[name] || ART.cube}
     </svg>`;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- render ---------- */
  function renderText() {
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  }

  function renderFilters() {
    const cats = ["all"].concat([...new Set(PRODUCTS.map((p) => p.category))]);
    $("#filters").innerHTML = cats.map((c) =>
      `<button type="button" class="chip" data-cat="${c}" aria-pressed="${c === filter}">${esc(t("filter." + c))}</button>`
    ).join("");
  }

  function renderGrid() {
    const list = PRODUCTS.filter((p) => filter === "all" || p.category === filter);
    $("#grid").innerHTML = list.map((p) => {
      const wait = p.status === "waitlist";
      const slides = p.images && p.images.length ? p.images : (p.image ? [p.image] : []);
      const cur = Math.min(galleryAt[p.id] || 0, Math.max(slides.length - 1, 0));
      let media = art(p.art);
      if (slides.length) {
        media = slides.map((s, i) =>
          `<div class="slide"${i === cur ? "" : " hidden"}>` +
          [].concat(s).map((src) => `<img src="${esc(src)}" alt="${esc(p.name[lang])}" loading="lazy">`).join("") +
          `</div>`).join("");
        if (slides.length > 1) {
          media +=
            `<button type="button" class="gal-btn prev" data-gal="${esc(p.id)}" data-step="-1" aria-label="${esc(t("gal.prev"))}">‹</button>` +
            `<button type="button" class="gal-btn next" data-gal="${esc(p.id)}" data-step="1" aria-label="${esc(t("gal.next"))}">›</button>` +
            `<div class="gal-dots" aria-hidden="true">${slides.map((_, i) => `<i${i === cur ? ' class="on"' : ""}></i>`).join("")}</div>`;
        }
      }
      return `<article class="card">
        <div class="card-media">${media}<span class="badge ${wait ? "waitlist" : ""}">${esc(t(wait ? "badge.waitlist" : "badge.made"))}</span></div>
        <div class="card-body">
          <h3>${esc(p.name[lang])}</h3>
          <p>${esc(p.desc[lang])}</p>
          <div class="card-foot">
            <span class="price">${esc(p.price[lang])}</span>
            <button type="button" class="btn ${wait ? "primary" : ""}" data-pick="${esc(p.id)}">${esc(t(wait ? "btn.waitlist" : "btn.request"))}</button>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function renderItems() {
    const sel = $("#item");
    const keep = sel.value;
    sel.innerHTML = `<option value="">${esc(t("req.item.none"))}</option>` +
      PRODUCTS.map((p) => `<option value="${esc(p.id)}">${esc(p.name[lang])}</option>`).join("");
    sel.value = keep;
  }

  function renderAll() { renderText(); renderFilters(); renderGrid(); renderItems(); }

  /* ---------- form ---------- */
  const form = $("#form");
  const status = $("#status");

  function setType(type) {
    form.elements.type.value = type;
  }

  function pick(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    setType(p.category === "service" ? "custom" : "waitlist");
    $("#item").value = id;
    $("#request").scrollIntoView();
    form.elements.name.focus({ preventScroll: true });
  }

  function summary(d) {
    const p = PRODUCTS.find((x) => x.id === d.item);
    const L = lang === "ko"
      ? { h: "[Paros Studio 요청]", type: "종류", item: "상품", qty: "수량", name: "이름", contact: "연락처", details: "내용", link: "참고" }
      : { h: "[Paros Studio request]", type: "Type", item: "Item", qty: "Qty", name: "Name", contact: "Contact", details: "Details", link: "Reference" };
    return [
      L.h,
      `${L.type}: ${t("req.type." + d.type)}`,
      p ? `${L.item}: ${p.name[lang]}` : "",
      p ? `${L.qty}: ${d.quantity}` : "",
      `${L.name}: ${d.name}`,
      `${L.contact}: ${d.contact}`,
      d.details ? `${L.details}: ${d.details}` : "",
      d.link ? `${L.link}: ${d.link}` : "",
    ].filter(Boolean).join("\n");
  }

  function showSendOptions(text, name) {
    $("#dmText").textContent = text;
    $("#dmEmail").href = "mailto:" + SITE.email +
      "?subject=" + encodeURIComponent(t("req.mail.subject") + " — " + name.trim()) +
      "&body=" + encodeURIComponent(text);
    $("#dmStatus").textContent = "";
    $("#dm").hidden = false;
  }

  $("#dmEmail").addEventListener("click", () => {
    $("#dmStatus").textContent = t("req.dm.emailed");
    $("#dmStatus").className = "status ok";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (d._gotcha) return; // bot trap

    let ok = true;
    ["name", "contact"].forEach((n) => {
      const el = form.elements[n];
      const bad = !el.value.trim();
      el.classList.toggle("invalid", bad);
      if (bad && ok) { el.focus(); ok = false; }
    });
    if (!ok) return;

    status.className = "status";
    const text = summary(d);

    if (!SITE.formEndpoint) {
      showSendOptions(text, d.name);
      $("#dm").scrollIntoView({ block: "center" });
      return;
    }

    const btn = $("#submit");
    btn.disabled = true;
    status.textContent = t("req.sending");
    try {
      const body = new FormData(form);
      const p = PRODUCTS.find((x) => x.id === d.item);
      if (p) body.set("item", p.name.en);
      body.set("language", lang);
      const res = await fetch(SITE.formEndpoint, { method: "POST", body, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = t("req.ok");
      status.className = "status ok";
    } catch (err) {
      status.textContent = t("req.err");
      status.className = "status err";
      showSendOptions(text, d.name);
    } finally {
      btn.disabled = false;
    }
  });

  $("#dmCopy").addEventListener("click", async () => {
    const text = $("#dmText").textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const r = document.createRange();
      r.selectNodeContents($("#dmText"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      try { document.execCommand("copy"); } catch (e2) { /* user can copy manually */ }
    }
    $("#dmStatus").textContent = t("req.dm.copied");
    $("#dmStatus").className = "status ok";
    window.open(SITE.instagramDM, "_blank", "noopener");
  });

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const langBtn = e.target.closest("[data-lang]");
    if (langBtn) {
      lang = langBtn.dataset.lang;
      try { localStorage.setItem("lang", lang); } catch (err) { /* ignore */ }
      renderAll();
      return;
    }
    const chip = e.target.closest("[data-cat]");
    if (chip) { filter = chip.dataset.cat; renderFilters(); renderGrid(); return; }
    const gal = e.target.closest("[data-gal]");
    if (gal) {
      const box = gal.closest(".card-media");
      const slides = $$(".slide", box);
      const n = slides.length;
      const i = ((galleryAt[gal.dataset.gal] || 0) + Number(gal.dataset.step) + n) % n;
      galleryAt[gal.dataset.gal] = i;
      slides.forEach((s, k) => { s.hidden = k !== i; });
      $$(".gal-dots i", box).forEach((d, k) => d.classList.toggle("on", k === i));
      return;
    }
    const pickBtn = e.target.closest("[data-pick]");
    if (pickBtn) { pick(pickBtn.dataset.pick); return; }
    if (e.target.closest("[data-custom]")) { setType("custom"); $("#item").value = ""; }
  });

  /* ---------- init ---------- */
  $("#igLink").href = SITE.instagram;
  $("#igHandle").textContent = SITE.instagramHandle;
  $("#igFoot").href = SITE.instagram;
  $("#igFoot").textContent = "Instagram " + SITE.instagramHandle;
  $("#year").textContent = new Date().getFullYear();
  renderAll();
})();
