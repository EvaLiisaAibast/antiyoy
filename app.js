
const BASE_URL = "/sdb/YOUR_NAMESPACE/YOUR_DB";

let state = null;
let playerKey = null;
let selectedHex = null;


async function fetchState() {
  try {
    const res = await fetch(BASE_URL);
    state = await res.json();
    render();
  } catch (err) {
    console.error("Failed to fetch state:", err);
  }
}


function render() {
  const mapEl = document.getElementById("map");
  mapEl.innerHTML = "";

  if (!state) return;

  // Display info
  document.getElementById("info").innerText =
    `Phase: ${state.phase || 'lobby'} | Turn: ${state.turn || '-'} | Current: ${state.current_player || '-'}`;

  for (const hex of state.map) {
    if (hex.type === "impassable") continue;

    const hexEl = document.createElement("div");
    hexEl.className = "hex";
    hexEl.style.left = hex.x + "px";
    hexEl.style.top = hex.y + "px";


    if (selectedHex && selectedHex.col === hex.col && selectedHex.row === hex.row) {
      hexEl.classList.add("selected");
    }


    const bg = document.createElement("img");
    bg.src = hex.image;
    hexEl.appendChild(bg);


    if (hex.unit_image) {
      const unit = document.createElement("img");
      unit.src = hex.unit_image;
      unit.className = "overlay";
      hexEl.appendChild(unit);
    }

    if (hex.building_image) {
      const building = document.createElement("img");
      building.src = hex.building_image;
      building.className = "overlay";
      hexEl.appendChild(building);
    }

    hexEl.title = `Owner: ${hex.owner || 'none'}\nUnit: ${hex.unit || 'none'}\nBuilding: ${hex.building || 'none'}`;

    // Click handler
    hexEl.onclick = () => onHexClick(hex);

    mapEl.appendChild(hexEl);
  }
}

function onHexClick(hex) {
  if (!playerKey) return;

  const buyType = document.getElementById("buyType").value;

  if (buyType) {
    // Buying a unit/building
    buy(buyType, hex);
    document.getElementById("buyType").value = "";
    return;
  }

  if (!selectedHex) {
    // First click: select hex
    selectedHex = hex;
  } else {
    // Second click: move unit
    moveUnit(selectedHex, hex);
    selectedHex = null;
  }
  render();
}

async function joinGame() {
  const username = document.getElementById("username").value;
  if (!username) return alert("Enter a username");

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "join", username })
  });

  const data = await res.json();
  if (data.player_key) {
    playerKey = data.player_key;
    alert("Joined! Your key: " + playerKey);
  } else {
    alert(data.error);
  }
}

async function startGame() {
  await post({ action: "start" });
}

async function endTurn() {
  if (!playerKey) return;
  await post({ action: "end_turn", player_key: playerKey });
}

async function moveUnit(from, to) {
  if (!playerKey) return;
  await post({
    action: "move",
    player_key: playerKey,
    from: { col: from.col, row: from.row },
    to: { col: to.col, row: to.row }
  });
}

async function buy(type, hex) {
  if (!playerKey) return;
  await post({
    action: "buy",
    player_key: playerKey,
    type,
    hex: { col: hex.col, row: hex.row }
  });
}

async function post(body) {
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(data.error);
      alert(data.error);
    }
  } catch (err) {
    console.error("POST failed:", err);
  }
}

document.getElementById("joinBtn").onclick = joinGame;
document.getElementById("startBtn").onclick = startGame;
document.getElementById("endBtn").onclick = endTurn;

setInterval(fetchState, 1500);
fetchState();
