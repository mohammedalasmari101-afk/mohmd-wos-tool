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

  // translate all [data-i18n]
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const t = I18N?.[lang]?.[key];
    if(typeof t === "string") el.textContent = t;
  });
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
 * V1 ROI score:
 * - Primary: Expert Marks per USD (big weight)
 * - Secondary: Skill books per USD (smaller weight)
 * - Speedups per USD (tiny weight, PvP wars still cares but less)
 * This is a placeholder until we plug Expert-level → PvP % gain.
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

  // weights tuned for PvP wars:
  return (marksPer$ * 1000) + (booksPer$ * 0.8) + (hrsPer$ * 5);
}

function verdictFor(pack){
  // cap rules (v1 only uses user toggles; later will use real level caps)
  const tags = pack.tags || [];

  if(tags.includes("chiefGear") && state.flags.chiefGearMaxed) return { type:"bad", key:"CAPPED" };
  if(tags.includes("charms") && state.flags.charmsMaxed) return { type:"bad", key:"CAPPED" };

  // If user says hero skills maxed, mark skill-heavy packs as situational/waste:
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

function syncUItoState(){
  $("chiefGearMaxed").checked = state.flags.chiefGearMaxed;
  $("charmsMaxed").checked = state.flags.charmsMaxed;
  $("heroSkillsMaxed").checked = state.flags.heroSkillsMaxed;

  $("currencySelect").value = state.currency;
  $("fxInput").value = String(state.fx);
  $("budgetInput").value = String(state.budget);

  $("currencyValue").textContent = state.currency;
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

  $("runBtn").addEventListener("click", () => {
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
}

init().catch(err => {
  console.error(err);
  alert("Failed to load app data. Check console.");
});
