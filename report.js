const state = {
  lang: "en",
  dir: "ltr",
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
  const isAr = state.lang === "ar";
  state.dir = isAr ? "rtl" : "ltr";
  html.lang = state.lang;
  html.dir = state.dir;

  $("langPill").textContent = isAr ? "AR" : "EN";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const t = I18N?.[state.lang]?.[key];
    if(typeof t === "string") el.textContent = t;
  });
}

function num(id){
  const v = Number($(id).value);
  return Number.isFinite(v) ? v : 0;
}

function hasCompleteType(prefix){
  const a = num(prefix+"Atk");
  const d = num(prefix+"Def");
  const l = num(prefix+"Leth");
  const h = num(prefix+"Hp");
  // treat "complete" as any non-zero across all four
  return a>0 && d>0 && l>0 && h>0;
}

function typeScore(prefix){
  const a = num(prefix+"Atk");
  const d = num(prefix+"Def");
  const l = num(prefix+"Leth");
  const h = num(prefix+"Hp");
  // simple: average of four main combat stats
  return (a + d + l + h) / 4;
}

function detectFocusFromTypes(){
  const candidates = [];

  if(hasCompleteType("i")) candidates.push({ name:"Infantry", key:"inf", score:typeScore("i") });
  if(hasCompleteType("l")) candidates.push({ name:"Lancer", key:"lan", score:typeScore("l") });
  if(hasCompleteType("m")) candidates.push({ name:"Marksman", key:"mm", score:typeScore("m") });

  if(!candidates.length) return null;

  candidates.sort((a,b)=> b.score - a.score);
  return candidates[0];
}

function detectFocusFallbackGlobal(){
  // fallback if troop types not provided:
  // pick focus based on the strongest global stat bucket (not perfect, but deterministic).
  const g = {
    atk: num("gAtk"),
    def: num("gDef"),
    leth: num("gLeth"),
    hp: num("gHp"),
  };
  const entries = Object.entries(g).sort((a,b)=> b[1]-a[1]);
  return { name:"Global", key:"global", score: entries[0][1], strongestStat: entries[0][0] };
}

function compute(){
  // Required global
  const global = {
    atk: num("gAtk"),
    def: num("gDef"),
    leth: num("gLeth"),
    hp: num("gHp"),
  };

  // Basic validation
  const ok = global.atk>0 && global.def>0 && global.leth>0 && global.hp>0;
  if(!ok){
    alert(state.lang === "ar"
      ? "أدخل القيم الأربعة لمؤشرات Troops (الهجوم/الدفاع/الفتك/الصحة)."
      : "Enter all 4 Global Troops values (Attack/Defense/Lethality/Health).");
    return;
  }

  const focusType = detectFocusFromTypes();
  const focus = focusType
    ? { focus: focusType.name, focusKey: focusType.key, focusScore: focusType.score, source:"troopTypes" }
    : { focus: "Auto", focusKey:"auto", focusScore: null, source:"globalFallback", ...detectFocusFallbackGlobal() };

  const flags = {
    petSkillActive: !!$("petSkillActive").checked,
    foundryExpertActive: !!$("foundryExpertActive").checked,
    svsExpertActive: !!$("svsExpertActive").checked,
    romulusAlwaysOn: !!$("romulusAlwaysOn").checked,
  };

  const troopTypes = {
    infantry: hasCompleteType("i") ? { atk:num("iAtk"), def:num("iDef"), leth:num("iLeth"), hp:num("iHp") } : null,
    lancer:   hasCompleteType("l") ? { atk:num("lAtk"), def:num("lDef"), leth:num("lLeth"), hp:num("lHp") } : null,
    marksman: hasCompleteType("m") ? { atk:num("mAtk"), def:num("mDef"), leth:num("mLeth"), hp:num("mHp") } : null,
  };

  const profile = {
    mode: "solo",
    lang: state.lang,
    baseline: { troops: global },
    troopTypes,
    flags,
    detected: focus,
    notes: {
      meaning: "Baseline % are from report/stat screen. Conditional buffs are toggles only (no math yet).",
      next: "Next step: pack -> delta -> predicted new report %."
    }
  };

  $("focusOut").textContent = focus.focusType ? focus.focusType : focus.focus;
  $("sourceOut").textContent = focus.source === "troopTypes"
    ? (state.lang === "ar" ? "من Troop Types" : "From Troop Types")
    : (state.lang === "ar" ? "Fallback (Global)" : "Fallback (Global)");

  $("jsonOut").textContent = JSON.stringify(profile, null, 2);
  location.hash = "#calc";
}

function bindTabs(){
  const btns = document.querySelectorAll(".tabBtn");
  btns.forEach(b=>{
    b.addEventListener("click", ()=>{
      btns.forEach(x=> x.classList.remove("tabActive"));
      b.classList.add("tabActive");

      const tab = b.getAttribute("data-tab");
      ["inf","lan","mm"].forEach(t=>{
        const el = document.getElementById("tab_"+t);
        if(!el) return;
        el.classList.toggle("hidden", t !== tab);
      });
    });
  });
}

async function init(){
  I18N = await loadJson("data/i18n.json");
  const saved = localStorage.getItem("mohmd_lang");
  if(saved === "ar" || saved === "en") state.lang = saved;

  $("langBtn").addEventListener("click", ()=>{
    state.lang = state.lang === "en" ? "ar" : "en";
    localStorage.setItem("mohmd_lang", state.lang);
    applyLang();
  });

  $("calcBtn").addEventListener("click", compute);

  bindTabs();
  applyLang();
}

init().catch(err=>{
  console.error(err);
  alert("Failed to load app data. Check console.");
});
