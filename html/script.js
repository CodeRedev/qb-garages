// Optional vehicle picture. {model} = spawn name. Set to "" to disable. Local example: "images/{model}.png"
const VEHICLE_IMAGE_URL = "https://docs.fivem.net/vehicles/{model}.webp";

const RES = typeof GetParentResourceName === "function" ? GetParentResourceName() : "qb-garages";
const $ = (id) => document.getElementById(id);
const app = $("app");
const state = { vehicles: [], filter: "all", sort: "name", query: "", selected: null };
const FILTERS = [["all", "All"], ["drive", "Garaged"], ["out", "Out"], ["depot", "Depot"], ["impound", "Impound"]];
const svg = (p) => `<svg viewBox="0 0 24 24" fill="currentColor">${p}</svg>`;
const ICONS = {
    key: svg('<path d="M7 14a5 5 0 1 1 4.9-6H22v4h-2v3h-3v-3h-5.1A5 5 0 0 1 7 14zm0-7.5A2.5 2.5 0 1 0 7 11.5 2.5 2.5 0 0 0 7 6.5z"/>'),
    pin: svg('<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>'),
    cash: svg('<path d="M3 6h18v12H3V6zm9 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>'),
    lock: svg('<path d="M6 10V8a6 6 0 1 1 12 0v2h1v11H5V10h1zm2 0h8V8a4 4 0 0 0-8 0v2z"/>'),
};

/* ---------- NUI ---------- */
function post(name, data) {
    return fetch(`https://${RES}/${name}`, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(data === undefined ? {} : data) })
        .then((r) => r.json()).catch(() => null);
}
window.addEventListener("message", (e) => { const d = e.data; if (d && d.action === "VehicleList") open(d.garageLabel, d.vehicles || []); });
function close() { app.hidden = true; post("closeGarage"); }

function getStatus(v) {
    const fee = v.depotPrice && v.depotPrice > 0;
    if (v.state === 2) return { key: "impound", label: "Impound", locked: true, note: "Held by police" };
    if (v.state === 0) {
        if (fee && v.type === "public") return { key: "depot", label: "Depot", locked: true, note: "Retrieve at a depot" };
        if (fee && v.type === "depot") return { key: "pay", label: "$" + Math.round(v.depotPrice), pay: true };
        return { key: "out", label: "Out", track: true };
    }
    if (fee && v.type === "public") return { key: "depot", label: "Depot", locked: true, note: "Retrieve at a depot" };
    if (fee && v.type === "depot") return { key: "pay", label: "$" + Math.round(v.depotPrice), pay: true };
    return { key: "drive", label: "Garaged" };
}
const pct = (v, max) => Math.max(0, Math.min(100, Math.round(((v || 0) / max) * 100)));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Math.round(n || 0).toLocaleString("en-US");
const imgTag = (v) => (VEHICLE_IMAGE_URL ? `<img src="${esc(VEHICLE_IMAGE_URL.replace("{model}", encodeURIComponent(String(v.vehicle).toLowerCase())))}" alt="" onerror="this.remove()">` : "");
const find = () => state.vehicles.find((x) => x.plate === state.selected);

function open(label, vehicles) {
    $("garage-header").textContent = label || "Garage";
    state.vehicles = vehicles.map((v) => ({ ...v, _s: getStatus(v) }));
    state.filter = "all"; state.query = ""; $("search").value = "";
    state.selected = state.vehicles[0] ? state.vehicles[0].plate : null;
    app.hidden = false;
    render();
}

function visible() {
    const q = state.query.trim().toLowerCase();
    const list = state.vehicles.filter((v) => {
        const k = v._s.key;
        if (state.filter === "depot" ? !(k === "depot" || k === "pay") : state.filter !== "all" && k !== state.filter) return false;
        return !q || (v.vehicleLabel || "").toLowerCase().includes(q) || (v.plate || "").toLowerCase().includes(q);
    });
    const by = state.sort;
    return list.sort((a, b) => (by === "name" ? String(a.vehicleLabel).localeCompare(String(b.vehicleLabel)) : (b[by] || 0) - (a[by] || 0)));
}

function render() {
    const all = state.vehicles;
    $("garage-sub").textContent = `${all.length} vehicle${all.length === 1 ? "" : "s"} - ${all.filter((v) => v._s.key === "out").length} out`;
    $("chips").innerHTML = FILTERS.map(([k, name]) => {
        const n = k === "all" ? all.length : all.filter((v) => (k === "depot" ? v._s.key === "depot" || v._s.key === "pay" : v._s.key === k)).length;
        return `<button class="tab ${state.filter === k ? "on" : ""}" data-f="${k}">${name}<i>${n}</i></button>`;
    }).join("");

    const list = visible();
    if (!list.some((v) => v.plate === state.selected)) state.selected = list[0] ? list[0].plate : null;
    $("list").innerHTML = list.length ? list.map((v, i) => `
        <div class="item ${v.plate === state.selected ? "sel" : ""}" data-plate="${esc(v.plate)}">
            <span class="n">${String(i + 1).padStart(2, "0")}</span><span class="nm">${esc(v.vehicleLabel)}</span><span class="dot ${v._s.key}"></span>
        </div>`).join("") : '<div class="empty">No vehicles found</div>';
    renderDetail();
    centerSelected();
}

const bar = (label, p) => `<div class="st"><small>${label}</small><div class="bar ${p >= 75 ? "" : p >= 50 ? "mid" : "low"}"><i style="width:${p}%"></i></div><b>${p}%</b></div>`;

function renderDetail() {
    const v = find(), el = $("detail");
    if (!v) { el.innerHTML = ""; return; }
    const s = v._s;
    let a;
    if (s.locked) a = `<button class="act off" disabled>${ICONS.lock}<span class="txt">Unavailable<small>${esc(s.note)}</small></span></button>`;
    else if (s.pay) a = `<button class="act amber" data-do="pay">${ICONS.cash}<span class="txt">Pay ${money(v.depotPrice)} &amp; Take Out<small>Depot fee</small></span></button>`;
    else if (s.track) a = `<button class="act" data-do="track">${ICONS.pin}<span class="txt">Track Vehicle<small>Currently out</small></span></button>`;
    else a = `<button class="act" data-do="drive">${ICONS.key}<span class="txt">Take Out<small>Spawn vehicle</small></span></button>`;

    el.innerHTML = `
        <div class="r-top"><small>${esc(v.type || "garage")} bay</small><span class="tag ${s.key}">${esc(s.label)}</span></div>
        <h2>${esc(v.vehicleLabel)}</h2>
        <div class="plate"><span><i>San Andreas</i><b>${esc(v.plate)}</b></span></div>
        <div class="pic">${imgTag(v)}</div>
        <div class="stats">${bar("Fuel", pct(v.fuel, 100))}${bar("Engine", pct(v.engine, 1000))}${bar("Body", pct(v.body, 1000))}</div>
        <div class="facts">
            <div><small>Mileage</small><b>${esc(v.distance || 0)} mi</b></div>
            <div><small>Finance</small><b class="${v.balance > 0 ? "" : "g"}">${v.balance > 0 ? money(v.balance) : "Paid Off"}</b></div>
            <div><small>Depot fee</small><b>${v.depotPrice > 0 ? money(v.depotPrice) : "-"}</b></div>
        </div>
        ${a}
        <p class="keys"><kbd>Up</kbd><kbd>Down</kbd> Browse <kbd>Enter</kbd> Confirm <kbd>Esc</kbd> Close</p>`;
}

function centerSelected() { const c = document.querySelector(".item.sel"); if (c) c.scrollIntoView({ block: "center" }); }
function select(plate) {
    state.selected = plate;
    document.querySelectorAll(".item").forEach((b) => b.classList.toggle("sel", b.dataset.plate === plate));
    renderDetail(); centerSelected();
}

/* ---------- actions ---------- */
function act(kind) {
    const v = find();
    if (!v || v._s.locked) return;
    const payload = { vehicle: v.vehicle, garage: v.garage, index: v.index, plate: v.plate, type: v.type, depotPrice: v.depotPrice, stats: { fuel: v.fuel, engine: v.engine, body: v.body } };
    const call = kind === "track" ? post("trackVehicle", v.plate) : kind === "pay" ? post("takeOutDepo", payload) : post("takeOutVehicle", payload);
    call.then((r) => { if (r === "ok") close(); });
}

/* ---------- events ---------- */
$("chips").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { state.filter = b.dataset.f; render(); } });
$("sorts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]"); if (!b) return;
    state.sort = b.dataset.sort;
    document.querySelectorAll("#sorts button").forEach((x) => x.classList.toggle("on", x === b));
    render();
});
$("list").addEventListener("click", (e) => { const c = e.target.closest("[data-plate]"); if (c) select(c.dataset.plate); });
$("detail").addEventListener("click", (e) => { const b = e.target.closest("[data-do]"); if (b) act(b.dataset.do); });
$("search").addEventListener("input", (e) => { state.query = e.target.value; render(); });
$("close-btn").addEventListener("click", close);

document.addEventListener("keydown", (e) => {
    if (app.hidden) return;
    if (e.key === "Escape") return close();
    if (e.key === "Enter" && document.activeElement !== $("search")) { const v = find(); if (v) act(v._s.track ? "track" : v._s.pay ? "pay" : "drive"); }
    const dir = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (dir) {
        e.preventDefault();
        const l = visible(), i = l.findIndex((x) => x.plate === state.selected);
        const n = l[Math.max(0, Math.min(l.length - 1, i + dir))];
        if (n) select(n.plate);
    }
});


if (!window.invokeNative) {
    open("Pillbox Garage Parking", [
        { vehicle: "sultan", vehicleLabel: "Sultan", plate: "02EAR643", state: 1, fuel: 100, engine: 880, body: 890, distance: 0, depotPrice: 0, balance: 0, type: "public" },
        { vehicle: "comet2", vehicleLabel: "Comet", plate: "FAST 007", state: 1, fuel: 40, engine: 620, body: 510, distance: 3210, depotPrice: 0, balance: 18400, type: "public" },
        { vehicle: "baller", vehicleLabel: "Baller", plate: "NX 90 21", state: 0, fuel: 66, engine: 1000, body: 990, distance: 560, depotPrice: 0, balance: 0, type: "public" },
        { vehicle: "kuruma", vehicleLabel: "Kuruma", plate: "DEP 0T11", state: 0, fuel: 20, engine: 300, body: 250, distance: 88000, depotPrice: 500, balance: 0, type: "public" },
        { vehicle: "t20", vehicleLabel: "T20", plate: "67IDE603", state: 1, fuel: 90, engine: 950, body: 940, distance: 12, depotPrice: 0, balance: 0, type: "public" },
        { vehicle: "vacca", vehicleLabel: "Vacca", plate: "86AJO739", state: 1, fuel: 75, engine: 900, body: 920, distance: 410, depotPrice: 0, balance: 0, type: "public" },
    ]);
}
