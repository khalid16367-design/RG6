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

/* =====================================================
   ✅ MEDIA / SCREEN SHARE (FIXED)  (لا يمس باقي اللعبة)
===================================================== */
let hostId = null; // socket.id للمقدم
let mediaState = { type: "none", src: "" }; // none | image | url | screen

function getIceServers() {
  const list = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // TURN من ENV (Render)
  if (process.env.TURN_URL && process.env.TURN_USER && process.env.TURN_PASS) {
    list.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USER,
      credential: process.env.TURN_PASS,
    });
  }

  return list;
}
/* ===================================================== */

io.on("connection", (socket) => {
  console.log("🟢 connected:", socket.id);

  /* ======================
     ✅ MEDIA / WEBRTC (Fixed)
  ====================== */
  // أرسل ICE + حالة الميديا لأي أحد يدخل
  socket.emit("iceServers", getIceServers());
  socket.emit("mediaState", mediaState);

  // تسجيل المقدم
  socket.on("registerHost", () => {
    hostId = socket.id;
    console.log("👑 Host registered:", hostId);
    socket.emit("mediaState", mediaState);
  });

  // تحكم الميديا: فقط المقدم
  socket.on("setMedia", (state) => {
    if (socket.id !== hostId) return; // ✅ فقط المقدم
    if (!state || !state.type) return;

    mediaState = { type: state.type, src: String(state.src || "") };
    io.emit("mediaState", mediaState);
  });

  // الضيف يطلب اتصال (مشاركة شاشة)
  socket.on("screenJoin", () => {
    if (!hostId) return;
    io.to(hostId).emit("screenJoin", { guestId: socket.id });
  });

  // Relay إشارات WebRTC
  socket.on("webrtcOffer", ({ to, sdp }) => {
    if (socket.id !== hostId) return; // offer من المقدم فقط
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
  /* ====================== */

  // إرسال الحالة عند الدخول
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
    console.log("✅ acceptRequest from", socket.id, "target", id);

    io.to(id).emit("requestAccepted");

    joinRequests = joinRequests.filter((r) => r.id !== id);
    io.emit("updateRequests", joinRequests);
    io.emit("updatePlayers", players);
  });

  socket.on("rejectRequest", (id) => {
    console.log("❌ rejectRequest from", socket.id, "target", id);

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
  socket.on("buzz", ({ name }) => {
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
    io.emit("buzzedInfo", {
      name: p.name,
      teamKey: p.team,
      teamName,
    });

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
    console.log("⚖️ server: judgeAnswer", correct);

    if (!buzzState.locked || !buzzState.lockedBy) return;

    const { id, team } = buzzState.lockedBy;

    if (correct === true) {
      if (players[id]) {
        players[id].correctCount = (players[id].correctCount || 0) + 1;
      }
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
  socket.on("resetBuzz", () => {
    console.log("🟥 server: resetBuzz received");
    resetBuzz(true);
  });

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

    buzzState.disabledTeams.left = false;
    buzzState.disabledTeams.right = false;
    buzzState.allowedTeam = team;
    buzzState.locked = false;
    buzzState.lockedBy = null;

    io.emit("timer", 0);
    io.emit("reset");
    emitBuzzState();
  });

  /* ======================
     Reset القديم
  ====================== */
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
    // حذف طلبات/لاعبين
    joinRequests = joinRequests.filter((r) => r.id !== socket.id);
    delete players[socket.id];

    io.emit("updateRequests", joinRequests);
    io.emit("updatePlayers", players);

    // إذا اللي طق الزر طلع
    if (buzzState.lockedBy && buzzState.lockedBy.id === socket.id) {
      buzzState.locked = false;
      buzzState.lockedBy = null;
      emitBuzzState();
    }

    // إذا المقدم طلع، نفك الميديا
    if (socket.id === hostId) {
      hostId = null;
      mediaState = { type: "none", src: "" };
      io.emit("mediaState", mediaState);
      console.log("👑 Host disconnected -> media reset");
    }

    console.log("🔴 disconnected:", socket.id);
  });
});

http.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
