document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  console.log("✅ script.js loaded");

  // ===== تحديد هل أنا مقدم؟ =====
  const isHost = !!document.getElementById("requestsContainer");
  if (isHost) socket.emit("registerHost");

  // ===== ICE (STUN/TURN) =====
  // افتراضي STUN فقط (يشتغل غالبًا داخل نفس الشبكة)
  // عشان يشتغل خارج نفس الشبكة لازم TURN (بنستلمه من السيرفر عبر iceServers)
  let ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  socket.on("iceServers", (servers) => {
    if (Array.isArray(servers) && servers.length) {
      ICE_SERVERS = servers;
      console.log("🧊 ICE servers updated from server:", ICE_SERVERS);
    }
  });

  // ====== معرفي ======
  let myId = null;
  socket.on("connect", () => {
    myId = socket.id;
  });

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
  // طلبات (مقدم) - طريقة مضمونة
  // =========================
  if (requestsContainer) {
    requestsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (!id || !action) return;

      if (action === "accept") socket.emit("acceptRequest", id);
      if (action === "reject") socket.emit("rejectRequest", id);
    });
  }

  socket.on("updateRequests", (requests) => {
    if (!requestsContainer) return;
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
    if (myId && players[myId]) myTeam = players[myId].team || null;
    else myTeam = null;

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
    });

    if (gLeftCount) gLeftCount.textContent = l;
    if (gRightCount) gRightCount.textContent = r;

    // مقدم
    if (!noTeam || !leftTeam || !rightTeam) return;

    if (leftCount) leftCount.textContent = l;
    if (rightCount) rightCount.textContent = r;

    noTeam.innerHTML = "";
    leftTeam.innerHTML = "";
    rightTeam.innerHTML = "";

    Object.entries(players).forEach(([id, p]) => {
      const score = p.correctCount || 0;

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

    if (lastBuzzState) setBuzzVisual(lastBuzzState);
  });

  // =========================
  // شكل الزر حسب الحالة
  // =========================
  function setBuzzVisual(state) {
    if (!buzzBtn) return;

    buzzBtn.classList.remove("buzz-red", "buzz-green", "buzz-grey");

    if (myTeam !== "left" && myTeam !== "right") {
      buzzBtn.classList.add("buzz-red");
      buzzBtn.disabled = true;
      return;
    }

    if (state.locked) {
      if (state.lockedBy && state.lockedBy.id === myId) buzzBtn.classList.add("buzz-green");
      else buzzBtn.classList.add("buzz-grey");
      buzzBtn.disabled = true;
      return;
    }

    if (state.disabledTeams && state.disabledTeams[myTeam]) {
      buzzBtn.classList.add("buzz-grey");
      buzzBtn.disabled = true;
      return;
    }

    if (state.allowedTeam !== "both" && state.allowedTeam !== myTeam) {
      buzzBtn.classList.add("buzz-grey");
      buzzBtn.disabled = true;
      return;
    }

    buzzBtn.classList.add("buzz-red");
    buzzBtn.disabled = false;
  }

  socket.on("buzzState", (state) => {
    lastBuzzState = state;
    setBuzzVisual(state);

    if (leftLockBadge) leftLockBadge.classList.toggle("hidden", !(state.disabledTeams && state.disabledTeams.left));
    if (rightLockBadge) rightLockBadge.classList.toggle("hidden", !(state.disabledTeams && state.disabledTeams.right));
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

    if (buzzOverlay && buzzInfo) {
      buzzInfo.innerHTML = `اللاعب: <b>${info.name}</b><br>الفريق: <b>${info.teamName}</b>`;
      const card = buzzOverlay.querySelector(".buzz-card");
      if (card) card.style.background = color;
      if (buzzTimeUp) buzzTimeUp.classList.add("hidden");
      buzzOverlay.classList.remove("hidden");
    }

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

  if (resetBtn) resetBtn.addEventListener("click", () => socket.emit("resetBuzz"));

  if (leftLockBtn) leftLockBtn.onclick = () => socket.emit("lockTeamBuzz", "left");
  if (leftOpenBtn) leftOpenBtn.onclick = () => socket.emit("openTeamBuzz", "left");
  if (rightLockBtn2) rightLockBtn2.onclick = () => socket.emit("lockTeamBuzz", "right");
  if (rightOpenBtn2) rightOpenBtn2.onclick = () => socket.emit("openTeamBuzz", "right");

  if (lockLeftBtn) lockLeftBtn.onclick = () => socket.emit("lockTeamBuzz", "left");
  if (openLeftBtn) openLeftBtn.onclick = () => socket.emit("openTeamBuzz", "left");
  if (lockRightBtn) lockRightBtn.onclick = () => socket.emit("lockTeamBuzz", "right");
  if (openRightBtn) openRightBtn.onclick = () => socket.emit("openTeamBuzz", "right");

  socket.on("judgeResult", () => {
    if (hostBuzzPanel) hostBuzzPanel.classList.add("hidden");
    if (buzzOverlay) buzzOverlay.classList.add("hidden");
  });

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

  // =====================================================
  // =============== MEDIA SCREEN (Host + Guest) ==========
  // =====================================================
  const mediaFrame = document.getElementById("mediaFrame");
  const mediaImg = document.getElementById("mediaImg");
  const mediaVideo = document.getElementById("mediaVideo") || document.getElementById("stageVideo");

const btnShareScreen = document.getElementById("btnShareScreen") || document.getElementById("shareScreenBtn");
const btnAddImage    = document.getElementById("btnAddImage")    || document.getElementById("addImageBtn");
const btnAddLink     = document.getElementById("btnAddLink")     || document.getElementById("addLinkBtn");
const btnRemoveMedia = document.getElementById("btnRemoveMedia") || document.getElementById("removeMediaBtn");
  let hostStream = null;
  let pcs = {}; // host: guestId -> RTCPeerConnection
  let guestPc = null;

  function hideAllMedia() {
    if (mediaFrame) mediaFrame.classList.add("hidden");
    if (mediaImg) mediaImg.classList.add("hidden");
    if (mediaVideo) mediaVideo.classList.add("hidden");
  }

  function updateRemoveBtn(state) {
    if (!btnRemoveMedia) return;
    const show = state && state.type && state.type !== "none";
    btnRemoveMedia.classList.toggle("hidden", !show);
  }

  function showPlaceholderForGuest(state) {
    if (!mediaPlaceholder) return;
    if (!isHost && (!state || state.type === "none")) {
      mediaPlaceholder.classList.remove("hidden");
    } else {
      mediaPlaceholder.classList.add("hidden");
    }
  }

  function stopShareLocalOnly() {
    // اقفل اتصالات
    Object.values(pcs).forEach((pc) => {
      try { pc.close(); } catch (e) {}
    });
    pcs = {};

    if (hostStream) {
      hostStream.getTracks().forEach((t) => t.stop());
      hostStream = null;
    }
    if (mediaVideo) mediaVideo.srcObject = null;
  }

  socket.on("mediaState", (state) => {
    hideAllMedia();
    updateRemoveBtn(state);
    showPlaceholderForGuest(state);

    if (!state || state.type === "none") {
      if (isHost && hostStream) stopShareLocalOnly();
      return;
    }

    if (state.type === "url" && mediaFrame) {
      mediaFrame.src = state.src || "";
      mediaFrame.classList.remove("hidden");
      return;
    }

    if (state.type === "image" && mediaImg) {
      mediaImg.src = state.src || "";
      mediaImg.classList.remove("hidden");
      return;
    }

    if (state.type === "screen" && mediaVideo) {
      mediaVideo.classList.remove("hidden");
      // الضيف يطلب اتصال من المقدم
      if (!isHost) socket.emit("screenJoin");
      return;
    }
  });

  // ===== HOST buttons (التحكم فقط للمقدم) =====
  if (isHost && btnAddLink) {
    btnAddLink.onclick = () => {
      const u = prompt("حط رابط الموقع:");
      if (!u) return;
      socket.emit("setMedia", { type: "url", src: u.trim() });
    };
  }

  if (isHost && btnAddImage) {
    btnAddImage.onclick = () => {
      const u = prompt("حط رابط الصورة (png/jpg/webp):");
      if (!u) return;
      socket.emit("setMedia", { type: "image", src: u.trim() });
    };
  }

  if (isHost && btnRemoveMedia) {
    btnRemoveMedia.onclick = () => {
      socket.emit("setMedia", { type: "none", src: "" });
    };
  }

  // ===== Screen Share (Host) =====
  async function startShare() {
    const stream = await navigator.mediaDevices
      .getDisplayMedia({ video: true, audio: false })
      .catch(() => null);

    if (!stream) return;

    hostStream = stream;

    if (mediaVideo) {
      mediaVideo.srcObject = hostStream;
      mediaVideo.muted = true;
      mediaVideo.classList.remove("hidden");
      await mediaVideo.play().catch(() => {});
    }

    socket.emit("setMedia", { type: "screen", src: "" });

    // إذا المستخدم وقف المشاركة من النظام
    hostStream.getVideoTracks()[0].addEventListener("ended", () => {
      socket.emit("setMedia", { type: "none", src: "" });
      stopShareLocalOnly();
    });
  }

  if (isHost && btnShareScreen) btnShareScreen.onclick = startShare;

  // ===== Host: guest asks to join => make offer =====
  socket.on("screenJoin", async ({ guestId }) => {
    if (!isHost || !hostStream || !guestId) return;
    if (guestId === socket.id) return;
    if (pcs[guestId]) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcs[guestId] = pc;

    hostStream.getTracks().forEach((track) => pc.addTrack(track, hostStream));

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

    if (isHost && pcs[from]) {
      try { await pcs[from].addIceCandidate(new RTCIceCandidate(ice)); } catch (e) {}
    }

    if (!isHost && guestPc) {
      try { await guestPc.addIceCandidate(new RTCIceCandidate(ice)); } catch (e) {}
    }
  });

  // ===== Guest: receive offer => answer =====
  socket.on("webrtcOffer", async ({ from, sdp }) => {
    if (isHost || !from || !sdp) return;

    if (guestPc) {
      try { guestPc.close(); } catch (e) {}
      guestPc = null;
    }

    guestPc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    guestPc.ontrack = (e) => {
      if (mediaVideo) {
        mediaVideo.srcObject = e.streams[0];
        mediaVideo.muted = true; // يساعد autoplay
        mediaVideo.classList.remove("hidden");
        mediaVideo.play().catch(() => {});
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
