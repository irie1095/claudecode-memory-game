MJ.Scoring = (function () {
  function roundUp100(n) {
    return Math.ceil(n / 100) * 100;
  }

  // 符・翻から基本点(base)を算出。5翻以上・役満は符に関係なく固定
  function baseFromHanFu(han, fu, isYakuman, yakumanCount) {
    if (isYakuman) return 8000 * yakumanCount;
    if (han >= 13) return 8000; // 数え役満
    if (han >= 11) return 6000; // 三倍満
    if (han >= 8) return 4000; // 倍満
    if (han >= 6) return 3000; // 跳満
    return Math.min(fu * Math.pow(2, 2 + han), 2000); // 2000クリップ＝満貫（fu*2^(2+han)）
  }

  function tierName(han, isYakuman) {
    if (isYakuman) return "役満";
    if (han >= 13) return "役満";
    if (han >= 11) return "三倍満";
    if (han >= 8) return "倍満";
    if (han >= 6) return "跳満";
    if (han >= 5) return "満貫";
    return null;
  }

  // 比較用の合計点（ロン想定の点数で候補間の優劣を決める。単調性があれば十分）
  function calcScore(cand, isDealer) {
    const base = cand.isYakuman
      ? baseFromHanFu(0, 0, true, cand.yakumanCount)
      : baseFromHanFu(cand.han, cand.fu, false, 0);
    const total = isDealer ? base * 6 : base * 4;
    return {
      base,
      total,
      tier: tierName(cand.isYakuman ? 13 : cand.han, cand.isYakuman),
    };
  }

  // ロン: 放銃者が支払う一括点数
  function ronPayment(base, isDealer) {
    return roundUp100(isDealer ? base * 6 : base * 4);
  }

  // ツモ: 各家の支払い内訳
  function tsumoPayments(base, isDealer) {
    if (isDealer) {
      const each = roundUp100(base * 2);
      return { dealerPays: 0, nonDealerPays: each, isDealerWinner: true };
    }
    return {
      dealerPays: roundUp100(base * 2),
      nonDealerPays: roundUp100(base * 1),
      isDealerWinner: false,
    };
  }

  // 流局時の聴牌/不聴罰符（各家±点）
  const NOTEN_TABLE = {
    0: { tenpai: 0, noten: 0 },
    1: { tenpai: 3000, noten: -1000 },
    2: { tenpai: 1500, noten: -1500 },
    3: { tenpai: 1000, noten: -3000 },
    4: { tenpai: 0, noten: 0 },
  };

  function ryuukyokuPayments(tenpaiCount) {
    return NOTEN_TABLE[tenpaiCount];
  }

  return { roundUp100, baseFromHanFu, tierName, calcScore, ronPayment, tsumoPayments, ryuukyokuPayments };
})();
