// =========================================================
// TIME CAPSULE — 사진 · 음성 · 영상
//
// 파일 확인/압축, 브라우저 녹음, 미리보기 플레이어,
// 그리고 예시 기록에 쓰는 사진과 소리(코드로 생성)를 담당한다.
// =========================================================

function mk(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ---------------- 파일 확인 · 준비 ----------------

const PHOTO_TYPES = /^image\/(jpeg|png|webp|gif)$/;
const PHOTO_MAX_SIDE = 2400;

// 오디오/영상의 길이와 재생 가능 여부 확인
function probeMedia(blob, tag) {
  return new Promise((resolve) => {
    const el = document.createElement(tag);
    const url = URL.createObjectURL(blob);
    let settled = false;

    const done = (v) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      el.removeAttribute("src");
      resolve(v);
    };

    el.preload = "metadata";
    el.muted = true;
    el.onloadedmetadata = () => {
      const info = () => ({ ok: true, duration: el.duration, width: el.videoWidth || 0, height: el.videoHeight || 0 });
      // 녹음 파일은 길이가 Infinity로 나오는 경우가 있어 끝으로 이동해 확인
      if (el.duration === Infinity) {
        el.ontimeupdate = () => {
          el.ontimeupdate = null;
          done(info());
        };
        el.currentTime = 1e9;
      } else {
        done(info());
      }
    };
    el.onerror = () => done({ ok: false });
    setTimeout(() => done({ ok: false }), 8000);
    el.src = url;
  });
}

const MediaPrep = {
  async photo(file) {
    if (!PHOTO_TYPES.test(file.type)) {
      throw new StorageError("JPG, PNG, WEBP, GIF 형식의 사진만 담을 수 있어요.");
    }
    if (file.size > LIMITS.photo.bytes) {
      throw new StorageError(`사진은 한 장에 ${fmtBytes(LIMITS.photo.bytes)} 이하만 담을 수 있어요. (선택한 파일 ${fmtBytes(file.size)})`);
    }

    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch {
      throw new StorageError("이 사진을 읽을 수 없어요. 다른 사진을 선택해 주세요.");
    }

    const { width, height } = bmp;
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(width, height));

    // 크지 않은 사진과 GIF(움직임 유지)는 그대로 저장
    if (file.type === "image/gif" || (scale === 1 && file.size <= 1.5 * MB)) {
      bmp.close && bmp.close();
      return { blob: file, width, height, name: file.name };
    }

    // 큰 사진은 저장 공간을 아끼기 위해 줄여서 저장
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close && bmp.close();

    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (!blob) throw new StorageError("사진을 처리하지 못했어요.");
    return { blob, width: canvas.width, height: canvas.height, name: file.name };
  },

  async audio(file) {
    if (!/^audio\//.test(file.type)) throw new StorageError("오디오 파일만 담을 수 있어요.");
    if (file.size > LIMITS.voice.bytes) {
      throw new StorageError(`오디오 파일은 ${fmtBytes(LIMITS.voice.bytes)} 이하만 담을 수 있어요. (선택한 파일 ${fmtBytes(file.size)})`);
    }
    const p = await probeMedia(file, "audio");
    if (!p.ok) throw new StorageError("이 브라우저에서 재생할 수 없는 오디오 형식이에요. (MP3, M4A, WAV 권장)");
    if (p.duration > LIMITS.voice.seconds + 1) {
      throw new StorageError(`음성은 ${LIMITS.voice.seconds / 60}분 이하만 담을 수 있어요.`);
    }
    return { blob: file, duration: p.duration, name: file.name };
  },

  async video(file) {
    if (!/^video\//.test(file.type)) throw new StorageError("영상 파일만 담을 수 있어요.");
    if (file.size > LIMITS.video.bytes) {
      throw new StorageError(`영상은 ${fmtBytes(LIMITS.video.bytes)} 이하의 짧은 영상만 담을 수 있어요. (선택한 파일 ${fmtBytes(file.size)})`);
    }
    const p = await probeMedia(file, "video");
    if (!p.ok) throw new StorageError("이 브라우저에서 재생할 수 없는 영상 형식이에요. (MP4 권장)");
    if (p.duration > LIMITS.video.seconds + 1) {
      throw new StorageError(`영상은 ${LIMITS.video.seconds / 60}분 이하의 짧은 영상만 담을 수 있어요.`);
    }
    return { blob: file, duration: p.duration, width: p.width, height: p.height, name: file.name };
  },
};

// ---------------- 브라우저 녹음 ----------------

const Recorder = {
  rec: null,
  stream: null,
  chunks: [],
  startedAt: 0,
  timer: null,

  supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  },

  get active() {
    return !!this.rec;
  },

  elapsed() {
    return (performance.now() - this.startedAt) / 1000;
  },

  async begin(onTick, onLimit) {
    if (this.rec || this.pending) return false;
    if (!window.isSecureContext) {
      throw new StorageError("녹음은 localhost 또는 https 주소에서만 할 수 있어요. Live Server로 열어 주세요.");
    }
    if (!this.supported()) {
      throw new StorageError("이 브라우저에서는 녹음을 지원하지 않아요. 오디오 파일을 첨부해 주세요.");
    }

    this.pending = true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new StorageError("마이크를 사용할 수 없어요. 브라우저의 마이크 권한을 확인해 주세요.");
    } finally {
      this.pending = false;
    }

    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find(
      (t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t),
    );

    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.startedAt = performance.now();

    this.timer = setInterval(() => {
      const s = this.elapsed();
      onTick(s);
      if (s >= LIMITS.voice.seconds) onLimit();
    }, 200);
    return true;
  },

  // keep = false 이면 녹음을 버린다
  finish(keep = true) {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(null);

      const rec = this.rec;
      const duration = this.elapsed();
      clearInterval(this.timer);

      rec.onstop = () => {
        this.stream.getTracks().forEach((t) => t.stop());
        const blob = keep && this.chunks.length ? new Blob(this.chunks, { type: rec.mimeType || "audio/webm" }) : null;
        this.rec = null;
        this.stream = null;
        this.chunks = [];
        resolve(blob ? { blob, duration } : null);
      };

      rec.stop();
    });
  },
};

// ---------------- 미리보기 · 재생 ----------------

const MediaView = {
  audios: new Set(),

  // owner: 캡슐 또는 초안. 봉인된 캡슐의 파일은 Store가 꺼내 주지 않는다
  render(box, items, opts = {}) {
    this.stopAll();
    // 이 영역에서 쓰던 오디오는 정리
    this.audios.forEach((a) => {
      if (a._box !== box) return;
      a.removeAttribute("src");
      this.audios.delete(a);
    });
    box.replaceChildren();
    box.hidden = !items.length;
    if (!items.length) return;

    const photos = items.filter((m) => m.kind === "photo");
    const voices = items.filter((m) => m.kind === "voice");
    const videos = items.filter((m) => m.kind === "video");

    if (photos.length) {
      const grid = mk("div", "media-photos");
      photos.forEach((m, i) => grid.append(this.photo(m, i, photos, opts)));
      box.append(grid);
    }
    voices.forEach((m, i) => box.append(this.voice(m, i, { ...opts, box })));
    videos.forEach((m, i) => box.append(this.video(m, i, opts)));
  },

  removeButton(m, opts) {
    const b = mk("button", "media-remove", "×");
    b.type = "button";
    b.setAttribute("aria-label", `${KIND_KO[m.kind]} 첨부 삭제`);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      opts.onRemove(m);
    });
    return b;
  },

  photo(m, i, all, opts) {
    const fig = mk("figure", "media-photo");
    const open = mk("button", "media-photo-open");
    open.type = "button";
    open.setAttribute("aria-label", `사진 ${i + 1} 크게 보기`);

    const img = mk("img");
    img.alt = m.name || `사진 ${i + 1}`;
    img.decoding = "async";
    Store.mediaURL(m, opts.owner)
      .then((u) => (img.src = u))
      .catch(() => fig.classList.add("is-missing"));

    open.append(img);
    open.addEventListener("click", () => Lightbox.open(all, i, opts.owner));
    fig.append(open);
    if (opts.editable) fig.append(this.removeButton(m, opts));
    return fig;
  },

  voice(m, i, opts) {
    const row = mk("div", "media-voice");
    const play = mk("button", "mv-play");
    play.type = "button";
    play.setAttribute("aria-label", "음성 재생");
    play.append(mk("i"));

    const body = mk("div", "mv-body");
    const top = mk("div", "mv-top");
    top.append(mk("span", "micro", `VOICE ${pad(i + 1)}`), mk("span", "mv-name", m.name || ""));
    const track = mk("div", "mv-track");
    const fill = mk("i", "mv-fill");
    track.append(fill);
    body.append(top, track);

    const time = mk("span", "micro mv-time", fmtDuration(m.duration));
    row.append(play, body, time);
    if (opts.editable) row.append(this.removeButton(m, opts));

    let audio = null;
    const dur = () => (audio && isFinite(audio.duration) && audio.duration) || m.duration || 0;

    const ensure = async () => {
      if (audio) return audio;
      audio = new Audio();
      audio._box = box;
      audio.preload = "auto";
      audio.src = await Store.mediaURL(m, opts.owner);
      this.audios.add(audio);
      audio.addEventListener("timeupdate", () => {
        const d = dur();
        fill.style.transform = `scaleX(${d ? Math.min(1, audio.currentTime / d) : 0})`;
        time.textContent = `${fmtDuration(audio.currentTime)} / ${fmtDuration(d)}`;
      });
      audio.addEventListener("play", () => row.classList.add("is-playing"));
      audio.addEventListener("pause", () => row.classList.remove("is-playing"));
      audio.addEventListener("ended", () => {
        fill.style.transform = "scaleX(0)";
        time.textContent = fmtDuration(dur());
      });
      return audio;
    };

    const box = opts.box;
    play.addEventListener("click", async () => {
      try {
        const a = await ensure();
        if (a.paused) {
          this.stopAll(a);
          await a.play();
        } else {
          a.pause();
        }
      } catch (err) {
        console.error(err);
        row.classList.add("is-missing");
      }
    });

    track.addEventListener("click", async (e) => {
      const a = await ensure().catch(() => null);
      const d = dur();
      if (!a || !d) return;
      const rect = track.getBoundingClientRect();
      a.currentTime = ((e.clientX - rect.left) / rect.width) * d;
    });

    return row;
  },

  video(m, i, opts) {
    const fig = mk("figure", "media-video");
    const v = mk("video");
    v.controls = true;
    v.playsInline = true;
    v.preload = "metadata";
    Store.mediaURL(m, opts.owner)
      .then((u) => (v.src = u))
      .catch(() => fig.classList.add("is-missing"));
    v.addEventListener("play", () => this.stopAll(v));

    const cap = mk(
      "figcaption",
      "micro",
      [`VIDEO ${pad(i + 1)}`, fmtDuration(m.duration), m.size ? fmtBytes(m.size) : ""].filter(Boolean).join(" · "),
    );
    fig.append(v, cap);
    if (opts.editable) fig.append(this.removeButton(m, opts));
    return fig;
  },

  // 다른 소리는 멈춘다 (except: 지금 재생할 요소)
  stopAll(except) {
    this.audios.forEach((a) => a !== except && a.pause());
    document.querySelectorAll("video").forEach((v) => v !== except && v.pause());
  },
};

// ---------------- 사진 크게 보기 ----------------

const Lightbox = {
  el: null,
  items: [],
  index: 0,
  owner: null,

  build() {
    const el = mk("div", "lightbox");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "사진 보기");
    el.hidden = true;

    const close = mk("button", "text-btn lb-close", "CLOSE ×");
    close.type = "button";
    const img = mk("img", "lb-img");
    const bar = mk("div", "lb-bar");
    const prev = mk("button", "cal-nav", "←");
    const next = mk("button", "cal-nav", "→");
    prev.type = next.type = "button";
    prev.setAttribute("aria-label", "이전 사진");
    next.setAttribute("aria-label", "다음 사진");
    const label = mk("span", "micro lb-label");
    bar.append(prev, label, next);
    el.append(close, img, bar);
    document.body.append(el);

    close.addEventListener("click", () => this.close());
    el.addEventListener("click", (e) => e.target === el && this.close());
    prev.addEventListener("click", () => this.show(this.index - 1));
    next.addEventListener("click", () => this.show(this.index + 1));

    this.el = el;
    this.img = img;
    this.label = label;
    this.prev = prev;
    this.next = next;
  },

  open(items, index, owner) {
    if (!this.el) this.build();
    this.items = items;
    this.owner = owner;
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add("is-open"));
    this.show(index);
  },

  async show(i) {
    const n = this.items.length;
    this.index = (i + n) % n;
    const m = this.items[this.index];
    this.label.textContent = `PHOTO ${pad(this.index + 1)} / ${pad(n)}${m.name ? " · " + m.name : ""}`;
    this.prev.hidden = this.next.hidden = n < 2;
    this.img.alt = m.name || `사진 ${this.index + 1}`;
    this.img.src = await Store.mediaURL(m, this.owner).catch(() => "");
  },

  get isOpen() {
    return !!this.el && !this.el.hidden;
  },

  close() {
    if (!this.isOpen) return;
    this.el.classList.remove("is-open");
    this.el.hidden = true;
  },
};

// ---------------- 예시 기록용 사진 · 소리 (코드로 생성) ----------------

const SampleMedia = {
  cache: new Map(),

  url(gen) {
    if (!this.cache.has(gen)) {
      this.cache.set(
        gen,
        this.make(gen).then((blob) => URL.createObjectURL(blob)),
      );
    }
    return this.cache.get(gen);
  },

  make(gen) {
    const [kind, name] = gen.split(":");
    return kind === "photo" ? this.photo(name) : Promise.resolve(this.sound(name));
  },

  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  photo(name) {
    const w = 1200;
    const h = 900;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const rnd = this.rng(name.length * 97 + 13);

    const grad = (stops, x0 = 0, y0 = 0, x1 = 0, y1 = h) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      return g;
    };
    const glow = (x, y, r, col) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    if (name === "sky") {
      // 저녁 하늘 + 지붕과 전깃줄 실루엣
      ctx.fillStyle = grad([
        [0, "#2c2f6e"],
        [0.42, "#7b5aa6"],
        [0.66, "#ee9a8f"],
        [0.82, "#ffcf8d"],
        [1, "#ffe6b8"],
      ]);
      ctx.fillRect(0, 0, w, h);
      glow(w * 0.64, h * 0.8, h * 0.45, "rgba(255,236,196,0.85)");
      ctx.fillStyle = "rgba(255,246,226,0.95)";
      ctx.beginPath();
      ctx.arc(w * 0.64, h * 0.8, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#231d38";
      ctx.beginPath();
      ctx.moveTo(0, h);
      let x = 0;
      while (x < w) {
        const bw = 60 + rnd() * 120;
        const bh = h * (0.08 + rnd() * 0.16);
        ctx.lineTo(x, h - bh);
        ctx.lineTo(x + bw, h - bh);
        x += bw;
      }
      ctx.lineTo(w, h);
      ctx.fill();

      ctx.strokeStyle = "rgba(35,29,56,0.8)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-20, h * (0.28 + i * 0.06));
        ctx.quadraticCurveTo(w * 0.5, h * (0.4 + i * 0.06), w + 20, h * (0.26 + i * 0.07));
        ctx.stroke();
      }
    } else if (name === "sea") {
      // 여름 바다: 하늘 · 수평선 · 반짝이는 물결 · 모래
      ctx.fillStyle = grad([
        [0, "#8fc4f2"],
        [0.5, "#d9ecff"],
        [0.52, "#2f6fb8"],
        [0.8, "#4fa9d8"],
        [0.82, "#f1dcb8"],
        [1, "#e8cfa6"],
      ]);
      ctx.fillRect(0, 0, w, h);
      glow(w * 0.3, h * 0.2, h * 0.5, "rgba(255,255,255,0.55)");
      for (let i = 0; i < 260; i++) {
        const y = h * (0.53 + rnd() * 0.27);
        const len = 10 + rnd() * 50;
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
        ctx.lineWidth = 1 + rnd() * 2;
        const x0 = w * 0.3 + (rnd() - 0.5) * w * (0.2 + (y / h - 0.5) * 1.6);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + len, y);
        ctx.stroke();
      }
    } else {
      // 밤의 불빛 (보케)
      ctx.fillStyle = grad([
        [0, "#1b1424"],
        [1, "#3a2433"],
      ]);
      ctx.fillRect(0, 0, w, h);
      ctx.filter = "blur(14px)";
      const cols = ["255,190,120", "255,140,170", "170,150,255", "255,225,170"];
      for (let i = 0; i < 46; i++) {
        const r = 18 + rnd() * 70;
        ctx.fillStyle = `rgba(${cols[i % cols.length]},${0.25 + rnd() * 0.5})`;
        ctx.beginPath();
        ctx.arc(rnd() * w, h * 0.15 + rnd() * h * 0.7, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.filter = "none";
      glow(w * 0.75, h * 0.3, h * 0.5, "rgba(255,200,140,0.35)");
    }

    // 필름 그레인
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 22;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);

    return new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));
  },

  // 짧은 소리를 WAV로 만든다 (오르골 멜로디 / 밤의 방 소리)
  sound(name) {
    const rate = 22050;
    const secs = name === "summer" ? 8 : 7;
    const n = rate * secs;
    const out = new Float32Array(n);
    const rnd = this.rng(name.length * 31 + 7);
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

    const note = (start, midi, len, amp) => {
      const f = hz(midi);
      const s0 = Math.floor(start * rate);
      const s1 = Math.min(n, s0 + Math.floor(len * rate));
      for (let i = s0; i < s1; i++) {
        const t = (i - s0) / rate;
        const env = Math.exp(-t * 3.2) * Math.min(1, t * 200);
        out[i] +=
          amp * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) + 0.1 * Math.sin(6 * Math.PI * f * t));
      }
    };

    if (name === "summer") {
      const melody = [72, 76, 79, 83, 81, 79, 76, 74, 72, 76, 79, 84, 83, 79, 76, 72];
      melody.forEach((m, i) => note(i * 0.45, m, 1.6, 0.22));
      // 멀리서 들리는 풀벌레
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        out[i] += 0.012 * Math.sin(2 * Math.PI * 4200 * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 9 * t)) * (0.5 + 0.5 * Math.sin(t * 1.3));
      }
    } else {
      // 낮은 화음 + 시계 소리 + 방의 공기
      [48, 55, 60, 64].forEach((m, k) => {
        const f = hz(m);
        for (let i = 0; i < n; i++) {
          const t = i / rate;
          const env = Math.min(1, t / 1.5) * Math.min(1, (secs - t) / 1.5);
          out[i] += 0.05 * env * Math.sin(2 * Math.PI * f * t + k) * (0.7 + 0.3 * Math.sin(t * 0.8 + k));
        }
      });
      for (let s = 0.5; s < secs; s += 1) note(s, 96, 0.05, 0.12);
    }

    let prev = 0;
    for (let i = 0; i < n; i++) {
      prev = prev * 0.97 + (rnd() - 0.5) * 0.02;
      out[i] += prev;
    }

    // 16bit PCM WAV
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 36 + n * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i])) * 0x7fff, true);
    }
    return new Blob([buf], { type: "audio/wav" });
  },
};
