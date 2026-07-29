MJ.Game = (function () {
  const T = MJ.Tiles;
  let state = null;
  let onChange = function () {};

  function setOnChange(fn) {
    onChange = fn;
  }
  function notify() {
    if (state) state.humanFuriten = checkFuriten(0);
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
      callHappened: false,
      players: [0, 1, 2, 3].map((i) => ({
        seatIndex: i,
        seatWind: T.EAST,
        score: 25000,
        hand: [],
        melds: [],
        discards: [],
        isHuman: i === 0,
        riichi: false,
        doubleRiichi: false,
        ippatsuEligible: false,
        temporaryFuriten: false,
      })),
      wall: [],
      wallCursor: 0,
      liveWallEnd: 0,
      deadWallCursor: 0,
      kanCount: 0,
      kanSeats: [],
      doraIndicators: [],
      turnSeat: 0,
      phase: "IDLE",
      lastDiscard: null,
      message: "",
      humanActions: { canTsumo: false, canRon: false },
      humanTsumoResult: null,
      humanKanOptions: [],
      humanCanRiichi: false,
      humanFuriten: false,
      lastDrawnTile: null,
      pendingRon: null,
      pendingOtherRonners: [],
      pendingCallOptions: [],
      pendingCallTile: null,
      pendingCallFrom: null,
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
    const p = player(seat);
    return Object.assign(
      {
        seatWind: p.seatWind,
        roundWind: roundWind(),
        winTile,
        isTsumo,
        isDealer: isDealer(seat),
        isRiichi: p.riichi,
        isDoubleRiichi: p.doubleRiichi,
        isIppatsu: p.ippatsuEligible,
        isRinshan: false,
        isChankan: false,
        isHaitei: false,
        isHoutei: false,
        doraTiles: doraTiles(),
      },
      extra || {}
    );
  }

  // 聴牌時、自分の待ち牌が自分の捨て牌にある（永久フリテン）か、
  // 直前にロンを見送っている（一時フリテン）場合はロン不可
  function checkFuriten(seat) {
    const p = player(seat);
    if (p.temporaryFuriten) return true;
    const counts = MJ.HandUtils.toCounts(p.hand);
    if (MJ.Shanten.shanten(counts, p.melds.length) !== 0) return false;
    const waits = MJ.Shanten.getWaits(counts, p.melds.length);
    return p.discards.some((d) => waits.includes(d.tile));
  }

  function startHand() {
    state.wall = T.buildWall();
    state.liveWallEnd = state.wall.length - 14;
    state.wallCursor = 0;
    state.deadWallCursor = 0;
    state.kanCount = 0;
    state.kanSeats = [];
    state.callHappened = false;
    state.doraIndicators = [state.wall[state.liveWallEnd]];
    refreshWinds();
    for (const p of state.players) {
      p.hand = [];
      p.melds = [];
      p.discards = [];
      p.riichi = false;
      p.doubleRiichi = false;
      p.ippatsuEligible = false;
      p.temporaryFuriten = false;
    }
    for (let n = 0; n < 13; n++) {
      for (let i = 0; i < 4; i++) {
        const seat = (state.dealerSeat + i) % 4;
        player(seat).hand.push(state.wall[state.wallCursor++]);
      }
    }
    state.turnSeat = state.dealerSeat;
    state.phase = "IDLE";
    state.result = null;
    state.message = "";
    notify();
    scheduleDraw(state.turnSeat);
  }

  function scheduleDraw(seat) {
    if (seat === 0) draw(seat);
    else setTimeout(() => draw(seat), 500);
  }

  function computeKanOptions(p) {
    if (p.riichi) return []; // リーチ後のカンは行わない簡略仕様
    const opts = [];
    const counts = MJ.HandUtils.toCounts(p.hand);
    for (let t = 0; t < 34; t++) {
      if (counts[t] >= 4) opts.push({ kind: "ankan", tile: t });
    }
    for (const m of p.melds) {
      if (m.kind === "pon" && p.hand.includes(m.tiles[0])) opts.push({ kind: "kakan", tile: m.tiles[0] });
    }
    return opts;
  }

  function declareSelfKan(seat, opt) {
    if (opt.kind === "kakan") {
      // 槍槓判定：カン成立前に他家がロンできるか確認
      const chankanRonners = [];
      for (let i = 1; i <= 3; i++) {
        const s = (seat + i) % 4;
        if (checkFuriten(s)) continue;
        const other = player(s);
        const ctx = buildContext(s, opt.tile, false, { isChankan: true });
        const result = MJ.Yaku.evaluateWin(other.hand.concat([opt.tile]), other.melds, ctx);
        if (result.valid) chankanRonners.push({ seat: s, result });
      }
      if (chankanRonners.length > 0) {
        for (const r of chankanRonners) resolveWin(r.seat, opt.tile, false, r.result, seat);
        return;
      }
    }

    const p = player(seat);
    if (opt.kind === "ankan") {
      for (let i = 0; i < 4; i++) MJ.HandUtils.removeTile(p.hand, opt.tile);
      p.melds.push({ kind: "ankan", tiles: [opt.tile, opt.tile, opt.tile, opt.tile], from: null });
    } else {
      const idx = p.melds.findIndex((m) => m.kind === "pon" && m.tiles[0] === opt.tile);
      MJ.HandUtils.removeTile(p.hand, opt.tile);
      p.melds[idx] = { kind: "kakan", tiles: [opt.tile, opt.tile, opt.tile, opt.tile], from: p.melds[idx].from };
    }
    state.callHappened = true;
    for (const pl of state.players) pl.ippatsuEligible = false;
    registerKan(seat);
    drawRinshan(seat);
  }

  function registerKan(seat) {
    state.kanCount++;
    state.kanSeats.push(seat);
  }

  function isSuukaikan() {
    if (state.kanCount < 4) return false;
    return new Set(state.kanSeats).size > 1;
  }

  // リーチ宣言（tileを切って聴牌になる場合のみ有効）
  function declareRiichiFor(seat, tile) {
    const p = player(seat);
    p.riichi = true;
    p.doubleRiichi = p.discards.length === 0 && !state.callHappened;
    p.ippatsuEligible = true;
    p.score -= 1000;
    state.riichiSticks += 1;
  }

  function canDeclareRiichi(p) {
    return !p.riichi && p.melds.length === 0 && p.score >= 1000 && remainingLiveWall() >= 4;
  }

  function findRiichiDiscard(p) {
    if (!canDeclareRiichi(p)) return null;
    return MJ.AI.findRiichiDiscard(p.hand);
  }

  // CPUの打牌牌を決定する（新規リーチ宣言／リーチ後のツモ切り／通常選択）
  function cpuDiscardChoice(seat) {
    const p = player(seat);
    if (!p.riichi) {
      const riichiTile = findRiichiDiscard(p);
      if (riichiTile !== null && MJ.AI.wantsToCall(p, { type: "riichi" }, state)) {
        declareRiichiFor(seat, riichiTile);
        return riichiTile;
      }
    }
    if (p.riichi) return p.hand[p.hand.length - 1];
    return MJ.AI.chooseDiscard(p, state);
  }

  function drawRinshan(seat) {
    const k = state.deadWallCursor;
    const rinshanTile = state.wall[state.wall.length - 1 - k];
    state.deadWallCursor++;
    state.liveWallEnd--;

    const p = player(seat);
    p.hand.push(rinshanTile);
    state.doraIndicators.push(state.wall[state.wall.length - 14 + state.deadWallCursor]);

    if (isSuukaikan()) {
      ryuukyoku(true);
      return;
    }

    const ctx = buildContext(seat, rinshanTile, true, { isRinshan: true });
    const result = MJ.Yaku.evaluateWin(p.hand.slice(), p.melds, ctx);
    p.ippatsuEligible = false;

    if (seat === 0) {
      if (p.riichi && !result.valid) {
        state.phase = "RESOLVING";
        state.lastDrawnTile = rinshanTile;
        state.message = `ツモ切り: ${T.label(rinshanTile)}`;
        notify();
        setTimeout(() => doDiscard(0, rinshanTile), 500);
        return;
      }
      state.phase = "HUMAN_DISCARD_WAIT";
      state.humanActions = { canTsumo: result.valid, canRon: false };
      state.humanTsumoResult = result.valid ? result : null;
      state.humanKanOptions = computeKanOptions(p);
      state.humanCanRiichi = canDeclareRiichi(p) && findRiichiDiscard(p) !== null;
      state.lastDrawnTile = rinshanTile;
      state.message = `嶺上牌: ${T.label(rinshanTile)}`;
      notify();
      return;
    }

    if (result.valid && MJ.AI.wantsToWin()) {
      resolveWin(seat, rinshanTile, true, result);
      return;
    }
    const kanOptions = state.deadWallCursor < 4 ? computeKanOptions(p) : [];
    if (kanOptions.length > 0 && MJ.AI.wantsToCall(p, { type: "selfkan" }, state)) {
      declareSelfKan(seat, kanOptions[0]);
      return;
    }
    const discardTile = cpuDiscardChoice(seat);
    setTimeout(() => doDiscard(seat, discardTile), 400);
  }

  function draw(seat) {
    if (state.wallCursor >= state.liveWallEnd) {
      ryuukyoku(false);
      return;
    }
    const tile = state.wall[state.wallCursor++];
    const p = player(seat);
    p.hand.push(tile);
    const isHaitei = state.wallCursor >= state.liveWallEnd;

    const ctx = buildContext(seat, tile, true, { isHaitei });
    const result = MJ.Yaku.evaluateWin(p.hand.slice(), p.melds, ctx);
    p.ippatsuEligible = false;

    if (seat === 0) {
      if (p.riichi && !result.valid) {
        state.phase = "RESOLVING";
        state.lastDrawnTile = tile;
        state.message = `ツモ切り: ${T.label(tile)}`;
        notify();
        setTimeout(() => doDiscard(0, tile), 500);
        return;
      }
      state.phase = "HUMAN_DISCARD_WAIT";
      state.humanActions = { canTsumo: result.valid, canRon: false };
      state.humanTsumoResult = result.valid ? result : null;
      state.humanKanOptions = state.deadWallCursor < 4 ? computeKanOptions(p) : [];
      state.humanCanRiichi = canDeclareRiichi(p) && findRiichiDiscard(p) !== null;
      state.lastDrawnTile = tile;
      state.message = "あなたの番です（牌をタップして選択→「捨てる」で確定）";
      notify();
      return;
    }

    if (result.valid && MJ.AI.wantsToWin()) {
      resolveWin(seat, tile, true, result);
      return;
    }
    const kanOptions = state.deadWallCursor < 4 ? computeKanOptions(p) : [];
    if (kanOptions.length > 0 && MJ.AI.wantsToCall(p, { type: "selfkan" }, state)) {
      declareSelfKan(seat, kanOptions[0]);
      return;
    }
    const discardTile = cpuDiscardChoice(seat);
    setTimeout(() => doDiscard(seat, discardTile), 400);
  }

  function computeChiSets(hand, tile) {
    if (!T.isSuited(tile)) return [];
    const rank = T.rankOf(tile);
    const has = (t) => hand.includes(t);
    const sets = [];
    if (rank >= 3 && has(tile - 2) && has(tile - 1)) sets.push([tile - 2, tile - 1]);
    if (rank >= 2 && rank <= 8 && has(tile - 1) && has(tile + 1)) sets.push([tile - 1, tile + 1]);
    if (rank <= 7 && has(tile + 1) && has(tile + 2)) sets.push([tile + 1, tile + 2]);
    return sets;
  }

  function resolveCallWindow(discarderSeat, tile) {
    const kanAvailable = state.deadWallCursor < 4; // カン用の嶺上牌が尽きていればカンだけ不可

    const ponKan = [];
    for (let i = 1; i <= 3; i++) {
      const s = (discarderSeat + i) % 4;
      const p = player(s);
      if (p.riichi) continue; // リーチ後は鳴かない簡略仕様
      const cnt = p.hand.filter((t) => t === tile).length;
      if (kanAvailable && cnt >= 3) ponKan.push({ seat: s, type: "kan", tile });
      if (cnt >= 2) ponKan.push({ seat: s, type: "pon", tile });
    }
    const chiSeat = (discarderSeat + 1) % 4;
    const chiSets = player(chiSeat).riichi ? [] : computeChiSets(player(chiSeat).hand, tile);
    const chiOpts = chiSets.map((set) => ({ seat: chiSeat, type: "chi", tile, set }));

    const allOptions = ponKan.concat(chiOpts);
    if (allOptions.length === 0) return null;

    const humanOpts = allOptions.filter((o) => o.seat === 0);
    if (humanOpts.length > 0) return { kind: "human", options: humanOpts };

    for (const opt of ponKan) {
      if (MJ.AI.wantsToCall(player(opt.seat), opt, state)) return { kind: "cpu", choice: opt };
    }
    for (const opt of chiOpts) {
      if (MJ.AI.wantsToCall(player(opt.seat), opt, state)) return { kind: "cpu", choice: opt };
    }
    return null;
  }

  function performCall(choice, discarderSeat) {
    const caller = player(choice.seat);
    const discards = player(discarderSeat).discards;
    discards[discards.length - 1].calledBy = choice.seat;

    state.callHappened = true;
    for (const pl of state.players) pl.ippatsuEligible = false;

    if (choice.type === "pon") {
      MJ.HandUtils.removeTile(caller.hand, choice.tile);
      MJ.HandUtils.removeTile(caller.hand, choice.tile);
      caller.melds.push({ kind: "pon", tiles: [choice.tile, choice.tile, choice.tile], from: discarderSeat });
      state.turnSeat = choice.seat;
      afterCallDiscardPhase(choice.seat, `${seatLabel(choice.seat)}がポン`);
    } else if (choice.type === "kan") {
      MJ.HandUtils.removeTile(caller.hand, choice.tile);
      MJ.HandUtils.removeTile(caller.hand, choice.tile);
      MJ.HandUtils.removeTile(caller.hand, choice.tile);
      caller.melds.push({ kind: "minkan", tiles: [choice.tile, choice.tile, choice.tile, choice.tile], from: discarderSeat });
      state.turnSeat = choice.seat;
      registerKan(choice.seat);
      drawRinshan(choice.seat);
    } else if (choice.type === "chi") {
      MJ.HandUtils.removeTile(caller.hand, choice.set[0]);
      MJ.HandUtils.removeTile(caller.hand, choice.set[1]);
      const tiles = [choice.set[0], choice.set[1], choice.tile].sort((a, b) => a - b);
      caller.melds.push({ kind: "chi", tiles, from: discarderSeat });
      state.turnSeat = choice.seat;
      afterCallDiscardPhase(choice.seat, `${seatLabel(choice.seat)}がチー`);
    }
  }

  function afterCallDiscardPhase(seat, message) {
    if (seat === 0) {
      state.phase = "HUMAN_DISCARD_WAIT";
      state.humanActions = { canTsumo: false, canRon: false };
      state.humanTsumoResult = null;
      state.humanKanOptions = state.deadWallCursor < 4 ? computeKanOptions(player(0)) : [];
      state.humanCanRiichi = false;
      state.lastDrawnTile = null;
      state.message = message + "。捨てる牌を選んでください";
      notify();
      return;
    }
    state.message = message;
    notify();
    const discardTile = cpuDiscardChoice(seat);
    setTimeout(() => doDiscard(seat, discardTile), 400);
  }

  function doDiscard(seat, tile) {
    const p = player(seat);
    MJ.HandUtils.removeTile(p.hand, tile);
    p.discards.push({ tile, calledBy: null });
    p.temporaryFuriten = false;
    state.lastDiscard = { seat, tile };
    state.message = `${seatLabel(seat)}が${T.label(tile)}を捨てました`;

    const isHoutei = state.wallCursor >= state.liveWallEnd;

    const ronners = [];
    for (let i = 1; i <= 3; i++) {
      const otherSeat = (seat + i) % 4;
      if (checkFuriten(otherSeat)) continue;
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

    const callResult = resolveCallWindow(seat, tile);
    if (callResult) {
      if (callResult.kind === "human") {
        state.phase = "HUMAN_CALL_WAIT";
        state.pendingCallOptions = callResult.options;
        state.pendingCallTile = tile;
        state.pendingCallFrom = seat;
        state.message = "鳴けます";
        notify();
        return;
      }
      notify();
      performCall(callResult.choice, seat);
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
    state.humanKanOptions = [];
    state.humanCanRiichi = false;
    state.lastDrawnTile = null;
    state.pendingRon = null;
    state.pendingOtherRonners = [];
    state.pendingCallOptions = [];
    state.pendingCallTile = null;
    state.pendingCallFrom = null;
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
      hand: isTsumo ? p.hand.slice() : p.hand.concat([winTile]),
      melds: p.melds.slice(),
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

  function ryuukyoku(isAbortive) {
    if (isAbortive) {
      state.phase = "ROUND_OVER";
      state.result = { type: "ryuukyoku", tenpaiSeats: [], abortive: true };
      state.dealerRepeats = true;
      state.message = "四開槓（途中流局）";
      notify();
      return;
    }
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
    state.result = { type: "ryuukyoku", tenpaiSeats, abortive: false };
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

  function humanDiscard(tile, declareRiichi) {
    if (state.phase !== "HUMAN_DISCARD_WAIT") return;
    const p = player(0);
    if (p.riichi && tile !== state.lastDrawnTile) return; // リーチ後はツモ切りのみ
    if (declareRiichi) {
      if (!canDeclareRiichi(p)) return;
      const testHand = p.hand.slice();
      MJ.HandUtils.removeTile(testHand, tile);
      const counts = MJ.HandUtils.toCounts(testHand);
      if (MJ.Shanten.shanten(counts, 0) !== 0) return;
      declareRiichiFor(0, tile);
    }
    doDiscard(0, tile);
  }

  function humanTsumo() {
    if (state.phase !== "HUMAN_DISCARD_WAIT" || !state.humanTsumoResult) return;
    const p = player(0);
    const tile = p.hand[p.hand.length - 1];
    resolveWin(0, tile, true, state.humanTsumoResult);
  }

  function humanAnkan(tile) {
    if (state.phase !== "HUMAN_DISCARD_WAIT") return;
    const opt = state.humanKanOptions.find((o) => o.kind === "ankan" && o.tile === tile);
    if (!opt) return;
    declareSelfKan(0, opt);
  }

  function humanKakan(tile) {
    if (state.phase !== "HUMAN_DISCARD_WAIT") return;
    const opt = state.humanKanOptions.find((o) => o.kind === "kakan" && o.tile === tile);
    if (!opt) return;
    declareSelfKan(0, opt);
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
    player(0).temporaryFuriten = true;
    for (const r of others) resolveWin(r.seat, state.lastDiscard.tile, false, r.result, discardSeat);
    if (state.phase === "ROUND_OVER") return; // 他家が代わりに和了した
    setNeutralPhase();
    notify();
    const nextSeat = (discardSeat + 1) % 4;
    state.turnSeat = nextSeat;
    scheduleDraw(nextSeat);
  }

  function humanCall(type) {
    if (state.phase !== "HUMAN_CALL_WAIT") return;
    const opt = state.pendingCallOptions.find((o) => o.type === type);
    if (!opt) return;
    const discarderSeat = state.pendingCallFrom;
    setNeutralPhase();
    performCall(opt, discarderSeat);
  }

  function humanSkipCall() {
    if (state.phase !== "HUMAN_CALL_WAIT") return;
    const discarderSeat = state.pendingCallFrom;
    setNeutralPhase();
    notify();
    const nextSeat = (discarderSeat + 1) % 4;
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
    humanAnkan,
    humanKakan,
    humanRon,
    humanSkipRon,
    humanCall,
    humanSkipCall,
    getState: () => state,
    seatLabel,
    round,
    kyokuNumber,
    remainingLiveWall,
    isDealer,
  };
})();
