"use strict";

/* ---------- хранилище и ученик ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem("ar:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("ar:" + k, JSON.stringify(v)); } catch (e) {} },
};

const urlKid = new URLSearchParams(location.search).get("kid");
if (urlKid) LS.set("kid", urlKid);
const KID = (window.KIDS || []).find(k => k.code === LS.get("kid", null)) || null;
const LEVEL = KID ? KID.level : 3;
const VIDEOS = window.VIDEOS || [];

/* ---------- мелочи ---------- */
const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
const fmt = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };

// Ключ для поиска слова в словарике: без огласовок, знаков препинания, с единой формой алифа.
const norm = s => String(s || "")
  .replace(/[ً-ٰٟـ]/g, "")
  .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[^ء-ي]/g, "");

function toast(msg, ms = 2600) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}

function confetti() {
  const set = ["⭐", "🎉", "🌟", "✨", "🎈"];
  for (let i = 0; i < 18; i++) {
    const s = document.createElement("div");
    s.className = "confetti"; s.textContent = set[i % set.length];
    s.style.left = Math.random() * 100 + "vw"; s.style.animationDelay = Math.random() * .6 + "s";
    document.body.appendChild(s); setTimeout(() => s.remove(), 2600);
  }
}

/* ---------- озвучка ---------- */
let warnedVoice = false;
function arVoice() { return (speechSynthesis.getVoices() || []).find(v => (v.lang || "").toLowerCase().startsWith("ar")); }
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => {};
function speak(text, rate = .8) {
  if (!("speechSynthesis" in window)) return toast("Это устройство не умеет озвучивать текст");
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ar-SA"; u.rate = rate;
  const v = arVoice(); if (v) u.voice = v;
  else if (!warnedVoice) { warnedVoice = true; toast("Нет арабского голоса. Android: Настройки → Синтез речи → Google → установить «Арабский»", 6000); }
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

/* ---------- прогресс и Google-таблица ---------- */
const progress = () => LS.get("progress", {});
function report(taskId, title, result) {
  if (!taskId) return;
  const p = progress(); p[taskId] = { result, at: Date.now() }; LS.set("progress", p);
  if (window.SHEET_URL) {
    fetch(window.SHEET_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ kid: KID ? KID.code : "гость", name: KID ? KID.name : "Гость", level: LEVEL, task: taskId, title, result, at: new Date().toISOString() }),
    }).catch(() => {});
  }
}
const myTasks = () => (window.HOMEWORK || []).filter(h => !KID || (h.levels || [1, 2, 3]).includes(KID.level));
const undoneCount = () => myTasks().filter(h => !progress()[h.id]).length;
const taskById = id => (window.HOMEWORK || []).find(h => h.id === id);

/* ---------- источники слов для игр ---------- */
function source(src) {
  src = src || "all";
  if (src.startsWith("set:")) {
    const s = (window.WORD_SETS || []).find(x => x.id === src.slice(4));
    return s ? { title: s.title, items: s.words } : null;
  }
  if (src.startsWith("video:")) {
    const v = VIDEOS.find(x => x.id === src.slice(6));
    return v ? { title: "Слова из мультика «" + v.title + "»", items: v.vocab || [] } : null;
  }
  if (src === "mine") return { title: "Мои слова", items: LS.get("mywords", []) };
  return { title: "Все слова", items: (window.WORD_SETS || []).filter(s => s.level <= LEVEL).flatMap(s => s.words) };
}
const sources = () => [
  ...(window.WORD_SETS || []).filter(s => s.level <= LEVEL).map(s => ({ id: "set:" + s.id, title: s.icon + " " + s.title })),
  ...VIDEOS.filter(v => v.level <= LEVEL && (v.vocab || []).length).map(v => ({ id: "video:" + v.id, title: "🎬 " + v.title })),
  { id: "mine", title: "⭐ Мои слова" },
];

/* ---------- роутер ---------- */
let cleanup = null;
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || "") };
}
function render() {
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  closeSheet();
  const { parts, q } = parseHash();
  const [view, a, b] = parts;
  const tab = { videos: "videos", video: "videos", alphabet: "alphabet", letter: "alphabet", letters: "homework", words: "words", set: "words", games: "games", game: "games", homework: "homework", teacher: "homework" }[view] || "home";
  document.querySelectorAll(".tabs a").forEach(x => x.classList.toggle("active", x.dataset.tab === tab));
  window.scrollTo(0, 0);
  const views = { videos: viewVideos, video: () => viewVideo(a, q), alphabet: viewAlphabet, letter: () => viewLetter(+a), letters: () => viewLetters(q), words: viewWords, set: () => viewSet(a), games: viewGames, game: () => viewGame(a, b, q), homework: viewHomework, teacher: viewTeacher };
  (views[view] || viewHome)();
}
window.addEventListener("hashchange", render);
document.getElementById("kid-badge").textContent = KID ? "👤 " + KID.name : "";

/* ---------- главная ---------- */
function viewHome() {
  const n = undoneCount();
  $app.innerHTML = `
    <div class="hello"><div class="ico">👋</div><div>
      <b>${KID ? "Привет, " + esc(KID.name) + "!" : "Привет!"}</b>
      <div class="muted">${KID ? (n ? "У тебя " + n + " " + plural(n, "задание", "задания", "заданий") + " в домашке" : "Все задания сделаны — молодец! 🌟") : "Выбирай, чем заняться сегодня"}</div>
    </div></div>
    <div class="tiles">
      <a class="tile c3" href="#/homework"><span class="ico">📋</span>Домашка${n ? `<span class="badge">${n}</span>` : ""}<small>задания от учителя</small></a>
      <a class="tile c2" href="#/videos"><span class="ico">🎬</span>Мультики<small>с субтитрами и переводом</small></a>
      <a class="tile c1" href="#/alphabet"><span class="ico">🔤</span>Алфавит<small>28 букв со звуком</small></a>
      <a class="tile c4" href="#/words"><span class="ico">📚</span>Слова<small>по темам с картинками</small></a>
      <a class="tile c2" href="#/games"><span class="ico">🎮</span>Игры<small>найди пару, выбери перевод</small></a>
    </div>`;
}
const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many; };

/* ---------- мультики ---------- */
function viewVideos() {
  const list = VIDEOS.filter(v => v.level <= LEVEL);
  $app.innerHTML = `<h1>🎬 Мультики</h1>
    <p class="muted">Смотри с арабскими субтитрами и переводом. Нажми на любое слово — увидишь, что оно значит.</p>
    ${list.length ? `<div class="vcards">${list.map(v => `
      <a class="vcard" href="#/video/${esc(v.id)}">
        <img src="https://i.ytimg.com/vi/${esc(v.yt)}/hqdefault.jpg" alt="" loading="lazy">
        <div class="t"><b>${esc(v.title)}</b><span class="ar muted">${esc(v.titleAr || "")}</span><div class="muted">${fmt(v.duration || 0)} · ${(v.lines || []).length} фраз</div></div>
      </a>`).join("")}</div>` : `<p class="note">Мультиков пока нет.</p>`}`;
}

let ytReady = null;
function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise(res => {
    if (window.YT && window.YT.Player) return res();
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  });
  return ytReady;
}

function viewVideo(id, q) {
  const v = VIDEOS.find(x => x.id === id);
  if (!v) { $app.innerHTML = `<a class="back" href="#/videos">← Мультики</a><p class="note">Мультик не найден.</p>`; return; }
  const taskId = q.get("task");
  const lines = v.lines || [];
  const gloss = {};
  Object.entries(v.glossary || {}).forEach(([k, val]) => (gloss[norm(k)] = val));
  let mode = LS.get("submode", "both"), speed = 1, pauseEach = false;
  let player = null, cur = -1, last = -1, pausedFor = -1, maxT = 0, reported = !!progress()[taskId];

  $app.innerHTML = `
    <a class="back" href="#/videos">← Мультики</a>
    <h1>${esc(v.title)}</h1>
    <div class="player-wrap"><div id="yt"></div></div>
    <div class="subs" id="subs"><div class="sub-ar" id="sub-ar"></div><div class="sub-ru" id="sub-ru"></div></div>
    <div class="controls">
      <div class="seg" id="mode">
        <button data-m="both">Арабский + русский</button><button data-m="ar">Только арабский</button><button data-m="none">Без субтитров</button>
      </div>
    </div>
    <div class="controls">
      <div class="seg" id="speed"><button data-s="1">1×</button><button data-s="0.75">0.75×</button><button data-s="0.5">0.5×</button></div>
      <button class="btn small light" id="repeat">↺ Повторить фразу</button>
      <label class="toggle"><input type="checkbox" id="pause-each"> Пауза после фразы</label>
    </div>
    <details class="box"><summary>📝 Весь текст (${lines.length} фраз)</summary>
      <ol class="transcript" id="tr">${lines.map((l, i) => `<li data-i="${i}"><span class="tc">${fmt(l.s)}</span><span class="l-ar">${esc(l.ar)}</span><span class="l-ru">${esc(l.ru || "")}</span></li>`).join("")}</ol>
    </details>
    ${(v.vocab || []).length ? `<div class="row" style="margin-top:14px"><a class="btn coral" href="#/game/quiz/video:${esc(v.id)}">🎮 Игра по словам из мультика</a></div>` : ""}`;

  const subs = document.getElementById("subs"), subAr = document.getElementById("sub-ar"), subRu = document.getElementById("sub-ru");
  const setMode = m => { mode = m; LS.set("submode", m); subs.classList.toggle("no-ru", m === "ar"); subs.classList.toggle("hidden-subs", m === "none"); document.querySelectorAll("#mode button").forEach(b => b.classList.toggle("on", b.dataset.m === m)); };
  const setSpeed = s => { speed = s; if (player && player.setPlaybackRate) player.setPlaybackRate(s); document.querySelectorAll("#speed button").forEach(b => b.classList.toggle("on", +b.dataset.s === s)); };
  setMode(mode); setSpeed(1);
  document.getElementById("mode").onclick = e => e.target.dataset.m && setMode(e.target.dataset.m);
  document.getElementById("speed").onclick = e => e.target.dataset.s && setSpeed(+e.target.dataset.s);
  document.getElementById("pause-each").onchange = e => { pauseEach = e.target.checked; pausedFor = -1; };

  // Ищем слово целиком, а если нет — без приставок و ف ب ل ال («и», «в», «для», артикль).
  const PREFIXES = ["وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ل"];
  const lookup = w => {
    const n = norm(w);
    if (gloss[n]) return gloss[n];
    for (const p of PREFIXES) if (n.startsWith(p) && gloss[n.slice(p.length)]) {
      const base = gloss[n.slice(p.length)];
      const pre = { "و": "и ", "ف": "и/так ", "ب": "с/в ", "ل": "для/к ", "ال": "", "لل": "для ", "وال": "и ", "فال": "и ", "بال": "с/в ", "كال": "как " }[p];
      return (pre || "") + (typeof base === "string" ? base : base.ru);
    }
    return null;
  };
  const findLine = t => { for (let i = 0; i < lines.length; i++) if (t >= lines[i].s && t < lines[i].e + .25) return i; return -1; };
  const showLine = i => {
    cur = i;
    if (i < 0) { subAr.innerHTML = ""; subRu.textContent = ""; }
    else {
      const l = lines[i];
      subAr.innerHTML = l.ar.split(/\s+/).map(w => `<span class="w" data-w="${esc(w)}">${esc(w)}</span>`).join(" ");
      subRu.textContent = l.ru || "";
    }
    document.querySelectorAll("#tr li").forEach(li => li.classList.toggle("cur", +li.dataset.i === i));
  };
  const seekLine = i => { if (!player || i < 0) return; pausedFor = -1; player.seekTo(Math.max(0, lines[i].s - .05), true); player.playVideo(); };

  subAr.onclick = e => {
    const w = e.target.dataset && e.target.dataset.w; if (!w) return;
    if (player && player.pauseVideo) player.pauseVideo();
    openWord(w.replace(/[.,!?؟،:«»"…]/g, ""), lookup(w));
  };
  document.getElementById("tr").onclick = e => { const li = e.target.closest("li"); if (li) { seekLine(+li.dataset.i); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  document.getElementById("repeat").onclick = () => seekLine(cur >= 0 ? cur : last);

  loadYT().then(() => {
    if (!document.getElementById("yt")) return;
    player = new YT.Player("yt", {
      videoId: v.yt,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, cc_load_policy: 0, iv_load_policy: 3 },
      events: { onReady: () => setSpeed(speed) },
    });
    window._yt = player; // для отладки из консоли
  });

  const timer = setInterval(() => {
    if (!player || !player.getCurrentTime) return;
    const t = player.getCurrentTime() || 0;
    maxT = Math.max(maxT, t);
    const i = findLine(t);
    if (i !== cur) { if (cur >= 0) last = cur; showLine(i); }
    if (pauseEach && player.getPlayerState && player.getPlayerState() === 1) {
      const li = i >= 0 ? i : last;
      if (li >= 0 && li !== pausedFor && t >= lines[li].e - .05 && t < lines[li].e + 1) { pausedFor = li; player.pauseVideo(); }
    }
    const dur = (player.getDuration && player.getDuration()) || v.duration || 0;
    if (taskId && !reported && dur && maxT / dur >= .8) { reported = true; report(taskId, v.title, "досмотрел(а)"); confetti(); toast("Задание выполнено! 🌟"); }
  }, 100);
  cleanup = () => { clearInterval(timer); if (player && player.destroy) player.destroy(); };
}

/* ---------- окно со словом ---------- */
function openWord(ar, g) {
  const sh = document.getElementById("sheet");
  const tr = g ? (typeof g === "string" ? g : g.ru) : null;
  sh.innerHTML = `
    <div class="ar">${esc(g && g.ar ? g.ar : ar)}</div>
    <div class="tr">${tr ? esc(tr) : '<span class="muted">Этого слова нет в словарике — спроси учителя</span>'}</div>
    <div class="row">
      <button class="btn light" id="sh-say">🔊 Послушать</button>
      ${tr ? `<button class="btn" id="sh-add">⭐ В мои слова</button>` : ""}
      <button class="btn light" id="sh-close">Закрыть</button>
    </div>`;
  sh.hidden = false;
  document.getElementById("sh-say").onclick = () => speak(g && g.ar ? g.ar : ar);
  document.getElementById("sh-close").onclick = closeSheet;
  const add = document.getElementById("sh-add");
  if (add) add.onclick = () => {
    const list = LS.get("mywords", []);
    const word = { ar: g && g.ar ? g.ar : ar, ru: tr };
    if (!list.some(x => norm(x.ar) === norm(word.ar))) { list.push(word); LS.set("mywords", list); toast("Добавлено в «Мои слова» ⭐"); } else toast("Это слово уже есть в «Моих словах»");
    closeSheet();
  };
}
function closeSheet() { const sh = document.getElementById("sheet"); if (sh) sh.hidden = true; }

/* ---------- алфавит ---------- */
const A = () => window.ALPHABET || [];
function viewAlphabet() {
  $app.innerHTML = `<h1>🔤 Алфавит</h1>
    <p class="muted">Нажми на букву, чтобы узнать, как она звучит и как пишется в слове. Арабский читают справа налево.</p>
    <div class="letters">${A().map((x, i) => `<a class="letter" href="#/letter/${i}"><span class="big">${x.l}</span><small>${esc(x.ru)}</small></a>`).join("")}</div>
    <div class="row" style="margin-top:18px"><a class="btn coral" href="#/game/letters/all">🎮 Игра «Узнай букву»</a></div>`;
}
function forms(x) {
  const T = "ـ";
  return x.joins === false
    ? [[x.l, "отдельно"], [T + x.l, "в конце"]]
    : [[x.l, "отдельно"], [x.l + T, "в начале"], [T + x.l + T, "в середине"], [T + x.l, "в конце"]];
}
function letterCard(x) {
  const f = forms(x);
  return `<div class="lcard">
    <div class="huge">${x.l}</div>
    <div class="row" style="justify-content:center"><span class="ar" style="font-size:30px">${x.name}</span><b style="font-size:22px">— ${esc(x.ru)}</b>
      <button class="btn small light" data-say="${esc(x.name)}">🔊</button></div>
    <p class="muted">Звук: ${esc(x.sound)}</p>
    <div class="forms ${f.length === 2 ? "two" : ""}">${f.map(([s, t]) => `<div><div class="f">${s}</div><small>${t}</small></div>`).join("")}</div>
    ${x.joins === false ? `<p class="muted" style="font-size:14px">Эта буква не соединяется со следующей буквой.</p>` : ""}
    <div class="example"><span class="e">${x.emoji}</span><span class="ar">${x.word}</span><b>${esc(x.wordRu)}</b><button class="btn small light" data-say="${esc(x.word)}">🔊</button></div>
  </div>`;
}
function bindSay(root = $app) { root.querySelectorAll("[data-say]").forEach(b => (b.onclick = () => speak(b.dataset.say))); }
function viewLetter(i) {
  const L = A(); i = Math.max(0, Math.min(L.length - 1, i | 0));
  $app.innerHTML = `<a class="back" href="#/alphabet">← Алфавит</a>
    ${letterCard(L[i])}
    <div class="row" style="justify-content:space-between;margin-top:14px">
      ${i > 0 ? `<a class="btn light" href="#/letter/${i - 1}">← ${L[i - 1].l}</a>` : "<span></span>"}
      ${i < L.length - 1 ? `<a class="btn" href="#/letter/${i + 1}">${L[i + 1].l} →</a>` : ""}
    </div>`;
  bindSay(); speak(L[i].name);
}
function viewLetters(q) {
  const set = (q.get("set") || "").split(",").filter(Boolean);
  const L = A().filter(x => set.includes(x.l));
  const task = q.get("task");
  $app.innerHTML = `<a class="back" href="#/homework">← Домашка</a><h1>Учим буквы</h1>
    <p class="muted">Рассмотри каждую букву и послушай, как она звучит. Потом проверь себя в игре.</p>
    <div class="tasks">${L.map(letterCard).join("")}</div>
    <div class="row" style="margin-top:16px"><a class="btn coral" href="#/game/letters/${encodeURIComponent(set.join(","))}${task ? "?task=" + encodeURIComponent(task) : ""}">🎮 Проверь себя</a></div>`;
  bindSay();
}

/* ---------- слова ---------- */
function viewWords() {
  const sets = (window.WORD_SETS || []).filter(s => s.level <= LEVEL);
  const mine = LS.get("mywords", []);
  $app.innerHTML = `<h1>📚 Слова</h1><p class="muted">Нажми на карточку — услышишь слово.</p>
    <div class="tiles">
      ${sets.map((s, i) => `<a class="tile c${(i % 4) + 1}" href="#/set/${s.id}"><span class="ico">${s.icon}</span>${esc(s.title)}<small>${s.words.length} слов</small></a>`).join("")}
      <a class="tile c1" href="#/set/mine"><span class="ico">⭐</span>Мои слова<small>${mine.length} слов из мультиков</small></a>
    </div>`;
}
function viewSet(id) {
  const isMine = id === "mine";
  const src = source(isMine ? "mine" : "set:" + id);
  if (!src) { location.hash = "#/words"; return; }
  $app.innerHTML = `<a class="back" href="#/words">← Слова</a><h1>${esc(src.title)}</h1>
    ${!src.items.length ? `<p class="note">Здесь пока пусто. В мультике нажми на слово и выбери «⭐ В мои слова».</p>` : ""}
    <div class="wcards">${src.items.map((w, i) => `
      <div class="wcard" data-i="${i}">
        ${w.e ? `<div class="e">${w.e}</div>` : ""}
        <div class="ar">${esc(w.ar)}</div><div class="ru">${esc(w.ru)}</div>
        ${isMine ? `<button class="del" data-del="${i}">убрать</button>` : ""}
      </div>`).join("")}</div>
    ${src.items.length >= 4 ? `<div class="row" style="margin-top:16px">
      <a class="btn" href="#/game/match/${isMine ? "mine" : "set:" + id}">🃏 Найди пару</a>
      <a class="btn coral" href="#/game/quiz/${isMine ? "mine" : "set:" + id}">❓ Выбери перевод</a></div>` : ""}`;
  $app.querySelector(".wcards").onclick = e => {
    const del = e.target.dataset && e.target.dataset.del;
    if (del !== undefined) { const l = LS.get("mywords", []); l.splice(+del, 1); LS.set("mywords", l); return viewSet("mine"); }
    const c = e.target.closest(".wcard"); if (c) speak(src.items[+c.dataset.i].ar);
  };
}

/* ---------- игры ---------- */
function viewGames() {
  const srcs = sources();
  $app.innerHTML = `<h1>🎮 Игры</h1>
    <h2>🃏 Найди пару</h2><p class="muted">Открывай карточки и находи пары: арабское слово и картинка.</p>
    <div class="row">${srcs.map(s => `<a class="btn small light" href="#/game/match/${s.id}">${esc(s.title)}</a>`).join("")}</div>
    <h2>❓ Выбери перевод</h2><p class="muted">Слушай и читай слово, выбирай правильную картинку.</p>
    <div class="row">${srcs.map(s => `<a class="btn small light" href="#/game/quiz/${s.id}">${esc(s.title)}</a>`).join("")}</div>
    <h2>🔤 Узнай букву</h2><p class="muted">Слушай название буквы и находи её.</p>
    <div class="row"><a class="btn small light" href="#/game/letters/all">Все буквы</a></div>`;
}

function viewGame(type, src, q) {
  const task = q.get("task");
  const back = task ? "#/homework" : "#/games";
  const finish = (stars, text) => {
    if (task) report(task, (taskById(task) || {}).title || type, text);
    if (stars >= 2) confetti();
    $app.querySelector("#game").innerHTML = `<div class="result"><div class="stars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div>
      <b>${stars === 3 ? "Отлично!" : stars === 2 ? "Хорошо!" : "Попробуй ещё раз!"}</b><div class="muted">${esc(text)}</div>
      ${task ? `<p>✅ Результат отправлен учителю</p>` : ""}
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="again">Ещё раз</button><a class="btn light" href="${back}">Назад</a></div></div>`;
    document.getElementById("again").onclick = () => viewGame(type, src, q);
  };

  if (type === "letters") return gameLetters(src, back, finish);
  const s = source(src);
  if (!s || s.items.length < 4) {
    $app.innerHTML = `<a class="back" href="${back}">← Назад</a><p class="note">Для игры нужно хотя бы 4 слова${src === "mine" ? ". Добавь слова из мультиков в «Мои слова»" : ""}.</p>`;
    return;
  }
  if (type === "match") return gameMatch(s, back, finish);
  return gameQuiz(s, back, finish);
}

function gameMatch(s, back, finish) {
  const n = Math.min(LEVEL === 1 ? 4 : 6, s.items.length);
  const words = pick(s.items, n);
  const cards = shuffle(words.flatMap((w, k) => [{ k, side: "ar", w }, { k, side: "pic", w }]));
  let open = [], done = 0, moves = 0, lock = false;
  $app.innerHTML = `<a class="back" href="${back}">← Назад</a>
    <div class="game-head"><h1 style="margin:0">🃏 ${esc(s.title)}</h1><span class="pill" id="moves">Ходов: 0</span></div>
    <div id="game"><div class="mgrid" id="grid">${cards.map((c, i) => `<button class="mcard" data-i="${i}">?</button>`).join("")}</div></div>`;
  const face = c => c.side === "ar" ? `<span class="ar">${esc(c.w.ar)}</span>` : (c.w.e ? `<span>${c.w.e}<span class="ru">${esc(c.w.ru)}</span></span>` : `<span class="ru" style="font-size:16px;color:var(--ink)">${esc(c.w.ru)}</span>`);
  document.getElementById("grid").onclick = e => {
    const b = e.target.closest(".mcard"); if (!b || lock) return;
    const i = +b.dataset.i, c = cards[i];
    if (b.classList.contains("open") || b.classList.contains("done")) return;
    b.classList.add("open"); b.innerHTML = face(c);
    if (c.side === "ar") speak(c.w.ar);
    open.push([b, c]);
    if (open.length === 2) {
      moves++; document.getElementById("moves").textContent = "Ходов: " + moves;
      const [[b1, c1], [b2, c2]] = open; open = [];
      if (c1.k === c2.k) { [b1, b2].forEach(x => { x.classList.remove("open"); x.classList.add("done"); }); done++; if (done === n) setTimeout(() => finish(moves <= n + 2 ? 3 : moves <= n * 2 ? 2 : 1, "Пар: " + n + ", ходов: " + moves), 500); }
      else { lock = true; setTimeout(() => { [b1, b2].forEach(x => { x.classList.remove("open"); x.textContent = "?"; }); lock = false; }, 900); }
    }
  };
}

function gameQuiz(s, back, finish) {
  const items = s.items;
  const qs = pick(items, Math.min(10, items.length));
  let k = 0, right = 0;
  $app.innerHTML = `<a class="back" href="${back}">← Назад</a>
    <div class="game-head"><h1 style="margin:0">❓ ${esc(s.title)}</h1><span class="pill" id="cnt"></span></div><div id="game"></div>`;
  const step = () => {
    if (k >= qs.length) { const p = right / qs.length; return finish(p >= .9 ? 3 : p >= .6 ? 2 : 1, "Правильно: " + right + " из " + qs.length); }
    const w = qs[k];
    const opts = shuffle([w, ...pick(items.filter(x => x !== w && x.ru !== w.ru), 3)]);
    document.getElementById("cnt").textContent = (k + 1) + " / " + qs.length;
    document.getElementById("game").innerHTML = `
      <div class="quiz-q"><div class="ask">Что значит это слово?</div><div class="ar">${esc(w.ar)}</div><button class="btn small light" id="say">🔊 Послушать</button></div>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}">${o.e ? `<span class="e">${o.e}</span>` : ""}${esc(o.ru)}</button>`).join("")}</div>`;
    document.getElementById("say").onclick = () => speak(w.ar);
    speak(w.ar);
    let answered = false;
    document.querySelector(".opts").onclick = e => {
      const b = e.target.closest(".opt"); if (!b || answered) return; answered = true;
      const o = opts[+b.dataset.i];
      if (o === w) { b.classList.add("ok"); right++; } else { b.classList.add("bad"); document.querySelectorAll(".opt")[opts.indexOf(w)].classList.add("ok"); }
      setTimeout(() => { k++; step(); }, o === w ? 800 : 1600);
    };
  };
  step();
}

function gameLetters(src, back, finish) {
  const all = A();
  const pool = src && src !== "all" ? all.filter(x => src.split(",").includes(x.l)) : all;
  const qs = Array.from({ length: Math.max(6, Math.min(10, pool.length * 2)) }, (_, i) => pool[i % pool.length]);
  const order = shuffle(qs);
  let k = 0, right = 0;
  $app.innerHTML = `<a class="back" href="${back}">← Назад</a>
    <div class="game-head"><h1 style="margin:0">🔤 Узнай букву</h1><span class="pill" id="cnt"></span></div><div id="game"></div>`;
  const step = () => {
    if (k >= order.length) { const p = right / order.length; return finish(p >= .9 ? 3 : p >= .6 ? 2 : 1, "Правильно: " + right + " из " + order.length); }
    const x = order[k];
    const opts = shuffle([x, ...pick(all.filter(y => y !== x), 3)]);
    document.getElementById("cnt").textContent = (k + 1) + " / " + order.length;
    document.getElementById("game").innerHTML = `
      <div class="quiz-q"><div class="ask">Где буква «${esc(x.ru)}»?</div><div class="ar" style="font-size:30px">${x.name}</div><button class="btn small light" id="say">🔊 Послушать</button></div>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="ar">${o.l}</span></button>`).join("")}</div>`;
    document.getElementById("say").onclick = () => speak(x.name);
    speak(x.name);
    let answered = false;
    document.querySelector(".opts").onclick = e => {
      const b = e.target.closest(".opt"); if (!b || answered) return; answered = true;
      const o = opts[+b.dataset.i];
      if (o === x) { b.classList.add("ok"); right++; } else { b.classList.add("bad"); document.querySelectorAll(".opt")[opts.indexOf(x)].classList.add("ok"); }
      setTimeout(() => { k++; step(); }, o === x ? 800 : 1600);
    };
  };
  step();
}

/* ---------- домашка ---------- */
const TASK_ICON = { video: "🎬", match: "🃏", quiz: "❓", letters: "🔤" };
function taskHref(h) {
  const t = "?task=" + encodeURIComponent(h.id);
  if (h.type === "video") return "#/video/" + h.video + t;
  if (h.type === "letters") return "#/letters" + t + "&set=" + encodeURIComponent((h.letters || []).join(","));
  return "#/game/" + h.type + "/" + h.source + t;
}
function viewHomework() {
  const p = progress();
  const list = myTasks();
  $app.innerHTML = `<h1>📋 Домашка</h1>
    ${KID ? "" : `<p class="note">Чтобы учитель видел твои результаты, открой сайт по своей личной ссылке от учителя.</p>`}
    <div class="tasks">${list.map(h => {
      const d = p[h.id];
      return `<a class="task ${d ? "done" : ""}" href="${taskHref(h)}"><span class="ico">${TASK_ICON[h.type] || "📌"}</span>
        <span class="info"><b>${esc(h.title)}</b><small>${d ? "Сделано: " + esc(d.result) : "Не сделано"}</small></span>
        <span class="st">${d ? "✅" : "▶️"}</span></a>`;
    }).join("") || `<p class="note">Заданий пока нет 🎉</p>`}</div>
    <p style="margin-top:28px"><a class="muted" href="#/teacher">Для учителя →</a></p>`;
}

function viewTeacher() {
  const base = location.origin + location.pathname;
  $app.innerHTML = `<a class="back" href="#/homework">← Домашка</a><h1>👩‍🏫 Для учителя</h1>
    <p class="note">${window.SHEET_URL ? "✅ Google-таблица подключена: результаты детей приходят туда." : "⚠️ Google-таблица ещё не подключена — результаты сохраняются только на устройстве ребёнка. Инструкция: google-sheet/НАСТРОЙКА.md"}</p>
    <h2>Личные ссылки учеников</h2>
    <table class="kids"><tr><th>Ученик</th><th>Уровень</th><th>Ссылка</th><th></th></tr>
      ${(window.KIDS || []).map(k => `<tr><td>${esc(k.name)}</td><td>${k.level}</td><td><code>${esc(base + "?kid=" + k.code)}</code></td>
        <td><button class="btn small light" data-copy="${esc(base + "?kid=" + k.code)}">Копировать</button></td></tr>`).join("")}
    </table>
    <h2>Задания</h2>
    <div class="tasks">${(window.HOMEWORK || []).map(h => `<div class="task"><span class="ico">${TASK_ICON[h.type] || "📌"}</span><span class="info"><b>${esc(h.title)}</b><small>Уровни: ${(h.levels || []).join(", ")}</small></span></div>`).join("")}</div>
    <p class="muted">Учеников и задания пока добавляет брат в файле data/class.js. Позже сделаем для этого удобную страницу.</p>`;
  $app.querySelectorAll("[data-copy]").forEach(b => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("Ссылка скопирована"); } catch (e) { toast(b.dataset.copy, 5000); }
  }));
}

render();
