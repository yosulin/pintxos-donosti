const DATA_FILES = {
  zones: "data/zones.json",
  tiers: "data/tiers.json",
  bars: "data/bars.json",
};

const VISITED_KEY = "pintxos-visited";

const state = {
  filter: "todos",
  sortMode: "prioridad", // "prioridad" | "cercania"
  expanded: new Set(),
  visited: new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || "[]")),
  userLoc: null, // { lat, lng }
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
function formatDistance(km){
  return km < 1 ? `${Math.round(km*1000)} m` : `${km.toFixed(1)} km`;
}

function saveVisited(){
  localStorage.setItem(VISITED_KEY, JSON.stringify([...state.visited]));
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

function renderFilters(){
  const { zones, bars } = DATA;
  const el = document.getElementById("filters");
  const zoneKeys = Object.keys(zones);
  const options = [
    { key:"todos", label:"Todos", count: bars.length },
    ...zoneKeys.map(k => ({ key:k, label:zones[k].label, count: bars.filter(b=>b.zone===k).length })),
  ];
  el.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.active = state.filter === opt.key ? "true" : "false";
    btn.innerHTML = `${opt.label} <span class="count">${opt.count}</span>`;
    btn.addEventListener("click", () => {
      state.filter = opt.key;
      render();
    });
    el.appendChild(btn);
  });
}

/* ---------------- LIST ---------------- */
function barSortComparator(zoneKey){
  return (a, b) => {
    if (state.sortMode === "cercania" && state.userLoc){
      return a._dist - b._dist;
    }
    return b.tier - a.tier;
  };
}

function renderList(){
  const { zones, tiers, bars } = DATA;
  const main = document.getElementById("main");
  main.innerHTML = "";

  if (state.userLoc){
    bars.forEach(b => { b._dist = distanceKm(state.userLoc.lat, state.userLoc.lng, b.lat, b.lng); });
  }

  Object.keys(zones).forEach((zoneKey, i) => {
    if (state.filter !== "todos" && state.filter !== zoneKey) return;
    const zoneBars = bars.filter(b => b.zone === zoneKey).sort(barSortComparator(zoneKey));
    if (!zoneBars.length) return;

    const section = document.createElement("section");
    section.style.setProperty("--zone-color", zones[zoneKey].color);
    section.innerHTML = `
      <div class="zone-head">
        <span class="zone-index mono">0${i+1}</span>
        <h2>${zones[zoneKey].label}</h2>
        <span class="zone-count mono">${zoneBars.length} bares</span>
      </div>
      <div class="zone-rule"></div>
      <div class="bar-list"></div>
    `;
    const list = section.querySelector(".bar-list");
    zoneBars.forEach(b => list.appendChild(renderBar(b, zones[zoneKey].color, tiers)));
    main.appendChild(section);
  });
}

function renderBar(b, color, tiers){
  const isExpanded = state.expanded.has(b.id);
  const isVisited = state.visited.has(b.id);
  const distText = (state.userLoc && b._dist != null) ? formatDistance(b._dist) : null;

  const el = document.createElement("article");
  el.className = "bar";
  el.id = `bar-${b.id}`;
  el.style.setProperty("--zone-color", color);
  el.dataset.expanded = isExpanded ? "true" : "false";

  el.innerHTML = `
    <div class="bar-header">
      <button class="visited-dot" data-visited="${isVisited}" aria-label="Marcar ${b.name} como visitado" aria-pressed="${isVisited}">✓</button>
      <div class="bar-header-main">
        <span class="bar-name">${b.name}</span>
        <span class="bar-sub mono">${tiers[b.tier]}${distText ? " · " + distText : ""}</span>
      </div>
      <span class="chevron">⌄</span>
    </div>
    <div class="bar-body-wrap"><div class="bar-body-inner"><div class="bar-body">
      <div class="bar-meta">${b.addr}${b.hours ? " · " + b.hours : ""}</div>
      ${b.note ? `<div class="bar-note">${b.note}</div>` : ""}
      <div class="tags">${b.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
      <div class="bar-actions">
        <a class="maps-link" href="${mapsUrl(b)}" target="_blank" rel="noopener">Maps ↗</a>
        <button class="share-btn" type="button">Compartir</button>
      </div>
    </div></div></div>
  `;

  el.querySelector(".bar-header").addEventListener("click", () => {
    if (state.expanded.has(b.id)) state.expanded.delete(b.id);
    else state.expanded.add(b.id);
    el.dataset.expanded = state.expanded.has(b.id) ? "true" : "false";
  });

  el.querySelector(".visited-dot").addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.visited.has(b.id)) state.visited.delete(b.id);
    else state.visited.add(b.id);
    saveVisited();
    renderStats();
    const dot = e.currentTarget;
    const nowVisited = state.visited.has(b.id);
    dot.dataset.visited = nowVisited;
    dot.setAttribute("aria-pressed", nowVisited);
  });

  el.querySelector(".share-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const url = `${location.origin}${location.pathname}#bar-${b.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => toast("Enlace copiado")).catch(() => toast(url));
    } else {
      toast(url);
    }
  });

  return el;
}

/* ---------------- SORT / SURPRISE CONTROLS ---------------- */
function setSortStatus(msg){
  document.getElementById("sort-status").textContent = msg || "";
}

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
        } catch (err) {
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
  const { zones, bars } = DATA;
  const pool = bars.filter(b => b.tier === 3 && (state.filter === "todos" || b.zone === state.filter));
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  if (state.filter !== "todos" && state.filter !== pick.zone) state.filter = pick.zone;
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
  state.filter = "todos";
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

/* ---------------- RENDER ---------------- */
function render(){
  renderStats();
  renderFilters();
  renderList();
}

(async function init(){
  DATA = await loadData();
  openDeepLink();
  render();
  initSortControls();
  scrollToDeepLink();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
