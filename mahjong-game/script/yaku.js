MJ.Yaku = (function () {
  const T = MJ.Tiles;

  // 副露(melds)を役判定用のブロック形式に変換
  function meldToBlock(meld) {
    if (meld.kind === "chi") {
      const tiles = meld.tiles.slice().sort((a, b) => a - b);
      return { type: "sequence", tiles, open: true, kan: false };
    }
    if (meld.kind === "pon") {
      return { type: "triplet", tiles: meld.tiles.slice(), open: true, kan: false };
    }
    // ankan / minkan / kakan はすべて刻子相当として形状判定に使う（ドラ加算のため4枚とも保持）
    return {
      type: "triplet",
      tiles: meld.tiles.slice(),
      open: meld.kind !== "ankan",
      kan: true,
    };
  }

  // 手牌（副露を除く手元の牌）を「面子×neededMelds＋雀頭」に完全分解する全パターンを返す
  function decomposeStandard(counts, neededMelds) {
    const results = [];
    const c = counts.slice();
    const blocks = [];

    function rec(idx, pairTile) {
      if (idx === 34) {
        if (pairTile !== null && blocks.length === neededMelds) {
          results.push({
            blocks: blocks.map((b) => ({ type: b.type, tiles: b.tiles.slice(), open: false, kan: false })),
            pair: pairTile,
          });
        }
        return;
      }
      if (c[idx] === 0) {
        rec(idx + 1, pairTile);
        return;
      }
      if (blocks.length < neededMelds) {
        if (c[idx] >= 3) {
          c[idx] -= 3;
          blocks.push({ type: "triplet", tiles: [idx, idx, idx] });
          rec(idx, pairTile);
          blocks.pop();
          c[idx] += 3;
        }
        if (T.isSuited(idx) && T.rankOf(idx) <= 7 && c[idx + 1] > 0 && c[idx + 2] > 0) {
          c[idx]--; c[idx + 1]--; c[idx + 2]--;
          blocks.push({ type: "sequence", tiles: [idx, idx + 1, idx + 2] });
          rec(idx, pairTile);
          blocks.pop();
          c[idx]++; c[idx + 1]++; c[idx + 2]++;
        }
      }
      if (c[idx] >= 2 && pairTile === null) {
        c[idx] -= 2;
        rec(idx, idx);
        c[idx] += 2;
      }
    }
    rec(0, null);
    return results;
  }

  function isYakuhaiTile(tile, context) {
    return T.isDragonTile(tile) || tile === context.seatWind || tile === context.roundWind;
  }

  // ある面子が「和了時点で確定した刻子/槓子」として暗刻扱いになるか
  // ロンで完成した面子は明刻扱い（暗刻に数えない）
  function isConcealedTripletBlock(block, context) {
    if (block.type !== "triplet") return false;
    if (block.open) return false; // ポン・明槓は常に明刻
    if (block.kan) return true; // 暗槓は常に暗刻扱い
    if (!block.tiles.includes(context.winTile)) return true; // 手牌内で既に揃っていた暗刻
    return context.isTsumo; // ロンでこの面子が完成した場合は明刻扱い
  }

  function waitTypeOf(blocks, pair, context) {
    const w = context.winTile;
    if (pair === w) return "tanki";
    for (const b of blocks) {
      if (!b.tiles.includes(w)) continue;
      if (b.type === "triplet") return "shanpon";
      const sorted = b.tiles.slice().sort((a, z) => a - z);
      if (w === sorted[1]) return "kanchan";
      if (w === sorted[0] && sorted[2] - sorted[0] === 2 && T.rankOf(sorted[2]) === 9) return "penchan";
      if (w === sorted[2] && T.rankOf(sorted[0]) === 1) return "penchan";
      return "ryanmen";
    }
    return "ryanmen";
  }

  function detectYakuman(blocks, pair, context) {
    const list = [];
    const allTiles = blocks.flatMap((b) => b.tiles).concat([pair]);

    // 四暗刻：4面子すべてが暗刻/暗槓
    const concealedTripletCount = blocks.filter((b) => isConcealedTripletBlock(b, context)).length;
    if (blocks.length === 4 && concealedTripletCount === 4) {
      list.push({ name: "四暗刻", yakuman: 1 });
    }

    // 大三元：三元牌が3種とも刻子/槓子
    const dragonTriplets = blocks.filter((b) => b.type === "triplet" && T.isDragonTile(b.tiles[0]));
    if (dragonTriplets.length === 3) {
      list.push({ name: "大三元", yakuman: 1 });
    }

    // 字一色：全てのブロックが字牌のみ
    if (allTiles.every((t) => T.isHonor(t))) {
      list.push({ name: "字一色", yakuman: 1 });
    }

    // 清老頭：全てのブロックが老頭牌（1,9）のみ（＝順子は存在し得ない＝全て刻子）
    if (allTiles.every((t) => T.isTerminal(t))) {
      list.push({ name: "清老頭", yakuman: 1 });
    }

    return list;
  }

  function detectYaku(blocks, pair, melds, context) {
    const isMenzen = melds.every((m) => m.kind === "ankan");
    const allTiles = blocks.flatMap((b) => b.tiles).concat([pair]);
    const list = [];
    let isPinfu = false;

    if (context.isDoubleRiichi) {
      list.push({ name: "ダブルリーチ", han: 2 });
    } else if (context.isRiichi) {
      list.push({ name: "リーチ", han: 1 });
    }
    if (context.isRiichi && context.isIppatsu) {
      list.push({ name: "一発", han: 1 });
    }
    if (isMenzen && context.isTsumo) {
      list.push({ name: "門前清自摸和", han: 1 });
    }
    if (context.isRinshan) list.push({ name: "嶺上開花", han: 1 });
    if (context.isChankan) list.push({ name: "槍槓", han: 1 });
    if (context.isHaitei && context.isTsumo) list.push({ name: "海底摸月", han: 1 });
    if (context.isHoutei && !context.isTsumo) list.push({ name: "河底撈魚", han: 1 });

    // 平和：面前・4面子すべて順子・雀頭が役牌でない・両面待ち
    if (
      isMenzen &&
      blocks.length === 4 &&
      blocks.every((b) => b.type === "sequence") &&
      !isYakuhaiTile(pair, context) &&
      waitTypeOf(blocks, pair, context) === "ryanmen"
    ) {
      list.push({ name: "平和", han: 1 });
      isPinfu = true;
    }

    // 断么九：老頭牌・字牌を一切含まない
    if (allTiles.every((t) => !T.isTerminalOrHonor(t))) {
      list.push({ name: "断么九", han: 1 });
    }

    // 役牌：三元牌の刻子、自風、場風（重複時は加算）
    for (const b of blocks) {
      if (b.type !== "triplet") continue;
      const t = b.tiles[0];
      if (T.isDragonTile(t)) list.push({ name: `役牌(${T.label(t)})`, han: 1 });
      if (t === context.seatWind) list.push({ name: "役牌(自風)", han: 1 });
      if (t === context.roundWind) list.push({ name: "役牌(場風)", han: 1 });
    }

    // 一盃口：面前で同一の順子が2組
    if (isMenzen) {
      const seqKeys = blocks.filter((b) => b.type === "sequence").map((b) => b.tiles[0]);
      const dup = seqKeys.some((k, i) => seqKeys.indexOf(k) !== i);
      if (dup) list.push({ name: "一盃口", han: 1 });
    }

    // 三色同順：同じ開始位置の順子が萬・筒・索すべてに存在
    const seqStarts = blocks.filter((b) => b.type === "sequence").map((b) => b.tiles[0]);
    for (let r = 0; r < 7; r++) {
      if (seqStarts.includes(r) && seqStarts.includes(r + 9) && seqStarts.includes(r + 18)) {
        list.push({ name: "三色同順", han: isMenzen ? 2 : 1 });
        break;
      }
    }

    // 一気通貫：同一スートで123・456・789がすべて揃う
    for (const base of [0, 9, 18]) {
      if (seqStarts.includes(base) && seqStarts.includes(base + 3) && seqStarts.includes(base + 6)) {
        list.push({ name: "一気通貫", han: isMenzen ? 2 : 1 });
        break;
      }
    }

    // 対々和：4面子すべて刻子/槓子
    if (blocks.length === 4 && blocks.every((b) => b.type === "triplet")) {
      list.push({ name: "対々和", han: 2 });
    }

    // 三暗刻：暗刻/暗槓が3つ以上
    const concealedTripletCount = blocks.filter((b) => isConcealedTripletBlock(b, context)).length;
    if (concealedTripletCount >= 3) {
      list.push({ name: "三暗刻", han: 2 });
    }

    // 小三元：三元牌の2種が刻子、残り1種が雀頭
    const dragonTripletTiles = blocks.filter((b) => b.type === "triplet" && T.isDragonTile(b.tiles[0])).map((b) => b.tiles[0]);
    if (dragonTripletTiles.length === 2 && T.isDragonTile(pair) && !dragonTripletTiles.includes(pair)) {
      list.push({ name: "小三元", han: 2 });
    }

    // チャンタ／純全帯幺九：全ブロック（雀頭含む）が老頭牌か字牌を含む
    const allBlocksHaveTerminalOrHonor =
      blocks.every((b) => b.tiles.some((t) => T.isTerminalOrHonor(t))) && T.isTerminalOrHonor(pair);
    if (allBlocksHaveTerminalOrHonor) {
      const hasHonor = allTiles.some((t) => T.isHonor(t));
      if (hasHonor) {
        list.push({ name: "チャンタ", han: isMenzen ? 2 : 1 });
      } else {
        list.push({ name: "純全帯幺九", han: isMenzen ? 3 : 2 });
      }
    }

    // 混一色／清一色：使用スートが1種類のみ（字牌は混一色のみ許容）
    const suits = new Set(allTiles.filter((t) => T.isSuited(t)).map((t) => T.suitOf(t)));
    const hasHonorTile = allTiles.some((t) => T.isHonor(t));
    if (suits.size === 1) {
      if (hasHonorTile) {
        list.push({ name: "混一色", han: isMenzen ? 3 : 2 });
      } else {
        list.push({ name: "清一色", han: isMenzen ? 6 : 5 });
      }
    }

    return { list, isPinfu, isMenzen };
  }

  function calcFu(blocks, pair, melds, context, isPinfu) {
    let fu = 20;
    const waitType = waitTypeOf(blocks, pair, context);

    for (const b of blocks) {
      if (b.type === "sequence") continue;
      const yaochuu = T.isTerminalOrHonor(b.tiles[0]);
      const concealed = isConcealedTripletBlock(b, context);
      if (b.kan) {
        fu += concealed ? (yaochuu ? 32 : 16) : (yaochuu ? 16 : 8);
      } else {
        fu += concealed ? (yaochuu ? 8 : 4) : (yaochuu ? 4 : 2);
      }
    }

    if (isYakuhaiTile(pair, context)) {
      fu += T.isDragonTile(pair) ? 2 : 0;
      if (pair === context.seatWind) fu += 2;
      if (pair === context.roundWind) fu += 2;
    }

    if (waitType === "kanchan" || waitType === "penchan" || waitType === "tanki") fu += 2;

    if (isPinfu) {
      fu = context.isTsumo ? 20 : 30;
      return fu;
    }

    const isMenzen = melds.every((m) => m.kind === "ankan");
    if (context.isTsumo) fu += 2;
    else if (isMenzen) fu += 10;

    return Math.ceil(fu / 10) * 10;
  }

  // concealedTiles: 副露で場に出ている牌を除いた、和了牌を含む手元の牌の配列
  // melds: {kind:'pon'|'chi'|'ankan'|'minkan'|'kakan', tiles:number[]}[]
  // context: { seatWind, roundWind, winTile, isTsumo, isRiichi, isDoubleRiichi, isIppatsu,
  //            isRinshan, isChankan, isHaitei, isHoutei, doraTiles:number[] }
  function evaluateWin(concealedTiles, melds, context) {
    const openBlocks = melds.map(meldToBlock);
    const neededMelds = 4 - melds.length;
    const counts = MJ.HandUtils.toCounts(concealedTiles);

    const candidates = [];

    if (melds.length === 0) {
      // 国士無双
      const YAOCHUU = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
      const kinds = YAOCHUU.filter((t) => counts[t] > 0).length;
      const hasPair = YAOCHUU.some((t) => counts[t] >= 2);
      if (kinds === 13 && hasPair) {
        candidates.push({ isYakuman: true, yakumanCount: 1, list: [{ name: "国士無双", yakuman: 1 }] });
      }
      // 七対子
      const isChiitoi = counts.every((n) => n === 0 || n === 2) && counts.filter((n) => n === 2).length === 7;
      if (isChiitoi) {
        const dora = context.doraTiles.reduce((sum, d) => sum + counts[d], 0);
        candidates.push({
          isYakuman: false,
          list: [{ name: "七対子", han: 2 }],
          han: 2 + dora,
          fu: 25,
          dora,
        });
      }
    }

    for (const decomp of decomposeStandard(counts, neededMelds)) {
      const blocks = decomp.blocks.concat(openBlocks);
      const pair = decomp.pair;

      const yakumanList = detectYakuman(blocks, pair, context);
      if (yakumanList.length > 0) {
        candidates.push({ isYakuman: true, yakumanCount: yakumanList.length, list: yakumanList });
        continue;
      }

      const { list, isPinfu, isMenzen } = detectYaku(blocks, pair, melds, context);
      if (list.length === 0) continue;

      const doraCount = context.doraTiles.reduce((sum, d) => {
        return sum + blocks.reduce((s, b) => s + b.tiles.filter((t) => t === d).length, 0) + (pair === d ? 1 : 0);
      }, 0);

      const han = list.reduce((s, y) => s + y.han, 0) + doraCount;
      const fu = calcFu(blocks, pair, melds, context, isPinfu);
      candidates.push({ isYakuman: false, list, han, fu, dora: doraCount, isMenzen });
    }

    if (candidates.length === 0) return { valid: false };

    let best = null;
    let bestScore = -1;
    for (const cand of candidates) {
      const score = MJ.Scoring.calcScore(cand, context.isDealer);
      if (score.total > bestScore) {
        bestScore = score.total;
        best = { ...cand, score };
      }
    }
    return { valid: true, ...best };
  }

  return { decomposeStandard, evaluateWin, isYakuhaiTile, waitTypeOf, isConcealedTripletBlock };
})();
