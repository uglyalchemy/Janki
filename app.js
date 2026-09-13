import { initialState, next, isDue, previewDelays, defaultOptions, cutoffInstant, RATING } from "./scheduler.js";
import { cardFor, notes, deckCounts, pickNext, deckHasWork } from "./queue.js";
import { load, save, serialize, parseBackup } from "./storage.js";

let db = load(), session = null, view = "home", answer = false, currentId = null;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[m]));
const now = () => Date.now();
const sameDay = (a, b = now()) => cutoffInstant(a, db.settings.dayCutoffHour, db.settings.timezone) === cutoffInstant(b, db.settings.dayCutoffHour, db.settings.timezone);

function persist() { save(db); }
function toast(msg) {
  const x = $("toast");
  if (!x) return;
  x.textContent = msg;
  x.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => x.classList.remove("show"), 2200);
}

function render() {
  document.body.innerHTML = `<div class="shell"><header class="top"><button class="brand-button" id="homeBtn"><span class="brand">Janki</span><small>Japanese SRS</small></button><div class="toolbar"><button class="icon" id="importBtn" aria-label="Import backup">⇧</button><button class="icon" id="exportBtn" aria-label="Export backup">⇩</button><button class="icon" id="settingsBtn" aria-label="Settings">⚙</button></div></header><main id="main"></main></div><nav class="nav" aria-label="Primary"><button id="navHome">Decks</button><button id="navBrowse">Browse</button><button id="navStats">Stats</button><button id="navAdd">Add</button></nav><input id="fileInput" type="file" accept="application/json,.json" hidden><div id="toast" class="toast" role="status" aria-live="polite"></div>`;
  bindGlobal();
  renderMain();
}

function bindGlobal() {
  $("homeBtn").onclick = () => { view = "home"; renderMain(); };
  $("navHome").onclick = () => { view = "home"; renderMain(); };
  $("navBrowse").onclick = () => { view = "browse"; renderMain(); };
  $("navStats").onclick = () => { view = "stats"; renderMain(); };
  $("navAdd").onclick = () => { view = "add"; currentId = null; renderMain(); };
  $("settingsBtn").onclick = () => { view = "settings"; renderMain(); };
  $("exportBtn").onclick = exportJSON;
  $("importBtn").onclick = () => $("fileInput").click();
  $("fileInput").onchange = importJSON;
}

function renderMain() {
  const main = $("main");
  const pages = { home: renderHome, study: renderStudy, browse: renderBrowse, stats: renderStats, add: renderAdd, settings: renderSettings };
  (pages[view] || renderHome)(main);
}

function deckCardHTML(deck) {
  const c = deckCounts(db, deck), total = notes(db, deck).length;
  return `<article class="deck"><div><h3>${esc(deck)}</h3><div class="sub">${total} cards</div><div class="counts"><span class="new">${c.newC} new</span><span class="learn">${c.learnC} learning</span><span class="review">${c.reviewC} due</span></div></div><button class="btn primary" data-study="${esc(deck)}" ${deckHasWork(db, deck) ? "" : "disabled"}>Study</button></article>`;
}

function renderHome(main) {
  const decks = [...new Set(db.notes.map(n => n.deck))].sort();
  const totalNew = db.notes.filter(n => { const c = cardFor(db, n); return c.state === "new" && !c.suspended; }).length;
  const totalDue = db.notes.filter(n => { const c = cardFor(db, n); return c.state === "review" && isDue(c); }).length;
  const today = db.reviews.filter(r => sameDay(r.at)).length;
  main.innerHTML = `<section><div class="hero panel"><div><div class="eyebrow">TODAY</div><h1>Keep your streak alive.</h1><div class="counts"><span class="new">${totalNew} new</span><span class="review">${totalDue} due</span><span class="muted">${today} reviews</span></div></div><button class="btn primary" id="quickStudy" ${decks.some(d => deckHasWork(db, d)) ? "" : "disabled"}>Study next</button></div><div class="section-head"><h2>Decks</h2><button class="btn" id="manageDecks">Options</button></div><div class="deck-list">${decks.map(deckCardHTML).join("") || '<div class="empty">No decks yet. Add your first card.</div>'}</div><div class="panel backup-panel"><div><b>Your data stays on this device.</b><div class="muted">Export a backup before changing phones or clearing browser data.</div></div><div class="toolbar"><button class="btn" id="backup">Export backup</button><button class="btn" id="restore">Import backup</button></div></div></section>`;
  main.querySelectorAll("[data-study]").forEach(b => b.onclick = () => start(b.dataset.study));
  $("quickStudy")?.addEventListener("click", () => { const d = decks.find(x => deckHasWork(db, x)); if (d) start(d); });
  $("manageDecks").onclick = () => { view = "settings"; renderMain(); };
  $("backup").onclick = exportJSON;
  $("restore").onclick = () => $("fileInput").click();
}

function start(deck) {
  if (!deckHasWork(db, deck)) { toast("Nothing due right now."); return; }
  session = { deck, sinceNew: 0, studied: 0 };
  view = "study";
  renderMain();
}

function renderStudy(main) {
  if (!session) { view = "home"; renderMain(); return; }
  const n = pickNext(db, session.deck, now(), session);
  if (!n) {
    const studied = session.studied;
    view = "home"; session = null; renderMain();
    toast(studied ? "Session complete 🎉" : "Nothing due right now.");
    return;
  }
  currentId = n.id;
  const s = cardFor(db, n);
  answer = false;
  const c = deckCounts(db, session.deck);
  const delays = previewDelays(s, db.settings, now());
  const done = session.studied;
  const isKanji = (n.tags || []).includes("kanji-top1000");
  main.innerHTML = `<section class="study"><div class="studyhead"><span>${esc(session.deck)}</span><span>${done} studied</span></div><div class="progress" aria-label="Session progress"><i style="width:${Math.min(100, Math.max(4, (done / Math.max(1, done + c.newC + c.reviewC + c.learnC)) * 100))}%"></i></div><div class="question"><div class="jp">${esc(n.front)}</div><button class="audio" id="audio" type="button">🔊 Hear Japanese</button><div class="answer" id="answer"><div class="reading" id="answerReading"></div><div class="meaning" id="answerMeaning"></div><div class="example" id="answerExample"></div></div><button class="btn primary reveal" id="reveal" type="button">Show Answer</button></div><div class="ratings" id="ratings" aria-hidden="true"><button class="rate r0" data-r="0" disabled>Again<small>${delays[RATING.AGAIN]}</small></button><button class="rate r1" data-r="1" disabled>Hard<small>${delays[RATING.HARD]}</small></button><button class="rate r2" data-r="2" disabled>Good<small>${delays[RATING.GOOD]}</small></button><button class="rate r3" data-r="3" disabled>Easy<small>${delays[RATING.EASY]}</small></button></div><div class="keyboard-hint muted">Space: reveal · 1–4: answer</div></section>`;
  $("reveal").onclick = () => revealAnswer(n, isKanji);
  $("audio").onclick = () => speak(n.front);
  main.querySelectorAll("[data-r]").forEach(b => b.onclick = () => grade(Number(b.dataset.r), n));
}

async function revealAnswer(n, isKanji = false) {
  if (answer) return;
  answer = true;
  const reveal = $("reveal");
  if (reveal) { reveal.disabled = true; reveal.textContent = isKanji ? "Loading…" : "Show Answer"; }
  let info = null;
  if (isKanji && n.front) {
    try {
      const cached = n.kanjiInfo;
      if (cached) info = cached;
      else {
        const res = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(n.front)}`, {cache:"force-cache"});
        if (!res.ok) throw new Error("Kanji lookup failed");
        info = await res.json();
        n.kanjiInfo = { meanings: info.meanings || [], on_readings: info.on_readings || [], kun_readings: info.kun_readings || [], stroke_count: info.stroke_count || null, grade: info.grade ?? null, jlpt: info.jlpt ?? null };
        persist();
      }
    } catch {
      info = n.kanjiInfo || null;
    }
  }
  const reading = info ? [...(info.on_readings || []), ...(info.kun_readings || [])].join(" · ") : n.reading;
  const meaning = info ? (info.meanings || []).slice(0, 4).join("; ") : n.meaning;
  const meta = info ? `Rank ${n.meaning.match(/rank (\d+)/)?.[1] || "—"} · ${info.stroke_count || "?"} strokes${info.grade ? ` · Grade ${info.grade}` : ""}${info.jlpt ? ` · JLPT N${info.jlpt}` : ""}` : n.meaning;
  $("answerReading").textContent = reading || "Reading unavailable";
  $("answerMeaning").textContent = meaning || "Meaning unavailable";
  $("answerExample").innerHTML = isKanji ? `<span class="muted">${esc(meta)}</span>` : `${esc(n.sentence)}<br><span class="muted">${esc(n.translation)}</span>`;
  $("answer")?.classList.add("show");
  $("reveal")?.remove();
  const ratings = $("ratings");
  if (ratings) {
    ratings.setAttribute("aria-hidden", "false");
    ratings.querySelectorAll("[data-r]").forEach(b => { b.disabled = false; });
  }
}

function grade(r, n) {
  if (!answer) return;
  const old = cardFor(db, n);
  const fresh = next(old, r, now(), db.settings);
  db.cards[n.id] = fresh;
  db.reviews.push({ at: now(), noteId: n.id, rating: r, deck: n.deck, wasState: old.state });
  if (fresh.leech) toast(fresh.suspended ? "Card suspended as a leech." : "Card flagged as a leech.");
  persist();
  session.studied++;
  renderMain();
}

function speak(text) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    playOnlineSpeech(text);
    return;
  }
  const speakNow = () => {
    const voices = speechSynthesis.getVoices();
    const japanese = voices.find(v => /^ja(?:-|$)/i.test(v.lang)) || voices.find(v => /japanese|日本語/i.test(v.name));
    if (!japanese) { playOnlineSpeech(text); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = japanese.lang || "ja-JP";
    u.voice = japanese;
    u.rate = 0.82;
    u.pitch = 1;
    u.volume = 1;
    u.onerror = () => playOnlineSpeech(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  if (speechSynthesis.getVoices().length) speakNow();
  else {
    let done = false;
    const handler = () => { if (done) return; done = true; speechSynthesis.removeEventListener("voiceschanged", handler); speakNow(); };
    speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(() => { if (done) return; done = true; speechSynthesis.removeEventListener("voiceschanged", handler); speakNow(); }, 700);
  }
}

function playOnlineSpeech(text) {
  // Explicitly triggered by the user's audio button. This fallback is used only
  // when the browser has no Japanese voice installed. It keeps the app usable on
  // browsers such as Opera/Windows where Japanese system voices may be absent.
  const src = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(text)}`;
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.play().catch(() => toast("Audio could not play. Install a Japanese voice in Windows or allow audio for this site."));
}

function renderBrowse(main) {
  main.innerHTML = `<section><div class="section-head"><div><h2>Browse cards</h2><div class="muted">Search, edit, or suspend cards.</div></div></div><div class="panel"><input class="search" id="q" placeholder="Search Japanese, reading, meaning, tag…" autocomplete="off"><div id="results"></div></div></section>`;
  const draw = () => {
    const q = $("q").value.trim().toLowerCase();
    const ns = db.notes.filter(n => [n.front, n.reading, n.meaning, n.deck, (n.tags || []).join(" ")].join(" ").toLowerCase().includes(q));
    $("results").innerHTML = `<div class="browser-row head"><span>Japanese</span><span>Meaning</span><span>Deck</span><span>State</span></div>` + ns.slice(0, 200).map(n => {
      const s = cardFor(db, n);
      return `<div class="browser-row"><span><b>${esc(n.front)}</b><br><small class="muted">${esc(n.reading)}</small></span><span>${esc(n.meaning)}</span><span class="muted">${esc(n.deck)}</span><span><span class="pill">${esc(s.state)}</span>${s.leech ? ' <span class="pill leech">leech</span>' : ''}${s.suspended ? ' <span class="pill suspended">suspended</span>' : ''}<div class="row-actions"><button class="btn tiny" data-edit="${esc(n.id)}">Edit</button><button class="btn tiny" data-toggle="${esc(n.id)}">${s.suspended ? "Unsuspend" : "Suspend"}</button></div></span></div>`;
    }).join("");
    $("results").querySelectorAll("[data-toggle]").forEach(b => b.onclick = () => { const id = b.dataset.toggle; db.cards[id].suspended = !db.cards[id].suspended; persist(); draw(); });
    $("results").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { currentId = b.dataset.edit; view = "add"; renderMain(); });
  };
  $("q").oninput = draw;
  draw();
}

function renderStats(main) {
  const reviews = db.reviews.length;
  const correct = db.reviews.filter(r => r.rating >= RATING.GOOD).length;
  const acc = reviews ? Math.round(correct / reviews * 100) : 0;
  const mature = db.notes.filter(n => { const c = cardFor(db, n); return c.state === "review" && c.interval >= 21; }).length;
  const leeches = db.notes.filter(n => cardFor(db, n).leech).length;
  const counts = [0,1,2,3].map(r => db.reviews.filter(x => x.rating === r).length);
  main.innerHTML = `<section><h2>Statistics</h2><div class="stats-grid"><div class="metric"><b>${reviews}</b><span>Total reviews</span></div><div class="metric"><b>${reviews ? acc + "%" : "—"}</b><span>Pass rate</span></div><div class="metric"><b>${mature}</b><span>Mature cards</span></div><div class="metric"><b>${todayReviews()}</b><span>Today</span></div></div><div class="panel"><h3>Answer buttons</h3><div class="bar-row"><span>Again</span><i style="width:${Math.max(2, counts[0] / Math.max(1, reviews) * 100)}%"></i><b>${counts[0]}</b></div><div class="bar-row"><span>Hard</span><i style="width:${Math.max(2, counts[1] / Math.max(1, reviews) * 100)}%"></i><b>${counts[1]}</b></div><div class="bar-row"><span>Good</span><i style="width:${Math.max(2, counts[2] / Math.max(1, reviews) * 100)}%"></i><b>${counts[2]}</b></div><div class="bar-row"><span>Easy</span><i style="width:${Math.max(2, counts[3] / Math.max(1, reviews) * 100)}%"></i><b>${counts[3]}</b></div></div>${leeches ? `<div class="panel"><h3>Leeches</h3><div class="muted">${leeches} card${leeches === 1 ? "" : "s"} flagged after repeated lapses. Check Browse.</div></div>` : ""}</section>`;
}

function renderAdd(main) {
  const editing = currentId ? db.notes.find(n => n.id === currentId) : null;
  const n = editing || { deck: db.notes[0]?.deck || "Japanese::Custom", tags: [], front: "", reading: "", meaning: "", sentence: "", translation: "" };
  const decks = [...new Set(db.notes.map(x => x.deck))];
  main.innerHTML = `<section><div class="section-head"><div><h2>${editing ? "Edit card" : "Add note"}</h2><div class="muted">Create a Japanese card with an example.</div></div></div><div class="panel form-grid"><div class="form-group"><label>Deck</label><select id="deck">${decks.map(d => `<option ${d === n.deck ? "selected" : ""}>${esc(d)}</option>`).join("")}<option ${n.deck === "Japanese::Custom" ? "selected" : ""}>Japanese::Custom</option></select></div><div class="form-group"><label>Tags</label><input id="tags" value="${esc((n.tags || []).join(" "))}" placeholder="travel jlpt-n5"></div><div class="form-group"><label>Japanese / front</label><input id="front" value="${esc(n.front)}" placeholder="駅" autocomplete="off"></div><div class="form-group"><label>Reading</label><input id="reading" value="${esc(n.reading)}" placeholder="えき" autocomplete="off"></div><div class="form-group full"><label>Meaning</label><input id="meaning" value="${esc(n.meaning)}" placeholder="station"></div><div class="form-group"><label>Example</label><textarea id="sentence" placeholder="駅はどこですか？">${esc(n.sentence)}</textarea></div><div class="form-group"><label>Translation</label><textarea id="translation" placeholder="Where is the station?">${esc(n.translation)}</textarea></div><div class="full toolbar"><button class="btn primary" id="save">${editing ? "Save changes" : "Add card"}</button><button class="btn" id="cancelAdd">Cancel</button></div></div></section>`;
  $("cancelAdd").onclick = () => { currentId = null; view = "browse"; renderMain(); };
  $("save").onclick = () => {
    const values = { deck: $("deck").value, front: $("front").value.trim(), reading: $("reading").value.trim(), meaning: $("meaning").value.trim(), sentence: $("sentence").value.trim(), translation: $("translation").value.trim(), tags: $("tags").value.trim().split(/\s+/).filter(Boolean) };
    if (!values.front || !values.meaning) { toast("Japanese and meaning are required."); return; }
    if (editing) { Object.assign(editing, values); toast("Card updated"); }
    else { const card = { id: crypto.randomUUID(), ...values, createdAt: now() }; db.notes.push(card); db.cards[card.id] = { ...initialState(), noteId: card.id }; toast("Card added"); }
    persist(); currentId = null; view = "browse"; renderMain();
  };
}

function renderSettings(main) {
  const s = db.settings;
  const field = (id, label, val, step = "1") => `<div class="form-group"><label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="${step}" value="${esc(val)}"></div>`;
  main.innerHTML = `<section><div class="section-head"><div><h2>Settings</h2><div class="muted">Scheduler, limits, and data tools.</div></div></div><div class="panel form-grid"><div class="form-group"><label for="learningSteps">Learning steps (minutes)</label><input id="learningSteps" value="${s.learningSteps.join(" ")}"></div><div class="form-group"><label for="relearningSteps">Relearning steps (minutes)</label><input id="relearningSteps" value="${s.relearningSteps.join(" ")}"></div>${field("graduatingInterval","Graduating interval (days)",s.graduatingInterval)}${field("easyInterval","Easy interval (days)",s.easyInterval)}${field("startingEase","Starting ease",s.startingEase,"0.05")}${field("easyBonus","Easy bonus",s.easyBonus,"0.05")}${field("hardIntervalFactor","Hard interval factor",s.hardIntervalFactor,"0.05")}${field("intervalModifier","Interval modifier",s.intervalModifier,"0.05")}${field("newLapseIntervalPercent","New interval on lapse (%)",s.newLapseIntervalPercent)}${field("minimumInterval","Minimum interval (days)",s.minimumInterval)}${field("maximumInterval","Maximum interval (days)",s.maximumInterval)}${field("leechThreshold","Leech threshold",s.leechThreshold)}${field("learnAheadMinutes","Learn ahead (minutes)",s.learnAheadMinutes)}${field("newPerDay","New cards/day",s.newPerDay)}${field("reviewPerDay","Reviews/day",s.reviewPerDay)}<div class="form-group"><label for="leechAction">Leech action</label><select id="leechAction"><option value="tag" ${s.leechAction === "tag" ? "selected" : ""}>Tag only</option><option value="suspend" ${s.leechAction === "suspend" ? "selected" : ""}>Suspend</option></select></div><div class="form-group"><label for="fuzz">Interval fuzz</label><select id="fuzz"><option value="1" ${s.fuzz ? "selected" : ""}>On</option><option value="0" ${!s.fuzz ? "selected" : ""}>Off</option></select></div><div class="form-group"><label for="dayCutoffHour">Day rollover hour (local)</label><input id="dayCutoffHour" type="number" min="0" max="23" value="${s.dayCutoffHour}"></div><div class="form-group"><label>Timezone</label><input value="Device local time" disabled></div><div class="full toolbar"><button class="btn primary" id="saveSettings">Save settings</button><button class="btn danger" id="resetData">Reset collection</button></div></div></section>`;
  $("saveSettings").onclick = () => {
    const num = id => Number($(id).value);
    const steps = id => $(id).value.trim().split(/\s+/).map(Number).filter(x => Number.isFinite(x) && x > 0);
    const ns = steps("learningSteps"), rs = steps("relearningSteps");
    db.settings = { ...s, learningSteps: ns.length ? ns : [1], relearningSteps: rs.length ? rs : [10], graduatingInterval:num("graduatingInterval"), easyInterval:num("easyInterval"), startingEase:num("startingEase"), easyBonus:num("easyBonus"), hardIntervalFactor:num("hardIntervalFactor"), intervalModifier:num("intervalModifier"), newLapseIntervalPercent:num("newLapseIntervalPercent"), minimumInterval:num("minimumInterval"), maximumInterval:num("maximumInterval"), leechThreshold:num("leechThreshold"), learnAheadMinutes:num("learnAheadMinutes"), newPerDay:num("newPerDay"), reviewPerDay:num("reviewPerDay"), leechAction:$("leechAction").value, fuzz:$("fuzz").value === "1", dayCutoffHour:Math.min(23, Math.max(0, Math.floor(num("dayCutoffHour")))), timezone:"local" };
    if (db.settings.maximumInterval < db.settings.minimumInterval) { toast("Maximum interval must be at least the minimum."); return; }
    persist(); toast("Settings saved"); view = "home"; renderMain();
  };
  $("resetData").onclick = () => { if (confirm("Delete all cards and review history and restore the starter decks?")) { localStorage.removeItem("janki.collection.v6"); db = load(); session = null; view = "home"; renderMain(); toast("Collection reset"); } };
}

function exportJSON() {
  const blob = new Blob([serialize(db)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `janki-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importJSON(e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return;
  try {
    const incoming = parseBackup(await f.text());
    if (!confirm(`Replace this collection with ${incoming.notes.length} cards and ${incoming.reviews.length} reviews?`)) return;
    db = incoming; persist(); session = null; view = "home"; renderMain(); toast("Backup restored");
  } catch (err) { toast(`Import failed: ${err.message}`); }
}

function todayReviews() { return db.reviews.filter(r => sameDay(r.at)).length; }

window.addEventListener("keydown", e => {
  if (view !== "study" || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  if (e.code === "Space") { e.preventDefault(); const n = currentId ? db.notes.find(x => x.id === currentId) : null; if (n) revealAnswer(n, (n.tags || []).includes("kanji-top1000")); }
  if (answer && ["Digit1","Digit2","Digit3","Digit4"].includes(e.code)) {
    e.preventDefault();
    const n = pickNext(db, session.deck, now(), session);
    if (n) grade(Number(e.code.slice(-1)) - 1, n);
  }
});

render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
