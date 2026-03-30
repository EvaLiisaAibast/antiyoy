

const BASE_URL   = "https://tinkr.tech/sdb/Antiyoy/Antiyoy";
const ASSET_BASE = "https://tinkr.tech";


const UNIT_COST = {
  peasant:  10,
  spearman: 20,
  knight:   30,
  baron:    40
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

  const isMyTurn =
    state.phase === "playing" &&
    state.current_player === myUsername;

  document.body.classList.toggle("my-turn", isMyTurn);

  let infoText = "Phase: " + (state.phase || "lobby") +
                 "  |  Turn: " + (state.turn || "-");

  if (state.phase === "playing") {
    infoText += "  |  Current: " + (state.current_player || "?");
  }

  if (myUsername) {
    infoText += isMyTurn ? "  |  ⚔ YOUR TURN" : "  |  ⏳ WAITING";
  }

  const me = state.players && state.players.find(function(p) {
    return p.username === myUsername;
  });

  if (me) {

    var buildingIncome = countBuildingIncome(myUsername);
    var totalIncome = (me.income || 0) + buildingIncome;
    var upkeep      = (me.upkeep || 0);
    var net         = totalIncome - upkeep;
    var netStr      = (net >= 0 ? "+" : "") + net;

    infoText += "  |  💰 " + me.money +
                "g  (income: +" + totalIncome +
                " / upkeep: -" + upkeep +
                " / net: " + netStr + ")";
  }

  document.getElementById("info").innerText = infoText;

  renderUnitPanel(me);

  for (var i = 0; i < state.map.length; i++) {
    var hex = state.map[i];
    if (hex.type === "impassable") continue;
    renderHex(hex);
  }
}

function countBuildingIncome(username) {
  if (!state || !state.map) return 0;
  var total = 0;
  for (var i = 0; i < state.map.length; i++) {
    var h = state.map[i];
    if (h.owner === username && h.building) {
      total += (BUILDING_INCOME[h.building] || 0);
    }
  }
  return total;
}

function renderUnitPanel(me) {
  var panel = document.getElementById("unitInfo");
  if (!me || !state || !state.map) {
    panel.innerText = "— No player data —";
    return;
  }


  var counts = { peasant: 0, spearman: 0, knight: 0, baron: 0 };
  for (var i = 0; i < state.map.length; i++) {
    var h = state.map[i];
    if (h.owner === myUsername && h.unit && counts[h.unit] !== undefined) {
      counts[h.unit]++;
    }
  }

  panel.innerText =
    "🧑 Peasants: " + counts.peasant +
    "   ⚔ Spearmen: " + counts.spearman +
    "   🛡 Knights: " + counts.knight +
    "   👑 Barons: " + counts.baron;
}

function renderHex(hex) {
  var mapEl  = document.getElementById("map");
  var hexEl  = document.createElement("div");
  hexEl.className = "hex";

  hexEl.style.left   = hex.x      + "px";
  hexEl.style.top    = hex.y      + "px";
  hexEl.style.width  = hex.width  + "px";
  hexEl.style.height = hex.height + "px";

  if (selectedHex &&
      selectedHex.col === hex.col &&
      selectedHex.row === hex.row) {
    hexEl.classList.add("selected");
  }


  var bg  = document.createElement("img");
  bg.src  = ASSET_BASE + hex.image;
  bg.className = "hex-bg";
  bg.alt       = hex.type || "tile";
  hexEl.appendChild(bg);


  if (hex.unit_image) {
    var unit    = document.createElement("img");
    unit.src    = ASSET_BASE + hex.unit_image;
    unit.className = "overlay";
    unit.alt       = hex.unit || "unit";
    hexEl.appendChild(unit);

    if (hex.unit === "peasant" && hex.unit_count && hex.unit_count > 1) {
      var badge       = document.createElement("div");
      badge.className = "peasant-count";
      badge.innerText = "x" + hex.unit_count;
      hexEl.appendChild(badge);
    }
  }


  if (hex.building_image) {
    var bld    = document.createElement("img");
    bld.src    = ASSET_BASE + hex.building_image;
    bld.className = "overlay";
    bld.alt       = hex.building || "building";
    hexEl.appendChild(bld);
  }


  hexEl.addEventListener("mouseenter", function(e) {
    showTooltip(e, hex);
  });
  hexEl.addEventListener("mousemove", function(e) {
    moveTooltip(e);
  });
  hexEl.addEventListener("mouseleave", function() {
    hideTooltip();
  });

  hexEl.onclick = function() { onHexClick(hex); };

  mapEl.appendChild(hexEl);
}


var tooltipEl = document.getElementById("tooltip");

function showTooltip(e, hex) {
  var lines = [];
  lines.push("Tile: " + (hex.type || "?"));
  if (hex.owner)    lines.push("Owner: "    + hex.owner);
  if (hex.unit)     lines.push("Unit: "     + hex.unit + (hex.unit_count && hex.unit_count > 1 ? " x" + hex.unit_count : ""));
  if (hex.building) lines.push("Building: " + hex.building + (BUILDING_INCOME[hex.building] ? " (+" + BUILDING_INCOME[hex.building] + "g)" : ""));
  if (hex.col !== undefined) lines.push("(" + hex.col + ", " + hex.row + ")");

  tooltipEl.innerHTML  = lines.join("<br>");
  tooltipEl.className  = "visible";
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
  if (!playerKey) {
    alert("You must join the game first!");
    return;
  }
  if (state.phase !== "playing") {
    alert("Game not started yet.");
    return;
  }
  if (state.current_player !== myUsername) {
    alert("Not your turn!");
    return;
  }

  var buyType = document.getElementById("buyType").value;

  if (buyType) {
    if (hex.type === "impassable") {
      alert("Can't place here: impassable tile.");
      return;
    }


    var isUnit = UNIT_COST[buyType] !== undefined;
    if (isUnit && hex.building) {
      alert("Can't place a unit on a building.");
      return;
    }
    if (!isUnit && isHexOccupied(hex)) {
      alert("Can't place a building here: hex is occupied.");
      return;
    }

    buy(buyType, hex);
    document.getElementById("buyType").value = "";
    return;
  }

  if (!selectedHex) {

    if (!hex.unit) {
      alert("No unit on this tile. Select a tile with your unit to move.");
      return;
    }
    if (hex.owner !== myUsername) {
      alert("That's not your unit.");
      return;
    }
    selectedHex = hex;
    render(); 
  } else {
 
    if (hex.col === selectedHex.col && hex.row === selectedHex.row) {
      selectedHex = null;
      render();
      return;
    }

    if (isValidMove(selectedHex, hex)) {
      moveUnit(selectedHex, hex);
      selectedHex = null;
    } else {
      alert("Invalid move: tiles must be adjacent and the destination must not be blocked by your own unit.");
      selectedHex = null;
      render();
    }
  }
}

function isValidMove(from, to) {
  if (to.type === "impassable") return false;

  if (!isAdjacent(from, to)) return false;


  if (to.owner === myUsername && to.unit) {
    var fromStrength = unitStrength(from.unit);
    var toStrength   = unitStrength(to.unit);
   
    if (!(fromStrength > 1 && toStrength === 1)) {
      return false; 
    }
  }

  if (to.owner === myUsername && to.building && !to.unit) {
    return false;
  }

  return true;
}

function unitStrength(unitName) {
  var s = { peasant: 1, spearman: 2, knight: 3, baron: 4 };
  return s[unitName] || 0;
}

function isAdjacent(a, b) {
  var dc = b.col - a.col;
  var dr = b.row - a.row;

  var evenRow = [
    [+1, 0], [-1, 0], [0, -1], [0, +1], [-1, -1], [-1, +1]
  ];
  var oddRow = [
    [+1, 0], [-1, 0], [0, -1], [0, +1], [+1, -1], [+1, +1]
  ];
  var neighbours = (a.row % 2 === 0) ? evenRow : oddRow;

  for (var i = 0; i < neighbours.length; i++) {
    if (neighbours[i][0] === dc && neighbours[i][1] === dr) return true;
  }
  return false;
}

function isHexOccupied(hex) {
  return !!(hex.unit_image || hex.building_image || hex.unit || hex.building);
}

async function joinGame() {
  var username = document.getElementById("username").value.trim();
  if (!username) {
    alert("Enter a username first.");
    return;
  }

  try {
    var res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", username: username })
    });
    var data = await res.json();

    if (data.player_key) {
      playerKey  = data.player_key;
      myUsername = username;
      localStorage.setItem("username",   myUsername);
      localStorage.setItem("playerKey",  playerKey);
      alert("Joined as '" + username + "'! Press Start Game when all players are in.");
    } else {
      alert(data.error || "Failed to join.");
    }
  } catch (err) {
    console.error("Join failed:", err);
    alert("Network error while joining.");
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
  await post({
    action: "move",
    player_key: playerKey,
    from: { col: from.col, row: from.row },
    to:   { col: to.col,   row: to.row   }
  });
}

async function buy(type, hex) {
  if (hex.type === "impassable") return;
  await post({
    action:     "buy",
    player_key: playerKey,
    type:       type,
    hex:        { col: hex.col, row: hex.row }
  });
}

async function post(body) {
  try {
    var res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) {
      alert(data.error || "Server error.");
    }
    await fetchState();
  } catch (err) {
    console.error("POST failed:", err);
  }
}

document.getElementById("joinBtn").onclick  = joinGame;
document.getElementById("startBtn").onclick = startGame;
document.getElementById("endBtn").onclick   = endTurn;


var tracks = 


var audio      = new Audio();
var trackIndex = 0;
var isPlaying  = false;

var playBtn    = document.getElementById("playBtn");
var prevBtn    = document.getElementById("prevBtn");
var nextBtn    = document.getElementById("nextBtn");
var volSlider  = document.getElementById("volSlider");
var trackName  = document.getElementById("trackName");
var progress   = document.getElementById("progressFill");

function loadTrack(index) {
  if (!tracks.length) {
    trackName.innerText = "No tracks — add .mp3 files";
    return;
  }
  trackIndex = (index + tracks.length) % tracks.length;
  audio.src  = tracks[trackIndex].src;
  trackName.innerText = tracks[trackIndex].title || tracks[trackIndex].src;
  if (isPlaying) audio.play().catch(function(){});
}

function togglePlay() {
  if (!tracks.length) return;
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    playBtn.innerHTML = "&#9654;";
  } else {
    audio.play().then(function() {
      isPlaying = true;
      playBtn.innerHTML = "&#9646;&#9646;";
    }).catch(function(err) {
      console.warn("Autoplay blocked:", err);
    });
  }
}

audio.ontimeupdate = function() {
  if (audio.duration) {
    progress.style.width = ((audio.currentTime / audio.duration) * 100) + "%";
  }
};
audio.onended = function() {
  loadTrack(trackIndex + 1);
  if (isPlaying) audio.play().catch(function(){});
};

playBtn.onclick = togglePlay;
prevBtn.onclick = function() { loadTrack(trackIndex - 1); };
nextBtn.onclick = function() { loadTrack(trackIndex + 1); };
volSlider.oninput = function() {
  audio.volume = parseFloat(volSlider.value);
  document.getElementById("volIcon").innerText =
    audio.volume === 0 ? "🔇" : audio.volume < 0.5 ? "🔉" : "🔊";
};

if (tracks.length) loadTrack(0);


setInterval(fetchState, 1500);
fetchState();
