// =========================================================
// TIME CAPSULE — 화면 구성 · 라우팅 · 인터랙션
// =========================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const VIEWS = ["home", "write", "seal", "capsules", "archive"];

const ui = {
  view: null,
  navToken: 0,
  filter: "all",
  page: 0,
  sealChoice: null, // { mode: "date" | "demo", openAt, quick }
  calMonth: null, // 달력에 보이는 달의 1일
  sealed: null, // 방금 봉인한 캡슐
  drawerId: null,
  readerId: null,
  archiveId: null,
  busy: false,
  pendingRoute: false,
  readySig: "",
  typingTimer: null,
  saveTimer: null,
  toastTimer: null,
};

const orbUI = $("#orb-ui");
const titleIn = $("#memo-title");
const bodyIn = $("#memo-body");

// ---------------- HELPERS ----------------

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function vp() {
  const W = innerWidth;
  const H = innerHeight;
  const mobile = W < 820;
  return { W, H, mobile, sb: mobile ? 0 : 240, m: Math.min(W, H) };
}

function fmtOpen(ts) {
  return ts === startOfDay(ts) ? `${fmtDate(ts)} ${fmtDay(ts)}` : `${fmtDate(ts)} · ${fmtTime(ts, true)}`;
}

function setPaletteVars(el, index) {
  const p = PALETTES[index] || PALETTES[0];
  el.style.setProperty("--pa", p.a);
  el.style.setProperty("--pb", p.b);
  el.style.setProperty("--pc", p.c);
}

// 구체를 따라다니는 DOM 레이어
function resetOrbUI() {
  orbUI.replaceChildren();
  Orbs.clearBindings();
}

function bindEl(id, child, opt) {
  const wrap = h("div", "bind");
  wrap.append(child);
  orbUI.append(wrap);
  Orbs.bind(id, wrap, opt);
  return wrap;
}

function setBusy(on) {
  ui.busy = on;
  document.body.classList.toggle("is-busy", on);

  if (!on && ui.pendingRoute) {
    ui.pendingRoute = false;
    route();
  }
}

// ---------------- SCENES (구체 배치) ----------------

// [x, y, r] — 라벨이 아래로 들어갈 수 있도록 화면 아래쪽은 비워 둔다
const SLOTS_D = [
  [0.22, 0.44, 0.17],
  [0.55, 0.28, 0.12],
  [0.83, 0.47, 0.18],
  [0.47, 0.7, 0.1],
  [0.12, 0.77, 0.07],
  [0.66, 0.82, 0.08],
  [0.93, 0.15, 0.065],
  [0.33, 0.14, 0.055],
];

const SLOTS_M = [
  [0.34, 0.2, 0.24],
  [0.8, 0.12, 0.13],
  [0.73, 0.44, 0.2],
  [0.27, 0.6, 0.16],
  [0.68, 0.76, 0.14],
  [0.2, 0.9, 0.1],
];

const SLOT_BLUR = [0.02, 0.1, 0.04, 0.16, 0.28, 0.12, 0.32, 0.24];

function homeIds() {
  const un = Store.unopened();
  return [0, 1, 2].map((i) => (un[i] ? un[i].id : `h-${i + 1}`));
}

function draftR(d) {
  const { m, W, mobile } = vp();
  const grow = Math.min(1, Math.log1p(d.title.length + d.body.length) / Math.log1p(900));
  return mobile ? W * (0.08 + 0.08 * grow) : m * (0.05 + 0.07 * grow);
}

function sceneFor(view) {
  const { W, H, sb, m, mobile } = vp();

  if (view === "home") {
    const un = Store.unopened();
    const ids = homeIds();
    const cap = (i, base, fallback) => {
      const c = un[i];
      return {
        id: ids[i],
        palette: c ? c.palette : fallback,
        seed: c ? c.seed : undefined,
        seam: c ? 1 : 0,
        ready: c && capStatus(c) === "ready" ? 1 : 0,
        ...base,
      };
    };

    if (mobile) {
      return [
        { id: "h-4", x: W * 1.04, y: H * 0.7, r: W * 0.18, palette: 3, blur: 0.5, depth: 0.6, scroll: 0.5 },
        cap(1, { x: W * 1.02, y: H * 0.1, r: W * 0.22, blur: 0.3, depth: 0.5, scroll: 0.5 }, 1),
        cap(0, { x: W * 0.6, y: H * 0.31, r: W * 0.36, blur: 0.04, depth: 0.3, scroll: 0.35 }, 0),
        { id: "h-5", x: W * 0.18, y: H * 0.21, r: W * 0.06, palette: 4, blur: 0, depth: 0.9, scroll: 0.6 },
      ];
    }

    return [
      { id: "h-6", x: W * 0.07, y: H * 0.66, r: m * 0.11, palette: 7, blur: 0.6, depth: 0.8, scroll: 0.5 },
      { id: "h-4", x: W * 0.37, y: H * 0.0, r: m * 0.12, palette: 3, blur: 0.45, depth: 0.6, scroll: 0.45 },
      cap(2, { x: W * 0.87, y: H * 0.98, r: m * 0.26, blur: 0.12, depth: 0.25, scroll: 0.3 }, 2),
      cap(1, { x: W * 0.97, y: H * 0.1, r: m * 0.18, blur: 0.3, depth: 0.5, scroll: 0.55 }, 1),
      cap(0, { x: W * 0.65, y: H * 0.45, r: m * 0.32, blur: 0.03, depth: 0.3, scroll: 0.35 }, 0),
      { id: "h-5", x: W * 0.5, y: H * 0.93, r: m * 0.055, palette: 4, blur: 0, depth: 0.9, scroll: 0.7 },
    ];
  }

  if (view === "write") {
    const d = Store.draft();
    const draft = { id: "draft", palette: d.palette, seed: d.seed, r: draftR(d), blur: 0.02 };

    if (mobile) {
      return [
        { id: "w-1", x: W * 1.02, y: 90, r: W * 0.28, palette: 1, blur: 0.3, depth: 0.4, scroll: 0.3 },
        { id: "w-2", x: W * 0.02, y: H * 0.98, r: W * 0.3, palette: 0, blur: 0.5, depth: 0.5, scroll: 0.2 },
        { ...draft, x: W * 0.9, y: 300, depth: 0.4, scroll: 1 },
      ];
    }

    return [
      { id: "w-2", x: W * 0.2, y: H * 1.05, r: m * 0.2, palette: 0, blur: 0.45, depth: 0.5, scroll: 0.4 },
      { id: "w-1", x: W * 1.0, y: H * 0.04, r: m * 0.24, palette: 1, blur: 0.3, depth: 0.4, scroll: 0.3 },
      { id: "w-3", x: W * 0.97, y: H * 0.96, r: m * 0.1, palette: 3, blur: 0.1, depth: 0.7, scroll: 0.5 },
      { ...draft, x: W * 0.905, y: H * 0.53, depth: 0.5, scroll: 0.2 },
    ];
  }

  if (view === "seal") {
    const src = ui.sealed || Store.draft();
    const main = {
      id: ui.sealed ? ui.sealed.id : "draft",
      palette: src.palette,
      seed: src.seed,
      blur: 0.02,
      seam: ui.sealed ? 1 : 0,
    };

    if (mobile) {
      const r = Math.min(W * 0.3, 150);
      const grid = $(".seal-grid");
      const top = grid ? grid.getBoundingClientRect().top + scrollY : 140;
      return [
        { id: "w-1", x: W * 1.02, y: 90, r: W * 0.2, palette: 1, blur: 0.4, depth: 0.4, scroll: 0.5 },
        { ...main, x: W * 0.5, y: top + r + 8, r, depth: 0.2, scroll: 1 },
      ];
    }

    return [
      { id: "w-1", x: W * 1.03, y: H * 0.2, r: m * 0.13, palette: 1, blur: 0.4, depth: 0.5, scroll: 0.3 },
      { id: "w-2", x: W * 0.44, y: H * 1.08, r: m * 0.17, palette: 0, blur: 0.5, depth: 0.5, scroll: 0.4 },
      { ...main, x: sb + (W - sb) * 0.7, y: H * 0.48, r: m * 0.26, depth: 0.25, scroll: 0.15 },
    ];
  }

  if (view === "capsules") {
    const { un, items, slots } = capsulePage();

    if (!un.length) {
      return [
        { id: "e-1", x: sb + (W - sb) * 0.62, y: H * 0.42, r: m * 0.2, palette: 7, blur: 0.5, alpha: 0.6, depth: 0.3 },
        { id: "e-2", x: sb + (W - sb) * 0.9, y: H * 0.78, r: m * 0.1, palette: 2, blur: 0.4, alpha: 0.5, depth: 0.6 },
        { id: "e-3", x: sb + (W - sb) * 0.3, y: H * 0.86, r: m * 0.07, palette: 3, blur: 0.6, alpha: 0.45, depth: 0.7 },
      ];
    }

    const top = mobile ? 150 : 0;
    return items.map((c, i) => {
      const [fx, fy, fr] = slots[i];
      return {
        id: c.id,
        x: mobile ? W * fx : sb + (W - sb) * fx,
        y: mobile ? top + (H - top - 40) * fy : H * fy,
        r: (mobile ? W : m) * fr,
        palette: c.palette,
        seed: c.seed,
        blur: SLOT_BLUR[i],
        depth: 0.2 + (i % 4) * 0.12,
        scroll: 0,
        seam: 1,
        ready: capStatus(c) === "ready" ? 1 : 0,
        hover: ui.drawerId === c.id ? 1 : 0,
      };
    });
  }

  if (view === "archive") {
    const sel = Store.byId(ui.archiveId) || Store.opened()[0];
    const main = { id: sel ? sel.id : "a-1", palette: sel ? sel.palette : 7, seed: sel ? sel.seed : undefined };

    if (mobile) {
      return [{ ...main, x: W * 1.0, y: 110, r: W * 0.3, blur: 0.3, depth: 0.3, scroll: 0.4 }];
    }

    return [
      { id: "a-2", x: W * 0.36, y: H * 0.93, r: m * 0.055, palette: 7, blur: 0.5, depth: 0.6, scroll: 0.5 },
      { ...main, x: W * 1.0, y: H * 0.98, r: m * 0.27, blur: 0.18, depth: 0.3, scroll: 0.2 },
    ];
  }

  return [];
}

// ---------------- ROUTER ----------------

function parseHash() {
  const [view, param] = location.hash.replace(/^#\/?/, "").split("/");
  return {
    view: VIEWS.includes(view) ? view : "home",
    param: param ? decodeURIComponent(param) : null,
  };
}

function route() {
  if (ui.busy) {
    ui.pendingRoute = true;
    return;
  }

  flushDraft();
  const { view, param } = parseHash();

  if (view === "seal" && !ui.sealed && !Store.hasContent()) {
    location.replace("#write");
    return;
  }

  if (view === "archive" && param) ui.archiveId = param;
  showView(view);
}

function showView(view) {
  const prev = ui.view;
  const token = ++ui.navToken;

  closeDrawer();
  closeReader();
  closeSettings();
  Lightbox.close();
  MediaView.stopAll();
  // 녹음 중에 다른 화면으로 가면 녹음한 만큼 첨부해 둔다
  if (prev === "write" && view !== "write" && Recorder.active) stopRecording(true);
  if (view !== "seal") ui.sealed = null;

  ui.view = view;
  document.body.dataset.view = view;

  const navKey = view === "seal" ? "write" : view;
  $$("[data-nav]").forEach((a) => {
    const on = a.dataset.nav === navKey;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  // 구체는 즉시 다음 장면으로 흘러가기 시작
  Orbs.setScene(sceneFor(view));
  orbUI.classList.add("is-hidden");

  const next = $(`.view[data-view="${view}"]`);
  const cur = prev ? $(`.view[data-view="${prev}"]`) : null;

  const enter = () => {
    if (token !== ui.navToken) return;
    $$(".view").forEach((v) => v !== next && v.classList.remove("is-active", "is-leaving"));
    window.scrollTo(0, 0);
    next.classList.add("is-active", "is-entering");
    renderView(view);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        next.classList.remove("is-entering");
        orbUI.classList.remove("is-hidden");
      }),
    );
  };

  if (cur && cur !== next) {
    cur.classList.add("is-leaving");
    setTimeout(enter, REDUCED ? 0 : 320);
  } else {
    enter();
  }
}

function renderView(view) {
  updateNavCounts();
  if (view === "home") renderHome();
  if (view === "write") renderWrite();
  if (view === "seal") renderSeal();
  if (view === "capsules") renderCapsules();
  if (view === "archive") renderArchive();
}

// 개수는 사용자 기록만 센다 (예시 기록 제외)
function updateNavCounts() {
  const st = Store.stats();
  $("#nav-count-caps").textContent = st.stored ? pad(st.stored) : "";
  $("#nav-count-arch").textContent = st.archived ? pad(st.archived) : "";
  $('[data-nav="capsules"]').classList.toggle("has-ready", st.ready > 0);
}

// ---------------- 01 HOME ----------------

function tagState(c) {
  return capStatus(c) === "ready" ? "READY TO OPEN" : `SEALED · OPENS ${fmtDate(c.openAt)}`;
}

function renderHome() {
  resetOrbUI();

  const now = Date.now();
  const un = Store.unopened();
  const mine = un.filter((c) => !c.sample);
  const ready = mine.filter((c) => capStatus(c, now) === "ready");
  const nextSealed = mine.find((c) => capStatus(c, now) === "sealed");
  const st = Store.stats(now);

  $("#stat-stored").textContent = pad(st.stored);
  $("#stat-ready").textContent = pad(st.ready);
  $("#stat-archived").textContent = pad(st.archived);
  $("#home-edition").textContent = `EDITION ${new Date().getFullYear()}`;

  const nextOpen = $("#next-open");
  nextOpen.replaceChildren();

  if (ready.length) {
    const a = h("a", "next-link", `${pad(ready.length)} CAPSULE${ready.length > 1 ? "S" : ""} READY TO OPEN →`);
    a.href = "#capsules";
    nextOpen.append(a);
  } else if (nextSealed) {
    const d = h("span", null, dLabel(nextSealed, now));
    d.dataset.dlabel = nextSealed.id;
    nextOpen.append(`NEXT OPENING — ${fmtDate(nextSealed.openAt)} · `, d);
  } else if (!st.stored && !st.archived) {
    const a = h("a", "next-link", `NO CAPSULES YET · ${pad(Store.samples.length)} SAMPLES TO EXPLORE →`);
    a.href = "#capsules";
    nextOpen.append(a);
  } else {
    nextOpen.textContent = "NO CAPSULES IN STORAGE";
  }

  // 구체 옆의 작은 정보 텍스트
  const { mobile } = vp();
  const ids = homeIds();
  const places = mobile
    ? [{ i: 0, ax: -0.92, ay: -0.92, align: "left" }]
    : [
        { i: 0, ax: -0.74, ay: -0.92, dx: -12, align: "right" },
        { i: 2, ax: -0.94, ay: -0.62, align: "right" },
      ];

  places.forEach((pl) => {
    const i = pl.i;
    const c = un[i];
    if (!c && i > 0) return;

    const tag = h("div", `tag tag-${pl.align}`);

    if (c) {
      const state = h("span", "micro dim", tagState(c));
      tag.append(h("span", "micro", capSerial(c)), h("span", "tag-title", `— ${c.title}`), state);
    } else {
      tag.append(
        h("span", "micro", "TC—000"),
        h("span", "tag-title", "— 첫 번째 캡슐을 기다리는 중"),
        h("span", "micro dim", "AWAITING FIRST CAPSULE"),
      );
    }

    bindEl(ids[i], tag, { ax: pl.ax, ay: pl.ay, dx: pl.dx });
  });
}

// ---------------- 02 WRITE ----------------

function renderWrite() {
  resetOrbUI();

  const d = Store.draft();
  if (!d.title && !d.body) d.createdAt = Date.now();

  if (titleIn.value !== d.title) titleIn.value = d.title;
  if (bodyIn.value !== d.body) bodyIn.value = d.body;
  autoGrow();

  $("#write-serial").textContent = `${serial(Store.nextNo())} · DRAFT`;
  $("#write-date").textContent = `${fmtDate(d.createdAt)} ${fmtDay(d.createdAt)}`;
  $("#write-time").textContent = fmtTime(d.createdAt);
  $("#autosave").textContent = d.updatedAt ? `SAVED ${fmtTime(d.updatedAt, true)}` : "AUTOSAVE ON · THIS BROWSER ONLY";
  setPaletteVars($(".write-sheet"), d.palette);
  updateWriteState();
  renderDraftMedia();
}

function updateWriteState() {
  const d = Store.draft();
  const ready = Store.hasContent(d);

  $("#write-count").textContent = `${d.body.length} CHARS`;
  $("#write-status").textContent = ready ? "READY TO SEAL" : d.title ? "WRITING" : "EMPTY";
  $("#write-media").textContent = mediaSummary(d.media) || "—";
  $("#to-seal").disabled = !ready || Recorder.active;
  $("#sheet-progress").style.transform = `scaleX(${Math.min(1, d.body.length / 600)})`;
}

function autoGrow() {
  bodyIn.style.height = "auto";
  bodyIn.style.height = bodyIn.scrollHeight + "px";
}

function onWriteInput() {
  const d = Store.draft();
  d.title = titleIn.value;
  d.body = bodyIn.value;

  autoGrow();
  updateWriteState();

  clearTimeout(ui.saveTimer);
  ui.saveTimer = setTimeout(() => {
    ui.saveTimer = null;
    Store.updateDraft({}).then((ok) => {
      $("#autosave").textContent = ok ? `SAVED ${fmtTime(Date.now(), true)}` : "SAVE FAILED — CHECK STORAGE";
    });
  }, 400);

  // 글을 쓰는 동안 캡슐이 조금씩 커지고 안쪽 색이 일렁인다
  Orbs.update("draft", { r: draftR(d), swirl: 0.7 });
  clearTimeout(ui.typingTimer);
  ui.typingTimer = setTimeout(() => Orbs.update("draft", { swirl: 0 }), 500);
}

function flushDraft() {
  if (!ui.saveTimer) return;
  clearTimeout(ui.saveTimer);
  ui.saveTimer = null;
  Store.updateDraft({});
}

// ---- 사진 · 음성 · 영상 첨부 ----

function attachStatus(msg) {
  const el = $("#attach-status");
  el.textContent = msg || "";
  el.hidden = !msg;
}

function renderDraftMedia() {
  const d = Store.draft();
  MediaView.render($("#draft-media"), d.media, {
    owner: d,
    editable: true,
    onRemove: async (m) => {
      await Store.removeMedia(m.id);
      renderDraftMedia();
      updateWriteState();
    },
  });
}

// 파일을 확인해 초안에 담는다 (여러 장이면 차례로)
async function attachFiles(files, kind) {
  const list = [...files];
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    attachStatus(`${KIND_KO[kind]} 담는 중 ${list.length > 1 ? `${i + 1} / ${list.length}` : ""}…`);
    try {
      const prep = kind === "photo" ? await MediaPrep.photo(file) : kind === "voice" ? await MediaPrep.audio(file) : await MediaPrep.video(file);
      await Store.addMedia(prep.blob, kind, prep);
      Orbs.update("draft", { swirl: 0.6 });
      setTimeout(() => Orbs.update("draft", { swirl: 0 }), 500);
    } catch (err) {
      notify(err);
      break;
    }
  }
  attachStatus("");
  renderDraftMedia();
  updateWriteState();
}

function notify(err) {
  if (!(err instanceof StorageError)) console.error(err);
  toast(err instanceof StorageError ? err.message : "파일을 담지 못했어요. 다시 시도해 주세요.", true);
}

async function startRecording() {
  if (Recorder.active || Recorder.pending) return;
  attachStatus("마이크 권한을 기다리는 중…");
  let started = false;
  try {
    started = await Recorder.begin(
      (s) => ($("#rec-time").textContent = fmtDuration(s)),
      () => stopRecording(true),
    );
  } catch (err) {
    notify(err);
  }
  attachStatus("");
  if (!started) return;
  $("#rec-time").textContent = "00:00";
  $("#rec").hidden = false;
  $(".attach-bar").classList.add("is-recording");
  updateWriteState();
  // 녹음하는 동안 캡슐이 조용히 일렁인다
  Orbs.update("draft", { swirl: 0.35 });
}

async function stopRecording(keep) {
  if (!Recorder.active) return;
  const res = await Recorder.finish(keep);
  $("#rec").hidden = true;
  $(".attach-bar").classList.remove("is-recording");
  Orbs.update("draft", { swirl: 0 });

  if (res) {
    try {
      const d = Store.draft();
      const n = d.media.filter((m) => m.kind === "voice").length + 1;
      await Store.addMedia(res.blob, "voice", { duration: res.duration, name: `녹음 ${pad(n)} · ${fmtTime(Date.now())}` });
    } catch (err) {
      notify(err);
    }
  }
  renderDraftMedia();
  updateWriteState();
}

// ---------------- 03 SEAL ----------------

function renderSeal() {
  resetOrbUI();

  const done = !!ui.sealed;
  $("#seal-form").hidden = done;
  $("#seal-done").hidden = !done;
  $("#seal-back").hidden = done;

  if (vp().mobile) {
    $(".seal-grid").style.paddingTop = Math.round(Math.min(vp().W * 0.3, 150) * 2 + 40) + "px";
  } else {
    $(".seal-grid").style.paddingTop = "";
  }

  if (done) {
    const c = ui.sealed;
    $("#done-serial").textContent = `${capSerial(c)} — CAPSULE SEALED`;
    $("#done-date").textContent = `see you on ${fmtDate(c.openAt)}`;
    $("#done-title").textContent = c.title;
    $("#done-opens").textContent = fmtOpen(c.openAt);
    const rem = $("#done-remaining");
    rem.dataset.dlabel = c.id;
    rem.textContent = dLabel(c);
    Orbs.setScene(sceneFor("seal"));
    return;
  }

  const d = Store.draft();
  const now = new Date();

  $("#seal-serial").textContent = `${serial(Store.nextNo())} · READY TO SEAL`;
  $("#seal-title").textContent = d.title.trim() || "무제";
  $("#seal-written").textContent = `${fmtDate(d.createdAt)} ${fmtDay(d.createdAt)} · ${fmtTime(d.createdAt)}`;
  setPaletteVars($(".seal-panel"), d.palette);

  if (!ui.calMonth) ui.calMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  renderCalendar();
  renderChoice();

  // 구체 앞에 떠 있는 메모 한 장
  const sheet = h("div", "sheet");
  sheet.id = "seal-sheet";
  sheet.append(
    h("span", "micro", `${serial(Store.nextNo())} · ${fmtDate(d.createdAt)}`),
    h("h4", "sheet-title", d.title.trim() || "무제"),
    h("p", "sheet-body", d.body.slice(0, 240)),
    h("span", "micro dim", [`${d.body.length} CHARS`, mediaSummary(d.media)].filter(Boolean).join(" · ")),
  );
  bindEl("draft", sheet, { fade: false });

  Orbs.setScene(sceneFor("seal"));
}

function renderCalendar() {
  const base = new Date(ui.calMonth);
  const y = base.getFullYear();
  const mo = base.getMonth();
  const today = startOfDay(Date.now());
  const sel = ui.sealChoice && ui.sealChoice.mode === "date" ? startOfDay(ui.sealChoice.openAt) : null;

  $("#cal-label").textContent = `${y} — ${pad(mo + 1)}`;

  const grid = $("#cal-grid");
  grid.replaceChildren();

  const firstDow = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) grid.append(h("span", "cal-blank"));

  for (let n = 1; n <= days; n++) {
    const ts = new Date(y, mo, n).getTime();
    const b = h("button", "cal-day");
    b.type = "button";
    b.append(h("span", null, String(n)));
    b.dataset.ts = ts;
    b.disabled = ts <= today; // 개봉일은 내일부터
    b.classList.toggle("is-today", ts === today);
    b.classList.toggle("is-selected", ts === sel);
    b.setAttribute("aria-label", `${fmtDate(ts)} ${fmtDay(ts)}`);
    if (ts === sel) b.setAttribute("aria-pressed", "true");
    grid.append(b);
  }

  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  $('[data-cal="-1"]').disabled = ui.calMonth <= thisMonth;
}

function renderChoice() {
  const ch = ui.sealChoice;

  $$("[data-quick]").forEach((b) => b.classList.toggle("is-active", !!ch && ch.quick === b.dataset.quick));

  if (!ch) {
    $("#seal-opens").textContent = "SELECT A DATE";
    $("#seal-duration").textContent = "—";
    $("#seal-btn").disabled = true;
    return;
  }

  if (ch.mode === "demo") {
    $("#seal-opens").textContent = `TODAY · ${fmtTime(Date.now() + 60000, true)}`;
    $("#seal-duration").textContent = "60 SECONDS — DEMO";
  } else {
    const dd = dayDiff(Date.now(), ch.openAt);
    $("#seal-opens").textContent = `${fmtDate(ch.openAt)} ${fmtDay(ch.openAt)}`;
    $("#seal-duration").textContent = `${dd} DAY${dd > 1 ? "S" : ""} IN THE CAPSULE`;
  }

  $("#seal-btn").disabled = false;
}

function chooseDate(ts, quick = null) {
  ui.sealChoice = { mode: "date", openAt: startOfDay(ts), quick };
  const d = new Date(ts);
  ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  renderCalendar();
  renderChoice();
  Orbs.update("draft", { swirl: 0.5 });
  setTimeout(() => Orbs.update("draft", { swirl: 0 }), 450);
}

async function sealCapsule() {
  const ch = ui.sealChoice;
  const d = Store.draft();
  if (ui.busy || !ch || !Store.hasContent(d)) return;

  flushDraft();
  setBusy(true);

  const openAt = ch.mode === "demo" ? Date.now() + 60000 : ch.openAt;
  const target = Orbs.get("draft");
  const r0 = target ? target.tr : vp().m * 0.26;
  const sheet = $("#seal-sheet");

  $("#seal-form").classList.add("is-sealing");

  // 1. 메모가 작아지며 구체 안으로 빨려 들어간다
  if (sheet && !REDUCED) {
    sheet.animate(
      [
        { transform: "translate(-50%, -50%) rotate(-3deg) scale(1)", opacity: 1, filter: "blur(0px)" },
        { transform: "translate(-50%, -56%) rotate(-1deg) scale(1.04)", opacity: 1, filter: "blur(0px)", offset: 0.2 },
        { transform: "translate(-50%, -50%) rotate(8deg) scale(0.04)", opacity: 0, filter: "blur(6px)" },
      ],
      { duration: 1500, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" },
    );
  } else if (sheet) {
    sheet.style.opacity = "0";
  }

  Orbs.update("draft", { swirl: 1.1, hover: 0.7 });
  await wait(REDUCED ? 50 : 1050);
  Orbs.update("draft", { r: r0 * 1.12, k: 0.05 });
  await wait(REDUCED ? 50 : 450);

  // 2. 구체가 닫히고(봉인선) 빛이 퍼진다
  const cap = Store.seal(openAt);
  // 봉인한 내용은 화면(숨겨진 글쓰기 영역 포함)에 남기지 않는다
  titleIn.value = "";
  bodyIn.value = "";
  MediaView.render($("#draft-media"), [], {});
  Orbs.rename("draft", cap.id);
  Orbs.flash(cap.id, 1.7);
  Orbs.update(cap.id, { r: r0, seam: 1, swirl: 0, hover: 0, k: 0.035 });
  await wait(REDUCED ? 50 : 650);

  ui.sealed = cap;
  ui.sealChoice = null;
  ui.calMonth = null;
  ui.readySig = readySignature(Date.now());
  $("#seal-form").classList.remove("is-sealing");

  renderSeal();
  updateNavCounts();
  setBusy(false);
}

// ---------------- 04 MY CAPSULES ----------------

function capsulePage() {
  const now = Date.now();
  const un = Store.unopened();
  // 필터의 숫자는 사용자 기록만 센다 (예시 기록 제외)
  const counts = { all: 0, sealed: 0, ready: 0 };
  un.filter((c) => !c.sample).forEach((c) => {
    counts.all++;
    counts[capStatus(c, now)]++;
  });

  const list = ui.filter === "all" ? un : un.filter((c) => capStatus(c, now) === ui.filter);
  const slots = vp().mobile ? SLOTS_M : SLOTS_D;
  const pages = Math.max(1, Math.ceil(list.length / slots.length));
  ui.page = Math.min(ui.page, pages - 1);
  const items = list.slice(ui.page * slots.length, (ui.page + 1) * slots.length);

  return { un, counts, list, items, slots, pages };
}

function renderCapsules() {
  resetOrbUI();

  const { un, counts, list, items, pages } = capsulePage();
  const { H } = vp();

  $("#count-all").textContent = pad(counts.all);
  $("#count-sealed").textContent = pad(counts.sealed);
  $("#count-ready").textContent = pad(counts.ready);

  $$("[data-filter]").forEach((b) => {
    const on = b.dataset.filter === ui.filter;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", String(on));
  });

  const empty = $("#caps-empty");
  empty.hidden = list.length > 0;
  $("#caps-empty-actions").hidden = un.length > 0;
  $("#caps-empty-title").textContent = !un.length
    ? "아직 보관 중인 캡슐이 없습니다."
    : ui.filter === "ready"
      ? "아직 개봉할 수 있는 캡슐이 없습니다."
      : "봉인 중인 캡슐이 없습니다.";

  const samples = list.filter((c) => c.sample).length;
  $("#caps-hint").hidden = !items.length;
  $("#caps-hint").textContent = `${samples ? `${pad(samples)} SAMPLES · NOT COUNTED · ` : ""}HOVER TO READ · CLICK TO INSPECT OR OPEN`;
  $("#pager").hidden = pages <= 1;
  $("#pager-label").textContent = `${pad(ui.page + 1)} / ${pad(pages)}`;

  const specs = new Map(sceneFor("capsules").map((s) => [s.id, s]));

  items.forEach((c) => {
    const spec = specs.get(c.id);
    const ready = capStatus(c) === "ready";

    // 클릭 영역
    const hit = h("button", "orb-hit");
    hit.type = "button";
    hit.setAttribute(
      "aria-label",
      `${capSerial(c)} ${c.title} — ${ready ? "개봉 가능, 눌러서 열기" : `봉인됨, ${fmtDate(c.openAt)} 개봉`}`,
    );
    orbUI.append(hit);
    Orbs.bind(c.id, hit, { mode: "box", fade: false });

    // 라벨: 평소엔 번호와 D-day, hover 시 제목과 개봉일
    const below = spec.y + spec.r + 64 < H;
    const label = h("div", `orb-label ${ready ? "is-ready" : ""} ${below ? "is-below" : "is-above"}`);
    const row = h("div", "ol-row");
    const state = h("span", "micro ol-state", dLabel(c));
    state.dataset.dlabel = c.id;
    row.append(h("span", "micro", capSerial(c)), state);

    const more = h("div", "ol-more");
    more.append(
      h("span", "ol-title", c.title),
      h("span", "micro dim", ready ? "CLICK TO OPEN" : `OPENS ${fmtOpen(c.openAt)}`),
    );

    label.append(row, more);
    bindEl(c.id, label, { ax: 0, ay: below ? 1 : -1, dy: below ? 14 : -14 });

    const enter = () => {
      Orbs.update(c.id, { hover: 1 });
      label.classList.add("is-hover");
    };
    const leave = () => {
      if (ui.drawerId !== c.id) Orbs.update(c.id, { hover: 0 });
      label.classList.remove("is-hover");
    };

    hit.addEventListener("pointerenter", enter);
    hit.addEventListener("pointerleave", leave);
    hit.addEventListener("focus", enter);
    hit.addEventListener("blur", leave);
    hit.addEventListener("click", () => {
      const cur = Store.byId(c.id);
      if (!cur) return;
      if (capStatus(cur) === "ready") openCapsule(cur.id);
      else openDrawer(cur.id);
    });
  });
}

function refreshCapsules() {
  Orbs.setScene(sceneFor("capsules"));
  renderCapsules();
}

// ---- 봉인된 캡슐 상세 ----

function openDrawer(id) {
  const c = Store.byId(id);
  if (!c) return;

  if (ui.drawerId && ui.drawerId !== id) Orbs.update(ui.drawerId, { hover: 0 });
  ui.drawerId = id;

  $("#dr-title").textContent = c.title;
  $("#dr-written").textContent = `${fmtDate(c.createdAt)} ${fmtDay(c.createdAt)}`;
  $("#dr-sealed").textContent = `${fmtDate(c.sealedAt)} · ${fmtTime(c.sealedAt)}`;
  $("#dr-opens").textContent = fmtOpen(c.openAt);
  // 무엇이 담겼는지만 알려 주고 내용은 보여주지 않는다
  $("#dr-contents").textContent = [`TEXT ${c.body.length} CHARS`, mediaSummary(c.media)].filter(Boolean).join(" · ");

  // 본문 대신 길이만 짐작할 수 있는 가림막
  const bars = $("#dr-redacted");
  bars.replaceChildren();
  const count = Math.max(3, Math.min(9, Math.round(c.body.length / 40)));
  for (let i = 0; i < count; i++) {
    const bar = h("i");
    bar.style.width = `${i === count - 1 ? 38 : 72 + 28 * Math.abs(Math.sin(c.seed * 7 + i * 1.7))}%`;
    bars.append(bar);
  }

  const drawer = $("#drawer");
  setPaletteVars(drawer, c.palette);
  updateDrawerLive();
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  Orbs.update(id, { hover: 1 });
  $("#drawer-close").focus({ preventScroll: true });
}

function updateDrawerLive() {
  const c = Store.byId(ui.drawerId);
  if (!c) return;

  const r = remaining(c.openAt);
  const ready = r.ms <= 0;

  $("#dr-serial").textContent = `${capSerial(c)} — ${ready ? "READY" : "SEALED"}`;
  $("#dr-days").textContent = r.days;
  $("#dr-days-unit").textContent = r.days === 1 ? "DAY" : "DAYS";
  $("#dr-clock").textContent = r.clock;
  $("#dr-open").hidden = !ready;
  $("#dr-note").textContent = ready
    ? "개봉일이 되었습니다. 이제 캡슐을 열 수 있어요."
    : "본문과 첨부한 사진 · 음성 · 영상은 개봉일까지 봉인되어 있습니다.";
}

function closeDrawer() {
  if (!ui.drawerId) return;
  Orbs.update(ui.drawerId, { hover: 0 });
  ui.drawerId = null;
  const drawer = $("#drawer");
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
}

// ---- 개봉 ----

async function openCapsule(id) {
  const c = Store.byId(id);
  if (!c || ui.busy) return;
  if (capStatus(c) !== "ready") {
    openDrawer(id);
    return;
  }

  closeDrawer();
  setBusy(true);
  orbUI.classList.add("is-hidden");
  $(".view-capsules").classList.add("is-dimmed");

  const { W, H, sb, m } = vp();

  // 1. 다른 캡슐은 사라지고, 고른 캡슐이 가운데로 와서 일렁인다
  Orbs.updateAll({ alpha: 0 }, id);
  Orbs.update(id, { x: sb + (W - sb) / 2, y: H / 2, r: m * 0.21, swirl: 1.3, hover: 1, ready: 1, k: 0.07 });
  await wait(REDUCED ? 50 : 950);

  // 2. 빛이 터지며 구체가 화면 가득 커지고, 안쪽의 메모가 드러난다
  Store.open(id);
  Orbs.flash(id, 1.5);
  Orbs.update(id, { r: Math.hypot(W, H) * 0.78, open: 1, seam: 0, swirl: 0.25, hover: 0, k: 0.03 });
  await wait(REDUCED ? 50 : 850);

  showReader(id);
  ui.readySig = readySignature(Date.now());
  updateNavCounts();
  setBusy(false);
}

function showReader(id) {
  const c = Store.byId(id);
  if (!c) return;

  ui.readerId = id;
  $("#rd-serial").textContent = `${capSerial(c)} — OPENED`;
  $("#rd-opened").textContent = `${fmtDate(c.openedAt)} · ${fmtTime(c.openedAt)}`;
  $("#rd-title").textContent = c.title;
  $("#rd-sub").textContent = `WRITTEN ${fmtDate(c.createdAt)} — ${dayDiff(c.sealedAt, c.openedAt)} DAYS IN THE CAPSULE`;
  $("#rd-body").textContent = c.body;
  $("#rd-body").hidden = !c.body;
  // 개봉한 뒤에야 사진 · 음성 · 영상을 꺼낸다
  MediaView.render($("#rd-media"), c.media, { owner: c });

  const reader = $("#reader");
  reader.scrollTop = 0;
  reader.classList.add("is-open");
  reader.setAttribute("aria-hidden", "false");
  $("#rd-archive").focus({ preventScroll: true });
}

function closeReader() {
  if (!ui.readerId) return;
  ui.readerId = null;
  MediaView.stopAll();
  const reader = $("#reader");
  reader.classList.remove("is-open");
  reader.setAttribute("aria-hidden", "true");
  $(".view-capsules").classList.remove("is-dimmed");
}

// ---------------- 05 ARCHIVE ----------------

function renderArchive() {
  resetOrbUI();

  const recs = Store.opened();
  $("#archive-count").textContent = `${pad(recs.length)} RECORD${recs.length === 1 ? "" : "S"}`;
  $("#archive-grid").hidden = !recs.length;
  $("#archive-empty").hidden = recs.length > 0;
  if (!recs.length) return;

  if (!recs.some((c) => c.id === ui.archiveId)) ui.archiveId = recs[0].id;

  const list = $("#archive-list");
  list.replaceChildren();

  recs.forEach((c) => {
    const li = h("li");
    const b = h("button", "ar-item");
    b.type = "button";
    b.classList.toggle("is-active", c.id === ui.archiveId);
    if (c.id === ui.archiveId) b.setAttribute("aria-current", "true");
    b.append(
      h("span", "micro", capSerial(c)),
      h("span", "ar-item-title", c.title),
      h("span", "micro dim", `WRITTEN ${fmtDate(c.createdAt)}`),
    );
    b.addEventListener("click", () => selectArchive(c.id));
    li.append(b);
    list.append(li);
  });

  renderArchiveReader();
}

function renderArchiveReader() {
  const c = Store.byId(ui.archiveId);
  const box = $("#archive-reader");
  box.replaceChildren();
  if (!c) return;

  const meta = h("dl", "ar-meta");
  [
    ["NO.", capSerial(c)],
    ["WRITTEN", fmtDate(c.createdAt)],
    ["SEALED", fmtDate(c.sealedAt)],
    ["OPENED", fmtDate(c.openedAt)],
  ].forEach(([k, v]) => {
    const row = h("div");
    row.append(h("dt", "micro", k), h("dd", null, v));
    meta.append(row);
  });

  const span = h("p", "micro ar-span", `— ${dayDiff(c.sealedAt, c.openedAt)} DAYS IN THE CAPSULE · OPENED ${fmtTime(c.openedAt)}`);

  const media = h("div", "media-list ar-media");
  MediaView.render(media, c.media, { owner: c });

  // 예시 기록은 지우지 않고 항상 남겨 둔다
  const foot = h("footer", "ar-foot");
  if (c.sample) {
    foot.append(h("span", "micro dim", "SAMPLE RECORD · 예시 기록은 개수에 포함되지 않습니다"));
  } else {
    const remove = h("button", "text-btn is-danger", "REMOVE RECORD");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm(`「${c.title}」 기록을 삭제할까요? 글과 첨부한 파일이 모두 지워지며 되돌릴 수 없습니다.`)) return;
      await Store.remove(c.id);
      ui.archiveId = null;
      history.replaceState(null, "", "#archive");
      renderArchive();
      Orbs.setScene(sceneFor("archive"));
      updateNavCounts();
    });
    foot.append(remove);
  }

  box.append(meta, h("h2", "ar-title", c.title), span, h("div", "ar-body", c.body), media, foot);

  box.classList.remove("is-in");
  void box.offsetWidth;
  box.classList.add("is-in");
}

function selectArchive(id) {
  if (id === ui.archiveId) return;
  ui.archiveId = id;
  history.replaceState(null, "", `#archive/${encodeURIComponent(id)}`);
  renderArchive();
  Orbs.setScene(sceneFor("archive"));

  if (vp().mobile) {
    $("#archive-reader").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
  }
}

// ---------------- LIVE CLOCK · 개봉 감지 ----------------

function readySignature(now) {
  return Store.unopened()
    .filter((c) => now >= c.openAt)
    .map((c) => c.id)
    .join(",");
}

function tickLive() {
  const now = Date.now();

  $("#clock-date").textContent = fmtDate(now).replace(/\./g, "—");
  $("#clock-time").textContent = fmtTime(now, true);

  $$("[data-dlabel]").forEach((el) => {
    const c = Store.byId(el.dataset.dlabel);
    if (c) el.textContent = dLabel(c, now);
  });

  if (ui.drawerId) updateDrawerLive();
  if (ui.view === "seal" && ui.sealChoice && ui.sealChoice.mode === "demo") renderChoice();

  // 개봉일이 된 캡슐이 생기면 화면을 갱신
  const sig = readySignature(now);
  if (sig !== ui.readySig && !ui.busy) {
    const before = new Set(ui.readySig.split(","));
    const newly = sig.split(",").filter((id) => id && !before.has(id));
    ui.readySig = sig;

    if (newly.length) {
      const c = Store.byId(newly[0]);
      toast(`${capSerial(c)} — READY TO OPEN`);
    }

    updateNavCounts();
    if (ui.view === "home" || ui.view === "capsules") {
      Orbs.setScene(sceneFor(ui.view));
      renderView(ui.view);
    }
  }
}

function toast(msg, warn = false) {
  const t = $("#toast");
  t.replaceChildren(h("i", "toast-dot"), h("span", null, msg));
  t.classList.toggle("is-warn", warn);
  t.classList.add("is-on");
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => t.classList.remove("is-on"), warn ? 6500 : 4600);
}

// ---------------- 저장 정보 · 전체 초기화 ----------------

async function refreshSettings() {
  const st = Store.stats();
  const d = Store.data.draft;
  $("#set-caps").textContent = pad(st.stored);
  $("#set-arch").textContent = pad(st.archived);
  $("#set-media").textContent = pad(st.media + (d ? d.media.length : 0));

  if (!Store.ok) {
    $("#set-usage").textContent = "UNAVAILABLE";
    return;
  }
  const est = await Store.usage();
  $("#set-usage").textContent = est && est.quota ? `${fmtBytes(est.usage || 0)} / ${fmtBytes(est.quota)}` : "—";
}

function openSettings() {
  refreshSettings();
  const el = $("#settings");
  el.classList.add("is-open");
  el.setAttribute("aria-hidden", "false");
  $("#settings-close").focus({ preventScroll: true });
}

function closeSettings() {
  const el = $("#settings");
  if (!el.classList.contains("is-open")) return;
  el.classList.remove("is-open");
  el.setAttribute("aria-hidden", "true");
}

function openConfirm() {
  const el = $("#confirm");
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("is-open"));
  $("#confirm-cancel").focus({ preventScroll: true });
}

function closeConfirm() {
  const el = $("#confirm");
  el.classList.remove("is-open");
  el.hidden = true;
}

// 확인 창에서 DELETE ALL DATA를 눌렀을 때만 실행된다
async function resetAllData() {
  if (ui.busy) return;
  const btn = $("#confirm-delete");
  btn.disabled = true;
  ui.busy = true;
  document.body.classList.add("is-busy");

  try {
    if (Recorder.active) await Recorder.finish(false);
    MediaView.stopAll();
    Lightbox.close();
    closeDrawer();
    closeReader();
    clearTimeout(ui.saveTimer);
    ui.saveTimer = null;

    await Store.resetAll();

    Object.assign(ui, { filter: "all", page: 0, sealChoice: null, calMonth: null, sealed: null, archiveId: null });
    ui.readySig = readySignature(Date.now());
    titleIn.value = "";
    bodyIn.value = "";
    toast("모든 기록을 삭제했습니다. 처음 상태로 돌아왔어요.");
  } catch (err) {
    console.error(err);
    toast("기록을 삭제하지 못했어요. 이 사이트를 연 다른 탭을 닫고 다시 시도해 주세요.", true);
  }

  btn.disabled = false;
  closeConfirm();
  closeSettings();
  ui.busy = false;
  ui.pendingRoute = false;
  document.body.classList.remove("is-busy");

  // HOME으로 돌아가 처음 방문한 것처럼 다시 그린다
  if (location.hash === "#home") showView("home");
  else location.hash = "#home";
}

// ---------------- EVENTS ----------------

function init() {
  ui.readySig = readySignature(Date.now());

  // WRITE
  titleIn.addEventListener("input", onWriteInput);
  bodyIn.addEventListener("input", onWriteInput);
  titleIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      bodyIn.focus();
    }
  });

  $("#to-seal").addEventListener("click", () => {
    flushDraft();
    location.hash = "#seal";
  });

  $("#draft-clear").addEventListener("click", async () => {
    const d = Store.draft();
    if ((d.title || d.body || d.media.length) && !confirm("작성 중인 초안과 첨부한 사진 · 음성 · 영상을 지울까요?")) return;
    if (Recorder.active) await stopRecording(false);
    await Store.clearDraft();
    ui.sealChoice = null;
    renderWrite();
    Orbs.setScene(sceneFor("write"));
  });

  // 사진 · 음성 · 영상 첨부
  const pickers = { photo: "#file-photo", audio: "#file-audio", video: "#file-video" };
  $$("[data-attach]").forEach((b) =>
    b.addEventListener("click", () => {
      const kind = b.dataset.attach;
      if (kind === "voice") {
        if (Recorder.active) stopRecording(true);
        else startRecording();
        return;
      }
      $(pickers[kind]).click();
    }),
  );

  [
    ["#file-photo", "photo"],
    ["#file-audio", "voice"],
    ["#file-video", "video"],
  ].forEach(([sel, kind]) =>
    $(sel).addEventListener("change", async (e) => {
      const files = e.target.files;
      if (files && files.length) await attachFiles(files, kind);
      e.target.value = "";
    }),
  );

  $("#rec-stop").addEventListener("click", () => stopRecording(true));
  $("#rec-cancel").addEventListener("click", () => stopRecording(false));

  // SEAL
  $("#cal-grid").addEventListener("click", (e) => {
    const b = e.target.closest(".cal-day");
    if (b && !b.disabled) chooseDate(+b.dataset.ts);
  });

  $$("[data-cal]").forEach((b) =>
    b.addEventListener("click", () => {
      const d = new Date(ui.calMonth);
      ui.calMonth = new Date(d.getFullYear(), d.getMonth() + +b.dataset.cal, 1).getTime();
      renderCalendar();
    }),
  );

  $$("[data-quick]").forEach((b) =>
    b.addEventListener("click", () => {
      const q = b.dataset.quick;
      if (q === "demo") {
        ui.sealChoice = { mode: "demo", quick: q };
        renderCalendar();
        renderChoice();
      } else {
        chooseDate(addMonths(Date.now(), +q), q);
      }
    }),
  );

  $("#seal-btn").addEventListener("click", sealCapsule);

  // MY CAPSULES
  $$("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      if (ui.filter === b.dataset.filter) return;
      ui.filter = b.dataset.filter;
      ui.page = 0;
      closeDrawer();
      refreshCapsules();
    }),
  );

  $$("[data-page]").forEach((b) =>
    b.addEventListener("click", () => {
      const { pages } = capsulePage();
      ui.page = (ui.page + +b.dataset.page + pages) % pages;
      closeDrawer();
      refreshCapsules();
    }),
  );

  // 저장 정보 · 초기화
  $("#settings-btn").addEventListener("click", () => {
    if ($("#settings").classList.contains("is-open")) closeSettings();
    else openSettings();
  });
  $("#settings-close").addEventListener("click", closeSettings);
  $("#reset-btn").addEventListener("click", openConfirm);
  $("#confirm-cancel").addEventListener("click", closeConfirm);
  $("#confirm-delete").addEventListener("click", resetAllData);
  $("#confirm").addEventListener("click", (e) => e.target.id === "confirm" && closeConfirm());

  $("#drawer-close").addEventListener("click", closeDrawer);
  $("#dr-open").addEventListener("click", () => {
    const id = ui.drawerId;
    if (id) openCapsule(id);
  });

  $("#rd-close").addEventListener("click", () => {
    closeReader();
    refreshCapsules();
    orbUI.classList.remove("is-hidden");
  });

  $("#rd-archive").addEventListener("click", () => {
    const id = ui.readerId;
    closeReader();
    location.hash = `#archive/${encodeURIComponent(id)}`;
  });

  // 빈 곳을 누르면 상세 패널 닫기
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#settings, #settings-btn, #confirm")) closeSettings();
    if (!ui.drawerId) return;
    if (e.target.closest("#drawer, .orb-hit")) return;
    closeDrawer();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#confirm").hidden) closeConfirm();
    else if (Lightbox.isOpen) Lightbox.close();
    else if ($("#settings").classList.contains("is-open")) closeSettings();
    else if (ui.drawerId) closeDrawer();
    else if (ui.readerId && !ui.busy) $("#rd-close").click();
  });

  // 화면 크기가 바뀌면 구체 배치를 다시 계산
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (ui.busy || ui.readerId) return;
      Orbs.setScene(sceneFor(ui.view));
      if (ui.view === "write") autoGrow();
      else renderView(ui.view);
    }, 180);
  });

  // 홈을 스크롤하면 구체 옆 정보 텍스트는 서서히 사라진다
  addEventListener(
    "scroll",
    () => orbUI.style.setProperty("--scroll-fade", Math.max(0, 1 - scrollY / 260).toFixed(3)),
    { passive: true },
  );

  addEventListener("pagehide", flushDraft);
  addEventListener("hashchange", route);

  route();
  tickLive();
  setInterval(tickLive, 1000);

  // p5가 시작되지 않았다면 라벨 위치만이라도 갱신
  setTimeout(() => {
    if (performance.now() / 1000 - Orbs.lastTick() > 1) Orbs.selfDrive();
  }, 2500);
}

// IndexedDB에서 기록을 불러온 뒤 시작
async function boot() {
  Store.onError = (msg) => toast(msg, true);
  await Store.init();
  init();
  if (!Store.ok) {
    toast("이 브라우저에서는 기록을 저장할 수 없어요. (IndexedDB 사용 불가 — 새로고침하면 사라집니다)", true);
  }
}

boot();
