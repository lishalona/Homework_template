// =========================================================
// TIME CAPSULE — 저장소 (IndexedDB)
//
// 모든 기록(글 · 사진 · 음성 · 영상)은 이 브라우저의 IndexedDB에만
// 저장된다. 서버로 보내지 않고, 다른 기기와 동기화하지 않는다.
//
// ※ 봉인은 화면에서만 잠그는 것이다. 개발자 도구로 IndexedDB를 열면
//   내용을 볼 수 있으므로 서버가 개봉일을 검증하는 보안 잠금과는 다르다.
// =========================================================

const DB_NAME = "timecapsule";
const DB_VERSION = 1;
const LEGACY_KEY = "timecapsule.v1"; // 이전 버전이 쓰던 localStorage 키
const DAY = 864e5;
const MB = 1024 * 1024;
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// 첨부 제한 (브라우저 저장 공간을 고려)
const LIMITS = {
  photo: { max: 12, bytes: 15 * MB },
  voice: { max: 6, bytes: 15 * MB, seconds: 300 },
  video: { max: 3, bytes: 30 * MB, seconds: 180 },
  capsuleBytes: 120 * MB,
};

const KIND_KO = { photo: "사진", voice: "음성", video: "영상" };

// 사용자에게 그대로 보여줄 수 있는 오류
class StorageError extends Error {}

// ---------------- DATE HELPERS ----------------

const pad = (n, len = 2) => String(n).padStart(len, "0");

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function fmtDay(ts) {
  return DOW[new Date(ts).getDay()];
}

function fmtTime(ts, seconds = false) {
  const d = new Date(ts);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return seconds ? `${hm}:${pad(d.getSeconds())}` : hm;
}

function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

function fmtBytes(n) {
  if (n >= 1024 * MB) return `${(n / 1024 / MB).toFixed(1)}GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

// 달력 기준 날짜 차이 (D-day 계산용)
function dayDiff(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

function addMonths(base, n) {
  const d = new Date(base);
  const day = d.getDate();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.getTime();
}

function remaining(openAt, now = Date.now()) {
  const ms = Math.max(0, openAt - now);
  const s = Math.floor(ms / 1000);
  return {
    ms,
    days: Math.floor(s / 86400),
    clock: `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`,
  };
}

function serial(no) {
  return `TC—${pad(no, 3)}`;
}

// 예시 기록은 번호 대신 SAMPLE 표시
function capSerial(c) {
  return c.sample ? `SAMPLE—${pad(c.no)}` : serial(c.no);
}

// ---------------- CAPSULE STATUS ----------------

function capStatus(c, now = Date.now()) {
  if (c.openedAt) return "opened";
  return now >= c.openAt ? "ready" : "sealed";
}

function dLabel(c, now = Date.now()) {
  if (now >= c.openAt) return "READY";
  const dd = dayDiff(now, c.openAt);
  return dd >= 1 ? `D-${dd}` : `D-DAY ${remaining(c.openAt, now).clock}`;
}

// "PHOTO 02 · VOICE 01" 처럼 담긴 기록의 종류만 요약
function mediaSummary(media = []) {
  return ["photo", "voice", "video"]
    .map((k) => [k, media.filter((m) => m.kind === k).length])
    .filter(([, n]) => n)
    .map(([k, n]) => `${k.toUpperCase()} ${pad(n)}`)
    .join(" · ");
}

// ---------------- INDEXEDDB HELPERS ----------------

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("capsules")) db.createObjectStore("capsules", { keyPath: "id" });
      if (!db.objectStoreNames.contains("media")) db.createObjectStore("media", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };

    req.onsuccess = () => {
      const db = req.result;
      // 다른 탭에서 초기화하면 연결을 닫아 삭제를 막지 않는다
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
  });
}

function isQuotaError(err) {
  return err && (err.name === "QuotaExceededError" || /quota/i.test(err.message || ""));
}

const QUOTA_MSG = "브라우저 저장 공간이 부족합니다. 다른 첨부를 지우거나 더 작은 파일을 선택해 주세요.";

// ---------------- 예시 기록 ----------------
// 사용자 기록과 따로 관리한다. 개수에 포함되지 않고, 초기화 후에도 다시 나타난다.
// 사진과 소리는 파일 대신 media.js에서 그때그때 만들어 쓴다.

const SAMPLE_DEFS = [
  {
    title: "첫 출근 전날 밤의 나에게",
    body:
      "내일이 첫 출근이다. 셔츠는 세 번이나 다려 놓았고, 알람은 다섯 개를 맞춰 두었다.\n\n" +
      "이 메모를 열 즈음의 너는 아마 지하철 몇 번 칸에 타야 환승이 빠른지 알고 있겠지. " +
      "그래도 오늘 밤의 이 떨림은 잊지 않았으면 좋겠다. 모르는 게 많아서 더 많이 볼 수 있었던 시간이니까.\n\n" +
      "힘든 날이 있었다면, 그날도 잘 버틴 거야.",
    created: -236,
    open: -12,
    palette: 4,
    seed: 1.3,
    media: [{ kind: "voice", gen: "voice:night", name: "출근 전날 밤, 방 안의 소리", duration: 7 }],
  },
  {
    title: "스물다섯의 여름",
    body:
      "창문을 열어 두면 매미 소리가 방 안까지 들어온다. 수박은 반 통을 혼자 다 먹었다.\n\n" +
      "요즘 가장 좋아하는 것: 저녁 일곱 시의 하늘, 새로 산 필름 카메라, 친구들과의 긴 통화.\n" +
      "요즘 가장 걱정하는 것: 내가 정말 잘하고 있는지.\n\n" +
      "일 년 뒤의 나는 이 질문에 뭐라고 답할까.",
    created: -410,
    open: -45,
    palette: 0,
    seed: 4.1,
    media: [
      { kind: "photo", gen: "photo:sky", name: "저녁 일곱 시의 하늘", width: 1200, height: 900 },
      { kind: "photo", gen: "photo:sea", name: "여름 바다", width: 1200, height: 900 },
      { kind: "voice", gen: "voice:summer", name: "여름밤 오르골", duration: 8 },
    ],
  },
  {
    title: "졸업 전시가 끝나면 열어 볼 것",
    body: "전시 준비로 밤을 새우는 중. 끝나고 나면 꼭 해 보고 싶은 일들을 적어 둔다.",
    created: -18,
    open: 54,
    palette: 2,
    seed: 2.6,
    media: [
      { kind: "photo", gen: "photo:bokeh", name: "작업실의 불빛", width: 1200, height: 900 },
      { kind: "photo", gen: "photo:sky", name: "새벽 하늘", width: 1200, height: 900 },
    ],
  },
  {
    title: "반년 뒤의 나에게 묻는 세 가지",
    body: "1. 아직 아침마다 달리고 있니?\n2. 그 사람과는 화해했니?\n3. 지금보다 조금 더 너그러워졌니?",
    created: -3,
    months: 6,
    palette: 3,
    seed: 5.4,
    media: [{ kind: "voice", gen: "voice:night", name: "질문을 읽는 목소리", duration: 7 }],
  },
  {
    title: "내년 이맘때",
    body: "올해의 마지막 계절을 지나며 남기는 짧은 편지.",
    created: -1,
    months: 12,
    palette: 7,
    seed: 0.6,
    media: [{ kind: "photo", gen: "photo:bokeh", name: "연말의 불빛", width: 1200, height: 900 }],
  },
];

function buildSamples(state) {
  const base = state.base;
  return SAMPLE_DEFS.map((s, i) => {
    const id = `sample-${i + 1}`;
    const createdAt = base + s.created * DAY;
    return {
      id,
      no: i + 1,
      sample: true,
      title: s.title,
      body: s.body,
      createdAt,
      sealedAt: createdAt,
      openAt: s.months ? addMonths(base, s.months) : startOfDay(base + s.open * DAY),
      openedAt: state.opened[id] || null,
      palette: s.palette,
      seed: s.seed,
      media: s.media.map((m, j) => ({ id: `${id}-m${j}`, size: 0, ...m })),
    };
  });
}

// ---------------- STORE ----------------

const Store = {
  db: null,
  ok: false, // IndexedDB에 저장할 수 있는지
  data: { seq: 0, capsules: [], draft: null },
  samples: [],
  sampleState: null, // { base, opened: { id: openedAt } }
  urls: new Map(), // media id → object URL
  onError: null,

  async init() {
    this.data = { seq: 0, capsules: [], draft: null };
    this.sampleState = null;

    try {
      this.db = await idbOpen();
      await this.migrateLegacy();
      await this.load();
      await this.cleanOrphans();
      this.ok = true;
    } catch (err) {
      console.error("IndexedDB를 사용할 수 없습니다.", err);
      this.ok = false;
    }

    if (!this.sampleState) {
      this.sampleState = { base: Date.now(), opened: {} };
      this.saveMeta();
    }
    this.samples = buildSamples(this.sampleState);
  },

  // 이전 버전(localStorage)의 기록을 IndexedDB로 한 번만 옮긴다.
  // 새 저장소에 쓰기가 끝난 것을 확인한 뒤에만 원래 데이터를 지운다.
  async migrateLegacy() {
    const tx0 = this.db.transaction("meta", "readonly");
    const version = await reqP(tx0.objectStore("meta").get("version"));
    if (version) return;

    let legacy = null;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
    } catch (err) {
      console.error(err);
    }

    const tx = this.db.transaction(["capsules", "meta"], "readwrite");
    const meta = tx.objectStore("meta");

    if (legacy && Array.isArray(legacy.capsules)) {
      // 예전에 불러온 예시 캡슐(sample)은 새 예시 기록으로 대체되므로 옮기지 않는다
      legacy.capsules
        .filter((c) => !c.sample)
        .forEach((c) => tx.objectStore("capsules").put({ ...c, media: c.media || [] }));
      meta.put({ key: "seq", value: legacy.seq || 0 });
      if (legacy.draft) meta.put({ key: "draft", value: { ...legacy.draft, media: [] } });
    }

    meta.put({ key: "version", value: DB_VERSION, migratedAt: legacy ? Date.now() : null });
    await txDone(tx);

    if (legacy) {
      try {
        localStorage.removeItem(LEGACY_KEY);
      } catch (err) {
        console.error(err);
      }
    }
  },

  async load() {
    const tx = this.db.transaction(["capsules", "meta"], "readonly");
    const [caps, metas] = await Promise.all([
      reqP(tx.objectStore("capsules").getAll()),
      reqP(tx.objectStore("meta").getAll()),
    ]);
    const m = Object.fromEntries(metas.map((x) => [x.key, x.value]));

    this.data = {
      seq: m.seq || 0,
      capsules: caps.map((c) => ({ ...c, media: c.media || [] })),
      draft: m.draft ? { ...m.draft, media: m.draft.media || [] } : null,
    };
    this.sampleState = m.samples || null;
  },

  // 어디에도 연결되지 않은 파일(작성 중 새로고침 등)을 정리
  async cleanOrphans() {
    const used = new Set();
    this.data.capsules.forEach((c) => c.media.forEach((m) => used.add(m.id)));
    if (this.data.draft) this.data.draft.media.forEach((m) => used.add(m.id));

    const tx = this.db.transaction("media", "readwrite");
    const keys = await reqP(tx.objectStore("media").getAllKeys());
    keys.filter((k) => !used.has(k)).forEach((k) => tx.objectStore("media").delete(k));
    await txDone(tx);
  },

  // 글 · 캡슐 목록 저장 (파일은 따로 저장됨)
  save() {
    if (!this.db) return Promise.resolve(false);

    const tx = this.db.transaction(["capsules", "meta"], "readwrite");
    const caps = tx.objectStore("capsules");
    caps.clear();
    this.data.capsules.forEach((c) => caps.put(c));
    this.putMeta(tx);

    return txDone(tx).then(
      () => true,
      (err) => this.fail(err),
    );
  },

  saveMeta() {
    if (!this.db) return Promise.resolve(false);
    const tx = this.db.transaction("meta", "readwrite");
    this.putMeta(tx);
    return txDone(tx).then(
      () => true,
      (err) => this.fail(err),
    );
  },

  putMeta(tx) {
    const meta = tx.objectStore("meta");
    meta.put({ key: "seq", value: this.data.seq });
    meta.put({ key: "draft", value: this.data.draft });
    meta.put({ key: "samples", value: this.sampleState });
  },

  fail(err) {
    console.error(err);
    if (this.onError) this.onError(isQuotaError(err) ? QUOTA_MSG : "기록을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
    return false;
  },

  // ---- 조회 ----

  all() {
    return [...this.data.capsules, ...this.samples];
  },

  byId(id) {
    return this.all().find((c) => c.id === id) || null;
  },

  // 아직 열지 않은 캡슐 (개봉일이 가까운 순, 예시 포함)
  unopened() {
    return this.all()
      .filter((c) => !c.openedAt)
      .sort((a, b) => a.openAt - b.openAt);
  },

  // 개봉한 캡슐 (최근에 연 순, 예시 포함)
  opened() {
    return this.all()
      .filter((c) => c.openedAt)
      .sort((a, b) => b.openedAt - a.openedAt);
  },

  // 사용자 기록 개수 (예시 제외)
  stats(now = Date.now()) {
    const s = { stored: 0, sealed: 0, ready: 0, archived: 0, media: 0 };
    this.data.capsules.forEach((c) => {
      const st = capStatus(c, now);
      if (st === "opened") s.archived++;
      else {
        s.stored++;
        s[st]++;
      }
      s.media += c.media.length;
    });
    return s;
  },

  nextNo() {
    return this.data.seq + 1;
  },

  pickPalette() {
    const last = this.data.capsules[this.data.capsules.length - 1];
    let p;
    do {
      p = Math.floor(Math.random() * PALETTES.length);
    } while (last && p === last.palette && PALETTES.length > 1);
    return p;
  },

  // ---- 초안 (봉인 전까지 수정 가능) ----

  draft() {
    if (!this.data.draft) {
      this.data.draft = {
        title: "",
        body: "",
        media: [],
        createdAt: Date.now(),
        updatedAt: null,
        palette: this.pickPalette(),
        seed: Math.random() * 6.28,
      };
    }
    return this.data.draft;
  },

  hasContent(d = this.draft()) {
    return d.body.trim().length > 0 || d.media.length > 0;
  },

  updateDraft(fields) {
    Object.assign(this.draft(), fields, { updatedAt: Date.now() });
    return this.saveMeta();
  },

  async clearDraft() {
    const d = this.data.draft;
    this.data.draft = null;
    if (d) await this.deleteBlobs(d.media);
    return this.saveMeta();
  },

  // ---- 첨부 파일 ----

  async addMedia(blob, kind, info = {}) {
    const d = this.draft();
    const lim = LIMITS[kind];

    if (d.media.filter((m) => m.kind === kind).length >= lim.max) {
      throw new StorageError(`${KIND_KO[kind]}은 캡슐 하나에 최대 ${lim.max}개까지 담을 수 있어요.`);
    }
    if (blob.size > lim.bytes) {
      throw new StorageError(`${KIND_KO[kind]} 파일은 ${fmtBytes(lim.bytes)} 이하만 담을 수 있어요. (선택한 파일 ${fmtBytes(blob.size)})`);
    }
    const total = d.media.reduce((sum, m) => sum + m.size, 0) + blob.size;
    if (total > LIMITS.capsuleBytes) {
      throw new StorageError(`캡슐 하나에 담을 수 있는 첨부는 모두 합쳐 ${fmtBytes(LIMITS.capsuleBytes)}까지예요.`);
    }
    if (!this.db) throw new StorageError("이 브라우저에서는 파일을 저장할 수 없습니다.");

    await this.checkQuota(blob.size);
    this.requestPersist();

    const item = {
      id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind,
      type: blob.type,
      size: blob.size,
      name: info.name || "",
      duration: info.duration || 0,
      width: info.width || 0,
      height: info.height || 0,
      createdAt: Date.now(),
    };

    d.media.push(item);
    d.updatedAt = Date.now();

    const tx = this.db.transaction(["media", "meta"], "readwrite");
    tx.objectStore("media").put({ id: item.id, blob });
    this.putMeta(tx);

    try {
      await txDone(tx);
    } catch (err) {
      d.media = d.media.filter((m) => m.id !== item.id);
      throw new StorageError(isQuotaError(err) ? QUOTA_MSG : "파일을 저장하지 못했습니다.");
    }

    return item;
  },

  async removeMedia(id) {
    const d = this.draft();
    const item = d.media.find((m) => m.id === id);
    if (!item) return;
    d.media = d.media.filter((m) => m.id !== id);
    await this.deleteBlobs([item]);
    return this.saveMeta();
  },

  async deleteBlobs(items) {
    items.forEach((m) => this.revoke(m.id));
    if (!this.db || !items.length) return;
    const tx = this.db.transaction("media", "readwrite");
    items.forEach((m) => tx.objectStore("media").delete(m.id));
    await txDone(tx).catch((err) => console.error(err));
  },

  async checkQuota(bytes) {
    if (!navigator.storage || !navigator.storage.estimate) return;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (quota && usage + bytes > quota * 0.9) {
      throw new StorageError(`${QUOTA_MSG} (사용 ${fmtBytes(usage)} / 가능 ${fmtBytes(quota)})`);
    }
  },

  // 브라우저가 공간이 부족할 때 임의로 지우지 않도록 요청
  requestPersist() {
    if (this.persistAsked || !navigator.storage || !navigator.storage.persist) return;
    this.persistAsked = true;
    navigator.storage.persist().catch(() => {});
  },

  async usage() {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    try {
      return await navigator.storage.estimate();
    } catch {
      return null;
    }
  },

  // 첨부 파일 주소. 봉인된 캡슐의 파일은 개봉 전에는 꺼내지 않는다
  async mediaURL(item, owner) {
    if (owner && owner !== this.data.draft && capStatus(owner) !== "opened") {
      throw new StorageError("봉인된 캡슐입니다.");
    }
    if (item.gen) return SampleMedia.url(item.gen);
    if (this.urls.has(item.id)) return this.urls.get(item.id);
    if (!this.db) throw new StorageError("파일을 불러올 수 없습니다.");

    const tx = this.db.transaction("media", "readonly");
    const rec = await reqP(tx.objectStore("media").get(item.id));
    if (!rec) throw new StorageError("파일을 찾을 수 없습니다.");

    const url = URL.createObjectURL(rec.blob);
    this.urls.set(item.id, url);
    return url;
  },

  revoke(id) {
    const url = this.urls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(id);
  },

  // ---- 봉인 ----

  seal(openAt) {
    const d = this.draft();
    const no = ++this.data.seq;
    const now = Date.now();

    const cap = {
      id: "tc" + now.toString(36) + Math.random().toString(36).slice(2, 6),
      no,
      title: d.title.trim() || "무제",
      body: d.body.replace(/\s+$/, ""),
      media: d.media,
      createdAt: d.createdAt,
      sealedAt: now,
      openAt,
      openedAt: null,
      palette: d.palette,
      seed: d.seed,
    };

    // 봉인 후에는 미리보기로 만든 주소를 닫아 둔다
    cap.media.forEach((m) => this.revoke(m.id));

    this.data.capsules.push(cap);
    this.data.draft = null;
    this.save();
    return cap;
  },

  // ---- 개봉: 개봉일이 지난 캡슐만 열 수 있다 ----

  open(id) {
    const c = this.byId(id);
    if (!c || c.openedAt || Date.now() < c.openAt) return null;
    c.openedAt = Date.now();

    if (c.sample) {
      this.sampleState.opened[c.id] = c.openedAt;
      this.saveMeta();
    } else {
      this.save();
    }
    return c;
  },

  async remove(id) {
    const c = this.data.capsules.find((x) => x.id === id);
    if (!c) return;
    this.data.capsules = this.data.capsules.filter((x) => x.id !== id);
    await this.deleteBlobs(c.media);
    return this.save();
  },

  // ---- 전체 초기화: 사용자 기록만 지우고 예시는 처음 상태로 ----

  async resetAll() {
    [...this.urls.keys()].forEach((id) => this.revoke(id));

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch (err) {
      console.error(err);
    }

    await this.init();
  },
};
