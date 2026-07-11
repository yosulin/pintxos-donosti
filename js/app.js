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
    `📍 ${b.name} — ${zoneLabel} · ${typeLabel}`,
    b.addr + (b.hours ? ` · ${b.hours}` : ""),
  ];
  if (b.tags && b.tags.length) lines.push(`🍢 ${b.tags.join(", ")}`);
  if (b.note) lines.push(b.note);
  lines.push(`Mapa: ${mapsUrl(b)}`);
  lines.push(`Guía: ${location.origin}${location.pathname}#bar-${b.id}`);
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

/* ---------------- STATS / FILTERS ---------------- */
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

function visibleBarsFor(dimension){
  // bars matching the *other* active filter, used to compute counts per chip
  return DATA.bars.filter(b => {
    const zoneOk = dimension === "zone" ? true : (state.zoneFilter === "todos" || b.zone === state.zoneFilter);
    const typeOk = dimension === "type" ? true : (state.typeFilter === "todos" || b.type === state.typeFilter);
    return zoneOk && typeOk;
  });
}

function renderZoneFilters(){
  const { zones } = DATA;
  const el = document.getElementById("filters-zone");
  const pool = visibleBarsFor("zone");
  const options = [
    { key:"todos", label:"Todos", count: pool.length },
    ...Object.keys(zones).map(k => ({ key:k, label:zones[k].label, count: pool.filter(b=>b.zone===k).length })),
  ];
  el.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.active = state.zoneFilter === opt.key ? "true" : "false";
    btn.innerHTML = `${opt.label} <span class="count">${opt.count}</span>`;
    btn.addEventListener("click", () => { state.zoneFilter = opt.key; render(); });
    el.appendChild(btn);
  });
}

function renderTypeFilters(){
  const { types } = DATA;
  const el = document.getElementById("filters-type");
  const pool = visibleBarsFor("type");
  const options = [
    { key:"todos", label:"Todos", count: pool.length },
    ...Object.keys(types).map(k => ({ key:k, label:`${types[k].icon} ${types[k].label}`, count: pool.filter(b=>b.type===k).length })),
  ];
  el.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.active = state.typeFilter === opt.key ? "true" : "false";
    btn.innerHTML = `${opt.label} <span class="count">${opt.count}</span>`;
    btn.addEventListener("click", () => { state.typeFilter = opt.key; render(); });
    el.appendChild(btn);
  });
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
function setSortStatus(msg){ document.getElementById("sort-status").textContent = msg || ""; }

function initSortControls(){
  const buttons = [...document.querySelectorAll(".sort-btn")];
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const mode = btn.dataset.mode;
      if (mode === "cercania" && !state.userLoc){
        setSortStatus("Buscando tu ubicación…");
        try {
          const pos = await getLocation();
          state.userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setSortStatus("");
        } catch (err){
          setSortStatus("No se pudo obtener tu ubicación — revisa los permisos del navegador.");
          return;
        }
      }
      state.sortMode = mode;
      buttons.forEach(b => b.dataset.active = (b === btn) ? "true" : "false");
      render();
    });
  });
  document.getElementById("surprise-btn").addEventListener("click", surpriseMe);
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
  if (!pool.length) return;
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
  const theme = saved || (preferDark ? "dark" : "light");
  applyTheme(theme);

  document.getElementById("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });
}
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  document.getElementById("theme-toggle").textContent = theme === "dark" ? "☀" : "☾";
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

/* ---------------- RENDER ---------------- */
function render(){
  renderStats();
  renderZoneFilters();
  renderTypeFilters();
  renderList();
}

(async function init(){
  initTheme();
  DATA = await loadData();
  openDeepLink();
  render();
  initSortControls();
  initInstallBanner();
  scrollToDeepLink();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
