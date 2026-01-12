const state = {
  lang: "en",
  dir: "ltr",
  buffs: {
    petSkillActive: false,
    foundryExpertActive: false,
    svsExpertActive: false,
    romulusAlwaysOn: true
  },
  inputs: {
    global: { atk: 0, def: 0, leth: 0, hp: 0 },
    inf: { atk: null, def: null, leth: null, hp: null },
    lan: { atk: null, def: null, leth: null, hp: null },
    mar: { atk: null, def: null, leth: null, hp: null }
  }
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
}

function numOrNull(v){
  if(v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readInputs(){
  state.inputs.global.atk = Number($("gAtk").value || 0);
  state.inputs.global.def = Number($("gDef").value || 0);
  state.inputs.global.leth = Number($("gLeth").value || 0);
  state.inputs.global.hp = Number($("gHp").value || 0);

  state.inputs.inf.atk = numOrNull($("iAtk").value);
  state.inputs.inf.def = numOrNull($("iDef").value);
  state.inputs.inf.leth = numOrNull($("iLeth").value);
  state.inputs.inf.hp = numOrNull($("iHp").value);

  state.inputs.lan.atk = numOrNull($("lAtk").value);
  state.inputs.lan.def = numOrNull($("lDef").value);
  state.inputs.lan.leth = numOrNull($("lLeth").value);
  state.inputs.lan.hp = numOrNull($("lHp").value);

  state.inputs.mar.atk = numOrNull($("mAtk").value);
  state.inputs.mar.def = numOrNull($("mDef").value);
  state.inputs.mar.leth = numOrNull($("mLeth").value);
  state.inputs.mar.hp = numOrNull($("mHp").value);

  state.buffs.petSkillActive = $("petSkillActive").checked;
  state.buffs.foundryExpertActive = $("foundryExpertActive").checked;
  state.buffs.svsExpertActive = $("svsExpertActive").checked;
}

function isComplete(t){
  return [t.atk, t.def, t.leth, t.hp].every(x => x !== null && Number.isFinite(x));
}

function avg4(t){ return (t.atk + t.def + t.leth + t.hp) / 4; }

function detectFocus(){
  const candidates = [];
  if(isComplete(state.inputs.inf)) candidates.push(["Infantry", avg4(state.inputs.inf)]);
  if(isComplete(state.inputs.lan)) candidates.push(["Lancer", avg4(state.inputs.lan)]);
  if(isComplete(state.inputs.mar)) candidates.push(["Marksman", avg4(state.inputs.mar)]);

  if(candidates.length === 0) return { focus: "—", source: "Global only" };

  candidates.sort((a,b) => b[1] - a[1]);
  return { focus: candidates[0][0], source: "Troop types" };
}

function computeProfile(){
  // Right now: we store baseline as what user entered.
  // Later: we’ll subtract conditional buffs (pet skill / foundry / svs) if ON and user wants “pure always-on baseline”.
  const g = state.inputs.global;

  const det = detectFocus();
  $("detectedFocus").textContent = det.focus;
  $("sourceValue").textContent = det.source;

  const profile = {
    mode: "solo",
    detectedFocus: det.focus,
    source: det.source,
    buffs: { ...state.buffs },
    globalTroops: {
      attack: g.atk,
      defense: g.def,
      lethality: g.leth,
      health: g.hp
    },
    troopTypes: {
      infantry: { ...state.inputs.inf },
      lancer: { ...state.inputs.lan },
      marksman: { ...state.inputs.mar }
    },
    timestamp: new Date().toISOString()
  };

  $("output").textContent = JSON.stringify(profile, null, 2);
  return profile;
}

function saveProfile(profile){
  localStorage.setItem("mohmd_solo_profile", JSON.stringify(profile));
}

function bindTabs(){
  const buttons = document.querySelectorAll(".tabBtn");
  const panels = {
    inf: $("tab-inf"),
    lan: $("tab-lan"),
    mar: $("tab-mar")
  };

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");

      buttons.forEach(b => b.classList.remove("tabActive"));
      btn.classList.add("tabActive");

      Object.values(panels).forEach(p => p.classList.remove("tabShow"));
      panels[tab].classList.add("tabShow");
    });
  });
}

function bindEvents(){
  $("langBtn").addEventListener("click", () => {
    state.lang = state.lang === "en" ? "ar" : "en";
    localStorage.setItem("mohmd_lang", state.lang);
    applyLang();
  });

  $("computeBtn").addEventListener("click", () => {
    readInputs();
    const profile = computeProfile();
    location.hash = "#calc";
  });

  $("saveBtn").addEventListener("click", () => {
    readInputs();
    const profile = computeProfile();
    saveProfile(profile);
    alert(state.lang === "ar" ? "تم حفظ الملف للحاسبة/ROI" : "Saved profile for ROI");
  });
}

async function init(){
  I18N = await loadJson("data/i18n.json");

  const savedLang = localStorage.getItem("mohmd_lang");
  if(savedLang === "ar" || savedLang === "en") state.lang = savedLang;

  applyLang();
  bindTabs();
  bindEvents();

  // Render default empty output
  $("output").textContent = JSON.stringify({}, null, 2);
}

init().catch(err => {
  console.error(err);
  alert("Failed to load report page. Check console.");
});
