/* ============================================================
   Finn — Combat Tracker · app.js
   Plain JS, no dependencies. State persists in localStorage.
   ============================================================ */

"use strict";

/* ---------------- Character constants ---------------- */

const MAX_HP = 89;
const RAGE_MAX = 4;
const RAGE_GRACE_MS = 20000; // toggling Rage back on within this window doesn't spend a use
const SLOT_MAX = { 1: 4, 2: 2 };
const HIT_DICE_MAX = 7;
const STORAGE_KEY = "finn-tracker-v1";

const SPELLS = [
  {
    id: "guidance", name: "Guidance", level: 0, tag: "Cantrip",
    meta: "Action · Touch",
    desc: "Action, touch. Target adds 1d4 to one ability check within the next minute. No attack roll or save."
  },
  {
    id: "produce-flame", name: "Produce Flame", level: 0, tag: "Cantrip",
    meta: "Action · 30 ft / Self · +5 to hit",
    desc: "Action, range 30ft/self. Spell attack +5, deals 1d8 Fire damage. Also functions as a 10-min light source."
  },
  {
    id: "cure-wounds", name: "Cure Wounds", level: 1, tag: "1st",
    meta: "Action · Touch · Heals 2d8+2",
    desc: "Action, touch. Heals 2d8+2 (or 3d8+2 if cast with a 2nd-level slot).",
    upcastable: true
  },
  {
    id: "jump", name: "Jump", level: 1, tag: "1st",
    meta: "Action · Touch · 1 min",
    desc: "Action, touch. Triples the target's jump distance for 1 minute."
  },
  {
    id: "speak-with-animals", name: "Speak with Animals", level: 1, tag: "1st · Ritual",
    meta: "Action · Self · 10 min",
    desc: "Action, self. Understand and communicate with beasts for 10 minutes.",
    ritual: true
  },
  {
    id: "enlarge", name: "Enlarge", level: 2, tag: "2nd · Conc.",
    meta: "Bonus Action · 30 ft · 1 min",
    desc: "Bonus Action, range 30ft. Target becomes Large; Str-based weapon/unarmed hits deal +1d4 damage; Advantage on Str checks. Lasts 1 minute.",
    concentration: true
  },
  {
    id: "flaming-sphere", name: "Flaming Sphere", level: 2, tag: "2nd · Conc.",
    meta: "Action · 60 ft · DC 13",
    desc: "Action, range 60ft. Conjures a 5ft fireball. On cast or when rammed into a creature (Bonus Action, move 30ft): Dex save DC 13 or 2d6 Fire damage (half on success).",
    concentration: true
  }
];

const FEATURES = [
  { id: "embrace", name: "Brother's Embrace", meta: "Reaction · 1/Long Rest · Resistance to all damage until start of next turn" },
  { id: "retaliation", name: "Brother's Retaliation", meta: "Bonus Action · 1/Long Rest · Weapon attacks deal +1d4 Force for 1 minute" },
  { id: "inspiration", name: "Heroic Inspiration", meta: "1/Long Rest · Reroll any d20, must keep the new result" }
];

const STATUSES = [
  { id: "poisoned", name: "Poisoned", effect: "Disadvantage on attack rolls and ability checks." },
  { id: "prone", name: "Prone", effect: "Disadvantage on your attacks; melee attacks against you have Advantage, ranged have Disadvantage. Costs half speed to stand." },
  { id: "restrained", name: "Restrained", effect: "Speed 0. Attacks against you have Advantage, yours have Disadvantage. Disadvantage on Dex saves." },
  { id: "grappled", name: "Grappled", effect: "Speed 0. Disadvantage on attacks against anyone other than the grappler." },
  { id: "frightened", name: "Frightened", effect: "Disadvantage on attacks and ability checks while the source is in sight. Can't willingly move closer to it." },
  { id: "stunned", name: "Stunned", effect: "Incapacitated. Auto-fail Str and Dex saves. Attacks against you have Advantage." }
];

const ABILITIES = [
  { name: "Str", score: 19, mod: 4, save: 7, prof: true },
  { name: "Dex", score: 10, mod: 0, save: 0, prof: false },
  { name: "Con", score: 16, mod: 3, save: 6, prof: true },
  { name: "Int", score: 8, mod: -1, save: -1, prof: false },
  { name: "Wis", score: 14, mod: 2, save: 2, prof: false },
  { name: "Cha", score: 8, mod: -1, save: -1, prof: false }
];

const WEAPONS = [
  { name: "Quinn and Brynn (Greataxe +1)", toHit: 8, dmg: { n: 1, d: 12, bonus: 8 }, rageBonus: 10, notes: "Heavy, Two-Handed · Cleave mastery" },
  { name: "Handaxe (thrown)", toHit: 7, dmg: { n: 1, d: 6, bonus: 4 }, rageBonus: 6, notes: "Light, Thrown 20/60 · Vex mastery" },
  { name: "Javelin (thrown)", toHit: 7, dmg: { n: 1, d: 6, bonus: 4 }, rageBonus: 6, notes: "Thrown 30/120 · Slow mastery" }
];

const CLASS_FEATURES = [
  ["Rage (4/Long Rest)", "Bonus Action. Resistance to Bludgeoning, Piercing, and Slashing damage; +2 damage on Str-based attacks; Advantage on Str checks and saves. Can't concentrate on or cast spells. Lasts 1 minute — extend it by attacking, taking damage, or using a Bonus Action."],
  ["Unarmored Defense", "While not wearing armor, AC = 10 + Dex + Con."],
  ["Reckless Attack", "When you make your first attack on your turn, gain Advantage on Str-based attack rolls this turn — but attacks against you have Advantage until your next turn."],
  ["Weapon Mastery", "Cleave (Greataxe): on a hit, make one extra attack vs a second creature within 5 ft of the first; on a hit it takes damage without your ability modifier. Vex (Handaxe): on a hit, Advantage on your next attack vs that target. Slow (Javelin): on a hit, reduce the target's speed by 10 ft until your next turn."],
  ["Primal Knowledge", "While raging, you can use Strength for Acrobatics, Intimidation, Perception, Stealth, and Survival checks."],
  ["Extra Attack", "Attack twice, instead of once, when you take the Attack action."],
  ["Fast Movement", "+10 ft speed while not in heavy armor (already in your 40 ft)."],
  ["Feral Instinct", "Advantage on Initiative rolls."],
  ["Instinctive Pounce", "When you enter your Rage, move up to half your speed as part of that Bonus Action."],
  ["Nature's Mantle", "Primal Shaman (homebrew) — send Claude the full text to fill this in."],
  ["Elemental Wrath", "Primal Shaman (homebrew) — send Claude the full text to fill this in."]
];

const FEATS = [
  ["Great Weapon Master", "+1 Str. Once per turn, add your Proficiency Bonus (+3) to damage with a Heavy weapon. When you score a critical hit or reduce a creature to 0 HP with a melee weapon, you can make one attack as a Bonus Action."],
  ["Tough", "+2 HP per level (+14, included in your 89 max)."],
  ["Savage Attacker", "Once per turn when you hit with a weapon, roll the damage dice twice and use either result."]
];

/* ---------------- State ---------------- */

const defaultState = () => ({
  hp: MAX_HP,
  tempHp: 0,
  raging: false,
  rageUses: RAGE_MAX,
  rageOver: 0,           // times raged past the limit since last Long Rest
  rageGraceUntil: 0,     // timestamp: re-toggling before this is free
  slots: { 1: SLOT_MAX[1], 2: SLOT_MAX[2] },
  concentration: null,   // spell id or null
  features: { embrace: true, retaliation: true, inspiration: true },
  savage: true,
  statuses: {},          // id -> true
  exhaustion: 0,
  round: 1,
  hitDice: HIT_DICE_MAX,
  log: []
});

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed, {
      slots: Object.assign({ 1: SLOT_MAX[1], 2: SLOT_MAX[2] }, parsed.slots || {}),
      features: Object.assign({ embrace: true, retaliation: true, inspiration: true }, parsed.features || {}),
      statuses: parsed.statuses || {}
    });
  } catch (e) {
    return defaultState();
  }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) { /* storage full/blocked — keep running in memory */ }
}

/* ---------------- Helpers ---------------- */

const $ = (id) => document.getElementById(id);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rollDie = (sides) => 1 + Math.floor(Math.random() * sides);

function addLog(text) {
  S.log.unshift({ t: Date.now(), text });
  if (S.log.length > 120) S.log.length = 120;
  renderLog();
}

let toastTimer = null;
function toast(msg, ms = 2400) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

let rollTimer = null;
function showRoll(total, detail, cls = "") {
  const box = $("roll-toast");
  const totalEl = $("roll-total");
  totalEl.textContent = total;
  totalEl.className = "roll-total " + cls;
  $("roll-detail").textContent = detail;
  box.classList.remove("hidden");
  clearTimeout(rollTimer);
  rollTimer = setTimeout(() => box.classList.add("hidden"), 2600);
}

/* ---------------- Modal ---------------- */

function openModal(title, bodyHTML, actions = []) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHTML;
  const act = $("modal-actions");
  act.innerHTML = "";
  actions.forEach(({ label, cls, onTap }) => {
    const b = document.createElement("button");
    b.className = "btn " + (cls || "");
    b.textContent = label;
    b.addEventListener("click", () => { onTap(); });
    act.appendChild(b);
  });
  $("modal-backdrop").classList.remove("hidden");
}
function closeModal() { $("modal-backdrop").classList.add("hidden"); }

$("modal-close").addEventListener("click", closeModal);
$("modal-backdrop").addEventListener("click", (e) => {
  if (e.target === $("modal-backdrop")) closeModal();
});

/* ---------------- HP ---------------- */

function readAmount() {
  const v = parseInt($("hp-input").value, 10);
  return Number.isFinite(v) && v > 0 ? v : null;
}
function clearAmount() { $("hp-input").value = ""; $("hp-input").blur(); }

function applyDamage(n) {
  let remaining = n;
  let absorbed = 0;
  if (S.tempHp > 0) {
    absorbed = Math.min(S.tempHp, remaining);
    S.tempHp -= absorbed;
    remaining -= absorbed;
  }
  S.hp = clamp(S.hp - remaining, 0, MAX_HP);
  addLog(`Took ${n} damage${absorbed ? ` (${absorbed} absorbed by Temp HP)` : ""} → ${S.hp} HP`);
  if (S.hp === 0) toast("Down! Death saves at the start of your turns.");
  else if (S.concentration && remaining > 0) {
    const dc = Math.max(10, Math.floor(remaining / 2));
    toast(`Concentration check: Con save DC ${dc}`);
  }
  save(); renderHP();
}

function applyHeal(n) {
  const before = S.hp;
  S.hp = clamp(S.hp + n, 0, MAX_HP);
  addLog(`Healed ${S.hp - before} → ${S.hp} HP`);
  save(); renderHP();
}

function setTemp(n) {
  if (S.tempHp > 0 && n <= S.tempHp) {
    toast(`Kept existing ${S.tempHp} Temp HP (new value wasn't higher)`);
    return;
  }
  S.tempHp = n;
  addLog(`Gained ${n} Temp HP`);
  save(); renderHP();
}

$("btn-damage").addEventListener("click", () => {
  const n = readAmount();
  if (n === null) { toast("Type an amount first"); return; }
  applyDamage(n); clearAmount();
});
$("btn-heal").addEventListener("click", () => {
  const n = readAmount();
  if (n === null) { toast("Type an amount first"); return; }
  applyHeal(n); clearAmount();
});
$("btn-temp").addEventListener("click", () => {
  const n = readAmount();
  if (n === null) { toast("Type an amount first"); return; }
  setTemp(n); clearAmount();
});
$("temp-chip").addEventListener("click", () => {
  if (S.tempHp === 0) { toast("Type an amount, then tap Temp"); return; }
  openModal("Temp HP", `<p>You have <strong>${S.tempHp}</strong> temporary hit points. They absorb damage first and don't stack — a new source replaces them only if it grants more.</p>`, [
    { label: "Clear Temp HP", cls: "btn-damage", onTap: () => { S.tempHp = 0; addLog("Temp HP cleared"); save(); renderHP(); closeModal(); } },
    { label: "Keep", onTap: closeModal }
  ]);
});

function renderHP() {
  $("hp-current").textContent = S.hp;
  $("temp-value").textContent = S.tempHp;
  $("temp-chip").classList.toggle("has-temp", S.tempHp > 0);

  const pct = (S.hp / MAX_HP) * 100;
  $("hp-bar-fill").style.width = pct + "%";
  const tempPct = clamp((S.tempHp / MAX_HP) * 100, 0, 100);
  $("hp-bar-temp").style.width = tempPct + "%";

  const card = document.querySelector(".hp-card");
  card.classList.toggle("hp-low", pct <= 25);
  card.classList.toggle("hp-mid", pct > 25 && pct <= 50);
}

/* ---------------- Rage ---------------- */

function renderRage() {
  document.body.classList.toggle("raging", S.raging);
  $("ac-value").textContent = S.raging ? 16 : 14;
  $("rage-toggle").setAttribute("aria-pressed", String(S.raging));
  $("rage-state").textContent = S.raging ? "Tap to end" : "Tap to enter";
  updateWeaponDamageChips();

  const label = $("rage-uses-label");
  if (S.rageUses === 0) {
    label.textContent = S.rageOver > 0 ? `0 left — over by ${S.rageOver}` : "0 / 4 — none left";
    label.classList.add("depleted");
  } else {
    label.textContent = `${S.rageUses} / ${RAGE_MAX} uses`;
    label.classList.remove("depleted");
  }

  const pips = $("rage-pips");
  pips.innerHTML = "";
  pips.classList.toggle("depleted", S.rageUses === 0);
  for (let i = 0; i < RAGE_MAX; i++) {
    const p = document.createElement("button");
    p.className = "pip" + (i < S.rageUses ? " full" : "");
    p.setAttribute("aria-label", `Rage use ${i + 1}`);
    p.addEventListener("click", () => {
      // manual adjust: tap a filled pip to spend, an empty one to restore
      S.rageUses = (i < S.rageUses) ? i : i + 1;
      if (S.rageUses > 0) S.rageOver = 0;
      save(); renderRage();
    });
    pips.appendChild(p);
  }
}

$("rage-toggle").addEventListener("click", () => {
  if (S.raging) {
    S.raging = false;
    S.rageGraceUntil = Date.now() + RAGE_GRACE_MS;
    addLog("Rage ended");
    toast("Rage ended — tap again within 20s to resume without spending a use");
  } else {
    const free = Date.now() < S.rageGraceUntil;
    if (free) {
      S.raging = true;
      addLog("Rage resumed");
      toast("Rage resumed — no use spent");
    } else {
      S.raging = true;
      if (S.rageUses > 0) {
        S.rageUses -= 1;
        addLog(`Rage! (${S.rageUses} use${S.rageUses === 1 ? "" : "s"} left)`);
      } else {
        S.rageOver += 1;
        addLog("Rage! — past your 4/Long Rest limit");
        toast("That's past your 4 rages — DM's call");
      }
    }
    S.rageGraceUntil = 0;
  }
  save(); renderRage();
});

/* ---------------- Spell slots ---------------- */

function renderSlots() {
  [1, 2].forEach((lvl) => {
    const el = $("slots-" + lvl);
    el.innerHTML = "";
    for (let i = 0; i < SLOT_MAX[lvl]; i++) {
      const p = document.createElement("button");
      p.className = "pip" + (i < S.slots[lvl] ? " full" : "");
      p.setAttribute("aria-label", `Level ${lvl} slot ${i + 1}`);
      p.addEventListener("click", () => {
        S.slots[lvl] = (i < S.slots[lvl]) ? i : i + 1;
        save(); renderSlots();
      });
      el.appendChild(p);
    }
  });
}

function spendSlot(lvl) {
  if (S.slots[lvl] > 0) { S.slots[lvl] -= 1; renderSlots(); return true; }
  return false;
}

/* ---------------- Spells ---------------- */

function spellById(id) { return SPELLS.find((s) => s.id === id); }

function setConcentration(id) {
  if (S.concentration && S.concentration !== id) {
    const old = spellById(S.concentration);
    toast(`${old.name} ended (Concentration)`);
    addLog(`${old.name} ended — new concentration`);
  }
  S.concentration = id;
  renderConcentration();
}

function dropConcentration(silent) {
  if (!S.concentration) return;
  const sp = spellById(S.concentration);
  if (!silent) { addLog(`Dropped concentration on ${sp.name}`); }
  S.concentration = null;
  save(); renderConcentration(); renderSpells();
}
$("conc-drop").addEventListener("click", () => dropConcentration(false));

function renderConcentration() {
  const chip = $("conc-chip");
  if (S.concentration) {
    $("conc-name").textContent = spellById(S.concentration).name;
    chip.classList.remove("hidden");
  } else {
    chip.classList.add("hidden");
  }
}

function castSpell(sp, slotLvl) {
  if (!spendSlot(slotLvl)) {
    toast(`No ${slotLvl === 1 ? "1st" : "2nd"}-level slots left — tap a slot pip to adjust manually if needed`);
    return;
  }
  if (sp.concentration) setConcentration(sp.id);
  const upcastNote = slotLvl > sp.level ? ` (upcast, ${slotLvl}nd-level slot)` : "";
  addLog(`Cast ${sp.name}${upcastNote}`);
  if (sp.id === "cure-wounds") {
    const dice = slotLvl >= 2 ? 3 : 2;
    let total = 2;
    const rolls = [];
    for (let i = 0; i < dice; i++) { const r = rollDie(8); rolls.push(r); total += r; }
    showRoll(total, `Cure Wounds · ${dice}d8+2 → [${rolls.join(", ")}] + 2 — tap Heal amount to apply`);
    $("hp-input").value = total;
  }
  save(); renderSpells();
}

function onCastTap(sp) {
  if (sp.level === 0) {
    addLog(`Used ${sp.name}`);
    if (sp.id === "produce-flame") {
      toast("Produce Flame — spell attack +5, 1d8 Fire");
    } else {
      toast(`${sp.name} — no slot needed`);
    }
    return;
  }
  if (sp.concentration && S.concentration === sp.id) {
    dropConcentration(false);
    toast(`${sp.name} ended`);
    return;
  }
  if (sp.upcastable && S.slots[2] > 0 && S.slots[1] > 0) {
    openModal(sp.name, `<p class="spell-props">Choose a slot</p><p>${sp.desc}</p>`, [
      { label: "1st — 2d8+2", cls: "btn-heal", onTap: () => { closeModal(); castSpell(sp, 1); } },
      { label: "2nd — 3d8+2", cls: "btn-heal", onTap: () => { closeModal(); castSpell(sp, 2); } },
      { label: "Cancel", onTap: closeModal }
    ]);
    return;
  }
  if (sp.upcastable && S.slots[1] === 0 && S.slots[2] > 0) { castSpell(sp, 2); return; }
  castSpell(sp, sp.level);
}

function renderSpells() {
  const list = $("spell-list");
  list.innerHTML = "";
  SPELLS.forEach((sp) => {
    const row = document.createElement("div");
    row.className = "spell-row";

    const info = document.createElement("button");
    info.className = "spell-info";
    info.innerHTML = `<span class="spell-name">${sp.name}<span class="spell-tag">${sp.tag}</span></span><span class="spell-meta">${sp.meta}</span>`;
    info.addEventListener("click", () => {
      openModal(sp.name, `<p class="spell-props">${sp.tag} · ${sp.meta}</p><p>${sp.desc}</p>`, [
        { label: "Close", onTap: closeModal }
      ]);
    });

    const cast = document.createElement("button");
    const isActiveConc = sp.concentration && S.concentration === sp.id;
    cast.className = "cast-btn" + (sp.level === 0 ? " cantrip" : "") + (isActiveConc ? " active-conc" : "");
    cast.textContent = sp.level === 0 ? "Use" : (isActiveConc ? "End" : "Cast");
    cast.addEventListener("click", () => onCastTap(sp));

    row.appendChild(info);
    row.appendChild(cast);
    list.appendChild(row);
  });
  renderConcentration();
}

/* ---------------- Features / resources ---------------- */

function renderFeatures() {
  const list = $("feature-list");
  list.innerHTML = "";
  FEATURES.forEach((f) => {
    const b = document.createElement("button");
    b.className = "feature-row" + (S.features[f.id] ? "" : " used");
    b.innerHTML = `<span class="feature-name">${f.name}</span><span class="feature-meta">${f.meta}</span>`;
    b.addEventListener("click", () => {
      S.features[f.id] = !S.features[f.id];
      addLog(S.features[f.id] ? `${f.name} restored` : `Used ${f.name}`);
      save(); renderFeatures();
    });
    list.appendChild(b);
  });
  $("savage-btn").className = "feature-row per-turn" + (S.savage ? "" : " used");
}

$("savage-btn").addEventListener("click", () => {
  S.savage = !S.savage;
  addLog(S.savage ? "Savage Attacker reset" : "Used Savage Attacker");
  save(); renderFeatures();
});

/* ---------------- Statuses ---------------- */

function renderStatuses() {
  const bar = $("status-bar");
  bar.innerHTML = "";

  STATUSES.forEach((st) => {
    const on = !!S.statuses[st.id];
    const chip = document.createElement("button");
    chip.className = "status-chip" + (on ? " on" : "");
    chip.textContent = st.name;
    chip.addEventListener("click", () => {
      if (on) {
        openModal(st.name, `<p>${st.effect}</p>`, [
          { label: "Remove condition", cls: "btn-heal", onTap: () => { delete S.statuses[st.id]; addLog(`${st.name} removed`); save(); renderStatuses(); closeModal(); } },
          { label: "Keep", onTap: closeModal }
        ]);
      } else {
        S.statuses[st.id] = true;
        addLog(`${st.name} applied`);
        toast(`${st.name}: ${st.effect}`, 3400);
        save(); renderStatuses();
      }
    });
    bar.appendChild(chip);
  });

  // Exhaustion (levels 1–6)
  const ex = document.createElement("button");
  ex.className = "status-chip" + (S.exhaustion > 0 ? " on" : "");
  ex.innerHTML = S.exhaustion > 0
    ? `Exhaustion <span class="exh-level">${S.exhaustion}</span>`
    : "Exhaustion";
  ex.addEventListener("click", () => {
    const lvl = S.exhaustion;
    const effect = lvl > 0
      ? `Level ${lvl}: −${lvl * 2} to all d20 Tests, −${lvl * 5} ft Speed. Death at level 6.`
      : "Each level: −2 to all d20 Tests and −5 ft Speed (cumulative). Death at level 6.";
    openModal("Exhaustion", `<p>${effect}</p>`, [
      { label: "− Level", onTap: () => { S.exhaustion = clamp(S.exhaustion - 1, 0, 6); addLog(`Exhaustion → ${S.exhaustion}`); save(); renderStatuses(); closeModal(); } },
      { label: "+ Level", cls: "btn-damage", onTap: () => { S.exhaustion = clamp(S.exhaustion + 1, 0, 6); addLog(`Exhaustion → ${S.exhaustion}`); save(); renderStatuses(); closeModal(); if (S.exhaustion === 6) toast("Exhaustion 6 — Finn dies. Hoping this is hypothetical."); } },
      { label: "Close", onTap: closeModal }
    ]);
  });
  bar.appendChild(ex);
}

/* ---------------- Round counter / turns ---------------- */

function renderRound() { $("round-num").textContent = S.round; }

$("round-plus").addEventListener("click", () => { S.round += 1; save(); renderRound(); });
$("round-minus").addEventListener("click", () => { S.round = Math.max(1, S.round - 1); save(); renderRound(); });

$("btn-next-turn").addEventListener("click", () => {
  S.savage = true;
  S.round += 1;
  addLog(`— Round ${S.round} —`);
  save(); renderFeatures(); renderRound();
  toast("New turn — Savage Attacker is back");
});

/* ---------------- Rests ---------------- */

$("btn-long-rest").addEventListener("click", () => {
  openModal("Long Rest", "<p>Restore HP to 89, clear Temp HP, refill Rage uses and spell slots, restore Brother's Embrace, Brother's Retaliation, and Heroic Inspiration, regain up to 3 Hit Dice, clear conditions, and end Rage.</p>", [
    { label: "Rest", cls: "btn-heal", onTap: () => { doLongRest(); closeModal(); } },
    { label: "Cancel", onTap: closeModal }
  ]);
});

function doLongRest() {
  S.hp = MAX_HP;
  S.tempHp = 0;
  S.raging = false;
  S.rageUses = RAGE_MAX;
  S.rageOver = 0;
  S.rageGraceUntil = 0;
  S.slots = { 1: SLOT_MAX[1], 2: SLOT_MAX[2] };
  S.concentration = null;
  S.features = { embrace: true, retaliation: true, inspiration: true };
  S.savage = true;
  S.statuses = {};
  S.round = 1;
  S.hitDice = Math.min(HIT_DICE_MAX, S.hitDice + 3);
  addLog("Long Rest — everything restored");
  save(); renderAll();
  toast("Long Rest complete");
}

$("btn-short-rest").addEventListener("click", openShortRest);

function openShortRest() {
  const body = `<p>Spend Hit Dice to heal <strong>1d12+3</strong> each.</p><p class="spell-props">${S.hitDice} of ${HIT_DICE_MAX} Hit Dice remaining</p>`;
  const actions = [];
  if (S.hitDice > 0) {
    actions.push({
      label: "Spend 1d12 + 3", cls: "btn-heal", onTap: () => {
        const r = rollDie(12);
        const healed = r + 3;
        S.hitDice -= 1;
        applyHeal(healed);
        addLog(`Hit Die spent: rolled ${r} + 3 → healed ${healed} (${S.hitDice} dice left)`);
        showRoll(healed, `1d12+3 → [${r}] + 3 healed`);
        save();
        closeModal();
        setTimeout(openShortRest, 350); // reopen so you can chain dice
      }
    });
  }
  actions.push({ label: "Done", onTap: closeModal });
  openModal("Short Rest", body, actions);
}

/* ---------------- Log ---------------- */

function renderLog() {
  const list = $("log-list");
  list.innerHTML = "";
  if (S.log.length === 0) {
    list.innerHTML = `<li class="log-empty">Nothing yet — your fight will show up here.</li>`;
    return;
  }
  S.log.forEach((entry) => {
    const li = document.createElement("li");
    const d = new Date(entry.t);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    li.innerHTML = `<span class="log-time">${hh}:${mm}</span><span>${entry.text}</span>`;
    list.appendChild(li);
  });
}

$("btn-log").addEventListener("click", () => $("log-drawer").classList.toggle("hidden"));
$("log-close").addEventListener("click", () => $("log-drawer").classList.add("hidden"));
$("log-clear").addEventListener("click", () => { S.log = []; save(); renderLog(); });

/* ---------------- More / Reference view ---------------- */

$("more-btn").addEventListener("click", () => {
  $("view-main").classList.add("hidden");
  $("view-more").classList.remove("hidden");
});
$("back-btn").addEventListener("click", () => {
  $("view-more").classList.add("hidden");
  $("view-main").classList.remove("hidden");
});

function fmtMod(n) { return (n >= 0 ? "+" : "−") + Math.abs(n); }

function renderReference() {
  const grid = $("ability-grid");
  grid.innerHTML = "";
  ABILITIES.forEach((a) => {
    const cell = document.createElement("div");
    cell.className = "ability-cell" + (a.prof ? " prof-save" : "");
    cell.innerHTML = `<div class="ab-name">${a.name}</div><div class="ab-mod">${fmtMod(a.mod)}</div><div class="ab-score">${a.score}</div><div class="ab-save">Save ${fmtMod(a.save)}</div>`;
    grid.appendChild(cell);
  });

  const wl = $("weapon-list");
  wl.innerHTML = "";
  WEAPONS.forEach((w) => {
    const row = document.createElement("div");
    row.className = "weapon-row";

    const name = document.createElement("span");
    name.className = "weapon-name";
    name.textContent = w.name;

    const hit = document.createElement("button");
    hit.className = "roll-chip";
    hit.innerHTML = `<span class="chip-label">To hit</span>+${w.toHit}`;
    hit.addEventListener("click", () => {
      const d = rollDie(20);
      const total = d + w.toHit;
      const cls = d === 20 ? "crit" : d === 1 ? "fumble" : "";
      const note = d === 20 ? " — CRIT!" : d === 1 ? " — natural 1" : "";
      showRoll(total, `d20 [${d}] + ${w.toHit}${note}`, cls);
      addLog(`Attack (${w.name.split(" (")[0]}): rolled ${total}${note}`);
    });

    const dmg = document.createElement("button");
    dmg.className = "roll-chip";
    dmg.addEventListener("click", () => {
      const bonus = S.raging ? w.rageBonus : w.dmg.bonus;
      const rolls = [];
      let total = bonus;
      for (let i = 0; i < w.dmg.n; i++) { const r = rollDie(w.dmg.d); rolls.push(r); total += r; }
      showRoll(total, `${w.dmg.n}d${w.dmg.d} [${rolls.join(", ")}] + ${bonus}${S.raging ? " (raging)" : ""}`);
      addLog(`Damage (${w.name.split(" (")[0]}): ${total}${S.raging ? " (raging)" : ""}`);
    });

    const notes = document.createElement("span");
    notes.className = "weapon-notes";
    notes.textContent = w.notes;

    row.appendChild(name);
    row.appendChild(hit);
    row.appendChild(dmg);
    row.appendChild(notes);
    wl.appendChild(row);

    w._dmgChip = dmg;
  });
  updateWeaponDamageChips();

  const fr = $("feature-ref");
  fr.innerHTML = "";
  CLASS_FEATURES.forEach(([name, text]) => {
    fr.innerHTML += `<dt>${name}</dt><dd>${text}</dd>`;
  });

  const ft = $("feat-ref");
  ft.innerHTML = "";
  FEATS.forEach(([name, text]) => {
    ft.innerHTML += `<dt>${name}</dt><dd>${text}</dd>`;
  });
}

function updateWeaponDamageChips() {
  WEAPONS.forEach((w) => {
    if (!w._dmgChip) return;
    const bonus = S.raging ? w.rageBonus : w.dmg.bonus;
    w._dmgChip.innerHTML = `<span class="chip-label">Damage</span>${w.dmg.n}d${w.dmg.d}+${bonus}`;
  });
  $("weapon-rage-note").textContent = S.raging
    ? "Raging: +2 rage damage is included in the damage values above."
    : "Damage shown without Rage. Toggle Rage on the main screen and these update.";
}

/* ---------------- iOS behavior guards ---------------- */

// Block pinch-zoom in standalone mode (double-tap zoom is already
// disabled by touch-action: manipulation in the CSS — no JS needed,
// and a JS guard would swallow rapid taps on pips mid-game)
document.addEventListener("gesturestart", (e) => e.preventDefault());

// Enter key in HP input = Damage (most common mid-fight action)
$("hp-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("btn-damage").click(); }
});

/* ---------------- Boot ---------------- */

function renderAll() {
  renderHP();
  renderRage();
  renderSlots();
  renderSpells();
  renderFeatures();
  renderStatuses();
  renderRound();
  renderLog();
  updateWeaponDamageChips();
}

renderReference();
renderAll();
