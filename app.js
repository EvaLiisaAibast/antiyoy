const BASE_URL = "https://tinkr.tech/sdb/Antiyoy/Antiyoy";
const ASSET_BASE = "https://tinkr.tech";

let state = null;
let playerKey = null;
let selectedHex = null;
let myUsername = null;

const savedUsername = localStorage.getItem("username");
const savedKey = localStorage.getItem("playerKey");

if (savedUsername && savedKey) {
  myUsername = savedUsername;
  playerKey = savedKey;
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

  const isMyTurn =
    state.phase === "playing" &&
    state.current_player === myUsername;

  document.body.style.background = isMyTurn ? "#102010" : "#201010";

  let infoText = "Phase: " + (state.phase || "lobby") +
                 " | Turn: " + (state.turn || "-");

  if (state.phase === "playing") {
    infoText += " | Current: " + state.current_player;
  }

  if (myUsername) {
    if (isMyTurn) {
      infoText += " | YOUR TURN";
    } else {
      infoText += " | WAITING";
    }
  }

  const me = state.players && state.players.find(function(p) {
    return p.username === myUsername;
  });

  if (me) {
    infoText += " | Money: " + me.money +
                " (+" + me.income + "/-" + me.upkeep + ")";
  }

  document.getElementById("info").innerText = infoText;

  for (let i = 0; i < state.map.length; i++) {
    const hex = state.map[i];
    if (hex.type === "impassable") continue;

    const hexEl = document.createElement("div");
    hexEl.className = "hex";

    hexEl.style.left = hex.x + "px";
    hexEl.style.top = hex.y + "px";
    hexEl.style.width = hex.width + "px";
    hexEl.style.height = hex.height + "px";

    if (selectedHex &&
        selectedHex.col === hex.col &&
        selectedHex.row === hex.row) {
      hexEl.classList.add("selected");
    }

    const bg = document.createElement("img");
    bg.src = ASSET_BASE + hex.image;
    hexEl.appendChild(bg);

    if (hex.unit_image) {
      const unit = document.createElement("img");
      unit.src = ASSET_BASE + hex.unit_image;
      unit.className = "overlay";
      hexEl.appendChild(unit);
    }

    if (hex.building_image) {
      const building = document.createElement("img");
      building.src = ASSET_BASE + hex.building_image;
      building.className = "overlay";
      hexEl.appendChild(building);
    }

    hexEl.onclick = function() {
      onHexClick(hex);
    };

    mapEl.appendChild(hexEl);
  }
}

function onHexClick(hex) {
  console.log(hex);

  if (!playerKey) return;

  if (state.phase !== "playing") {
    alert("Game not started");
    return;
  }

  if (state.current_player !== myUsername) {
    alert("Not your turn");
    return;
  }

  const buyType = document.getElementById("buyType").value;
  if (buyType) {
    if (hex.type === "impassable" || isHexOccupied(hex)) {
      alert("Can't buy here: Invalid hex");
      return;
    }

    if (hex.type === "neutral") {
      buy(buyType, hex);
      document.getElementById("buyType").value = "";
      return;
    }

    buy(buyType, hex);
    document.getElementById("buyType").value = "";
    return;
  }

  if (!selectedHex) {
    if (hex.type === "impassable") {
      alert("Can't select this hex: It's impassable.");
      return;
    }
    selectedHex = hex;
  } else {
    if (isValidMove(selectedHex, hex)) {
      moveUnit(selectedHex, hex);
      selectedHex = null;
    } else {
      alert("Invalid move: You can't move to this hex.");
    }
  }

  render();
}

function isValidMove(from, to) {
  const rowDiff = Math.abs(from.row - to.row);
  const colDiff = Math.abs(from.col - to.col);
  const isAdjacent = (rowDiff <= 1 && colDiff <= 1);

  if (!isAdjacent) {
    return false;  
  }

  if (to.type === "impassable" || isHexOccupied(to)) {
    return false;
  }

  return true;
}

function isHexOccupied(hex) {
  return (hex.unit_image || hex.building_image);
}

async function joinGame() {
  const username = document.getElementById("username").value;
  if (!username) {
    alert("Enter username");
    return;
  }

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      action: "join",
      username: username
    })
  });

  const data = await res.json();

  if (data.player_key) {
    playerKey = data.player_key;
    myUsername = username;

    localStorage.setItem("username", myUsername);
    localStorage.setItem("playerKey", playerKey);

    alert("Joined! Now press Start Game.");
  } else {
    alert(data.error);
  }
}

async function startGame() {
  await post({ action: "start" });
}

async function endTurn() {
  if (!playerKey) return;
  await post({
    action: "end_turn",
    player_key: playerKey
  });
}

async function moveUnit(from, to) {
  await post({
    action: "move",
    player_key: playerKey,
    from: { col: from.col, row: from.row },
    to: { col: to.col, row: to.row }
  });
}

async function buy(type, hex) {
  if (isHexOccupied(hex)) {
    alert("This hex is occupied! Can't place here.");
    return;
  }

  await post({
    action: "buy",
    player_key: playerKey,
    type: type,
    hex: { col: hex.col, row: hex.row }
  });
}

async function post(body) {
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
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
