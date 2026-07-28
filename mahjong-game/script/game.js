MJ.Game = (function () {
  const T = MJ.Tiles;
  let state = null;
  let onChange = function () {};

  function setOnChange(fn) {
    onChange = fn;
  }
  function notify() {
    onChange();
  }

  function seatWindFor(seatIndex, dealerSeat) {
    const offset = (seatIndex - dealerSeat + 4) % 4;
    return [T.EAST, T.SOUTH, T.WEST, T.NORTH][offset];
  }

  function newGame() {
    state = {
      handIndex: 0,
      honba: 0,
      riichiSticks: 0,
      dealerSeat: 0,
      players: [0, 1, 2, 3].map((i) => ({
        seatIndex: i,
        seatWind: T.EAST,
        score: 25000,
        hand: [],
        melds: [],
        discards: [],
        isHuman: i === 0,
      })),
      wall: [],
      wallCursor: 0,
      liveWallEnd: 0,
      doraIndicators: [],
      turnSeat: 0,
      phase: "IDLE",
      lastDiscard: null,
      message: "",
      humanActions: { canTsumo: false, canRon: false },
      humanTsumoResult: null,
      pendingRon: null,
      pendingOtherRonners: [],
      dealerRepeats: false,
      result: null,
    };
    return state;
  }

  function round() {
    return state.handIndex < 4 ? "east" : "south";
  }
  function kyokuNumber() {
    return (state.handIndex % 4) + 1;
  }
  function roundWind() {
    return round() === "east" ? T.EAST : T.SOUTH;
  }
  function player(seat) {
    return state.players[seat];
  }
  function isDealer(seat) {
    return seat === state.dealerSeat;
  }
  function remainingLiveWall() {
    return state.liveWallEnd - state.wallCursor;
  }
  function seatLabel(seat) {
    return ["あなた", "下家", "対面", "上家"][seat];
  }

  function refreshWinds() {
    for (const p of state.players) p.seatWind = seatWindFor(p.seatIndex, state.dealerSeat);
  }

  function doraTiles() {
    return state.doraIndicators.map((ind) => T.doraFromIndicator(ind));
  }

  function buildContext(seat, winTile, isTsumo, extra) {
    return Object.assign(
      {
        seatWind: player(seat).seatWind,
        roundWind: roundWind(),
        winTile,
        isTsumo,
        isDealer: isDealer(seat),
        isRiichi: false,
        isDoubleRiichi: false,
        isIppatsu: false,
        isRinshan: false,
        isChankan: false,
        isHaitei: false,
        isHoutei: false,
        doraTiles: doraTiles(),
      },
      extra || {}
    );
  }

  function startHand() {
    state.wall = T.buildWall();
    state.liveWallEnd = state.wall.length - 14;
    state.wallCursor = 0;
    state.doraIndicators = [state.wall[state.liveWallEnd]];
    refreshWinds();
    for (const p of state.players) {
      p.hand = [];
      p.melds = [];
      p.discards = [];
    }
    for (let n = 0; n < 13; n++) {
      for (let i = 0; i < 4; i++) {
        const seat = (state.dealerSeat + i) % 4;
        player(seat).hand.push(state.wall[state.wallCursor++]);
      }
    }
    state.turnSeat = state.dealerSeat;
    state.result = null;
    state.message = "";
    notify();
    scheduleDraw(state.turnSeat);
  }

  function scheduleDraw(seat) {
    if (seat === 0) draw(seat);
    else setTimeout(() => draw(seat), 500);
  }

  function draw(seat) {
    if (state.wallCursor >= state.liveWallEnd) {
      ryuukyoku();
      return;
    }
    const tile = state.wall[state.wallCursor++];
    const p = player(seat);
    p.hand.push(tile);
    const isHaitei = state.wallCursor >= state.liveWallEnd;

    const ctx = buildContext(seat, tile, true, { isHaitei });
    const result = MJ.Yaku.evaluateWin(p.hand.slice(), p.melds, ctx);

    if (seat === 0) {
      state.phase = "HUMAN_DISCARD_WAIT";
      state.humanActions = { canTsumo: result.valid, canRon: false };
      state.humanTsumoResult = result.valid ? result : null;
      state.message = "あなたの番です（牌をタップして選択→「捨てる」で確定）";
      notify();
      return;
    }

    if (result.valid && MJ.AI.wantsToWin()) {
      resolveWin(seat, tile, true, result);
      return;
    }
    const discardTile = MJ.AI.chooseDiscard(p, state);
    setTimeout(() => doDiscard(seat, discardTile), 400);
  }

  function doDiscard(seat, tile) {
    const p = player(seat);
    MJ.HandUtils.removeTile(p.hand, tile);
    p.discards.push({ tile, calledBy: null });
    state.lastDiscard = { seat, tile };
    state.message = `${seatLabel(seat)}が${T.label(tile)}を捨てました`;

    const isHoutei = state.wallCursor >= state.liveWallEnd;

    const ronners = [];
    for (let i = 1; i <= 3; i++) {
      const otherSeat = (seat + i) % 4;
      const other = player(otherSeat);
      const ctx = buildContext(otherSeat, tile, false, { isHoutei });
      const result = MJ.Yaku.evaluateWin(other.hand.concat([tile]), other.melds, ctx);
      if (result.valid) ronners.push({ seat: otherSeat, result });
    }

    if (ronners.length > 0) {
      const humanRon = ronners.find((r) => r.seat === 0);
      if (humanRon) {
        state.phase = "HUMAN_RON_WAIT";
        state.humanActions = { canTsumo: false, canRon: true };
        state.pendingRon = humanRon;
        state.pendingOtherRonners = ronners.filter((r) => r.seat !== 0);
        state.message = `ロンできます（${T.label(tile)}）`;
        notify();
        return;
      }
      for (const r of ronners) resolveWin(r.seat, tile, false, r.result, seat);
      return;
    }

    setNeutralPhase();
    notify();
    const nextSeat = (seat + 1) % 4;
    state.turnSeat = nextSeat;
    scheduleDraw(nextSeat);
  }

  // 人間の即時アクション待ちでなくなったことを明示し、古いphaseによる誤操作を防ぐ
  function setNeutralPhase() {
    state.phase = "RESOLVING";
    state.humanActions = { canTsumo: false, canRon: false };
    state.humanTsumoResult = null;
    state.pendingRon = null;
    state.pendingOtherRonners = [];
  }

  function resolveWin(seat, winTile, isTsumo, result, discarderSeat) {
    const p = player(seat);
    const base = result.score.base;
    const honbaRon = state.honba * 300;
    const honbaTsumoEach = state.honba * 100;

    if (isTsumo) {
      const pay = MJ.Scoring.tsumoPayments(base, isDealer(seat));
      for (const other of state.players) {
        if (other.seatIndex === seat) continue;
        const amount =
          (isDealer(seat) ? pay.nonDealerPays : other.seatIndex === state.dealerSeat ? pay.dealerPays : pay.nonDealerPays) +
          honbaTsumoEach;
        other.score -= amount;
        p.score += amount;
      }
    } else {
      const amount = MJ.Scoring.ronPayment(base, isDealer(seat)) + honbaRon;
      player(discarderSeat).score -= amount;
      p.score += amount;
    }
    p.score += state.riichiSticks * 1000;
    state.riichiSticks = 0;

    state.phase = "ROUND_OVER";
    state.result = {
      type: isTsumo ? "tsumo" : "ron",
      seat,
      winTile,
      yakuList: result.list,
      han: result.isYakuman ? null : result.han,
      fu: result.isYakuman ? null : result.fu,
      score: result.score,
      isYakuman: result.isYakuman,
    };
    state.dealerRepeats = state.dealerRepeats || isDealer(seat);
    state.message = `${seatLabel(seat)}の和了！`;
    notify();
  }

  function ryuukyoku() {
    const tenpaiSeats = [];
    for (let s = 0; s < 4; s++) {
      const p = player(s);
      const counts = MJ.HandUtils.toCounts(p.hand);
      if (MJ.Shanten.shanten(counts, p.melds.length) === 0) tenpaiSeats.push(s);
    }
    const pay = MJ.Scoring.ryuukyokuPayments(tenpaiSeats.length);
    for (let s = 0; s < 4; s++) {
      player(s).score += tenpaiSeats.includes(s) ? pay.tenpai : pay.noten;
    }
    state.phase = "ROUND_OVER";
    state.result = { type: "ryuukyoku", tenpaiSeats };
    state.dealerRepeats = tenpaiSeats.includes(state.dealerSeat);
    state.message = "流局";
    notify();
  }

  function nextHand() {
    if (state.players.some((p) => p.score < 0)) {
      state.phase = "GAME_END";
      notify();
      return;
    }
    if (state.dealerRepeats) {
      state.honba++;
    } else {
      state.honba = 0;
      state.dealerSeat = (state.dealerSeat + 1) % 4;
      state.handIndex++;
    }
    state.dealerRepeats = false;
    if (state.handIndex >= 8) {
      state.phase = "GAME_END";
      notify();
      return;
    }
    startHand();
  }

  // ---- 人間の操作 ----

  function humanDiscard(tile) {
    if (state.phase !== "HUMAN_DISCARD_WAIT") return;
    doDiscard(0, tile);
  }

  function humanTsumo() {
    if (state.phase !== "HUMAN_DISCARD_WAIT" || !state.humanTsumoResult) return;
    const p = player(0);
    const tile = p.hand[p.hand.length - 1];
    resolveWin(0, tile, true, state.humanTsumoResult);
  }

  function humanRon() {
    if (state.phase !== "HUMAN_RON_WAIT" || !state.pendingRon) return;
    const { seat, result } = state.pendingRon;
    const discarderSeat = state.lastDiscard.seat;
    const others = state.pendingOtherRonners || [];
    resolveWin(seat, state.lastDiscard.tile, false, result, discarderSeat);
    for (const r of others) resolveWin(r.seat, state.lastDiscard.tile, false, r.result, discarderSeat);
  }

  function humanSkipRon() {
    if (state.phase !== "HUMAN_RON_WAIT") return;
    const others = state.pendingOtherRonners || [];
    const discardSeat = state.lastDiscard.seat;
    for (const r of others) resolveWin(r.seat, state.lastDiscard.tile, false, r.result, discardSeat);
    if (state.phase === "ROUND_OVER") return; // 他家が代わりに和了した
    setNeutralPhase();
    notify();
    const nextSeat = (discardSeat + 1) % 4;
    state.turnSeat = nextSeat;
    scheduleDraw(nextSeat);
  }

  return {
    setOnChange,
    newGame,
    startHand,
    nextHand,
    humanDiscard,
    humanTsumo,
    humanRon,
    humanSkipRon,
    getState: () => state,
    seatLabel,
    round,
    kyokuNumber,
    remainingLiveWall,
    isDealer,
  };
})();
