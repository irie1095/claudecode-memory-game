OTH.Engine = (function () {
  const B = OTH.Board;

  let state = null;
  let onChange = function () {};

  function setOnChange(fn) {
    onChange = fn;
  }

  function notify() {
    onChange();
  }

  function getState() {
    return state;
  }

  function currentPlayer() {
    return state.players.find((p) => p.color === state.currentColor);
  }

  function buildTurnMessage() {
    const p = currentPlayer();
    return `${p.name}の番です（${state.currentColor === B.BLACK ? "黒" : "白"}）`;
  }

  function legalMovesForCurrent() {
    return B.legalMoves(state.board, state.currentColor);
  }

  // ---- ゲーム開始 ----

  function startGame(playersConfig) {
    state = {
      board: B.createInitialBoard(),
      players: playersConfig,
      currentColor: B.BLACK,
      phase: "AWAITING_ACTION",
      message: "",
      passColor: null,
      result: null,
    };
    state.message = buildTurnMessage();
    notify();
    maybeRunCpuTurn();
  }

  // ---- 着手 ----

  function placeDisc(color, row, col) {
    if (!state || state.phase !== "AWAITING_ACTION") return false;
    if (color !== state.currentColor) return false;
    const move = legalMovesForCurrent().find((m) => m.row === row && m.col === col);
    if (!move) return false;

    B.applyMove(state.board, color, row, col);
    advanceTurnAfterMove();
    return true;
  }

  function advanceTurnAfterMove() {
    const next = B.opponent(state.currentColor);
    if (B.hasAnyLegalMove(state.board, next)) {
      state.currentColor = next;
      state.phase = "AWAITING_ACTION";
      state.message = buildTurnMessage();
      notify();
      maybeRunCpuTurn();
      return;
    }

    if (B.hasAnyLegalMove(state.board, state.currentColor)) {
      enterPassNotice(next);
    } else {
      finishGame();
    }
  }

  function enterPassNotice(skippedColor) {
    state.phase = "PASS_NOTICE";
    state.passColor = skippedColor;
    const p = state.players.find((pl) => pl.color === skippedColor);
    state.message = `${p.name}は置ける場所がないためパスです`;
    notify();

    if (p.controller === "cpu") {
      setTimeout(acknowledgePass, 900);
    }
  }

  function acknowledgePass() {
    if (!state || state.phase !== "PASS_NOTICE") return false;
    state.phase = "AWAITING_ACTION";
    state.passColor = null;
    state.message = buildTurnMessage();
    notify();
    maybeRunCpuTurn();
    return true;
  }

  function finishGame() {
    const { black, white } = B.countDiscs(state.board);
    state.phase = "GAME_OVER";
    state.result = {
      black,
      white,
      winnerColor: black === white ? null : black > white ? B.BLACK : B.WHITE,
    };
    state.message =
      state.result.winnerColor === null
        ? `引き分け！（黒${black} - 白${white}）`
        : `${state.result.winnerColor === B.BLACK ? "黒" : "白"}の勝ち！（黒${black} - 白${white}）`;
    notify();
  }

  // ---- CPU ----

  function maybeRunCpuTurn() {
    if (!state || state.phase !== "AWAITING_ACTION") return;
    const p = currentPlayer();
    if (!p || p.controller !== "cpu") return;
    setTimeout(runCpuTurn, 700);
  }

  function runCpuTurn() {
    if (!state || state.phase !== "AWAITING_ACTION") return;
    const p = currentPlayer();
    if (!p || p.controller !== "cpu") return;
    const move = OTH.AI.chooseMove(state.board, state.currentColor, p.difficulty);
    placeDisc(state.currentColor, move.row, move.col);
  }

  return {
    setOnChange,
    getState,
    startGame,
    placeDisc,
    acknowledgePass,
    legalMovesForCurrent,
  };
})();
