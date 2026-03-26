document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  console.log("✅ script.js loaded");

  // ===== تحديد هل أنا مقدم؟ =====
  const isHost = !!document.getElementById("requestsContainer");
  if (isHost) socket.emit("registerHost");

  // ===== ICE (STUN/TURN) =====
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

  // ===== الأصوات =====
  const buzzSound = new Audio("/assets/buzz_sound.mp3");
  const timeUpSound = new Audio("/assets/timeup_sound.mp3");

  buzzSound.preload = "auto";
  timeUpSound.preload = "auto";

  socket.on("playBuzzSound", () => {
    try {
      buzzSound.currentTime = 0;
      buzzSound.play().catch(() => {});
    } catch (e) {}
  });

  socket.on("playTimeUpSound", () => {
    try {
      timeUpSound.currentTime = 0;
      timeUpSound.play().catch(() => {});
    } catch (e) {}
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

  // ===== تنبيه قبل الخروج للضيف =====
  window.addEventListener("beforeunload", (e) => {
    if (!isHost) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ===== منع الخروج بالرجوع =====
  if (!isHost) {
    history.pushState(null, "", location.href);

    window.addEventListener("popstate", function () {
      const leave = confirm("متأكد أنك تريد الخروج من الموقع؟");

      if (leave) {
        window.location.href = "/";
      } else {
        history.pushState(null, "", location.href);
      }
    });
  }

  // ====== الضيف: فرق ======
  const gJoinLeft = document.getElementById("gJoinLeft");
  const gJoinRight = document.getElementById("gJoinRight");
  const gLeftCount = document.getElementById("gLeftCount");
  const gRightCount = document.getElementById("gRightCount");
  const gLeftPlayers = document.getElementById("gLeftPlayers");
  const gRightPlayers = document.getElementById("gRightPlayers");
  const gNoTeamPlayers = document.getElementById("gNoTeamPlayers");
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

  // ====== Widgets الجديدة ======
  const leftPointBox = document.getElementById("leftPointBox");
  const rightPointBox = document.getElementById("rightPointBox");
  const leftPointView = document.getElementById("leftPointView");
  const rightPointView = document.getElementById("rightPointView");

  const leftTimerBox = document.getElementById("leftTimerBox");
  const rightTimerBox = document.getElementById("rightTimerBox");
  const leftTimerView = document.getElementById("leftTimerView");
  const rightTimerView = document.getElementById("rightTimerView");

  const gLeftPointBox = document.getElementById("gLeftPointBox");
  const gRightPointBox = document.getElementById("gRightPointBox");
  const gLeftPointView = document.getElementById("gLeftPointView");
  const gRightPointView = document.getElementById("gRightPointView");

  const gLeftTimerBox = document.getElementById("gLeftTimerBox");
  const gRightTimerBox = document.getElementById("gRightTimerBox");
  const gLeftTimerView = document.getElementById("gLeftTimerView");
  const gRightTimerView = document.getElementById("gRightTimerView");

  const leftPointToggleVisible = document.getElementById("leftPointToggleVisible");
  const rightPointToggleVisible = document.getElementById("rightPointToggleVisible");
  const leftTimerToggleVisible = document.getElementById("leftTimerToggleVisible");
  const rightTimerToggleVisible = document.getElementById("rightTimerToggleVisible");

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

  // ====== قفل/فتح داخل الكروت ======
  const leftLockBtn = document.getElementById("leftLockBtn");
  const leftOpenBtn = document.getElementById("leftOpenBtn");
  const rightLockBtn2 = document.getElementById("rightLockBtn2");
  const rightOpenBtn2 = document.getElementById("rightOpenBtn2");
  const leftLockBadge = document.getElementById("leftLockBadge");
  const rightLockBadge = document.getElementById("rightLockBadge");

  // ====== تحكم صور ======
  const lockLeftBtn = document.getElementById("lockLeftBtn");
  const openLeftBtn = document.getElementById("openLeftBtn");
  const lockRightBtn = document.getElementById("lockRightBtn");
  const openRightBtn = document.getElementById("openRightBtn");

  // ====== زر اللعبة ======
  const buzzBtn = document.getElementById("buzzBtn");
  const shareBtn = document.getElementById("shareBtn");

  // ====== بيانات ======
  let playerName = "";
  let currentTeamSettings = null;
  let lastBuzzState = null;
  let myTeam = null;
  let allPlayers = {};

  function formatWidgetTime(sec) {
    return String(sec).padStart(2, "0");
  }

  function bindTeamWidgetHostControls(team, state) {
    const startBtn = document.getElementById(`${team}WidgetStartBtn`);
    const resetBtnLocal = document.getElementById(`${team}WidgetResetBtn`);
    const pointInput = document.getElementById(`${team}WidgetPointInput`);
    const secondsInput = document.getElementById(`${team}WidgetSecondsInput`);
    const applySecondsBtn = document.getElementById(`${team}WidgetApplySecondsBtn`);

    if (startBtn) {
      startBtn.onclick = () => {
        if (state.running) socket.emit("stopTeamWidgetTimer", team);
        else socket.emit("startTeamWidgetTimer", team);
      };
    }

    if (resetBtnLocal) {
      resetBtnLocal.onclick = () => socket.emit("resetTeamWidgetTimer", team);
    }

    if (pointInput) {
      pointInput.onchange = () => {
        socket.emit("setTeamWidgetPoints", {
          team,
          value: pointInput.value
        });
      };
    }

    if (applySecondsBtn && secondsInput) {
      applySecondsBtn.onclick = () => {
        socket.emit("setTeamWidgetSeconds", {
          team,
          value: secondsInput.value
        });
      };
    }
  }

  function renderTeamWidgets(team, state, refs) {
    if (!state) return;

    if (refs.hostPointBox) refs.hostPointBox.classList.toggle("hidden", !state.pointVisible);
    if (refs.hostTimerBox) refs.hostTimerBox.classList.toggle("hidden", !state.timerVisible);
    if (refs.guestPointBox) refs.guestPointBox.classList.toggle("hidden", !state.pointVisible);
    if (refs.guestTimerBox) refs.guestTimerBox.classList.toggle("hidden", !state.timerVisible);

    const pointHostHtml = `
      <div class="team-widget-main">
        <span class="team-widget-label">Point :</span>
        <input id="${team}WidgetPointInput" class="team-widget-input" type="number" value="${state.points}">
      </div>
    `;

    const pointGuestHtml = `
      <div class="team-widget-main">
        <span class="team-widget-label">Point : ${state.points}</span>
      </div>
    `;

    const timerHostHtml = `
      <div class="team-widget-main">
        <span class="team-widget-label">Timer : ${formatWidgetTime(state.seconds)}</span>
        <input id="${team}WidgetSecondsInput" class="team-widget-input" type="number" min="1" value="${state.seconds}">
        <button class="team-widget-btn" id="${team}WidgetApplySecondsBtn">تعيين</button>
        <button class="team-widget-btn" id="${team}WidgetStartBtn">${state.running ? "إيقاف" : "تشغيل"}</button>
        <button class="team-widget-btn" id="${team}WidgetResetBtn">Reset</button>
      </div>
    `;

    const timerGuestHtml = `
      <div class="team-widget-main">
        <span class="team-widget-label">Timer : ${formatWidgetTime(state.seconds)}</span>
      </div>
    `;

    if (refs.hostPointView) refs.hostPointView.innerHTML = pointHostHtml;
    if (refs.guestPointView) refs.guestPointView.innerHTML = pointGuestHtml;
    if (refs.hostTimerView) refs.hostTimerView.innerHTML = timerHostHtml;
    if (refs.guestTimerView) refs.guestTimerView.innerHTML = timerGuestHtml;

    if (isHost) {
      bindTeamWidgetHostControls(team, state);
    }
  }

  // =========================
  // طلب دخول
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
  // طلبات المقدم
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

  if (gJoinLeft) gJoinLeft.onclick = () => socket.emit("chooseTeam", "left");
  if (gJoinRight) gJoinRight.onclick = () => socket.emit("chooseTeam", "right");

  // =========================
  // إعدادات الفرق
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

    if (gLeftName) gLeftName.textContent = settings.left.name;
    if (gRightName) gRightName.textContent = settings.right.name;
    if (gLeftCard) gLeftCard.style.background = settings.left.color;
    if (gRightCard) gRightCard.style.background = settings.right.color;

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
  // رسم اللاعبين
  // =========================
  socket.on("updatePlayers", (players) => {
    allPlayers = players;

    if (myId && players[myId]) myTeam = players[myId].team || null;
    else myTeam = null;

    if (gLeftPlayers) gLeftPlayers.innerHTML = "";
    if (gRightPlayers) gRightPlayers.innerHTML = "";
    if (gNoTeamPlayers) gNoTeamPlayers.innerHTML = "";

    let l = 0;
    let r = 0;

    Object.values(players).forEach((p) => {
      const score = p.correctCount || 0;
      const lockText = p.buzzLocked ? " | 🔒" : "";

      if (p.team === "left") {
        l++;
        if (gLeftPlayers) {
          const row = document.createElement("div");
          row.className = "player-item";
          row.innerHTML = `<span>${p.name}${lockText}</span><span>✅${score}</span>`;
          gLeftPlayers.appendChild(row);
        }
        return;
      }

      if (p.team === "right") {
        r++;
        if (gRightPlayers) {
          const row = document.createElement("div");
          row.className = "player-item";
          row.innerHTML = `<span>${p.name}${lockText}</span><span>✅${score}</span>`;
          gRightPlayers.appendChild(row);
        }
        return;
      }

      if (gNoTeamPlayers) {
        const row = document.createElement("div");
        row.className = "player-item";
        row.innerHTML = `<span>${p.name}${lockText}</span><span>✅${score}</span>`;
        gNoTeamPlayers.appendChild(row);
      }
    });

    if (gLeftCount) gLeftCount.textContent = l;
    if (gRightCount) gRightCount.textContent = r;

    if (noTeam && leftTeam && rightTeam) {
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
          info.textContent = `${p.name} | ✅${score}${p.buzzLocked ? " | 🔒" : ""}`;

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

          const buzzLockBtn = document.createElement("button");
          buzzLockBtn.textContent = p.buzzLocked ? "فتح الزر 🔓" : "قفل الزر 🔒";
          buzzLockBtn.onclick = () => socket.emit("togglePlayerBuzzLock", id);

          controls.append(minus, plus, removeBtn, swapBtn, buzzLockBtn);
          row.append(info, controls);

          if (p.team === "left") leftTeam.appendChild(row);
          else rightTeam.appendChild(row);

          return;
        }

        const box = document.createElement("div");
        box.className = "noTeamPlayer";

        const nm = document.createElement("span");
        nm.textContent = `${p.name} | ✅${score}${p.buzzLocked ? " | 🔒" : ""}`;

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

        const buzzLockBtn = document.createElement("button");
        buzzLockBtn.textContent = p.buzzLocked ? "فتح الزر 🔓" : "قفل الزر 🔒";
        buzzLockBtn.onclick = () => socket.emit("togglePlayerBuzzLock", id);

        btns.append(leftBtn, rightBtn, kickBtn, minus, plus, buzzLockBtn);
        box.append(nm, btns);
        noTeam.appendChild(box);
      });
    }

    if (lastBuzzState) setBuzzVisual(lastBuzzState);
  });

  // =========================
  // شكل الزر
  // =========================
  function setBuzzVisual(state) {
    if (!buzzBtn) return;

    buzzBtn.classList.remove("buzz-red", "buzz-green", "buzz-grey");

    if (myTeam !== "left" && myTeam !== "right") {
      buzzBtn.classList.add("buzz-red");
      buzzBtn.disabled = true;
      return;
    }

    const me = myId && allPlayers[myId] ? allPlayers[myId] : null;
    if (me && me.buzzLocked) {
      buzzBtn.classList.add("buzz-grey");
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

  if (buzzBtn) {
    buzzBtn.addEventListener("click", () => {
      if (myTeam !== "left" && myTeam !== "right") return alert("اختر فريق أولاً 👈");
      if (!playerName) return alert("اكتب اسمك أولاً");

      const me = myId && allPlayers[myId] ? allPlayers[myId] : null;
      if (me && me.buzzLocked) return alert("زرّك مقفول من المقدم 🔒");

      if (lastBuzzState) {
        if (lastBuzzState.locked) return;
        if (lastBuzzState.disabledTeams && lastBuzzState.disabledTeams[myTeam]) return alert("فريقك مقفل حالياً 🔒");
        if (lastBuzzState.allowedTeam !== "both" && lastBuzzState.allowedTeam !== myTeam) return alert("الدور للفريق الثاني ⛔");
      }

      socket.emit("buzz", { name: playerName });
    });
  }

  // =========================
  // تم ضغط الزر
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

  if (leftPointToggleVisible) {
    leftPointToggleVisible.onclick = () => socket.emit("toggleTeamPointVisible", "left");
  }

  if (rightPointToggleVisible) {
    rightPointToggleVisible.onclick = () => socket.emit("toggleTeamPointVisible", "right");
  }

  if (leftTimerToggleVisible) {
    leftTimerToggleVisible.onclick = () => socket.emit("toggleTeamTimerVisible", "left");
  }

  if (rightTimerToggleVisible) {
    rightTimerToggleVisible.onclick = () => socket.emit("toggleTeamTimerVisible", "right");
  }

  socket.on("teamWidgets", (widgets) => {
    if (!widgets) return;

    renderTeamWidgets("left", widgets.left, {
      hostPointBox: leftPointBox,
      hostPointView: leftPointView,
      hostTimerBox: leftTimerBox,
      hostTimerView: leftTimerView,
      guestPointBox: gLeftPointBox,
      guestPointView: gLeftPointView,
      guestTimerBox: gLeftTimerBox,
      guestTimerView: gLeftTimerView,
    });

    renderTeamWidgets("right", widgets.right, {
      hostPointBox: rightPointBox,
      hostPointView: rightPointView,
      hostTimerBox: rightTimerBox,
      hostTimerView: rightTimerView,
      guestPointBox: gRightPointBox,
      guestPointView: gRightPointView,
      guestTimerBox: gRightTimerBox,
      guestTimerView: gRightTimerView,
    });
  });

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
  const mediaPlaceholder = document.getElementById("mediaPlaceholder");

  const btnShareScreen = document.getElementById("btnShareScreen") || document.getElementById("shareScreenBtn");
  const btnShareScreenMobile = document.getElementById("btnShareScreenMobile");
  const btnAddImage = document.getElementById("btnAddImage") || document.getElementById("addImageBtn");
  const btnAddLink = document.getElementById("btnAddLink") || document.getElementById("addLinkBtn");
  const btnRemoveMedia = document.getElementById("btnRemoveMedia") || document.getElementById("removeMediaBtn");

  let hostStream = null;
  let pcs = {};
  let guestPc = null;
  let snapshotTimer = null;
  let latestSnapshot = "";
  let useSnapshotFallback = false;
  let webrtcConnected = false;
  let webrtcWaitTimer = null;

  function clearWebRTCWaitTimer() {
    if (webrtcWaitTimer) {
      clearTimeout(webrtcWaitTimer);
      webrtcWaitTimer = null;
    }
  }

  function startWebRTCFallbackTimer() {
    clearWebRTCWaitTimer();

    webrtcWaitTimer = setTimeout(() => {
      if (!isHost && !webrtcConnected) {
        useSnapshotFallback = true;

        if (guestPc) {
          try { guestPc.close(); } catch (e) {}
          guestPc = null;
        }

        hideAllMedia();

        if (latestSnapshot && mediaImg) {
          mediaImg.src = latestSnapshot;
          mediaImg.classList.remove("hidden");
        } else if (mediaPlaceholder) {
          mediaPlaceholder.textContent = "تعذر تشغيل البث المباشر، تم التحويل لوضع الصور";
          mediaPlaceholder.classList.remove("hidden");
        }
      }
    }, 4000);
  }

  function hideAllMedia() {
    if (mediaFrame) mediaFrame.classList.add("hidden");
    if (mediaImg) mediaImg.classList.add("hidden");
    if (mediaVideo) mediaVideo.classList.add("hidden");
    if (mediaPlaceholder) mediaPlaceholder.classList.add("hidden");
  }

  function updateRemoveBtn(state) {
    if (!btnRemoveMedia) return;
    const show = state && state.type && state.type !== "none";
    btnRemoveMedia.classList.toggle("hidden", !show);
  }

  function showPlaceholderForGuest(state) {
    if (!mediaPlaceholder) return;

    if (!isHost && (!state || state.type === "none")) {
      mediaPlaceholder.textContent = "اشغل وقتك بالاستغفار و التسبيح و ذكر الله 🤍. 'الله اكبر' ";
      mediaPlaceholder.classList.remove("hidden");
    } else {
      mediaPlaceholder.classList.add("hidden");
    }
  }

  function stopShareLocalOnly() {
    if (snapshotTimer) {
      clearInterval(snapshotTimer);
      snapshotTimer = null;
    }

    latestSnapshot = "";
    webrtcConnected = false;
    useSnapshotFallback = false;
    clearWebRTCWaitTimer();

    Object.values(pcs).forEach((pc) => {
      try { pc.close(); } catch (e) {}
    });
    pcs = {};

    if (guestPc) {
      try { guestPc.close(); } catch (e) {}
      guestPc = null;
    }

    if (hostStream) {
      hostStream.getTracks().forEach((t) => t.stop());
      hostStream = null;
    }

    if (mediaVideo) mediaVideo.srcObject = null;
  }

  function startSnapshotLoop() {
    if (!hostStream) return;

    if (snapshotTimer) {
      clearInterval(snapshotTimer);
      snapshotTimer = null;
    }

    const snapVideo = document.createElement("video");
    snapVideo.srcObject = hostStream;
    snapVideo.muted = true;
    snapVideo.playsInline = true;

    snapVideo.play().catch(() => {});

    snapshotTimer = setInterval(() => {
      try {
        if (!snapVideo.videoWidth || !snapVideo.videoHeight) return;

        const canvas = document.createElement("canvas");
        const maxWidth = 960;
        const scale = Math.min(1, maxWidth / snapVideo.videoWidth);

        canvas.width = Math.floor(snapVideo.videoWidth * scale);
        canvas.height = Math.floor(snapVideo.videoHeight * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(snapVideo, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

        latestSnapshot = dataUrl;
        socket.emit("screenSnapshot", dataUrl);
      } catch (e) {
        console.error("snapshot error", e);
      }
    }, 1000);
  }

  socket.on("mediaState", (state) => {
    hideAllMedia();
    updateRemoveBtn(state);
    showPlaceholderForGuest(state);

    if (!state || state.type === "none") {
      webrtcConnected = false;
      useSnapshotFallback = false;
      clearWebRTCWaitTimer();

      if (!isHost && guestPc) {
        try { guestPc.close(); } catch (e) {}
        guestPc = null;
      }

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

    if (state.type === "screen") {
      if (isHost) {
        if (mediaVideo) mediaVideo.classList.remove("hidden");
        return;
      }

      webrtcConnected = false;
      useSnapshotFallback = false;
      clearWebRTCWaitTimer();

      if (mediaVideo) mediaVideo.classList.remove("hidden");

      socket.emit("screenJoin");
      startWebRTCFallbackTimer();
      return;
    }
  });

  socket.on("screenSnapshot", (dataUrl) => {
    if (isHost) return;
    if (!dataUrl) return;

    latestSnapshot = dataUrl;

    if (!useSnapshotFallback) return;

    hideAllMedia();
    if (mediaImg) {
      mediaImg.src = dataUrl;
      mediaImg.classList.remove("hidden");
    }
  });

  // ===== ملف صورة من الجهاز =====
  const imagePicker = document.createElement("input");
  imagePicker.type = "file";
  imagePicker.accept = "image/*";
  imagePicker.style.display = "none";
  document.body.appendChild(imagePicker);

  imagePicker.addEventListener("change", () => {
    const file = imagePicker.files && imagePicker.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        alert("ما قدرت أقرأ الصورة");
        return;
      }

      socket.emit("setMedia", { type: "image", src: result });
      imagePicker.value = "";
    };

    reader.onerror = () => {
      alert("صار خطأ أثناء قراءة الصورة");
      imagePicker.value = "";
    };

    reader.readAsDataURL(file);
  });

  // ===== أزرار الهوست =====
  if (isHost && btnAddLink) {
    btnAddLink.onclick = () => {
      const u = prompt("حط رابط الموقع:");
      if (!u) return;
      socket.emit("setMedia", { type: "url", src: u.trim() });
    };
  }

  if (isHost && btnAddImage) {
    btnAddImage.onclick = () => {
      imagePicker.click();
    };
  }

  if (isHost && btnRemoveMedia) {
    btnRemoveMedia.onclick = () => {
      socket.emit("setMedia", { type: "none", src: "" });
    };
  }

  // ===== مشاركة الشاشة =====
  async function beginShareFlow() {
    try {
      if (!window.isSecureContext) {
        alert("مشاركة الشاشة تحتاج رابط آمن HTTPS أو localhost");
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert("هذا المتصفح أو الجهاز ما يدعم getDisplayMedia");
        return;
      }

      stopShareLocalOnly();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      if (!stream) {
        alert("ما بدأت مشاركة الشاشة");
        return;
      }

      hostStream = stream;
      startSnapshotLoop();

      if (mediaVideo) {
        mediaVideo.srcObject = hostStream;
        mediaVideo.muted = true;
        mediaVideo.classList.remove("hidden");
        await mediaVideo.play().catch(() => {});
      }

      socket.emit("setMedia", { type: "screen", src: "" });

      const videoTrack = hostStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          socket.emit("setMedia", { type: "none", src: "" });
          stopShareLocalOnly();
        });
      }
    } catch (err) {
      console.log("share screen error", err);

      if (err && err.name === "NotAllowedError") {
        alert("تم إلغاء مشاركة الشاشة أو رفض الإذن");
        return;
      }

      if (err && err.name === "NotFoundError") {
        alert("ما لقيت شاشة أو نافذة قابلة للمشاركة");
        return;
      }

      if (err && err.name === "NotReadableError") {
        alert("المتصفح ما قدر يبدأ مشاركة الشاشة");
        return;
      }

      alert("تعذر تشغيل مشاركة الشاشة");
    }
  }

  async function startShare() {
    await beginShareFlow();
  }

  async function startMobileShare() {
    await beginShareFlow();
  }

  if (isHost && btnShareScreen) {
    btnShareScreen.onclick = startShare;
  }

  if (isHost && btnShareScreenMobile) {
    btnShareScreenMobile.onclick = startMobileShare;
  }

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

    clearWebRTCWaitTimer();
    startWebRTCFallbackTimer();

    guestPc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    guestPc.ontrack = (e) => {
      webrtcConnected = true;
      useSnapshotFallback = false;
      clearWebRTCWaitTimer();

      if (mediaVideo) {
        mediaVideo.srcObject = e.streams[0];
        mediaVideo.muted = true;
        mediaVideo.classList.remove("hidden");
        if (mediaPlaceholder) mediaPlaceholder.classList.add("hidden");
        if (mediaImg) mediaImg.classList.add("hidden");
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

  // ===== زر مشاركة رابط الصفحة =====
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const shareData = {
        title: "RG6 Button",
        text: "ادخل اللعبة",
        url: window.location.href
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(window.location.href);
          alert("تم نسخ رابط اللعبة 📋");
        }
      } catch (err) {
        console.log("share cancelled");
      }
    });
  }
});
