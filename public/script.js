document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  console.log("✅ script.js loaded");


  // ===== WebRTC signaling للشاشة =====
socket.on("viewer:join", () => {
  // نبلغ كل المقدمين/الكل أن فيه مشاهد جديد (بنستعمله عند المقدم فقط)
  io.emit("viewer:joined", { viewerId: socket.id });
});

socket.on("webrtc:signal", ({ to, signal }) => {
  if (!to || !signal) return;
  io.to(to).emit("webrtc:signal", { from: socket.id, signal });
});

  // ====== معرفي ======
  let myId = null;
  socket.on("connect", () => { myId = socket.id; });

  

  // ====== عام ======
  const statusText = document.getElementById("status");
  const timerText = document.getElementById("timer");

  // ====== شاشات الضيف ======
  const requestScreen = document.getElementById("requestScreen");
  const waitingScreen = document.getElementById("waitingScreen");
  const gameScreen = document.getElementById("gameScreen");
  const nameInput = document.getElementById("playerName");
  const sendRequestBtn = document.getElementById("sendRequestBtn");

  // ====== الضيف: فرق ======
  const gJoinLeft = document.getElementById("gJoinLeft");
  const gJoinRight = document.getElementById("gJoinRight");
  const gLeftCount = document.getElementById("gLeftCount");
  const gRightCount = document.getElementById("gRightCount");
  const gLeftPlayers = document.getElementById("gLeftPlayers");
  const gRightPlayers = document.getElementById("gRightPlayers");
  const gLeftCard = document.getElementById("gLeftCard");
  const gRightCard = document.getElementById("gRightCard");
  const gLeftName = document.getElementById("gLeftName");
  const gRightName = document.getElementById("gRightName");

  // ====== المقدم ======
  const requestsContainer = document.getElementById("requestsContainer");
  const lockTeamsBtn = document.getElementById("lockTeamsBtn");
  const resetBtn = document.getElementById("resetBtn");

  const leftTeamNameInput = document.getElementById("leftTeamName");
  const rightTeamNameInput = document.getElementById("rightTeamName");
  const leftCard = document.getElementById("leftCard");
  const rightCard = document.getElementById("rightCard");

  const leftTeam = document.getElementById("leftTeam");
  const rightTeam = document.getElementById("rightTeam");
  const noTeam = document.getElementById("noTeam");
  const leftCount = document.getElementById("leftCount");
  const rightCount = document.getElementById("rightCount");

  // ====== لوحة تم ضغط الزر (ضيف) ======
  const buzzOverlay = document.getElementById("buzzOverlay");
  const buzzInfo = document.getElementById("buzzInfo");
  const buzzTimer = document.getElementById("buzzTimer");
  const buzzTimeUp = document.getElementById("buzzTimeUp");

  // ====== لوحة تم ضغط الزر (مقدم) ======
  const hostBuzzPanel = document.getElementById("hostBuzzPanel");
  const hostBuzzInfo = document.getElementById("hostBuzzInfo");
  const hostBuzzTimer = document.getElementById("hostBuzzTimer");
  const hostBuzzTimeUp = document.getElementById("hostBuzzTimeUp");
  const markCorrectBtn = document.getElementById("markCorrectBtn");
  const markWrongBtn = document.getElementById("markWrongBtn");

  // ====== قفل/فتح داخل الكروت (المقدم) ======
  const leftLockBtn = document.getElementById("leftLockBtn");
  const leftOpenBtn = document.getElementById("leftOpenBtn");
  const rightLockBtn2 = document.getElementById("rightLockBtn2");
  const rightOpenBtn2 = document.getElementById("rightOpenBtn2");
  const leftLockBadge = document.getElementById("leftLockBadge");
  const rightLockBadge = document.getElementById("rightLockBadge");

  // ====== تحكم صور (تحت) ======
  const lockLeftBtn = document.getElementById("lockLeftBtn");
  const openLeftBtn = document.getElementById("openLeftBtn");
  const lockRightBtn = document.getElementById("lockRightBtn");
  const openRightBtn = document.getElementById("openRightBtn");

  // ===== WebRTC signaling للشاشة =====
socket.on("viewer:join", () => {
  // نبلغ كل المقدمين/الكل أن فيه مشاهد جديد (بنستعمله عند المقدم فقط)
  io.emit("viewer:joined", { viewerId: socket.id });
});

const shareScreenBtn = document.getElementById("shareScreenBtn");

if (shareScreenBtn) {
  shareScreenBtn.onclick = async () => {
    try {
      hostStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // عرضها عند المقدم
      if (stageVideo) {
        stageVideo.srcObject = hostStream;
        stageVideo.muted = true;
        await stageVideo.play().catch(()=>{});
      }

      // لو وقفت المشاركة من النظام
      hostStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopHostingScreen();
      });

      // أي ضيف جديد يدخل بعد التشغيل لازم نرسل له
      // (الضيوف بيعطوننا viewer:joined)
      console.log("✅ Screen sharing started");
    } catch (e) {
      console.log("❌ share error", e);
      alert("ما قدرت أشارك الشاشة");
    }
  };
}

function stopHostingScreen() {
  // اقفل اتصالات الضيوف
  Object.values(hostPeers).forEach(p => {
    try { p.destroy(); } catch {}
  });
  for (const k in hostPeers) delete hostPeers[k];

  // وقف الستريم
  if (hostStream) {
    hostStream.getTracks().forEach(t => t.stop());
    hostStream = null;
  }

  // فضّي الفيديو
  if (stageVideo) stageVideo.srcObject = null;

  console.log("🧹 Screen sharing stopped");
}

socket.on("viewer:joined", ({ viewerId }) => {
  // لا تسوي شيء إذا ما عندك ستريم شغال
  if (!hostStream) return;

  // مهم: لا تسوي peer لنفسك
  if (!viewerId || viewerId === socket.id) return;

  // إذا موجود قبل لا تعيد
  if (hostPeers[viewerId]) return;

  const peer = new SimplePeer({
    initiator: true,
    trickle: false,
    stream: hostStream,
  });

  hostPeers[viewerId] = peer;

  peer.on("signal", (signal) => {
    socket.emit("webrtc:signal", { to: viewerId, signal });
  });

  peer.on("close", () => {
    delete hostPeers[viewerId];
  });

  peer.on("error", (err) => {
    console.log("peer error", err);
    delete hostPeers[viewerId];
  });
});

// الضيف يقول: أنا مشاهد
socket.emit("viewer:join");

socket.on("webrtc:signal", async ({ from, signal }) => {
  // ===== الضيف =====
  // إذا ما عنده peer، ينشئ واحد (غير initiator)
  if (!viewerPeer) {
    viewerPeer = new SimplePeer({
      initiator: false,
      trickle: false,
    });

    viewerPeer.on("signal", (sig) => {
      socket.emit("webrtc:signal", { to: from, signal: sig });
    });

    viewerPeer.on("stream", async (stream) => {
      if (stageVideo) {
        stageVideo.srcObject = stream;
        stageVideo.muted = true; // عشان autoplay
        await stageVideo.play().catch(()=>{});
      }
    });

    viewerPeer.on("close", () => {
      viewerPeer = null;
    });

    viewerPeer.on("error", (e) => {
      console.log("viewerPeer error", e);
      viewerPeer = null;
    });
  }

  // استقبل الإشارة
  try {
    viewerPeer.signal(signal);
  } catch (e) {
    console.log("signal error", e);
  }
});

socket.on("webrtc:signal", ({ to, signal }) => {
  if (!to || !signal) return;
  io.to(to).emit("webrtc:signal", { from: socket.id, signal });
});

  // ====== زر اللعبة ======
  const buzzBtn = document.getElementById("buzzBtn");

  // ====== بيانات ======
  let playerName = "";
  let currentTeamSettings = null;
  let lastBuzzState = null;
  let myTeam = null;

  // =========================
  // طلب دخول (ضيف)
  // =========================
  if (sendRequestBtn) {
    sendRequestBtn.addEventListener("click", () => {
      const name = nameInput ? nameInput.value.trim() : "";
      if (!name) return alert("اكتب اسمك");

      playerName = name;
      socket.emit("joinRequest", name);

      if (requestScreen) requestScreen.classList.add("hidden");
      if (waitingScreen) waitingScreen.classList.remove("hidden");
    });
  }

  socket.on("requestAccepted", () => {
    if (waitingScreen) waitingScreen.classList.add("hidden");
    if (gameScreen) gameScreen.classList.remove("hidden");
  });

  socket.on("requestRejected", () => {
    if (waitingScreen) waitingScreen.classList.add("hidden");
    if (requestScreen) requestScreen.classList.remove("hidden");
    alert("تم رفض طلبك ❌");
  });

  // =========================
  // طلبات (مقدم)
  // =========================
  // =========================
// طلبات (مقدم) - بطريقة مضمونة
// =========================
if (requestsContainer) {
  // كليك واحد لكل الأزرار (قبول/رفض)
  requestsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (!id || !action) return;

    console.log("🟦 host click:", action, id);

    if (action === "accept") socket.emit("acceptRequest", id);
    if (action === "reject") socket.emit("rejectRequest", id);
  });
}

socket.on("updateRequests", (requests) => {
  if (!requestsContainer) return;

  console.log("📩 updateRequests:", requests);

  requestsContainer.innerHTML = "";

  requests.forEach((req) => {
    const box = document.createElement("div");
    box.className = "request-card";

    const nm = document.createElement("span");
    nm.textContent = req.name;

    const accept = document.createElement("button");
    accept.className = "accept";
    accept.type = "button";
    accept.textContent = "✅";
    accept.dataset.action = "accept";
    accept.dataset.id = req.id;

    const reject = document.createElement("button");
    reject.className = "reject";
    reject.type = "button";
    reject.textContent = "❌";
    reject.dataset.action = "reject";
    reject.dataset.id = req.id;

    box.append(nm, accept, reject);
    requestsContainer.appendChild(box);
  });
});

  // =========================
  // قفل اختيار الفرق
  // =========================
  if (lockTeamsBtn) lockTeamsBtn.onclick = () => socket.emit("toggleTeamLock");

  socket.on("teamLockStatus", (locked) => {
    if (lockTeamsBtn) lockTeamsBtn.textContent = locked ? "فتح اختيار الفرق" : "قفل اختيار الفرق";
    if (gJoinLeft) gJoinLeft.disabled = locked;
    if (gJoinRight) gJoinRight.disabled = locked;
  });

  // اختيار فريق (ضيف)
  if (gJoinLeft) gJoinLeft.onclick = () => socket.emit("chooseTeam", "left");
  if (gJoinRight) gJoinRight.onclick = () => socket.emit("chooseTeam", "right");

  // =========================
  // إعدادات الفرق (اسم/لون)
  // =========================
  function sendTeamSettingsToServer() {
    if (!currentTeamSettings) return;

    const payload = {
      left: {
        name: leftTeamNameInput ? leftTeamNameInput.value : currentTeamSettings.left.name,
        color: currentTeamSettings.left.color,
      },
      right: {
        name: rightTeamNameInput ? rightTeamNameInput.value : currentTeamSettings.right.name,
        color: currentTeamSettings.right.color,
      },
    };

    socket.emit("setTeamSettings", payload);
  }

  socket.on("teamSettings", (settings) => {
    currentTeamSettings = settings;

    // الضيف
    if (gLeftName) gLeftName.textContent = settings.left.name;
    if (gRightName) gRightName.textContent = settings.right.name;
    if (gLeftCard) gLeftCard.style.background = settings.left.color;
    if (gRightCard) gRightCard.style.background = settings.right.color;

    // المقدم
    if (leftTeamNameInput) leftTeamNameInput.value = settings.left.name;
    if (rightTeamNameInput) rightTeamNameInput.value = settings.right.name;
    if (leftCard) leftCard.style.background = settings.left.color;
    if (rightCard) rightCard.style.background = settings.right.color;
  });

  if (leftTeamNameInput) leftTeamNameInput.addEventListener("input", sendTeamSettingsToServer);
  if (rightTeamNameInput) rightTeamNameInput.addEventListener("input", sendTeamSettingsToServer);

  document.querySelectorAll(".color").forEach((btn) => {
    const c = btn.dataset.color;
    if (c) btn.style.background = c;

    btn.addEventListener("click", () => {
      const team = btn.dataset.team;
      const color = btn.dataset.color;
      if (!team || !color) return;
      if (!currentTeamSettings) return;

      if (team === "left") currentTeamSettings.left.color = color;
      if (team === "right") currentTeamSettings.right.color = color;

      sendTeamSettingsToServer();
    });
  });

  // =========================
  // رسم اللاعبين (ضيف + مقدم)
  // =========================
  socket.on("updatePlayers", (players) => {
    // عرف فريقي أنا
    if (myId && players[myId]) myTeam = players[myId].team || null;
    else myTeam = null;

    // --- ضيف ---
    if (gLeftPlayers) gLeftPlayers.innerHTML = "";
    if (gRightPlayers) gRightPlayers.innerHTML = "";

    let l = 0, r = 0;
    Object.values(players).forEach((p) => {
      const score = p.correctCount || 0;

      if (p.team === "left") {
        l++;
        if (gLeftPlayers) {
          const row = document.createElement("div");
          row.className = "player-item";
          row.innerHTML = `<span>${p.name}</span><span>✅${score}</span>`;
          gLeftPlayers.appendChild(row);
        }
      }

      if (p.team === "right") {
        r++;
        if (gRightPlayers) {
          const row = document.createElement("div");
          row.className = "player-item";
          row.innerHTML = `<span>${p.name}</span><span>✅${score}</span>`;
          gRightPlayers.appendChild(row);
        }
      }
        // ✅ بعد ما عرفنا فريقي، حدّث الزر فوراً
    if (lastBuzzState) setBuzzVisual(lastBuzzState);
    });

    if (gLeftCount) gLeftCount.textContent = l;
    if (gRightCount) gRightCount.textContent = r;

    // --- مقدم ---
    if (!noTeam || !leftTeam || !rightTeam) return;

    if (leftCount) leftCount.textContent = l;
    if (rightCount) rightCount.textContent = r;

    noTeam.innerHTML = "";
    leftTeam.innerHTML = "";
    rightTeam.innerHTML = "";

    Object.entries(players).forEach(([id, p]) => {
      const score = p.correctCount || 0;

      // داخل فريق (مقدم)
      if (p.team === "left" || p.team === "right") {
        const row = document.createElement("div");
        row.className = "player-item host-row";

        const info = document.createElement("span");
        info.className = "pinfo";
        info.textContent = `${p.name} | ✅${score}`;

        const controls = document.createElement("div");
        controls.className = "pcontrols";

        const minus = document.createElement("button");
        minus.textContent = "➖";
        minus.onclick = () => socket.emit("adjustScore", { id, delta: -1 });

        const plus = document.createElement("button");
        plus.textContent = "➕";
        plus.onclick = () => socket.emit("adjustScore", { id, delta: 1 });

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "❌";
        removeBtn.onclick = () => socket.emit("excludePlayer", id);

        const swapBtn = document.createElement("button");
        swapBtn.textContent = "🔀";
        swapBtn.onclick = () => socket.emit("swapTeam", id);

        controls.append(minus, plus, removeBtn, swapBtn);
        row.append(info, controls);

        if (p.team === "left") leftTeam.appendChild(row);
        else rightTeam.appendChild(row);

        return;
      }

      // بدون فريق (مقدم)
      const box = document.createElement("div");
      box.className = "noTeamPlayer";

      const nm = document.createElement("span");
      nm.textContent = `${p.name} | ✅${score}`;

      const btns = document.createElement("div");
      btns.className = "noTeamBtns";

      const leftBtn = document.createElement("button");
      leftBtn.textContent = "➡️";
      leftBtn.onclick = () => socket.emit("setTeam", { id, team: "left" });

      const rightBtn = document.createElement("button");
      rightBtn.textContent = "⬅️";
      rightBtn.onclick = () => socket.emit("setTeam", { id, team: "right" });

      const kickBtn = document.createElement("button");
      kickBtn.textContent = "⚠️";
      kickBtn.onclick = () => socket.emit("kickPlayer", id);

      const minus = document.createElement("button");
      minus.textContent = "➖";
      minus.onclick = () => socket.emit("adjustScore", { id, delta: -1 });

      const plus = document.createElement("button");
      plus.textContent = "➕";
      plus.onclick = () => socket.emit("adjustScore", { id, delta: 1 });

      btns.append(leftBtn, rightBtn, kickBtn, minus, plus);
      box.append(nm, btns);
      noTeam.appendChild(box);
    });
  });

  // =========================
  // شكل الزر حسب الحالة
  // =========================
  function setBuzzVisual(state) {
    if (!buzzBtn) return;

    buzzBtn.classList.remove("buzz-red", "buzz-green", "buzz-grey");

    // لازم يختار فريق
    if (myTeam !== "left" && myTeam !== "right") {
      buzzBtn.classList.add("buzz-red");
      buzzBtn.disabled = true;
      return;
    }

    // مقفل بسبب ضغط
    if (state.locked) {
      if (state.lockedBy && state.lockedBy.id === myId) {
        buzzBtn.classList.add("buzz-green");
      } else {
        buzzBtn.classList.add("buzz-grey");
      }
      buzzBtn.disabled = true;
      return;
    }

    // فريقي ممنوع
    if (state.disabledTeams && state.disabledTeams[myTeam]) {
      buzzBtn.classList.add("buzz-grey");
      buzzBtn.disabled = true;
      return;
    }

    // السماح لفريق آخر
    if (state.allowedTeam !== "both" && state.allowedTeam !== myTeam) {
      buzzBtn.classList.add("buzz-grey");
      buzzBtn.disabled = true;
      return;
    }

    // مسموح
    buzzBtn.classList.add("buzz-red");
    buzzBtn.disabled = false;
  }

  socket.on("buzzState", (state) => {
    lastBuzzState = state;
    setBuzzVisual(state);

    // شارات القفل داخل الكروت
    if (leftLockBadge) {
      leftLockBadge.classList.toggle("hidden", !(state.disabledTeams && state.disabledTeams.left));
    }
    if (rightLockBadge) {
      rightLockBadge.classList.toggle("hidden", !(state.disabledTeams && state.disabledTeams.right));
    }
  });

  // ضغط زر الضيف
  if (buzzBtn) {
    buzzBtn.addEventListener("click", () => {
      if (myTeam !== "left" && myTeam !== "right") return alert("اختر فريق أولاً 👈");
      if (!playerName) return alert("اكتب اسمك أولاً");

      if (lastBuzzState) {
        if (lastBuzzState.locked) return;
        if (lastBuzzState.disabledTeams && lastBuzzState.disabledTeams[myTeam]) return alert("فريقك مقفل حالياً 🔒");
        if (lastBuzzState.allowedTeam !== "both" && lastBuzzState.allowedTeam !== myTeam) return alert("الدور للفريق الثاني ⛔");
      }

      socket.emit("buzz", { name: playerName });
    });
  }

  // =========================
  // تم ضغط الزر (ضيف + مقدم)
  // =========================
  socket.on("buzzedInfo", (info) => {
    if (!info || !info.name) return;

    const color = currentTeamSettings
      ? (info.teamKey === "left" ? currentTeamSettings.left.color : currentTeamSettings.right.color)
      : "#d8212d";

    // ضيف
    if (buzzOverlay && buzzInfo) {
      buzzInfo.innerHTML = `اللاعب: <b>${info.name}</b><br>الفريق: <b>${info.teamName}</b>`;
      const card = buzzOverlay.querySelector(".buzz-card");
      if (card) card.style.background = color;
      if (buzzTimeUp) buzzTimeUp.classList.add("hidden");
      buzzOverlay.classList.remove("hidden");
    }

    // مقدم
    if (hostBuzzPanel && hostBuzzInfo) {
      hostBuzzInfo.innerHTML = `اللاعب: <b>${info.name}</b><br>الفريق: <b>${info.teamName}</b>`;
      const card = hostBuzzPanel.querySelector(".buzz-card");
      if (card) card.style.background = color;
      if (hostBuzzTimeUp) hostBuzzTimeUp.classList.add("hidden");
      hostBuzzPanel.classList.remove("hidden");
    }
  });

  // =========================
  // صح/خطأ + Reset (مقدم)
  // =========================
  if (markCorrectBtn) markCorrectBtn.onclick = () => socket.emit("judgeAnswer", { correct: true });
  if (markWrongBtn) markWrongBtn.onclick = () => socket.emit("judgeAnswer", { correct: false });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      console.log("🟥 Host Reset clicked -> resetBuzz");
      socket.emit("resetBuzz");
    });
  }

  if (leftLockBtn) leftLockBtn.onclick = () => socket.emit("lockTeamBuzz", "left");
  if (leftOpenBtn) leftOpenBtn.onclick = () => socket.emit("openTeamBuzz", "left");
  if (rightLockBtn2) rightLockBtn2.onclick = () => socket.emit("lockTeamBuzz", "right");
  if (rightOpenBtn2) rightOpenBtn2.onclick = () => socket.emit("openTeamBuzz", "right");

  if (lockLeftBtn) lockLeftBtn.onclick = () => socket.emit("lockTeamBuzz", "left");
  if (openLeftBtn) openLeftBtn.onclick = () => socket.emit("openTeamBuzz", "left");
  if (lockRightBtn) lockRightBtn.onclick = () => socket.emit("lockTeamBuzz", "right");
  if (openRightBtn) openRightBtn.onclick = () => socket.emit("openTeamBuzz", "right");

  // بعد الحكم نخفي لوحات الحكم
  socket.on("judgeResult", () => {
    if (hostBuzzPanel) hostBuzzPanel.classList.add("hidden");
    if (buzzOverlay) buzzOverlay.classList.add("hidden");
  });

  // Timer / TimeUp
  socket.on("timer", (t) => {
    if (timerText) timerText.textContent = "Timer: " + t;
    if (buzzTimer) buzzTimer.textContent = "Timer: " + t;
    if (hostBuzzTimer) hostBuzzTimer.textContent = "Timer: " + t;

    if (t > 0) {
      if (buzzTimeUp) buzzTimeUp.classList.add("hidden");
      if (hostBuzzTimeUp) hostBuzzTimeUp.classList.add("hidden");
    }
  });

  socket.on("timeUp", () => {
    if (buzzTimeUp) buzzTimeUp.classList.remove("hidden");
    if (hostBuzzTimeUp) hostBuzzTimeUp.classList.remove("hidden");
    if (statusText) statusText.textContent = "انتهى الوقت";
  });

  // Reset يرجع النصوص ويخفي اللوحات
  socket.on("reset", () => {
    if (statusText) statusText.textContent = "بانتظار الضغط...";
    if (timerText) timerText.textContent = "Timer: 0";

    if (buzzOverlay) buzzOverlay.classList.add("hidden");
    if (buzzInfo) buzzInfo.innerHTML = "";

    if (hostBuzzPanel) hostBuzzPanel.classList.add("hidden");
    if (hostBuzzInfo) hostBuzzInfo.innerHTML = "";
    if (hostBuzzTimer) hostBuzzTimer.textContent = "Timer: 0";
    if (hostBuzzTimeUp) hostBuzzTimeUp.classList.add("hidden");
  });
  // ===== MEDIA SCREEN (Host + Guest) =====
const mediaFrame = document.getElementById("mediaFrame");
const mediaImg = document.getElementById("mediaImg");
const mediaVideo = document.getElementById("mediaVideo");
const mediaPlaceholder = document.getElementById("mediaPlaceholder");

const btnShareScreen = document.getElementById("btnShareScreen");
const btnAddImage = document.getElementById("btnAddImage");
const btnAddLink = document.getElementById("btnAddLink");
const btnRemoveMedia = document.getElementById("btnRemoveMedia");

const isHost = !!document.getElementById("requestsContainer"); // علامة إن الصفحة مقدم

let hostStream = null;
let pcs = {}; // host: guestId -> RTCPeerConnection
let guestPc = null;

// عرف نفسك كمقدم
if (isHost) socket.emit("imHost");

function hideAllMedia(){
  if (mediaFrame) mediaFrame.classList.add("hidden");
  if (mediaImg) mediaImg.classList.add("hidden");
  if (mediaVideo) mediaVideo.classList.add("hidden");
}

function updateRemoveBtn(state){
  if (!btnRemoveMedia) return;
  const show = state.type !== "none";
  btnRemoveMedia.classList.toggle("hidden", !show);
}

function showPlaceholderForGuest(state){
  if (!mediaPlaceholder) return;
  // الضيف فقط: إذا ما فيه شيء، أظهر العبارة
  if (!isHost && state.type === "none") mediaPlaceholder.classList.remove("hidden");
  else mediaPlaceholder.classList.add("hidden");
}

socket.on("mediaState", (state) => {
  hideAllMedia();
  updateRemoveBtn(state);
  showPlaceholderForGuest(state);

  if (!state || state.type === "none") {
    // وقف مشاركة الشاشة عند المقدم لو كان شغال
    if (isHost && hostStream) stopShare();
    return;
  }

  if (state.type === "url" && mediaFrame) {
    mediaFrame.src = state.src;
    mediaFrame.classList.remove("hidden");
    return;
  }

  if (state.type === "image" && mediaImg) {
    mediaImg.src = state.src;
    mediaImg.classList.remove("hidden");
    return;
  }

  if (state.type === "screen" && mediaVideo) {
    mediaVideo.classList.remove("hidden");
    // الضيف يطلب اتصال
    if (!isHost) socket.emit("screenJoin");
  }
});

// ====== HOST buttons ======
if (isHost && btnAddLink) {
  btnAddLink.onclick = () => {
    const u = prompt("حط رابط الموقع:");
    if (!u) return;
    socket.emit("setMedia", { type: "url", src: u.trim() });
  };
}

if (isHost && btnAddImage) {
  btnAddImage.onclick = () => {
    const u = prompt("حط رابط الصورة (ينتهي png/jpg/webp):");
    if (!u) return;
    socket.emit("setMedia", { type: "image", src: u.trim() });
  };
}

if (isHost && btnRemoveMedia) {
  btnRemoveMedia.onclick = () => {
    socket.emit("setMedia", { type: "none", src: "" });
    socket.emit("resetBuzz"); // إذا تبي ترجع كل شيء طبيعي كمان
  };
}

// ====== Screen Share (minimal but كامل) ======
async function startShare(){
  hostStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).catch(()=>null);
  if (!hostStream) return;

  // عرض للمقدم داخل نفس الفيديو
  if (mediaVideo) {
    mediaVideo.srcObject = hostStream;
    mediaVideo.classList.remove("hidden");
  }

  socket.emit("setMedia", { type: "screen", src: "" });

  // لو وقف المشاركة من النظام
  hostStream.getVideoTracks()[0].addEventListener("ended", stopShare);
}

function stopShare(){
  Object.values(pcs).forEach(pc => { try{pc.close()}catch(e){} });
  pcs = {};

  if (hostStream) {
    hostStream.getTracks().forEach(t=>t.stop());
    hostStream = null;
  }
  if (mediaVideo) mediaVideo.srcObject = null;

  socket.emit("setMedia", { type: "none", src: "" });
}

if (isHost && btnShareScreen) btnShareScreen.onclick = startShare;

// ====== Host: when guest joins, create offer ======
socket.on("screenJoin", async ({ guestId }) => {
  if (!isHost || !hostStream || !guestId) return;

  const pc = new RTCPeerConnection();
  pcs[guestId] = pc;

  hostStream.getTracks().forEach(track => pc.addTrack(track, hostStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("webrtcIce", { to: guestId, ice: e.candidate });
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("webrtcOffer", { to: guestId, sdp: pc.localDescription });
});

socket.on("webrtcAnswer", async ({ from, sdp }) => {
  if (!isHost || !from || !pcs[from] || !sdp) return;
  await pcs[from].setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on("webrtcIce", async ({ from, ice }) => {
  if (!from || !ice) return;

  // host side
  if (isHost && pcs[from]) {
    try { await pcs[from].addIceCandidate(new RTCIceCandidate(ice)); } catch(e){}
  }

  // guest side
  if (!isHost && guestPc) {
    try { await guestPc.addIceCandidate(new RTCIceCandidate(ice)); } catch(e){}
  }
});

// ====== Guest: receive offer, answer ======
socket.on("webrtcOffer", async ({ from, sdp }) => {
  if (isHost || !from || !sdp) return;

  if (guestPc) { try{guestPc.close()}catch(e){} }
  guestPc = new RTCPeerConnection();

  guestPc.ontrack = (e) => {
    if (mediaVideo) {
      mediaVideo.srcObject = e.streams[0];
      mediaVideo.classList.remove("hidden");
    }
  };

  guestPc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("webrtcIce", { to: from, ice: e.candidate });
  };

  await guestPc.setRemoteDescription(new RTCSessionDescription(sdp));
  const ans = await guestPc.createAnswer();
  await guestPc.setLocalDescription(ans);

  socket.emit("webrtcAnswer", { to: from, sdp: guestPc.localDescription });
});
});
