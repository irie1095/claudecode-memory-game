UNO.Engine = (function () {
  const C = UNO.Cards;
  const TOTAL_ROUNDS = 10;

  let state = null;
  let matchSeatsConfig = null; // [{ name, controller }]
  let scores = null; // [{ seatId, name, total }]
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

  function seatCount() {
    return state.seats.length;
  }

  function advance(k) {
    const n = seatCount();
    return (((state.currentSeat + k * state.direction) % n) + n) % n;
  }

  function topCard() {
    return state.discard[state.discard.length - 1];
  }

  function hasPlayableCard(seat) {
    return seat.hand.some((c) => C.matchesTop(c, topCard(), state.activeColor));
  }

  function pickRandomColor() {
    return C.COLORS[Math.floor(Math.random() * C.COLORS.length)];
  }

  function drawOne() {
    if (state.deck.length === 0) {
      const top = state.discard.pop();
      state.deck = C.shuffle(state.discard);
      state.discard = [top];
    }
    return state.deck.pop();
  }

  function drawCards(seat, n) {
    for (let i = 0; i < n; i++) seat.hand.push(drawOne());
  }

  function buildTurnMessage() {
    const seat = state.seats[state.currentSeat];
    return `${seat.name}の番です`;
  }

  // ---- マッチ/ラウンド開始 ----

  function startMatch(seatsConfig) {
    matchSeatsConfig = seatsConfig;
    scores = seatsConfig.map((s, i) => ({ seatId: i, name: s.name, total: 0 }));
    startRound(1);
  }

  function startNextRound() {
    if (!state || state.round >= TOTAL_ROUNDS) return;
    startRound(state.round + 1);
  }

  function startRound(roundNumber) {
    const deck = C.shuffle(C.buildDeck());
    const seats = matchSeatsConfig.map((s, i) => ({
      id: i,
      name: s.name,
      controller: s.controller,
      hand: [],
      catchable: false,
      saidUno: false,
    }));

    state = {
      seats,
      deck,
      discard: [],
      direction: 1,
      currentSeat: 0,
      activeColor: null,
      phase: "AWAITING_ACTION",
      drawnCard: null,
      pendingWildPlay: null,
      message: "",
      round: roundNumber,
      totalRounds: TOTAL_ROUNDS,
      scores,
      matchOver: false,
      roundResult: null,
    };

    for (let n = 0; n < 7; n++) {
      for (const seat of state.seats) seat.hand.push(drawOne());
    }

    let first = drawOne();
    while (first.value === "wild4") {
      state.deck.unshift(first);
      state.deck = C.shuffle(state.deck);
      first = drawOne();
    }
    state.discard.push(first);
    state.activeColor = C.isWild(first) ? pickRandomColor() : first.color;

    if (first.value === "skip") {
      state.currentSeat = advance(1);
    } else if (first.value === "reverse") {
      state.direction = -1;
    } else if (first.value === "draw2") {
      drawCards(state.seats[state.currentSeat], 2);
      state.currentSeat = advance(1);
    }

    state.message = buildTurnMessage();
    notify();
    maybeRunCpuTurn();
  }

  // ---- プレイヤー操作 ----

  function playCard(seatId, cardId) {
    if (!state || state.phase === "ROUND_OVER") return false;
    if (seatId !== state.currentSeat) return false;
    const seat = state.seats[seatId];
    const cardIndex = seat.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return false;
    const card = seat.hand[cardIndex];

    if (state.phase === "AWAITING_POST_DRAW_DECISION") {
      if (!state.drawnCard || state.drawnCard.id !== cardId) return false;
    } else if (state.phase !== "AWAITING_ACTION") {
      return false;
    } else if (!C.matchesTop(card, topCard(), state.activeColor)) {
      return false;
    }

    seat.hand.splice(cardIndex, 1);
    state.discard.push(card);
    state.drawnCard = null;

    if (C.isWild(card)) {
      state.pendingWildPlay = { seatId, card };
      state.phase = "AWAITING_COLOR_CHOICE";
      notify();
      return true;
    }

    state.activeColor = card.color;
    resolveAfterPlay(seat, card);
    return true;
  }

  function chooseColor(color) {
    if (!state || state.phase !== "AWAITING_COLOR_CHOICE" || !state.pendingWildPlay) return false;
    const { seatId, card } = state.pendingWildPlay;
    state.activeColor = color;
    state.pendingWildPlay = null;
    resolveAfterPlay(state.seats[seatId], card);
    return true;
  }

  function drawCardAction(seatId) {
    if (!state || state.phase !== "AWAITING_ACTION" || seatId !== state.currentSeat) return false;
    const seat = state.seats[seatId];
    if (hasPlayableCard(seat)) return false;

    const card = drawOne();
    seat.hand.push(card);

    if (C.matchesTop(card, topCard(), state.activeColor)) {
      state.phase = "AWAITING_POST_DRAW_DECISION";
      state.drawnCard = card;
      state.message = `${seat.name}が引いた${C.label(card)}は出せます`;
      notify();
      return true;
    }

    state.drawnCard = null;
    state.message = `${seat.name}が引きましたが出せませんでした`;
    state.currentSeat = advance(1);
    closeCatchWindowForCurrentSeat();
    state.phase = "AWAITING_ACTION";
    notify();
    maybeRunCpuTurn();
    return true;
  }

  function endTurnAfterDraw(seatId) {
    if (!state || state.phase !== "AWAITING_POST_DRAW_DECISION" || seatId !== state.currentSeat) return false;
    state.drawnCard = null;
    state.currentSeat = advance(1);
    closeCatchWindowForCurrentSeat();
    state.phase = "AWAITING_ACTION";
    state.message = buildTurnMessage();
    notify();
    maybeRunCpuTurn();
    return true;
  }

  function callUno(seatId) {
    if (!state) return false;
    const seat = state.seats[seatId];
    if (!seat || seat.hand.length !== 1 || !seat.catchable || seat.saidUno) return false;
    seat.saidUno = true;
    notify();
    return true;
  }

  function catchMissedUno(targetSeatId) {
    if (!state) return false;
    const seat = state.seats[targetSeatId];
    if (!seat || seat.hand.length !== 1 || !seat.catchable || seat.saidUno) return false;
    drawCards(seat, 2);
    seat.catchable = false;
    seat.saidUno = false;
    state.message = `${seat.name}はUNOコール忘れでペナルティ2枚！`;
    notify();
    return true;
  }

  function checkCpuCatches() {
    if (!state) return;
    for (const seat of state.seats) {
      if (seat.controller !== "cpu") continue;
      for (const other of state.seats) {
        if (other.id === seat.id) continue;
        if (other.hand.length === 1 && other.catchable && !other.saidUno) {
          catchMissedUno(other.id);
          return;
        }
      }
    }
  }

  // ---- 効果解決 ----

  function resolveAfterPlay(seat, card) {
    if (seat.hand.length === 0) {
      finishRound(seat);
      return;
    }

    if (seat.hand.length === 1) {
      seat.catchable = true;
      // CPUは自分のUNOコールを忘れない簡略仕様（人間プレイヤーだけがコール漏れの対象）
      seat.saidUno = seat.controller === "cpu";
    }

    applyEffectAndAdvance(card);
    closeCatchWindowForCurrentSeat();

    state.phase = "AWAITING_ACTION";
    state.message = buildTurnMessage();
    notify();
    maybeRunCpuTurn();
  }

  function applyEffectAndAdvance(card) {
    if (card.value === "reverse") {
      state.direction *= -1;
      if (seatCount() === 2) {
        state.currentSeat = advance(2);
      } else {
        state.currentSeat = advance(1);
      }
      return;
    }
    if (card.value === "skip") {
      state.currentSeat = advance(2);
      return;
    }
    if (card.value === "draw2" || card.value === "wild4") {
      const target = state.seats[advance(1)];
      drawCards(target, card.value === "draw2" ? 2 : 4);
      state.currentSeat = advance(2);
      return;
    }
    state.currentSeat = advance(1);
  }

  function closeCatchWindowForCurrentSeat() {
    const seat = state.seats[state.currentSeat];
    if (seat.catchable) seat.catchable = false;
  }

  function finishRound(winnerSeat) {
    let pointsEarned = 0;
    const breakdown = [];
    for (const seat of state.seats) {
      if (seat.id === winnerSeat.id) continue;
      const pts = seat.hand.reduce((sum, c) => sum + C.pointValue(c), 0);
      if (pts > 0) breakdown.push({ seatId: seat.id, name: seat.name, points: pts });
      pointsEarned += pts;
    }

    const scoreEntry = scores.find((s) => s.seatId === winnerSeat.id);
    scoreEntry.total += pointsEarned;

    state.matchOver = state.round >= TOTAL_ROUNDS;
    state.phase = "ROUND_OVER";
    state.roundResult = {
      winnerSeat: winnerSeat.id,
      winnerName: winnerSeat.name,
      pointsEarned,
      breakdown,
    };
    state.message = `${winnerSeat.name}がラウンド${state.round}を制し、${pointsEarned}点を獲得！`;
    notify();
  }

  // ---- CPU ----

  function maybeRunCpuTurn() {
    if (!state || state.phase === "ROUND_OVER") return;
    const seat = state.seats[state.currentSeat];
    if (!seat || seat.controller !== "cpu") return;
    setTimeout(runCpuTurn, 700);
  }

  function runCpuTurn() {
    if (!state || state.phase !== "AWAITING_ACTION") return;
    const seat = state.seats[state.currentSeat];
    if (!seat || seat.controller !== "cpu") return;

    // このCPUの手番が来た時点で、他家のUNOコール漏れをまだ見逃していれば指摘する
    // （プレイ直後ではなく次の手番のタイミングにすることで、人間側にコールする猶予を与える）
    checkCpuCatches();

    if (hasPlayableCard(seat)) {
      const card = UNO.AI.chooseCard(seat, state, topCard());
      playCard(seat.id, card.id);
      if (state.phase === "AWAITING_COLOR_CHOICE") {
        chooseColor(UNO.AI.chooseColor(seat));
      }
      return;
    }

    drawCardAction(seat.id);
    if (state.phase === "AWAITING_POST_DRAW_DECISION" && state.currentSeat === seat.id) {
      playCard(seat.id, state.drawnCard.id);
      if (state.phase === "AWAITING_COLOR_CHOICE") {
        chooseColor(UNO.AI.chooseColor(seat));
      }
    }
  }

  return {
    setOnChange,
    getState,
    startMatch,
    startNextRound,
    playCard,
    chooseColor,
    drawCard: drawCardAction,
    endTurnAfterDraw,
    callUno,
    catchMissedUno,
    hasPlayableCard,
    topCard,
  };
})();
