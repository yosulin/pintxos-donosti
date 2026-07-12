const DATA_FILES = {
  zones: "data/zones.json",
  types: "data/types.json",
  tiers: "data/tiers.json",
  bars: "data/bars.json",
};

const VISITED_KEY = "pintxos-visited";
const THEME_KEY = "pintxos-theme";

const state = {
  zoneFilter: "todos",
  typeFilter: "todos",
  sortMode: "prioridad", // "prioridad" | "cercania"
  expanded: new Set(),
  visited: new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || "[]")),
  userLoc: null,
};

let DATA = null;

/* ---------------- HELPERS ---------------- */
function mapsUrl(item){
  if (item.placeId) return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}&query_place_id=${item.placeId}`;
  if (item.search) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.search)}`;
  return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
}
function distanceKm(lat1, lng1, lat2, lng2){
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function formatDistance(km){ return km < 1 ? `${Math.round(km*1000)} m` : `${km.toFixed(1)} km`; }
function saveVisited(){ localStorage.setItem(VISITED_KEY, JSON.stringify([...state.visited])); }

function buildShareText(b, zoneLabel, typeLabel){
  const lines = [
    `${b.name}`,
    `📍 ${b.addr}`,
  ];
  if (b.hours) lines.push(`🕒 ${b.hours}`);
  if (b.tags && b.tags.length) lines.push(`🍢 ${b.tags.join(", ")}`);
  if (b.note) lines.push(`💬 ${b.note}`);
  lines.push(`${zoneLabel} · ${typeLabel}`);
  lines.push("");
  lines.push(`Mapa: ${mapsUrl(b)}`);
  return lines.join("\n");
}
function shareToWhatsapp(b, zoneLabel, typeLabel){
  const text = buildShareText(b, zoneLabel, typeLabel);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

let toastTimer = null;
function toast(msg){
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

async function loadData(){
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, url]) => [key, await (await fetch(url)).json()])
  );
  return Object.fromEntries(entries);
}

/* ---------------- STATS ---------------- */
function renderStats(){
  const { zones, bars } = DATA;
  const row = document.getElementById("stat-row");
  const stats = [
    { n: bars.length, l: "Bares" },
    { n: Object.keys(zones).length, l: "Zonas" },
    { n: `${state.visited.size}/${bars.length}`, l: "Probados" },
  ];
  row.innerHTML = stats.map(s => `<div class="stat"><span class="n">${s.n}</span><span class="l">${s.l}</span></div>`).join("");
}

/* ---------------- FILTER OPTIONS ---------------- */
function visibleBarsFor(dimension){
  return DATA.bars.filter(b => {
    const zoneOk = dimension === "zone" ? true : (state.zoneFilter === "todos" || b.zone === state.zoneFilter);
    const typeOk = dimension === "type" ? true : (state.typeFilter === "todos" || b.type === state.typeFilter);
    return zoneOk && typeOk;
  });
}
function zoneOptions(){
  const { zones } = DATA;
  const pool = visibleBarsFor("zone");
  return [
    { key:"todos", label:"Todos", count: pool.length },
    ...Object.keys(zones).map(k => ({ key:k, label:zones[k].label, count: pool.filter(b=>b.zone===k).length })),
  ];
}
function typeOptions(){
  const { types } = DATA;
  const pool = visibleBarsFor("type");
  return [
    { key:"todos", label:"Todos", count: pool.length },
    ...Object.keys(types).map(k => ({ key:k, label:`${types[k].icon} ${types[k].label}`, count: pool.filter(b=>b.type===k).length })),
  ];
}

/* ---------------- BOTTOM SHEET ---------------- */
function buildChipRow(options, activeKey, onSelect){
  const wrap = document.createElement("div");
  wrap.className = "filters";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.active = activeKey === opt.key ? "true" : "false";
    btn.innerHTML = `${opt.label} <span class="count">${opt.count}</span>`;
    btn.addEventListener("click", () => onSelect(opt.key));
    wrap.appendChild(btn);
  });
  return wrap;
}
function openSheet(kind){
  const title = document.getElementById("sheet-title");
  const body = document.getElementById("sheet-body");
  body.innerHTML = "";
  if (kind === "zone"){
    title.textContent = "Zona";
    body.appendChild(buildChipRow(zoneOptions(), state.zoneFilter, (key) => { state.zoneFilter = key; closeSheet(); render(); }));
  } else {
    title.textContent = "Tipo";
    body.appendChild(buildChipRow(typeOptions(), state.typeFilter, (key) => { state.typeFilter = key; closeSheet(); render(); }));
  }
  document.getElementById("sheet-backdrop").classList.remove("hidden");
  document.getElementById("sheet").classList.remove("hidden");
}
function closeSheet(){
  document.getElementById("sheet-backdrop").classList.add("hidden");
  document.getElementById("sheet").classList.add("hidden");
}

/* ---------------- DOCK LABELS ---------------- */
function updateDockLabels(){
  const zoneLbl = state.zoneFilter === "todos" ? "Zona" : DATA.zones[state.zoneFilter].label;
  document.getElementById("dock-zone-label").textContent = zoneLbl;
  document.getElementById("dock-zone").classList.toggle("active", state.zoneFilter !== "todos");

  const typeLbl = state.typeFilter === "todos" ? "Tipo" : DATA.types[state.typeFilter].label;
  document.getElementById("dock-type-label").textContent = typeLbl;
  document.getElementById("dock-type").classList.toggle("active", state.typeFilter !== "todos");

  document.getElementById("dock-sort-label").textContent = state.sortMode === "cercania" ? "Cerca" : "Prioridad";
  document.getElementById("dock-sort-icon").textContent = state.sortMode === "cercania" ? "📍" : "⇅";
  document.getElementById("dock-sort").classList.toggle("active", state.sortMode === "cercania");
}

/* ---------------- LIST ---------------- */
function barSortComparator(){
  return (a, b) => (state.sortMode === "cercania" && state.userLoc) ? a._dist - b._dist : b.tier - a.tier;
}

function renderList(){
  const { zones, types, tiers, bars } = DATA;
  const main = document.getElementById("main");
  main.innerHTML = "";

  if (state.userLoc){
    bars.forEach(b => { b._dist = distanceKm(state.userLoc.lat, state.userLoc.lng, b.lat, b.lng); });
  }

  Object.keys(zones).forEach((zoneKey, i) => {
    if (state.zoneFilter !== "todos" && state.zoneFilter !== zoneKey) return;
    const zoneBars = bars
      .filter(b => b.zone === zoneKey)
      .filter(b => state.typeFilter === "todos" || b.type === state.typeFilter)
      .sort(barSortComparator());
    if (!zoneBars.length) return;

    const section = document.createElement("section");
    section.style.setProperty("--zc", zones[zoneKey].color);
    section.innerHTML = `
      <div class="zone-head">
        <span class="idx">0${i+1}/</span><h2>${zones[zoneKey].label}</h2>
        <span class="zone-count mono">${zoneBars.length}</span>
      </div>
      <hr class="zone-line">
      <div class="bar-list"></div>
    `;
    const list = section.querySelector(".bar-list");
    zoneBars.forEach(b => list.appendChild(renderBar(b, zones[zoneKey].color, tiers, zones[zoneKey].label, types[b.type])));
    main.appendChild(section);
  });

  if (!main.children.length){
    main.innerHTML = `<p class="mono" style="color:var(--muted); padding-top:2rem;">Nada por aquí con estos filtros.</p>`;
  }
}

function renderBar(b, color, tiers, zoneLabel, typeInfo){
  const isExpanded = state.expanded.has(b.id);
  const isVisited = state.visited.has(b.id);
  const distText = (state.userLoc && b._dist != null) ? formatDistance(b._dist) : null;

  const el = document.createElement("article");
  el.className = "card";
  el.id = `bar-${b.id}`;
  el.style.setProperty("--zc", color);
  el.dataset.expanded = isExpanded ? "true" : "false";

  el.innerHTML = `
    <div class="card-top">
      <button class="visited-dot" data-visited="${isVisited}" aria-label="Marcar ${b.name} como visitado" aria-pressed="${isVisited}">✓</button>
      <span class="type-icon" title="${typeInfo.label}">${typeInfo.icon}</span>
      <span class="card-name">${b.name}</span>
      <span class="stamp">${tiers[b.tier]}${distText ? " · " + distText : ""}</span>
    </div>
    <div class="card-detail">
      <div class="card-meta">${b.addr}${b.hours ? " · " + b.hours : ""}</div>
      ${b.note ? `<div class="card-note">${b.note}</div>` : ""}
      <div class="tags">${b.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
      <div class="card-actions">
        <a class="maps-link" href="${mapsUrl(b)}" target="_blank" rel="noopener">Maps ↗</a>
        <button class="share-btn" type="button">WhatsApp ↗</button>
      </div>
    </div>
  `;

  el.addEventListener("click", (e) => {
    if (e.target.closest(".visited-dot") || e.target.closest(".share-btn") || e.target.closest(".maps-link")) return;
    state.expanded.has(b.id) ? state.expanded.delete(b.id) : state.expanded.add(b.id);
    el.dataset.expanded = state.expanded.has(b.id) ? "true" : "false";
  });

  el.querySelector(".visited-dot").addEventListener("click", (e) => {
    e.stopPropagation();
    state.visited.has(b.id) ? state.visited.delete(b.id) : state.visited.add(b.id);
    saveVisited();
    renderStats();
    const dot = e.currentTarget;
    const nowVisited = state.visited.has(b.id);
    dot.dataset.visited = nowVisited;
    dot.setAttribute("aria-pressed", nowVisited);
  });

  el.querySelector(".share-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    shareToWhatsapp(b, zoneLabel, typeInfo.label);
  });

  return el;
}

/* ---------------- SORT / SURPRISE ---------------- */
async function toggleSort(){
  const next = state.sortMode === "prioridad" ? "cercania" : "prioridad";
  if (next === "cercania" && !state.userLoc){
    toast("Buscando tu ubicación…");
    try {
      const pos = await getLocation();
      state.userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err){
      toast("No se pudo obtener tu ubicación");
      return;
    }
  }
  state.sortMode = next;
  render();
}

function getLocation(){
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
  });
}

function surpriseMe(){
  const pool = DATA.bars.filter(b =>
    b.tier === 3 &&
    (state.zoneFilter === "todos" || b.zone === state.zoneFilter) &&
    (state.typeFilter === "todos" || b.type === state.typeFilter)
  );
  if (!pool.length){ toast("No hay imprescindibles con estos filtros"); return; }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (state.zoneFilter !== "todos" && state.zoneFilter !== pick.zone) state.zoneFilter = pick.zone;
  state.expanded.add(pick.id);
  render();
  requestAnimationFrame(() => {
    const el = document.getElementById(`bar-${pick.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1200);
  });
}

/* ---------------- DEEP LINK ---------------- */
function openDeepLink(){
  const hash = location.hash.replace("#bar-", "");
  if (!hash) return;
  const bar = DATA.bars.find(b => b.id === hash);
  if (!bar) return;
  state.zoneFilter = "todos";
  state.typeFilter = "todos";
  state.expanded.add(bar.id);
}
function scrollToDeepLink(){
  const hash = location.hash.replace("#bar-", "");
  if (!hash) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(`bar-${hash}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ---------------- THEME ---------------- */
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (preferDark ? "dark" : "light"));
}
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  document.getElementById("dock-theme-icon").textContent = theme === "dark" ? "☀" : "☾";
}
function toggleTheme(){
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

/* ---------------- INSTALL PROMPT ---------------- */
const INSTALL_DISMISSED_KEY = "pintxos-install-dismissed";
let deferredInstallPrompt = null;
function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function initInstallBanner(){
  const banner = document.getElementById("install-banner");
  const btn = document.getElementById("install-btn");
  const dismiss = document.getElementById("install-dismiss");
  const text = document.getElementById("install-text");
  if (isStandalone() || localStorage.getItem(INSTALL_DISMISSED_KEY) === "true") return;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  dismiss.addEventListener("click", () => {
    banner.classList.add("hidden");
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  });

  if (isIOS){
    text.textContent = "Instala esta guía en tu iPhone: toca compartir ⬆️ y luego \"Añadir a pantalla de inicio\".";
    banner.classList.remove("hidden");
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btn.classList.remove("hidden");
    banner.classList.remove("hidden");
  });
  btn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    banner.classList.add("hidden");
  });
  window.addEventListener("appinstalled", () => {
    banner.classList.add("hidden");
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  });
}

/* ---------------- DOCK WIRING ---------------- */
function initDock(){
  document.getElementById("dock-zone").addEventListener("click", () => openSheet("zone"));
  document.getElementById("dock-type").addEventListener("click", () => openSheet("type"));
  document.getElementById("dock-sort").addEventListener("click", toggleSort);
  document.getElementById("dock-surprise").addEventListener("click", surpriseMe);
  document.getElementById("dock-theme").addEventListener("click", toggleTheme);
  document.getElementById("sheet-close").addEventListener("click", closeSheet);
  document.getElementById("sheet-backdrop").addEventListener("click", closeSheet);
}

/* ---------------- RENDER ---------------- */
function render(){
  renderStats();
  updateDockLabels();
  renderList();
}

(async function init(){
  initTheme();
  DATA = await loadData();
  openDeepLink();
  render();
  initDock();
  initInstallBanner();
  scrollToDeepLink();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
