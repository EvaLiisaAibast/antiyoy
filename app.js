const BASE_URL   = "https://tinkr.tech/sdb/Antiyoy/Antiyoy";
const ASSET_BASE = "https://tinkr.tech";

const UNIT_COST = {
  peasant:  10,
  spearman: 20,
  knight:   30,
  baron:    40
};
const BUILDING_COST = {
  farm:     30,
  tower:    50,
  fortress: 80
};
const BUILDING_INCOME = {
  farm:     2,
  tower:    0,
  fortress: 0
};
const UNIT_UPKEEP = {
  peasant:  1,
  spearman: 2,
  knight:   3,
  baron:    4
};

let state             = null;
let playerKey         = null;
let myUsername        = null;
let selectedHexCoords = null;

const savedUsername = localStorage.getItem("username");
const savedKey      = localStorage.getItem("playerKey");
if (savedUsername && savedKey) {
  myUsername = savedUsername;
  playerKey  = savedKey;
  document.getElementById("username").value = savedUsername;
}

const TOAST_ICONS = { info: "📜", warn: "⚠", error: "✖", success: "✔" };

function toast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toastContainer");
  const el        = document.createElement("div");
  el.className    = `toast ${type}`;
  el.innerHTML    = `
    <span class="toast-icon">${TOAST_ICONS[type] || "📜"}</span>
    <span class="toast-msg">${message}</span>
    <span class="toast-close" title="Dismiss">✕</span>
  `;
  const dismiss = () => {
    el.classList.add("removing");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  el.querySelector(".toast-close").addEventListener("click", dismiss);
  el.addEventListener("click", dismiss);
  container.appendChild(el);
  setTimeout(dismiss, duration);
}

async function fetchState() {
  try {
    const res = await fetch(BASE_URL);
    state = await res.json();
    render();
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

async function post(body) {
  try {
    const res  = await fetch(BASE_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) toast(data.error || "Server error.", "error");
    await fetchState();
  } catch (err) {
    console.error("POST failed:", err);
    toast("Network error. Please try again.", "error");
  }
}

async function joinGame() {
  const username = document.getElementById("username").value.trim();
  if (!username) { toast("Enter a username first.", "warn"); return; }
  try {
    const res  = await fetch(BASE_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "join", username })
    });
    const data = await res.json();
    if (data.player_key) {
      playerKey  = data.player_key;
      myUsername = username;
      localStorage.setItem("username",  myUsername);
      localStorage.setItem("playerKey", playerKey);
      toast(`Joined as <strong>${username}</strong>! Press Start Game when all players are ready.`, "success", 5000);
      await fetchState();
    } else {
      toast(data.error || "Failed to join.", "error");
    }
  } catch (err) {
    console.error("Join failed:", err);
    toast("Network error while joining.", "error");
  }
}

async function startGame() {
  await post({ action: "start" });
}

async function endTurn() {
  if (!playerKey) return;
  selectedHexCoords = null;
  await post({ action: "end_turn", player_key: playerKey });
}

async function buy(type, hex) {
  if (hex.type === "impassable") return;
  await post({
    action:     "buy",
    player_key: playerKey,
    type,
    hex: { col: hex.col, row: hex.row }
  });
}

function onHexClick(hex) {
  if (!playerKey)                          { toast("You must join the game first!", "warn"); return; }
  if (state.phase !== "playing")           { toast("Game has not started yet.", "warn"); return; }
  if (state.current_player !== myUsername) { toast("It's not your turn!", "warn"); return; }

  const buyType = document.getElementById("buyType").value;

  if (buyType) {
    if (hex.type === "impassable") { toast("Can't place here: impassable tile.", "error"); return; }
    const isUnit = UNIT_COST[buyType] !== undefined;
    if (isUnit && hex.building)        { toast("Can't place a unit on a building.", "error"); return; }
    if (!isUnit && isHexOccupied(hex)) { toast("Can't place a building here: hex is occupied.", "error"); return; }
    buy(buyType, hex);
    document.getElementById("buyType").value = "";
    return;
  }

  if (!selectedHexCoords) {
    if (!hex.unit)                { toast("No unit on this tile. Select a tile with your unit to move.", "info"); return; }
    if (hex.owner !== myUsername) { toast("That's not your unit.", "warn"); return; }
    selectedHexCoords = { col: hex.col, row: hex.row };
    render();
    return;
  }

  if (hex.col === selectedHexCoords.col && hex.row === selectedHexCoords.row) {
    selectedHexCoords = null;
    render();
    return;
  }

  const fromHex = state.map.find(
    h => h.col === selectedHexCoords.col && h.row === selectedHexCoords.row
  );

  if (!fromHex) { selectedHexCoords = null; render(); return; }

  if (!isValidMove(fromHex, hex)) {
    toast("Invalid move: tiles must be adjacent and destination must not be blocked by your own unit.", "error");
    selectedHexCoords = null;
    render();
    return;
  }

  post({
    action:     "move",
    player_key: playerKey,
    from: { col: fromHex.col, row: fromHex.row },
    to:   { col: hex.col,     row: hex.row }
  });

  selectedHexCoords = null;
}

function isValidMove(from, to) {
  if (to.type === "impassable") return false;
  if (!isAdjacent(from, to))    return false;
  if (to.owner === myUsername && to.building && !to.unit) return false;
  if (to.owner === myUsername && to.unit) {
    const fromStrength = unitStrength(from.unit);
    const toStrength   = unitStrength(to.unit);
    if (!(fromStrength > 1 && toStrength === 1)) return false;
  }
  return true;
}

function unitStrength(unitName) {
  const s = { peasant: 1, spearman: 2, knight: 3, baron: 4 };
  return s[unitName] || 0;
}

function isAdjacent(a, b) {
  const dc = b.col - a.col;
  const dr = b.row - a.row;
  const evenRow = [[+1,0],[-1,0],[0,-1],[0,+1],[-1,-1],[-1,+1]];
  const oddRow  = [[+1,0],[-1,0],[0,-1],[0,+1],[+1,-1],[+1,+1]];
  const neighbours = (a.row % 2 === 0) ? evenRow : oddRow;
  return neighbours.some(([ndc, ndr]) => ndc === dc && ndr === dr);
}

function isHexOccupied(hex) {
  return !!(hex.unit || hex.building || hex.unit_image || hex.building_image);
}

function countBuildingIncome(username) {
  if (!state || !state.map) return 0;
  let total = 0;
  for (let i = 0; i < state.map.length; i++) {
    const h = state.map[i];
    if (h.owner === username && h.building) total += BUILDING_INCOME[h.building] || 0;
  }
  return total;
}

function render() {
  const mapEl = document.getElementById("map");
  mapEl.innerHTML = "";
  if (!state) return;

  const isMyTurn = state.phase === "playing" && state.current_player === myUsername;
  document.body.classList.toggle("my-turn", isMyTurn);

  let infoText = `Phase: ${state.phase || "lobby"}  |  Turn: ${state.turn || "-"}`;
  if (state.phase === "playing") infoText += `  |  Current: ${state.current_player || "?"}`;
  if (myUsername) infoText += isMyTurn ? "  |  ⚔ YOUR TURN" : "  |  ⏳ WAITING";

  const me = state.players && state.players.find(p => p.username === myUsername);
  if (me) {
    const buildingIncome = countBuildingIncome(myUsername);
    const totalIncome    = (me.income || 0) + buildingIncome;
    const upkeep         = me.upkeep || 0;
    const net            = totalIncome - upkeep;
    const netStr         = (net >= 0 ? "+" : "") + net;
    infoText += `  |  💰 ${me.money}g  (income: +${totalIncome} / upkeep: -${upkeep} / net: ${netStr})`;
  }

  document.getElementById("info").innerText = infoText;
  renderUnitPanel(me);

  for (let i = 0; i < state.map.length; i++) {
    const hex = state.map[i];
    if (hex.type === "impassable") continue;
    renderHex(hex);
  }
}

function renderUnitPanel(me) {
  const panel = document.getElementById("unitInfo");
  if (!me || !state || !state.map) { panel.innerText = "— No player data —"; return; }
  const counts = { peasant: 0, spearman: 0, knight: 0, baron: 0 };
  for (let i = 0; i < state.map.length; i++) {
    const h = state.map[i];
    if (h.owner === myUsername && h.unit && counts[h.unit] !== undefined) {
      counts[h.unit] += h.unit_count || 1;
    }
  }
  panel.innerText = `🧑 Peasants: ${counts.peasant}   ⚔ Spearmen: ${counts.spearman}   🛡 Knights: ${counts.knight}   👑 Barons: ${counts.baron}`;
}

function renderHex(hex) {
  const mapEl = document.getElementById("map");
  const hexEl = document.createElement("div");
  hexEl.className = "hex";
  hexEl.style.left   = hex.x + "px";
  hexEl.style.top    = hex.y + "px";
  hexEl.style.width  = hex.width + "px";
  hexEl.style.height = hex.height + "px";

  if (selectedHexCoords && selectedHexCoords.col === hex.col && selectedHexCoords.row === hex.row) {
    hexEl.classList.add("selected");
  }

  const bg = document.createElement("img");
  bg.src       = ASSET_BASE + hex.image;
  bg.className = "hex-bg";
  bg.alt       = hex.type || "tile";
  hexEl.appendChild(bg);

  if (hex.unit_image) {
    const unit = document.createElement("img");
    unit.src       = ASSET_BASE + hex.unit_image;
    unit.className = "overlay";
    unit.alt       = hex.unit || "unit";
    hexEl.appendChild(unit);
    if (hex.unit === "peasant" && hex.unit_count && hex.unit_count > 1) {
      const badge     = document.createElement("div");
      badge.className = "peasant-count";
      badge.innerText = "x" + hex.unit_count;
      hexEl.appendChild(badge);
    }
  }

  if (hex.building_image) {
    const bld     = document.createElement("img");
    bld.src       = ASSET_BASE + hex.building_image;
    bld.className = "overlay";
    bld.alt       = hex.building || "building";
    hexEl.appendChild(bld);
  }

  hexEl.addEventListener("mouseenter", e => showTooltip(e, hex));
  hexEl.addEventListener("mousemove",  moveTooltip);
  hexEl.addEventListener("mouseleave", hideTooltip);
  hexEl.onclick = () => onHexClick(hex);

  mapEl.appendChild(hexEl);
}

const tooltipEl = document.getElementById("tooltip");

function showTooltip(e, hex) {
  const lines = [];
  lines.push("Tile: " + (hex.type || "?"));
  if (hex.owner)    lines.push("Owner: " + hex.owner);
  if (hex.unit)     lines.push("Unit: " + hex.unit + (hex.unit_count && hex.unit_count > 1 ? " x" + hex.unit_count : ""));
  if (hex.building) lines.push(
    "Building: " + hex.building +
    (BUILDING_INCOME[hex.building] ? " (+" + BUILDING_INCOME[hex.building] + "g/turn)" : "") +
    (BUILDING_COST[hex.building]   ? " [" + BUILDING_COST[hex.building] + "g]" : "")
  );
  if (hex.col !== undefined) lines.push("(" + hex.col + ", " + hex.row + ")");
  tooltipEl.innerHTML = lines.join("<br>");
  tooltipEl.className = "visible";
  moveTooltip(e);
}

function moveTooltip(e) {
  tooltipEl.style.left = (e.clientX + 14) + "px";
  tooltipEl.style.top  = (e.clientY + 14) + "px";
}

function hideTooltip() {
  tooltipEl.className = "";
}

document.getElementById("joinBtn").onclick  = joinGame;
document.getElementById("startBtn").onclick = startGame;
document.getElementById("endBtn").onclick   = endTurn;

setInterval(fetchState, 1500);
fetchState();
