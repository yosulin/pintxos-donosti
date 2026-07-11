const DATA_FILES = {
  zones: "data/zones.json",
  tiers: "data/tiers.json",
  bars: "data/bars.json",
};

function mapsUrl(item){
  if (item.placeId) return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}&query_place_id=${item.placeId}`;
  if (item.search) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.search)}`;
  return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
}

async function loadData(){
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, url]) => [key, await (await fetch(url)).json()])
  );
  return Object.fromEntries(entries);
}

function renderStats(zones, bars){
  const row = document.getElementById("stat-row");
  const stats = [
    { n: bars.length, l: "Bares" },
    { n: Object.keys(zones).length, l: "Zonas" },
    { n: bars.filter(b => b.tier === 3).length, l: "Imprescindibles" },
  ];
  row.innerHTML = stats.map(s => `<div class="stat"><span class="n">${s.n}</span><span class="l">${s.l}</span></div>`).join("");
}

function renderFilters(zones, bars, onChange){
  const el = document.getElementById("filters");
  const zoneKeys = Object.keys(zones);
  const options = [
    { key:"todos", label:"Todos", count: bars.length },
    ...zoneKeys.map(k => ({ key:k, label:zones[k].label, count: bars.filter(b=>b.zone===k).length })),
  ];
  el.innerHTML = "";
  options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.active = i === 0 ? "true" : "false";
    btn.innerHTML = `${opt.label} <span class="count">${opt.count}</span>`;
    btn.addEventListener("click", () => {
      [...el.children].forEach(c => c.dataset.active = "false");
      btn.dataset.active = "true";
      onChange(opt.key);
    });
    el.appendChild(btn);
  });
}

function renderList(filter, { zones, tiers, bars }){
  const main = document.getElementById("main");
  main.innerHTML = "";

  Object.keys(zones).forEach((zoneKey, i) => {
    if (filter !== "todos" && filter !== zoneKey) return;
    const zoneBars = bars.filter(b => b.zone === zoneKey).sort((a,b) => b.tier - a.tier);
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
    zoneBars.forEach(b => {
      const row = document.createElement("article");
      row.className = "bar";
      row.innerHTML = `
        <div class="bar-top">
          <span class="bar-name">${b.name}</span>
          <span class="tier-label">${tiers[b.tier]}</span>
        </div>
        <div class="bar-meta">${b.addr}${b.hours ? " · " + b.hours : ""}</div>
        ${b.note ? `<div class="bar-note">${b.note}</div>` : ""}
        <div class="tags">${b.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        <div class="bar-foot"><a class="maps-link" href="${mapsUrl(b)}" target="_blank" rel="noopener">Maps ↗</a></div>
      `;
      list.appendChild(row);
    });
    main.appendChild(section);
  });
}

(async function init(){
  const data = await loadData();
  renderStats(data.zones, data.bars);
  let currentFilter = "todos";
  renderFilters(data.zones, data.bars, (key) => {
    currentFilter = key;
    renderList(currentFilter, data);
  });
  renderList(currentFilter, data);
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
