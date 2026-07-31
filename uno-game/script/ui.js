UNO.UI = (function () {
  const E = UNO.Engine;
  const C = UNO.Cards;

  let els = {};
  let revealedSeat = null;
  let lastSeenRound = null;

  function init() {
    els = {
      screenSetup: document.getElementById("screen-setup"),
      screenGame: document.getElementById("screen-game"),
      statusBar: document.getElementById("status-bar"),
      opponentsRow: document.getElementById("opponents-row"),
      drawPile: document.getElementById("draw-pile"),
      drawCount: document.getElementById("draw-count"),
      discardTop: document.getElementById("discard-top"),
      message: document.getElementById("message"),
      handRow: document.getElementById("hand-row"),
      btnDraw: document.getElementById("btn-draw"),
      btnPlayDrawn: document.getElementById("btn-play-drawn"),
      btnKeep: document.getElementById("btn-keep"),
      btnUno: document.getElementById("btn-uno"),
      colorOverlay: document.getElementById("color-overlay"),
      hiddenHandOverlay: document.getElementById("hidden-hand-overlay"),
      hiddenHandTitle: document.getElementById("hidden-hand-title"),
      hiddenHandMessage: document.getElementById("hidden-hand-message"),
      btnReveal: document.getElementById("btn-reveal"),
      btnSkipCall: document.getElementById("btn-skip-call"),
      resultOverlay: document.getElementById("result-overlay"),
      resultTitle: document.getElementById("result-title"),
      resultMessage: document.getElementById("result-message"),
      scoreTable: document.getElementById("score-table"),
      btnNextRound: document.getElementById("btn-next-round"),
      btnRestart: document.getElementById("btn-restart"),
    };

    els.drawPile.addEventListener("click", onDrawPileClick);
    els.btnDraw.addEventListener("click", onDrawPileClick);
    els.btnPlayDrawn.addEventListener("click", onPlayDrawnClick);
    els.btnKeep.addEventListener("click", onKeepClick);
    els.btnNextRound.addEventListener("click", onNextRoundClick);
    els.btnRestart.addEventListener("click", onRestartClick);

    els.colorOverlay.querySelectorAll(".color-btn").forEach((btn) => {
      btn.addEventListener("click", () => onColorChoice(btn.dataset.color));
    });

    E.setOnChange(render);
  }

  function showScreen(name) {
    els.screenSetup.hidden = name !== "setup";
    els.screenGame.hidden = name !== "game";
  }

  function startGame() {
    revealedSeat = null;
    lastSeenRound = null;
    showScreen("game");
    render();
  }

  function showOverlay(el) {
    el.classList.add("show");
  }

  function hideOverlay(el) {
    el.classList.remove("show");
  }

  // ---- レンダリング ----

  function isPassPlay(state) {
    return state.seats.every((s) => s.controller === "human-hidden");
  }

  function render() {
    const state = E.getState();
    if (!state) return;

    if (state.round !== lastSeenRound) {
      lastSeenRound = state.round;
      revealedSeat = null; // 新ラウンドでは必ず手札を隠した状態から始める
    }

    renderStatusBar(state);
    renderOpponents(state);
    renderPlayArea(state);
    els.message.textContent = state.message || "";

    if (state.phase === "ROUND_OVER") {
      hideOverlay(els.colorOverlay);
      hideOverlay(els.hiddenHandOverlay);
      renderHandRow(state, null, false);
      renderActionButtons(state, null);
      renderResultOverlay(state);
      return;
    }
    hideOverlay(els.resultOverlay);

    const passPlay = isPassPlay(state);
    const actingSeat = state.seats[state.currentSeat];
    const canControlActingSeat = actingSeat.controller !== "cpu";

    if (passPlay) {
      // revealedSeatが「現在の手番」以外を指している＝直前に見せていた人の手番が終わった
      if (revealedSeat !== null && revealedSeat !== state.currentSeat) {
        const prevSeat = state.seats[revealedSeat];
        const needsReminder = prevSeat.hand.length === 1 && prevSeat.catchable && !prevSeat.saidUno;
        if (needsReminder) {
          hideOverlay(els.colorOverlay);
          renderHandRow(state, null, false);
          renderActionButtons(state, null);
          showUnoReminder(prevSeat);
          return;
        }
        revealedSeat = null;
      }

      // これから操作する人の手札を隠す（タップするまで表示しない）
      if (canControlActingSeat && revealedSeat !== state.currentSeat) {
        hideOverlay(els.colorOverlay);
        renderHandRow(state, null, false);
        renderActionButtons(state, null);
        showHiddenHandPrompt(actingSeat);
        return;
      }
    }
    hideOverlay(els.hiddenHandOverlay);

    const viewSeatId = passPlay ? state.currentSeat : 0;
    const viewSeat = state.seats[viewSeatId];
    const interactive = canControlActingSeat && viewSeatId === state.currentSeat;

    renderHandRow(state, viewSeat, interactive);
    renderActionButtons(state, interactive ? actingSeat : null);

    if (state.phase === "AWAITING_COLOR_CHOICE" && interactive) {
      showOverlay(els.colorOverlay);
    } else {
      hideOverlay(els.colorOverlay);
    }
  }

  function renderStatusBar(state) {
    els.statusBar.innerHTML = "";
    els.statusBar.appendChild(chip(`ラウンド ${state.round}/${state.totalRounds}`));
    els.statusBar.appendChild(chip(state.direction === 1 ? "回転→" : "回転←"));
  }

  function chip(text) {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = text;
    return span;
  }

  function renderOpponents(state) {
    const passPlay = isPassPlay(state);
    els.opponentsRow.innerHTML = "";
    for (const seat of state.seats) {
      if (!passPlay && seat.id === 0) continue;
      els.opponentsRow.appendChild(opponentChip(state, seat));
    }
  }

  function opponentChip(state, seat) {
    const div = document.createElement("div");
    div.className = "opponent-chip";
    if (seat.id === state.currentSeat && state.phase !== "ROUND_OVER") {
      div.classList.add("current-turn");
    }
    const catchableOpen = seat.hand.length === 1 && seat.catchable && !seat.saidUno;
    if (catchableOpen) div.classList.add("uno-warning");

    const name = document.createElement("span");
    name.textContent = seat.name;
    div.appendChild(name);

    const count = document.createElement("span");
    count.className = "opp-count";
    count.textContent = `${seat.hand.length}枚`;
    div.appendChild(count);

    if (catchableOpen) {
      const actions = document.createElement("div");
      actions.className = "opp-uno-actions";

      const callBtn = document.createElement("button");
      callBtn.type = "button";
      callBtn.className = "opp-call-btn";
      callBtn.textContent = "UNO!";
      callBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        E.callUno(seat.id);
      });
      actions.appendChild(callBtn);

      const catchBtn = document.createElement("button");
      catchBtn.type = "button";
      catchBtn.className = "opp-catch-btn";
      catchBtn.textContent = "指摘";
      catchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        E.catchMissedUno(seat.id);
      });
      actions.appendChild(catchBtn);

      div.appendChild(actions);
    }

    return div;
  }

  function renderPlayArea(state) {
    els.drawCount.textContent = `${state.deck.length}枚`;
    const top = state.discard[state.discard.length - 1];
    els.discardTop.innerHTML = "";
    els.discardTop.appendChild(cardEl(top, { effectiveColor: state.activeColor }));
  }

  function renderHandRow(state, seat, interactive) {
    els.handRow.innerHTML = "";
    if (!seat) return;
    const top = state.discard[state.discard.length - 1];
    const sorted = seat.hand.slice().sort(compareCards);
    for (const card of sorted) {
      const el = cardEl(card);
      const isDrawn = state.phase === "AWAITING_POST_DRAW_DECISION" && state.drawnCard && state.drawnCard.id === card.id;
      if (isDrawn) el.classList.add("selected");

      let playableNow = false;
      if (interactive) {
        if (state.phase === "AWAITING_ACTION") {
          playableNow = C.matchesTop(card, top, state.activeColor);
        } else if (state.phase === "AWAITING_POST_DRAW_DECISION") {
          playableNow = isDrawn;
        }
      }

      if (playableNow) {
        el.addEventListener("click", () => E.playCard(seat.id, card.id));
      } else {
        el.style.opacity = interactive ? "0.5" : "0.75";
      }
      els.handRow.appendChild(el);
    }
  }

  function compareCards(a, b) {
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return String(a.value).localeCompare(String(b.value));
  }

  function renderActionButtons(state, actingSeat) {
    const canAct = !!actingSeat;
    const canDraw = canAct && state.phase === "AWAITING_ACTION" && !E.hasPlayableCard(actingSeat);
    const drawPhase = canAct && state.phase === "AWAITING_POST_DRAW_DECISION";

    els.btnDraw.hidden = !canDraw;
    els.btnPlayDrawn.hidden = !drawPhase;
    els.btnKeep.hidden = !drawPhase;

    const selfNeedsCall = canAct && actingSeat.hand.length === 1 && actingSeat.catchable && !actingSeat.saidUno;
    els.btnUno.hidden = !selfNeedsCall;
    if (selfNeedsCall) {
      els.btnUno.onclick = () => E.callUno(actingSeat.id);
    }
  }

  function cardEl(card, opts) {
    opts = opts || {};
    const div = document.createElement("div");
    const colorClass = card.color === "wild" ? "card-wild" : `card-${card.color}`;
    div.className = `card ${colorClass}`;

    if (card.value === "skip") {
      div.appendChild(symbolEl("icon-skip"));
    } else if (card.value === "reverse") {
      const s = symbolEl("icon-reverse");
      s.textContent = "⇄";
      div.appendChild(s);
    } else if (card.value === "draw2") {
      const s = symbolEl("icon-draw");
      s.textContent = "+2";
      div.appendChild(s);
    } else if (card.value === "wild4") {
      const s = symbolEl("icon-wild4");
      s.textContent = "+4";
      div.appendChild(s);
    } else if (card.value === "wild") {
      div.appendChild(symbolEl("icon-wild"));
    } else {
      const s = document.createElement("span");
      s.className = "card-symbol";
      s.textContent = card.value;
      div.appendChild(s);
    }

    if (card.color === "wild" && opts.effectiveColor) {
      const corner = document.createElement("span");
      corner.className = "card-corner";
      corner.textContent = colorLabel(opts.effectiveColor);
      div.appendChild(corner);
      div.style.boxShadow = `inset 0 0 0 3px ${colorHex(opts.effectiveColor)}`;
    }

    return div;
  }

  function symbolEl(iconClass) {
    const s = document.createElement("span");
    s.className = `card-symbol ${iconClass}`;
    return s;
  }

  function colorLabel(color) {
    return { red: "赤", yellow: "黄", green: "緑", blue: "青" }[color] || "";
  }

  function colorHex(color) {
    return { red: "#ef4444", yellow: "#facc15", green: "#22c55e", blue: "#3b82f6" }[color] || "#fff";
  }

  function showHiddenHandPrompt(seat) {
    els.hiddenHandTitle.textContent = `${seat.name} さんの番です`;
    els.hiddenHandMessage.textContent = "他の人に見えないようにしてからタップしてください";
    els.btnReveal.textContent = "タップして手札を表示";
    els.btnReveal.onclick = onRevealClick;
    els.btnSkipCall.hidden = true;
    showOverlay(els.hiddenHandOverlay);
  }

  function showUnoReminder(seat) {
    els.hiddenHandTitle.textContent = `${seat.name} さん`;
    els.hiddenHandMessage.textContent = "残り1枚です。「UNO!」を宣言し忘れていませんか？";
    els.btnReveal.textContent = "UNO! と宣言する";
    els.btnReveal.onclick = () => {
      E.callUno(seat.id);
      revealedSeat = null;
      render();
    };
    els.btnSkipCall.hidden = false;
    els.btnSkipCall.onclick = () => {
      revealedSeat = null;
      render();
    };
    showOverlay(els.hiddenHandOverlay);
  }

  function renderResultOverlay(state) {
    const r = state.roundResult;
    if (!r) return;
    if (state.matchOver) {
      const ranked = state.scores.slice().sort((a, b) => b.total - a.total);
      els.resultTitle.textContent = "マッチ終了！";
      els.resultMessage.textContent = `優勝: ${ranked[0].name}（${ranked[0].total}点）`;
    } else {
      els.resultTitle.textContent = `ラウンド${state.round} 終了`;
      els.resultMessage.textContent = `${r.winnerName} が ${r.pointsEarned}点 獲得！`;
    }
    els.scoreTable.innerHTML = "";
    els.scoreTable.appendChild(buildScoreTable(state));

    els.btnNextRound.hidden = state.matchOver;
    els.btnRestart.hidden = !state.matchOver;

    showOverlay(els.resultOverlay);
  }

  function buildScoreTable(state) {
    const ranked = state.scores.slice().sort((a, b) => b.total - a.total);
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>順位</th><th>名前</th><th>得点</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    ranked.forEach((entry, i) => {
      const tr = document.createElement("tr");
      if (i === 0) tr.className = "leader";
      const nameCell = document.createElement("td");
      nameCell.textContent = entry.name;
      const rankCell = document.createElement("td");
      rankCell.textContent = String(i + 1);
      const totalCell = document.createElement("td");
      totalCell.textContent = String(entry.total);
      tr.appendChild(rankCell);
      tr.appendChild(nameCell);
      tr.appendChild(totalCell);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  // ---- イベントハンドラ ----

  function onDrawPileClick() {
    const state = E.getState();
    if (!state || state.phase !== "AWAITING_ACTION") return;
    E.drawCard(state.currentSeat);
  }

  function onPlayDrawnClick() {
    const state = E.getState();
    if (!state || state.phase !== "AWAITING_POST_DRAW_DECISION" || !state.drawnCard) return;
    E.playCard(state.currentSeat, state.drawnCard.id);
  }

  function onKeepClick() {
    const state = E.getState();
    if (!state || state.phase !== "AWAITING_POST_DRAW_DECISION") return;
    E.endTurnAfterDraw(state.currentSeat);
  }

  function onRevealClick() {
    const state = E.getState();
    if (!state) return;
    revealedSeat = state.currentSeat;
    render();
  }

  function onColorChoice(color) {
    E.chooseColor(color);
  }

  function onNextRoundClick() {
    E.startNextRound();
  }

  function onRestartClick() {
    location.reload();
  }

  return { init, startGame };
})();
