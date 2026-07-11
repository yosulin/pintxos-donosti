const DATA_FILES = {
  zones: "data/zones.json",
  tiers: "data/tiers.json",
  bars: "data/bars.json",
  night: "data/night.json",
  special: "data/special.json",
};

function mapsUrl(item){
  if (item.placeId) return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}&query_place_id=${item.placeId}`;
  if (item.search) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.search)}`;
  return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
}

function meterHTML(tier){
  let out = "";
  for (let i=1;i<=3;i++) out += `<span class="seg ${i<=tier ? "on" : ""}"></span>`;
  return out;
}

async function loadData(){
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, url]) => [key, await (await fetch(url)).json()])
  );
  return Object.fromEntries(entries);
}

function renderStats(zones, bars){
  const row = document.getElementById("stat-row");
  const zoneKeys = Object.keys(zones);
  const stats = [
    { n: bars.length, l: "Bares" },
    { n: zoneKeys.length, l: "Zonas" },
    { n: bars.filter(b => b.tier === 3).length, l: "Imprescindibles" },
  ];
  row.innerHTML = stats.map(s => `<div class="stat"><span class="n">${s.n}</span><span class="l">${s.l}</span></div>`).join("");
}

function renderFilters(zones, bars, night, special, onChange){
  const el = document.getElementById("filters");
  const zoneKeys = Object.keys(zones);
  const options = [
    { key:"todos", label:"Todos", count: bars.length + night.reduce((a,f)=>a+f.items.length,0) + special.length },
    ...zoneKeys.map(k => ({ key:k, label:zones[k].label, count: bars.filter(b=>b.zone===k).length })),
    { key:"noche", label:"Planes nocturnos", count: night.reduce((a,f)=>a+f.items.length,0) },
    { key:"especial", label:"Especial", count: special.length },
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

function renderGrid(filter, { zones, tiers, bars, night, special }){
  const main = document.getElementById("main");
  main.innerHTML = "";

  Object.keys(zones).forEach(zoneKey => {
    if (filter !== "todos" && filter !== zoneKey) return;
    const zoneBars = bars.filter(b => b.zone === zoneKey).sort((a,b) => b.tier - a.tier);
    if (!zoneBars.length) return;

    const section = document.createElement("section");
    section.innerHTML = `
      <div class="zone-head">
        <span class="zone-dot" style="background:${zones[zoneKey].color}"></span>
        <h2>${zones[zoneKey].label}</h2>
        <span class="zone-count mono">${zoneBars.length} bares</span>
      </div>
      <div class="grid"></div>
    `;
    const grid = section.querySelector(".grid");
    zoneBars.forEach(b => {
      const card = document.createElement("article");
      card.className = "card";
      card.style.setProperty("--zone-color", zones[zoneKey].color);
      card.innerHTML = `
        <div class="card-top">
          <span class="card-name">${b.name}</span>
          <div>
            <div class="meter">${meterHTML(b.tier)}</div>
            <span class="tier-label">${tiers[b.tier]}</span>
          </div>
        </div>
        <div class="card-meta">${b.addr}${b.hours ? " · " + b.hours : ""}</div>
        ${b.note ? `<div class="card-note">${b.note}</div>` : ""}
        <div class="tags">${b.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        <div class="card-foot"><a class="maps-link" href="${mapsUrl(b)}" target="_blank" rel="noopener">Maps ↗</a></div>
      `;
      grid.appendChild(card);
    });
    main.appendChild(section);
  });

  if (filter === "todos" || filter === "noche"){
    const section = document.createElement("section");
    section.innerHTML = `<div class="zone-head"><h2>Planes para salir</h2></div><div class="franjas"></div>`;
    const wrap = section.querySelector(".franjas");
    night.forEach(f => {
      const card = document.createElement("div");
      card.className = "franja-card";
      card.innerHTML = `
        <h3>${f.franja}</h3><span class="franja-time mono">${f.time}</span>
        <ul class="franja-list">${f.items.map(i=>`<li><a href="${mapsUrl(i)}" target="_blank" rel="noopener">${i.name}</a></li>`).join("")}</ul>
      `;
      wrap.appendChild(card);
    });
    main.appendChild(section);
  }

  if (filter === "todos" || filter === "especial"){
    const section = document.createElement("section");
    section.innerHTML = `<div class="zone-head"><h2>Sitios especiales</h2></div>`;
    special.forEach(s => {
      const card = document.createElement("div");
      card.className = "special-card";
      card.innerHTML = `
        <span class="k">${s.kicker || ""}</span>
        <h2>${s.name}</h2>
        <p>${s.blurb}</p>
        <a class="maps-link" href="${mapsUrl(s)}" target="_blank" rel="noopener">Maps ↗</a>
      `;
      section.appendChild(card);
    });
    main.appendChild(section);
  }
}

(async function init(){
  const data = await loadData();
  renderStats(data.zones, data.bars);
  let currentFilter = "todos";
  renderFilters(data.zones, data.bars, data.night, data.special, (key) => {
    currentFilter = key;
    renderGrid(currentFilter, data);
  });
  renderGrid(currentFilter, data);
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
