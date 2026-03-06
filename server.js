const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

// ===== الطلبات =====
let joinRequests = []; // { id, name }

// ===== نظام الفرق =====
let players = {}; // socketId: { name, team: null|"left"|"right", correctCount }
let teamChoiceLocked = false;

let teamSettings = {
  left: { name: "الفريق الأيسر", color: "#d8212d" },
  right: { name: "الفريق الأيمن", color: "#f59e0b" },
};

// ===== نظام الزر =====
let buzzState = {
  locked: false,
  lockedBy: null, // { id, name, team }
  allowedTeam: "both", // "both" | "left" | "right"
  disabledTeams: { left: false, right: false },
};

let buzzerTimer = null;

// ====== MEDIA / SCREEN (الجديد) ======
let hostSocketId = null; // المقدم الحالي
let mediaState = { type: "none", src: "" }; // none | image | url | screen

function parseTurnUrls(str) {
  // يسمح لك تحط أكثر من رابط مفصول بفاصلة
  return String(str || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function buildIceServers() {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // TURN من ENV (Render)
  // TURN_URLS مثال: "turn:global.relay.metered.ca:80?transport=udp,turn:global.relay.metered.ca:443?transport=tcp,turns:global.relay.metered.ca:443?transport=tcp"
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

// أرسل الحالة للجميع
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

  // ====== أرسل إعدادات ICE (STUN/TURN) لكل شخص ======
  socket.emit("iceServers", buildIceServers());

  // ====== MEDIA: أرسل الحالة الحالية أول ما يدخل ======
  socket.emit("mediaState", mediaState);

  // ====== تسجيل المقدم ======
  socket.on("registerHost", () => {
    hostSocketId = socket.id;
    console.log("👑 Host registered:", hostSocketId);

    // لما يسجل نفسه مقدم نعطيه الحالة الحالية
    socket.emit("mediaState", mediaState);
  });

  // ====== المقدم فقط يقدر يغير media ======
  socket.on("setMedia", (state) => {
    if (socket.id !== hostSocketId) return; // ✅ فقط المقدم
    if (!state || !state.type) return;

    mediaState = { type: state.type, src: String(state.src || "") };
    io.emit("mediaState", mediaState);
  });

  // ====== WebRTC signaling relay (Offer/Answer/ICE) ======
  // الضيف يطلب اتصال شاشة
  socket.on("screenJoin", () => {
    if (!hostSocketId) return;
    io.to(hostSocketId).emit("screenJoin", { guestId: socket.id });
  });

  // offer من المقدم فقط
  socket.on("webrtcOffer", ({ to, sdp }) => {
    if (socket.id !== hostSocketId) return;
    if (!to || !sdp) return;
    io.to(to).emit("webrtcOffer", { from: socket.id, sdp });
  });

  // answer من أي ضيف -> للمقدم
  socket.on("webrtcAnswer", ({ to, sdp }) => {
    if (!to || !sdp) return;
    io.to(to).emit("webrtcAnswer", { from: socket.id, sdp });
  });

  socket.on("webrtcIce", ({ to, ice }) => {
    if (!to || !ice) return;
    io.to(to).emit("webrtcIce", { from: socket.id, ice });
  });

  // ====== إرسال الحالة عند الدخول (باقي مشروعك كما هو) ======
  socket.emit("teamLockStatus", teamChoiceLocked);
  socket.emit("teamSettings", teamSettings);
  socket.emit("updateRequests", joinRequests);
  socket.emit("updatePlayers", players);
  socket.emit("buzzState", buzzState);

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

    // ✅ إذا هذا أول لاعب يدخل (بداية جديدة) رجّع الزر للوضع الطبيعي
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
     ✅ قبول/رفض الطلبات
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
     تحكم المقدم بالزر (صور)
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

  // افتح اللعب لفريق واحد فقط
  // بدون ما نغيّر قفل الفريق الثاني
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
    joinRequests = joinRequests.filter((r) => r.id !== socket.id);
    delete players[socket.id];

    io.emit("updateRequests", joinRequests);
    io.emit("updatePlayers", players);

    if (buzzState.lockedBy && buzzState.lockedBy.id === socket.id) {
      buzzState.locked = false;
      buzzState.lockedBy = null;
      emitBuzzState();
    }

    // إذا المقدم طلع
    if (socket.id === hostSocketId) {
      hostSocketId = null;
      // اختياري: ترجع الميديا فاضية إذا المقدم طلع
      mediaState = { type: "none", src: "" };
      io.emit("mediaState", mediaState);
      console.log("👑 Host left, media cleared");
    }

    console.log("🔴 disconnected:", socket.id);
  });
});

http.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});

