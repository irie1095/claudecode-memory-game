// CPU思考ロジック：シャンテン数を最小化する貪欲法。
// 受け入れ枚数計算などの高度な牌効率は行わず、あくまで「悪くない」打ち手を目指す簡易AI。
MJ.AI = (function () {
  const T = MJ.Tiles;

  // 数値が小さいほど「先に切ってよい」牌（字牌・老頭牌を優先して整理する）
  function tileDesirability(tile) {
    if (T.isHonor(tile)) return 0;
    const rank = T.rankOf(tile);
    if (rank === 1 || rank === 9) return 1;
    if (rank === 2 || rank === 8) return 2;
    if (rank === 3 || rank === 7) return 3;
    return 4;
  }

  // 手牌の中から、切った後のシャンテン数が最小になる牌を選ぶ。
  // 同点なら使いにくい牌（字牌・老頭牌）を優先して切る。
  function chooseDiscard(player) {
    const meldCount = player.melds.length;
    let best = null;
    let bestShanten = Infinity;
    let bestDesirability = Infinity;
    for (const tile of new Set(player.hand)) {
      const testHand = player.hand.slice();
      MJ.HandUtils.removeTile(testHand, tile);
      const counts = MJ.HandUtils.toCounts(testHand);
      const shanten = MJ.Shanten.shanten(counts, meldCount);
      const desirability = tileDesirability(tile);
      if (shanten < bestShanten || (shanten === bestShanten && desirability < bestDesirability)) {
        best = tile;
        bestShanten = shanten;
        bestDesirability = desirability;
      }
    }
    return best !== null ? best : player.hand[player.hand.length - 1];
  }

  function wantsToWin() {
    return true;
  }

  // hand（13枚）の中に、切ると聴牌になる牌があれば返す（無ければnull）
  function findRiichiDiscard(hand) {
    for (const tile of new Set(hand)) {
      const testHand = hand.slice();
      MJ.HandUtils.removeTile(testHand, tile);
      const counts = MJ.HandUtils.toCounts(testHand);
      if (MJ.Shanten.shanten(counts, 0) === 0) return tile;
    }
    return null;
  }

  // 鳴いた後、手牌の中で最も良い牌を切った場合の最小シャンテン数
  function bestShantenAfter(hand, meldCount) {
    let best = Infinity;
    for (const tile of new Set(hand)) {
      const testHand = hand.slice();
      MJ.HandUtils.removeTile(testHand, tile);
      const counts = MJ.HandUtils.toCounts(testHand);
      const s = MJ.Shanten.shanten(counts, meldCount);
      if (s < best) best = s;
    }
    return best;
  }

  // 鳴いた後も役に届く見込みがあるかの簡易チェック
  // （断么九互換／役牌がらみ／混一色・清一色路線のいずれか）
  function isYakuFeasible(handAfterCall, melds, player, state) {
    const allTiles = handAfterCall.concat(melds.flatMap((m) => m.tiles));

    if (allTiles.every((t) => !T.isTerminalOrHonor(t))) return true; // 断么九

    const roundWind = state.handIndex < 4 ? T.EAST : T.SOUTH;
    const hasYakuhaiMeld = melds.some((m) => {
      if (m.kind === "chi") return false;
      const t = m.tiles[0];
      return T.isDragonTile(t) || t === player.seatWind || t === roundWind;
    });
    if (hasYakuhaiMeld) return true;

    const suits = new Set(allTiles.filter((t) => T.isSuited(t)).map((t) => T.suitOf(t)));
    if (suits.size <= 1) return true; // 混一色・清一色路線

    return false;
  }

  // ポン・チー・明槓：鳴いた後のシャンテン数が改善し、かつ役に届く見込みがある時だけ受ける
  function wantsToCallMeld(player, option, state) {
    const beforeShanten = MJ.Shanten.shanten(MJ.HandUtils.toCounts(player.hand), player.melds.length);

    const testHand = player.hand.slice();
    if (option.type === "chi") {
      MJ.HandUtils.removeTile(testHand, option.set[0]);
      MJ.HandUtils.removeTile(testHand, option.set[1]);
    } else {
      const copies = option.type === "kan" ? 3 : 2;
      for (let i = 0; i < copies; i++) MJ.HandUtils.removeTile(testHand, option.tile);
    }
    const newMeldCount = player.melds.length + 1;
    const afterShanten = bestShantenAfter(testHand, newMeldCount);
    if (afterShanten >= beforeShanten) return false;

    const meldTiles = option.type === "chi" ? [option.set[0], option.set[1], option.tile] : new Array(option.type === "kan" ? 4 : 3).fill(option.tile);
    const newMelds = player.melds.concat([{ kind: option.type, tiles: meldTiles }]);
    return isYakuFeasible(testHand, newMelds, player, state);
  }

  function wantsToCall(player, option, state) {
    if (option.type === "selfkan" || option.type === "riichi") return true;
    return wantsToCallMeld(player, option, state);
  }

  return { chooseDiscard, wantsToWin, wantsToCall, findRiichiDiscard };
})();
