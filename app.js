// Constants
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

let state       = null;
let playerKey   = null;
let selectedHex = null;
let myUsername  = null;

const savedUsername = localStorage.getItem("username");
const savedKey      = localStorage.getItem("playerKey");
if (savedUsername && savedKey) {
  myUsername = savedUsername;
  playerKey  = savedKey;
  document.getElementById("username").value = savedUsername;
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
    const totalIncome = (me.income || 0) + buildingIncome;
    const upkeep = me.upkeep || 0;
    const net = totalIncome - upkeep;
    const netStr = (net >= 0 ? "+" : "") + net;
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

function countBuildingIncome(username) {
  if (!state || !state.map) return 0;
  let total = 0;
  for (let i = 0; i < state.map.length; i++) {
    const h = state.map[i];
    if (h.owner === username && h.building) total += BUILDING_INCOME[h.building] || 0;
  }
  return total;
}

function renderUnitPanel(me) {
  const panel = document.getElementById("unitInfo");
  if (!me || !state || !state.map) {
    panel.innerText = "— No player data —";
    return;
  }

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

  if (selectedHex && selectedHex.col === hex.col && selectedHex.row === hex.row) hexEl.classList.add("selected");

  const bg = document.createElement("img");
  bg.src = ASSET_BASE + hex.image;
  bg.className = "hex-bg";
  bg.alt = hex.type || "tile";
  hexEl.appendChild(bg);

  if (hex.unit_image) {
    const unit = document.createElement("img");
    unit.src = ASSET_BASE + hex.unit_image;
    unit.className = "overlay";
    unit.alt = hex.unit || "unit";
    hexEl.appendChild(unit);

    if (hex.unit === "peasant" && hex.unit_count && hex.unit_count > 1) {
      const badge = document.createElement("div");
      badge.className = "peasant-count";
      badge.innerText = "x" + hex.unit_count;
      hexEl.appendChild(badge);
    }
  }

  if (hex.building_image) {
    const bld = document.createElement("img");
    bld.src = ASSET_BASE + hex.building_image;
    bld.className = "overlay";
    bld.alt = hex.building || "building";
    hexEl.appendChild(bld);
  }

  hexEl.addEventListener("mouseenter", e => showTooltip(e, hex));
  hexEl.addEventListener("mousemove", moveTooltip);
  hexEl.addEventListener("mouseleave", hideTooltip);
  hexEl.onclick = () => onHexClick(hex);

  mapEl.appendChild(hexEl);
}

const tooltipEl = document.getElementById("tooltip");
function showTooltip(e, hex) {
  const lines = [];
  lines.push("Tile: " + (hex.type || "?"));
  if (hex.owner) lines.push("Owner: " + hex.owner);
  if (hex.unit) lines.push("Unit: " + hex.unit + (hex.unit_count && hex.unit_count > 1 ? " x" + hex.unit_count : ""));
  if (hex.building) lines.push("Building: " + hex.building + (BUILDING_INCOME[hex.building] ? " (+" + BUILDING_INCOME[hex.building] + "g)" : "") + (BUILDING_COST[hex.building] ? ` (${BUILDING_COST[hex.building]}g)` : ""));
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

function onHexClick(hex) {
  if (!playerKey) return alert("You must join the game first!");
  if (state.phase !== "playing") return alert("Game not started yet.");
  if (state.current_player !== myUsername) return alert("Not your turn!");

  const buyType = document.getElementById("buyType").value;

  if (buyType) {
    if (hex.type === "impassable") return alert("Can't place here: impassable tile.");

    const isUnit = UNIT_COST[buyType] !== undefined;
    if (isUnit && hex.building) return alert("Can't place a unit on a building.");
    if (!isUnit && isHexOccupied(hex)) return alert("Can't place a building here: hex is occupied.");

    buy(buyType, hex);
    document.getElementById("buyType").value = "";
    return;
  }

  if (!selectedHex) {
    if (!hex.unit) return alert("No unit on this tile. Select a tile with your unit to move.");
    if (hex.owner !== myUsername) return alert("That's not your unit.");
    selectedHex = hex;
    render();
  } else {
    if (hex.col === selectedHex.col && hex.row === selectedHex.row) {
      selectedHex = null;
      render();
      return;
    }

    if (isValidMove(selectedHex, hex)) {
      moveUnitStack(selectedHex, hex);
      selectedHex = null;
    } else {
      alert("Invalid move: tiles must be adjacent and the destination must not be blocked by your own unit.");
      selectedHex = null;
      render();
    }
  }
}

function moveUnitStack(from, to) {
  let movingCount = 1; 
  from.unit_count = from.unit_count || 1;
  to.unit_count   = to.unit_count || 0;

  from.unit_count -= movingCount;
  if (from.unit_count <= 0) {
    from.unit = null;
    from.unit_image = null;
    from.unit_count = 0;
  }

  if (!to.unit) {
    to.unit = from.unit || to.unit;
    to.unit_image = from.unit_image || to.unit_image;
    to.unit_count = movingCount;
  } else if (to.unit === from.unit) {
    to.unit_count += movingCount;
  } else {
   
    if (unitStrength(from.unit) > unitStrength(to.unit)) {
      to.unit = from.unit;
      to.unit_image = from.unit_image;
      to.unit_count = movingCount;
    } else {
      to.unit_count -= movingCount;
      if (to.unit_count <= 0) {
        to.unit = from.unit;
        to.unit_image = from.unit_image;
        to.unit_count = 1;
      }
    }
  }

  post({
    action: "move",
    player_key: playerKey,
    from: { col: from.col, row: from.row },
    to:   { col: to.col,   row: to.row }
  });
}


function isValidMove(from, to) {
  if (to.type === "impassable") return false;
  if (!isAdjacent(from, to)) return false;
  if (to.owner === myUsername && to.unit) {
    const fromStrength = unitStrength(from.unit);
    const toStrength   = unitStrength(to.unit);
    if (!(fromStrength > 1 && toStrength === 1)) return false;
  }
  if (to.owner === myUsername && to.building && !to.unit) return false;
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
  for (let i = 0; i < neighbours.length; i++) {
    if (neighbours[i][0] === dc && neighbours[i][1] === dr) return true;
  }
  return false;
}
function isHexOccupied(hex) {
  return !!(hex.unit_image || hex.building_image || hex.unit || hex.building);
}


async function joinGame() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("Enter a username first.");

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", username })
    });
    const data = await res.json();

    if (data.player_key) {
      playerKey  = data.player_key;
      myUsername = username;
      localStorage.setItem("username",   myUsername);
      localStorage.setItem("playerKey",  playerKey);
      alert(`Joined as '${username}'! Press Start Game when all players are in.`);
    } else {
      alert(data.error || "Failed to join.");
    }
  } catch (err) {
    console.error("Join failed:", err);
    alert("Network error while joining.");
  }
}
async function startGame() { await post({ action: "start" }); }
async function endTurn() { if (playerKey) await post({ action: "end_turn", player_key: playerKey }); }
async function buy(type, hex) {
  if (hex.type === "impassable") return;
  await post({ action: "buy", player_key: playerKey, type, hex: { col: hex.col, row: hex.row } });
}
async function post(body) {
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Server error.");
    await fetchState();
  } catch (err) {
    console.error("POST failed:", err);
  }
}

document.getElementById("joinBtn").onclick  = joinGame;
document.getElementById("startBtn").onclick = startGame;
document.getElementById("endBtn").onclick   = endTurn;


setInterval(fetchState, 1500);
fetchState();

const musicDiv = document.createElement("div");
musicDiv.style.position = "fixed";
musicDiv.style.bottom = "10px";
musicDiv.style.left = "10px";
musicDiv.style.zIndex = "1000";
musicDiv.innerHTML = `<a href="https://open.spotify.com/playlist/25FRBddMnZKKctxOi2ZbBs?utm_source=generator" target="_blank" style="color:#f0c060; font-family:sans-serif; font-size:12px; text-decoration:none;">🎵 Recommended Antiyoy OST on Spotify</a>`;
document.body.appendChild(musicDiv);
