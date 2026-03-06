const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

// ===== الطلبات =====
let joinRequests = [];

// ===== نظام الفرق =====
let players = {};
let teamChoiceLocked = false;

let teamSettings = {
  left: { name: "الفريق الأيسر", color: "#d8212d" },
  right: { name: "الفريق الأيمن", color: "#f59e0b" },
};

// ===== نظام الزر =====
let buzzState = {
  locked: false,
  lockedBy: null,
  allowedTeam: "both",
  disabledTeams: { left: false, right: false },
};

let buzzerTimer = null;

// ====== MEDIA / SCREEN ======
let hostSocketId = null;
let mediaState = { type: "none", src: "" };
let latestSnapshot = "";

// ===== Widgets: Timer / Point لكل فريق =====
let teamWidgets = {
  left:  { visible: true, mode: "timer", seconds: 15, running: false, points: 0 },
  right: { visible: true, mode: "timer", seconds: 15, running: false, points: 0 },
};

let teamWidgetIntervals = {
  left: null,
  right: null,
};

function emitTeamWidgets() {
  io.emit("teamWidgets", teamWidgets);
}

function stopTeamWidgetTimer(team) {
  if (teamWidgetIntervals[team]) {
    clearInterval(teamWidgetIntervals[team]);
    teamWidgetIntervals[team] = null;
  }
  teamWidgets[team].running = false;
}

function startTeamWidgetTimer(team) {
  if (team !== "left" && team !== "right") return;
  if (teamWidgets[team].running) return;

  teamWidgets[team].running = true;
  emitTeamWidgets();

  teamWidgetIntervals[team] = setInterval(() => {
    if (teamWidgets[team].seconds > 0) {
      teamWidgets[team].seconds--;
      emitTeamWidgets();
    }

    if (teamWidgets[team].seconds <= 0) {
      stopTeamWidgetTimer(team);
      emitTeamWidgets();
    }
  }, 1000);
}

function resetTeamWidgetTimer(team) {
  if (team !== "left" && team !== "right") return;
  stopTeamWidgetTimer(team);
  teamWidgets[team].seconds = 15;
  emitTeamWidgets();
}

function parseTurnUrls(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildIceServers() {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const urls = parseTurnUrls(process.env.TURN_URLS);
  const user = process.env.TURN_USER;
  const pass = process.env.TURN_PASS;

  if (urls.length && user && pass) {
    servers.push({
      urls,
      username: user,
      credential: pass,
    });
  }

  return servers;
}

function emitBuzzState() {
  io.emit("buzzState", buzzState);
}

function resetBuzz(full = false) {
  buzzState.locked = false;
  buzzState.lockedBy = null;
  buzzState.allowedTeam = "both";

  if (full) {
    buzzState.disabledTeams.left = false;
    buzzState.disabledTeams.right = false;
  }

  if (buzzerTimer) {
    clearInterval(buzzerTimer);
    buzzerTimer = null;
  }

  io.emit("timer", 0);
  io.emit("reset");
  emitBuzzState();
}

io.on("connection", (socket) => {
  console.log("🟢 connected:", socket.id);

  socket.on("screenSnapshot", (dataUrl) => {
    latestSnapshot = String(dataUrl || "");
    socket.broadcast.emit("screenSnapshot", latestSnapshot);
  });

  socket.emit("iceServers", buildIceServers());

  socket.emit("mediaState", mediaState);
  if (mediaState.type === "screen" && latestSnapshot) {
    socket.emit("screenSnapshot", latestSnapshot);
  }

  socket.on("registerHost", () => {
    hostSocketId = socket.id;
    console.log("👑 Host registered:", hostSocketId);
    socket.emit("mediaState", mediaState);

    if (mediaState.type === "screen" && latestSnapshot) {
      socket.emit("screenSnapshot", latestSnapshot);
    }
  });

  socket.on("setMedia", (state) => {
    if (socket.id !== hostSocketId) return;
    if (!state || !state.type) return;

    mediaState = { type: state.type, src: String(state.src || "") };

    if (mediaState.type !== "screen") {
      latestSnapshot = "";
    }

    io.emit("mediaState", mediaState);

    if (mediaState.type === "screen" && latestSnapshot) {
      io.emit("screenSnapshot", latestSnapshot);
    }
  });

  socket.on("screenJoin", () => {
    if (!hostSocketId) return;
    io.to(hostSocketId).emit("screenJoin", { guestId: socket.id });
  });

  socket.on("webrtcOffer", ({ to, sdp }) => {
    if (socket.id !== hostSocketId) return;
    if (!to || !sdp) return;
    io.to(to).emit("webrtcOffer", { from: socket.id, sdp });
  });

  socket.on("webrtcAnswer", ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit("webrtcAnswer", { from: socket.id, sdp });
  });

  socket.on("webrtcIce", ({ to, ice }) => {
    if (!to || !ice) return;
    io.to(to).emit("webrtcIce", { from: socket.id, ice });
  });

  socket.emit("teamLockStatus", teamChoiceLocked);
  socket.emit("teamSettings", teamSettings);
  socket.emit("updateRequests", joinRequests);
  socket.emit("updatePlayers", players);
  socket.emit("buzzState", buzzState);
  socket.emit("teamWidgets", teamWidgets);

  /* ======================
     Timer / Point Widgets
  ====================== */
  socket.on("toggleTeamWidgetMode", (team) => {
    if (team !== "left" && team !== "right") return;

    teamWidgets[team].mode = teamWidgets[team].mode === "timer" ? "point" : "timer";
    emitTeamWidgets();
  });

  socket.on("toggleTeamWidgetVisible", (team) => {
    if (team !== "left" && team !== "right") return;

    teamWidgets[team].visible = !teamWidgets[team].visible;
    emitTeamWidgets();
  });

  socket.on("setTeamWidgetPoints", ({ team, value }) => {
    if (team !== "left" && team !== "right") return;

    const num = Number(value);
    teamWidgets[team].points = Number.isFinite(num) ? num : 0;
    emitTeamWidgets();
  });

  socket.on("startTeamWidgetTimer", (team) => {
    if (team !== "left" && team !== "right") return;
    startTeamWidgetTimer(team);
  });

  socket.on("stopTeamWidgetTimer", (team) => {
    if (team !== "left" && team !== "right") return;
    stopTeamWidgetTimer(team);
    emitTeamWidgets();
  });

  socket.on("resetTeamWidgetTimer", (team) => {
    if (team !== "left" && team !== "right") return;
    resetTeamWidgetTimer(team);
  });

  /* ======================
     تحديث اسم/لون الفرق من المقدم
  ====================== */
  socket.on("setTeamSettings", (newSettings) => {
    if (!newSettings || !newSettings.left || !newSettings.right) return;

    teamSettings = {
      left: {
        name: String(newSettings.left.name || teamSettings.left.name),
        color: String(newSettings.left.color || teamSettings.left.color),
      },
      right: {
        name: String(newSettings.right.name || teamSettings.right.name),
        color: String(newSettings.right.color || teamSettings.right.color),
      },
    };

    io.emit("teamSettings", teamSettings);
  });

  /* ======================
     طلبات الدخول
  ====================== */
  socket.on("joinRequest", (name) => {
    const clean = String(name || "").trim();
    if (!clean) return;

    if (Object.keys(players).length === 0) {
      resetBuzz(true);
    }

    joinRequests.push({ id: socket.id, name: clean });

    players[socket.id] = {
      name: clean,
      team: null,
      correctCount: 0,
    };

    io.emit("updateRequests", joinRequests);
    io.emit("updatePlayers", players);
  });

  /* ======================
     قبول/رفض الطلبات
  ====================== */
  socket.on("acceptRequest", (id) => {
    io.to(id).emit("requestAccepted");
    joinRequests = joinRequests.filter((r) => r.id !== id);
    io.emit("updateRequests", joinRequests);
    io.emit("updatePlayers", players);
  });

  socket.on("rejectRequest", (id) => {
    io.to(id).emit("requestRejected");
    joinRequests = joinRequests.filter((r) => r.id !== id);
    delete players[id];
    io.emit("updateRequests", joinRequests);
    io.emit("updatePlayers", players);
  });

  /* ======================
     قفل/فتح اختيار الفرق
  ====================== */
  socket.on("toggleTeamLock", () => {
    teamChoiceLocked = !teamChoiceLocked;
    io.emit("teamLockStatus", teamChoiceLocked);
  });

  /* ======================
     اختيار فريق (ضيف)
  ====================== */
  socket.on("chooseTeam", (team) => {
    if (teamChoiceLocked) return;
    if (!players[socket.id]) return;
    if (team !== "left" && team !== "right") return;

    players[socket.id].team = team;
    io.emit("updatePlayers", players);
  });

  /* ======================
     أدوات المقدم على اللاعبين
  ====================== */
  socket.on("setTeam", ({ id, team }) => {
    if (!players[id]) return;
    if (team !== "left" && team !== "right") return;
    players[id].team = team;
    io.emit("updatePlayers", players);
  });

  socket.on("swapTeam", (id) => {
    if (!players[id]) return;
    if (players[id].team !== "left" && players[id].team !== "right") return;
    players[id].team = players[id].team === "left" ? "right" : "left";
    io.emit("updatePlayers", players);
  });

  socket.on("excludePlayer", (id) => {
    if (!players[id]) return;
    players[id].team = null;
    io.emit("updatePlayers", players);
  });

  socket.on("kickPlayer", (id) => {
    io.to(id).emit("requestRejected");
    delete players[id];
    io.emit("updatePlayers", players);
  });

  /* ======================
     نقاط (➕➖)
  ====================== */
  socket.on("adjustScore", ({ id, delta }) => {
    if (!players[id]) return;
    const d = Number(delta);
    if (!Number.isFinite(d)) return;
    const curr = Number(players[id].correctCount || 0);
    players[id].correctCount = Math.max(0, curr + d);
    io.emit("updatePlayers", players);
  });

  /* ======================
     زر اللعبة (Buzz)
  ====================== */
  socket.on("buzz", () => {
    const p = players[socket.id];
    if (!p) return;

    if (p.team !== "left" && p.team !== "right") return;
    if (buzzState.disabledTeams[p.team]) return;
    if (buzzState.allowedTeam !== "both" && buzzState.allowedTeam !== p.team) return;
    if (buzzState.locked) return;

    buzzState.locked = true;
    buzzState.lockedBy = { id: socket.id, name: p.name, team: p.team };
    emitBuzzState();

    const teamName = teamSettings[p.team].name;
    io.emit("buzzedInfo", { name: p.name, teamKey: p.team, teamName });

    let timeLeft = 5;
    io.emit("timer", timeLeft);

    if (buzzerTimer) clearInterval(buzzerTimer);
    buzzerTimer = setInterval(() => {
      timeLeft--;
      io.emit("timer", timeLeft);
      if (timeLeft <= 0) {
        clearInterval(buzzerTimer);
        buzzerTimer = null;
        io.emit("timeUp");
      }
    }, 1000);
  });

  /* ======================
     حكم المقدم: صح/خطأ
  ====================== */
  socket.on("judgeAnswer", ({ correct }) => {
    if (!buzzState.locked || !buzzState.lockedBy) return;

    const { id, team } = buzzState.lockedBy;

    if (correct === true) {
      if (players[id]) players[id].correctCount = (players[id].correctCount || 0) + 1;
      io.emit("updatePlayers", players);

      resetBuzz(true);
      io.emit("judgeResult", { result: "correct" });
      return;
    }

    if (correct === false) {
      buzzState.locked = false;
      buzzState.disabledTeams[team] = true;
      buzzState.lockedBy = null;
      buzzState.allowedTeam = team === "left" ? "right" : "left";

      if (buzzerTimer) {
        clearInterval(buzzerTimer);
        buzzerTimer = null;
      }
      io.emit("timer", 0);
      io.emit("reset");
      emitBuzzState();

      io.emit("judgeResult", { result: "wrong", lockedTeam: team });
      return;
    }
  });

  /* ======================
     تحكم المقدم بالزر
  ====================== */
  socket.on("resetBuzz", () => resetBuzz(true));

  socket.on("lockTeamBuzz", (team) => {
    if (team !== "left" && team !== "right") return;

    buzzState.disabledTeams[team] = true;
    buzzState.allowedTeam = team === "left" ? "right" : "left";
    buzzState.locked = false;
    buzzState.lockedBy = null;

    io.emit("timer", 0);
    io.emit("reset");
    emitBuzzState();
  });

  socket.on("openTeamBuzz", (team) => {
    if (team !== "left" && team !== "right") return;

    buzzState.allowedTeam = team;
    buzzState.disabledTeams[team] = false;

    buzzState.locked = false;
    buzzState.lockedBy = null;

    io.emit("timer", 0);
    io.emit("reset");
    emitBuzzState();
  });

  socket.on("reset", () => {
    buzzState.locked = false;
    buzzState.lockedBy = null;

    if (buzzerTimer) {
      clearInterval(buzzerTimer);
      buzzerTimer = null;
    }
    io.emit("timer", 0);
    io.emit("reset");
    emitBuzzState();
  });

  socket.on("disconnect", () => {
    const wasHost = socket.id === hostSocketId;

    joinRequests = joinRequests.filter((r) => r.id !== socket.id);
    delete players[socket.id];

    io.emit("updateRequests", joinRequests);
    io.emit("updatePlayers", players);

    if (buzzState.lockedBy && buzzState.lockedBy.id === socket.id) {
      buzzState.locked = false;
      buzzState.lockedBy = null;
      emitBuzzState();
    }

    if (wasHost) {
      hostSocketId = null;
      mediaState = { type: "none", src: "" };
      latestSnapshot = "";
      io.emit("mediaState", mediaState);

      stopTeamWidgetTimer("left");
      stopTeamWidgetTimer("right");
      emitTeamWidgets();

      console.log("👑 Host left, media cleared");
    }

    console.log("🔴 disconnected:", socket.id);
  });
});

http.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
