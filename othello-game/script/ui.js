OTH.UI = (function () {
  const E = OTH.Engine;
  const B = OTH.Board;

  let els = {};

  function init() {
    els = {
      screenSetup: document.getElementById("screen-setup"),
      screenGame: document.getElementById("screen-game"),
      statusBar: document.getElementById("status-bar"),
      message: document.getElementById("message"),
      board: document.getElementById("board"),
      passOverlay: document.getElementById("pass-overlay"),
      passTitle: document.getElementById("pass-title"),
      passMessage: document.getElementById("pass-message"),
      btnPassContinue: document.getElementById("btn-pass-continue"),
      resultOverlay: document.getElementById("result-overlay"),
      resultTitle: document.getElementById("result-title"),
      resultMessage: document.getElementById("result-message"),
      btnRestart: document.getElementById("btn-restart"),
    };

    els.btnPassContinue.addEventListener("click", () => E.acknowledgePass());
    els.btnRestart.addEventListener("click", () => location.reload());

    E.setOnChange(render);
  }

  function showScreen(name) {
    els.screenSetup.hidden = name !== "setup";
    els.screenGame.hidden = name !== "game";
  }

  function startGame() {
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

  function render() {
    const state = E.getState();
    if (!state) return;

    renderStatusBar(state);
    els.message.textContent = state.message || "";
    renderBoard(state);

    if (state.phase === "GAME_OVER") {
      hideOverlay(els.passOverlay);
      renderResultOverlay(state);
      return;
    }
    hideOverlay(els.resultOverlay);

    if (state.phase === "PASS_NOTICE") {
      const skippedPlayer = state.players.find((p) => p.color === state.passColor);
      if (skippedPlayer.controller === "human") {
        showPassOverlay(skippedPlayer);
      } else {
        hideOverlay(els.passOverlay);
      }
      return;
    }
    hideOverlay(els.passOverlay);
  }

  function renderStatusBar(state) {
    els.statusBar.innerHTML = "";
    const counts = B.countDiscs(state.board);
    for (const color of [B.BLACK, B.WHITE]) {
      const p = state.players.find((pl) => pl.color === color);
      const count = color === B.BLACK ? counts.black : counts.white;

      const chip = document.createElement("span");
      chip.className = "chip";
      if (state.currentColor === color && state.phase === "AWAITING_ACTION") {
        chip.classList.add("current-turn");
      }

      const disc = document.createElement("span");
      disc.className = `chip-disc ${color === B.BLACK ? "disc-black" : "disc-white"}`;
      chip.appendChild(disc);

      const text = document.createElement("span");
      text.textContent = `${p.name}: ${count}`;
      chip.appendChild(text);

      els.statusBar.appendChild(chip);
    }
  }

  function currentPlayerIsHuman(state) {
    const p = state.players.find((pl) => pl.color === state.currentColor);
    return p.controller === "human";
  }

  function renderBoard(state) {
    els.board.innerHTML = "";
    const interactive = state.phase === "AWAITING_ACTION" && currentPlayerIsHuman(state);
    const legalSet = new Set();
    if (interactive) {
      for (const m of E.legalMovesForCurrent()) legalSet.add(m.row * 8 + m.col);
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const idx = r * 8 + c;
        const cell = document.createElement("div");
        cell.className = "cell";
        const val = state.board[idx];

        if (val !== B.EMPTY) {
          const disc = document.createElement("span");
          disc.className = `disc ${val === B.BLACK ? "disc-black" : "disc-white"}`;
          cell.appendChild(disc);
        } else if (legalSet.has(idx)) {
          cell.classList.add("legal-move");
          cell.addEventListener("click", () => E.placeDisc(state.currentColor, r, c));
        }

        els.board.appendChild(cell);
      }
    }
  }

  function showPassOverlay(player) {
    els.passTitle.textContent = `${player.name} さん`;
    els.passMessage.textContent = "置ける場所がないため、パスになります";
    showOverlay(els.passOverlay);
  }

  function renderResultOverlay(state) {
    const r = state.result;
    els.resultTitle.textContent = "対局終了";
    if (r.winnerColor === null) {
      els.resultMessage.textContent = `引き分け（黒${r.black} - 白${r.white}）`;
    } else {
      const winnerName = state.players.find((p) => p.color === r.winnerColor).name;
      els.resultMessage.textContent = `${winnerName}の勝ち！（黒${r.black} - 白${r.white}）`;
    }
    showOverlay(els.resultOverlay);
  }

  return { init, startGame };
})();
