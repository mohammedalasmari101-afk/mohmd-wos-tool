const state = {
  lang: "en",
  dir: "ltr",
  currency: "USD",
  fx: 3.75,
  budget: 100,
  flags: {
    chiefGearMaxed: true,
    charmsMaxed: true,
    heroSkillsMaxed: true,
  },
  account: {
    mainType: "auto", // auto | infantry | lancer | marksman
    detectedType: null,
    troops: { atk:0, def:0, leth:0, hp:0, deploy:0 },
    infantry: { atk:0, def:0, leth:0, hp:0 },
    lancer: { atk:0, def:0, leth:0, hp:0 },
    marksman: { atk:0, def:0, leth:0, hp:0 },
  },
  packs: []
};

function $(id){ return document.getElementById(id); }

async function loadJson(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

let I18N = null;

function applyLang(){
  const html = document.documentElement;
  const lang = state.lang;
  const isAr = lang === "ar";
  state.dir = isAr ? "rtl" : "ltr";
  html.lang = lang;
  html.dir = state.dir;

  $("langPill").textContent = isAr ? "AR" : "EN";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const t = I18N?.[lang]?.[key];
    if(typeof t === "string") el.textContent = t;
  });

  // update detected label language
  updateDetectedTypeUI();
}

function fmtMoney(usd){
  if(state.currency === "USD") return `$${usd.toFixed(2)}`;
  const sar = usd * state.fx;
  return `SAR ${sar.toFixed(2)}`;
}

function summarizeContents(contents){
  const lines = [];
  const map = [
    ["expert_mark", { en:"Expert Marks", ar:"علامات الخبير" }],
    ["expert_skill_book", { en:"Expert Skill Books", ar:"كتب مهارات الخبير" }],
    ["speedup_hours", { en:"Speedups (hrs)", ar:"تسريعات (ساعة)" }],
    ["expert_gift", { en:"Expert Gift", ar:"هدايا الخبير" }]
  ];

  for(const [k, label] of map){
    if(contents[k] != null){
      const name = label[state.lang];
      lines.push(`${name}: ${contents[k]}`);
    }
  }
  return lines.join(" • ");
}

/**
 * V1 ROI score (placeholder):
 * - Primary: Expert Marks per USD (big weight)
 * - Secondary: Skill books per USD (smaller weight)
 * - Speedups per USD (tiny weight)
 */
function roiScore(pack){
  const c = pack.contents || {};
  const marks = Number(c.expert_mark || 0);
  const books = Number(c.expert_skill_book || 0);
  const hrs = Number(c.speedup_hours || 0);
  const usd = Number(pack.price_usd || 0.01);

  const marksPer$ = marks / usd;
  const booksPer$ = books / usd;
  const hrsPer$ = hrs / usd;

  return (marksPer$ * 1000) + (booksPer$ * 0.8) + (hrsPer$ * 5);
}

function verdictFor(pack){
  const tags = pack.tags || [];

  if(tags.includes("chiefGear") && state.flags.chiefGearMaxed) return { type:"bad", key:"CAPPED" };
  if(tags.includes("charms") && state.flags.charmsMaxed) return { type:"bad", key:"CAPPED" };

  const books = Number(pack.contents?.expert_skill_book || 0);
  const marks = Number(pack.contents?.expert_mark || 0);

  if(state.flags.heroSkillsMaxed && books > 0 && marks === 0){
    return { type:"warn", key:"SITUATIONAL" };
  }

  return { type:"ok", key:"BUY" };
}

function verdictLabel(v){
  const dict = {
    en: { BUY:"BUY", SITUATIONAL:"SITUATIONAL", CAPPED:"WASTE (CAPPED)" },
    ar: { BUY:"اشترِ", SITUATIONAL:"حسب الحاجة", CAPPED:"هدر (مكتمل)" }
  };
  return dict[state.lang][v.key] || v.key;
}

function renderChips(){
  $("chipChiefGear").style.display = state.flags.chiefGearMaxed ? "inline-flex" : "none";
  $("chipCharms").style.display = state.flags.charmsMaxed ? "inline-flex" : "none";
  $("chipHeroSkills").style.display = state.flags.heroSkillsMaxed ? "inline-flex" : "none";
}

function renderTable(){
  const tbody = $("roiBody");
  tbody.innerHTML = "";

  const rows = state.packs
    .map(p => {
      const score = roiScore(p);
      const verdict = verdictFor(p);
      return { p, score, verdict };
    })
    .sort((a,b) => b.score - a.score);

  for(const r of rows){
    const p = r.p;
    const name = state.lang === "ar" ? p.name_ar : p.name_en;

    const tr = document.createElement("tr");

    const td1 = document.createElement("td");
    td1.innerHTML = `<strong>${name}</strong><div class="mutedSmall">${(p.tags||[]).join(" • ")}</div>`;

    const td2 = document.createElement("td");
    td2.textContent = fmtMoney(p.price_usd);

    const td3 = document.createElement("td");
    td3.textContent = summarizeContents(p.contents);

    const td4 = document.createElement("td");
    td4.textContent = r.score.toFixed(1);

    const td5 = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${r.verdict.type === "ok" ? "badgeOk" : r.verdict.type === "warn" ? "badgeWarn" : "badgeBad"}`;
    badge.textContent = verdictLabel(r.verdict);
    td5.appendChild(badge);

    tr.append(td1, td2, td3, td4, td5);
    tbody.appendChild(tr);
  }
}

/* ---------------------------
   Option B: Manual Stats Input
---------------------------- */

function numVal(id){
  const el = $(id);
  if(!el) return 0;
  const v = Number(el.value);
  return Number.isFinite(v) ? v : 0;
}

function readAccountFromUI(){
  state.account.mainType = $("mainTypeSelect")?.value || "auto";

  state.account.troops.atk = numVal("troopsAtk");
  state.account.troops.def = numVal("troopsDef");
  state.account.troops.leth = numVal("troopsLeth");
  state.account.troops.hp = numVal("troopsHp");
  state.account.troops.deploy = numVal("troopsDeploy");

  state.account.infantry.atk = numVal("infAtk");
  state.account.infantry.def = numVal("infDef");
  state.account.infantry.leth = numVal("infLeth");
  state.account.infantry.hp = numVal("infHp");

  state.account.lancer.atk = numVal("lanAtk");
  state.account.lancer.def = numVal("lanDef");
  state.account.lancer.leth = numVal("lanLeth");
  state.account.lancer.hp = numVal("lanHp");

  state.account.marksman.atk = numVal("markAtk");
  state.account.marksman.def = numVal("markDef");
  state.account.marksman.leth = numVal("markLeth");
  state.account.marksman.hp = numVal("markHp");
}

function scoreType(typeStats){
  // Simple: add the 4 % stats (you can later weight these)
  return (typeStats.atk || 0) + (typeStats.def || 0) + (typeStats.leth || 0) + (typeStats.hp || 0);
}

function detectMainType(){
  // If user manually selects, respect it
  if(state.account.mainType && state.account.mainType !== "auto"){
    return state.account.mainType;
  }

  const inf = scoreType(state.account.infantry);
  const lan = scoreType(state.account.lancer);
  const mark = scoreType(state.account.marksman);

  let best = "lancer";
  let bestScore = lan;

  if(inf > bestScore){ best = "infantry"; bestScore = inf; }
  if(mark > bestScore){ best = "marksman"; bestScore = mark; }

  // If all zero, return null
  if(inf === 0 && lan === 0 && mark === 0) return null;

  return best;
}

function labelForType(t){
  const en = { infantry:"Infantry", lancer:"Lancer", marksman:"Marksman" };
  const ar = { infantry:"مشاة", lancer:"رماح", marksman:"رماة" };
  if(!t) return "—";
  return state.lang === "ar" ? (ar[t] || "—") : (en[t] || "—");
}

function updateDetectedTypeUI(){
  const t = state.account.detectedType;
  const label = labelForType(t);

  if($("detectedPill")) $("detectedPill").textContent = label;
  if($("focusValue")) $("focusValue").textContent = label;

  // Show a little breakdown
  const inf = scoreType(state.account.infantry);
  const lan = scoreType(state.account.lancer);
  const mark = scoreType(state.account.marksman);

  const infoEl = $("detectInfo");
  if(infoEl){
    if(!t){
      infoEl.textContent = state.lang === "ar"
        ? "أدخل نسب المشاة/الرماح/الرماة لتحديد النوع تلقائياً."
        : "Enter Infantry/Lancer/Marksman stats to auto-detect.";
    } else {
      infoEl.textContent = state.lang === "ar"
        ? `المجموع — مشاة: ${inf.toFixed(2)} • رماح: ${lan.toFixed(2)} • رماة: ${mark.toFixed(2)}`
        : `Totals — Infantry: ${inf.toFixed(2)} • Lancer: ${lan.toFixed(2)} • Marksman: ${mark.toFixed(2)}`;
    }
  }
}

function updateDetectedType(){
  readAccountFromUI();
  state.account.detectedType = detectMainType();
  updateDetectedTypeUI();
}

/* ---------------------------
   UI sync + events
---------------------------- */

function syncUItoState(){
  $("chiefGearMaxed").checked = state.flags.chiefGearMaxed;
  $("charmsMaxed").checked = state.flags.charmsMaxed;
  $("heroSkillsMaxed").checked = state.flags.heroSkillsMaxed;

  $("currencySelect").value = state.currency;
  $("fxInput").value = String(state.fx);
  $("budgetInput").value = String(state.budget);

  $("currencyValue").textContent = state.currency;

  if($("mainTypeSelect")) $("mainTypeSelect").value = state.account.mainType;
}

function bindEvents(){
  $("langBtn").addEventListener("click", () => {
    state.lang = state.lang === "en" ? "ar" : "en";
    localStorage.setItem("mohmd_lang", state.lang);
    applyLang();
    renderTable();
  });

  $("currencySelect").addEventListener("change", (e) => {
    state.currency = e.target.value;
    $("currencyValue").textContent = state.currency;
    renderTable();
  });

  $("fxInput").addEventListener("input", (e) => {
    const v = Number(e.target.value);
    if(!Number.isFinite(v) || v <= 0) return;
    state.fx = v;
    renderTable();
  });

  $("budgetInput").addEventListener("input", (e) => {
    const v = Number(e.target.value);
    if(!Number.isFinite(v) || v < 0) return;
    state.budget = v;
  });

  $("chiefGearMaxed").addEventListener("change", (e) => {
    state.flags.chiefGearMaxed = !!e.target.checked;
    renderChips();
    renderTable();
  });

  $("charmsMaxed").addEventListener("change", (e) => {
    state.flags.charmsMaxed = !!e.target.checked;
    renderChips();
    renderTable();
  });

  $("heroSkillsMaxed").addEventListener("change", (e) => {
    state.flags.heroSkillsMaxed = !!e.target.checked;
    renderChips();
    renderTable();
  });

  // Auto-update detection on any stats input change (fast + user friendly)
  const statIds = [
    "mainTypeSelect",
    "troopsAtk","troopsDef","troopsLeth","troopsHp","troopsDeploy",
    "infAtk","infDef","infLeth","infHp",
    "lanAtk","lanDef","lanLeth","lanHp",
    "markAtk","markDef","markLeth","markHp"
  ];
  statIds.forEach(id => {
    const el = $(id);
    if(!el) return;
    el.addEventListener("input", () => {
      updateDetectedType();
    });
    el.addEventListener("change", () => {
      updateDetectedType();
    });
  });

  $("runBtn").addEventListener("click", () => {
    updateDetectedType();
    renderChips();
    renderTable();
    location.hash = "#roi";
  });
}

async function init(){
  I18N = await loadJson("data/i18n.json");
  const expert = await loadJson("data/packs.expert.json");
  state.packs = expert.packs || [];

  const savedLang = localStorage.getItem("mohmd_lang");
  if(savedLang === "ar" || savedLang === "en") state.lang = savedLang;

  bindEvents();
  syncUItoState();
  applyLang();
  renderChips();
  renderTable();

  // first detection render
  updateDetectedType();
}

init().catch(err => {
  console.error(err);
  alert("Failed to load app data. Check console.");
});
