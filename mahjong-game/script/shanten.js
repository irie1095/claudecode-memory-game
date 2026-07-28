MJ.Shanten = (function () {
  const T = MJ.Tiles;
  const YAOCHUU = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

  // counts: 34要素の枚数配列（副露で場に出ている牌は含めない＝手牌のうち手元に残っている分のみ）
  // openMelds: 既に確定している副露（ポン・チー・カン）の面子数
  function standardShanten(counts, openMelds) {
    const c = counts.slice();
    let best = Infinity;

    function rec(idx, melds, taatsu, hasPair) {
      if (idx === 34) {
        let usedTaatsu = taatsu;
        if (melds + usedTaatsu > 4) usedTaatsu = 4 - melds;
        const s = (4 - melds) * 2 - usedTaatsu - (hasPair ? 1 : 0);
        if (s < best) best = s;
        return;
      }
      if (c[idx] === 0) {
        rec(idx + 1, melds, taatsu, hasPair);
        return;
      }

      // 刻子
      if (c[idx] >= 3) {
        c[idx] -= 3;
        rec(idx, melds + 1, taatsu, hasPair);
        c[idx] += 3;
      }

      // 順子
      if (T.isSuited(idx) && T.rankOf(idx) <= 7 && c[idx + 1] > 0 && c[idx + 2] > 0) {
        c[idx]--; c[idx + 1]--; c[idx + 2]--;
        rec(idx, melds + 1, taatsu, hasPair);
        c[idx]++; c[idx + 1]++; c[idx + 2]++;
      }

      // 雀頭
      if (c[idx] >= 2 && !hasPair) {
        c[idx] -= 2;
        rec(idx, melds, taatsu, true);
        c[idx] += 2;
      }

      // 対子（雀頭以外＝刻子候補としての塔子）
      if (c[idx] >= 2 && melds + taatsu < 4) {
        c[idx] -= 2;
        rec(idx, melds, taatsu + 1, hasPair);
        c[idx] += 2;
      }

      // 両面・辺張塔子
      if (T.isSuited(idx) && T.rankOf(idx) <= 8 && c[idx + 1] > 0 && melds + taatsu < 4) {
        c[idx]--; c[idx + 1]--;
        rec(idx, melds, taatsu + 1, hasPair);
        c[idx]++; c[idx + 1]++;
      }

      // 嵌張塔子
      if (T.isSuited(idx) && T.rankOf(idx) <= 7 && c[idx + 2] > 0 && melds + taatsu < 4) {
        c[idx]--; c[idx + 2]--;
        rec(idx, melds, taatsu + 1, hasPair);
        c[idx]++; c[idx + 2]++;
      }

      // 浮き牌として無視
      rec(idx + 1, melds, taatsu, hasPair);
    }

    rec(0, openMelds, 0, false);
    return best;
  }

  function chiitoiShanten(counts) {
    let pairs = 0, kinds = 0;
    for (let i = 0; i < 34; i++) {
      if (counts[i] > 0) kinds++;
      if (counts[i] >= 2) pairs++;
    }
    return 6 - pairs + Math.max(0, 7 - kinds);
  }

  function kokushiShanten(counts) {
    let kinds = 0, hasPair = false;
    for (const i of YAOCHUU) {
      if (counts[i] > 0) kinds++;
      if (counts[i] >= 2) hasPair = true;
    }
    return 13 - kinds - (hasPair ? 1 : 0);
  }

  // openMelds > 0（鳴きあり）の場合、七対子・国士は成立しないため通常形のみ判定
  function shanten(counts, openMelds) {
    let best = standardShanten(counts, openMelds);
    if (openMelds === 0) {
      best = Math.min(best, chiitoiShanten(counts));
      best = Math.min(best, kokushiShanten(counts));
    }
    return best;
  }

  function isAgari(counts, openMelds) {
    return shanten(counts, openMelds) === -1;
  }

  // 聴牌時（shanten===0）の待ち牌一覧を返す
  function getWaits(counts, openMelds) {
    const c = counts.slice();
    const waits = [];
    for (let t = 0; t < 34; t++) {
      if (c[t] >= 4) continue;
      c[t]++;
      if (shanten(c, openMelds) === -1) waits.push(t);
      c[t]--;
    }
    return waits;
  }

  return { standardShanten, chiitoiShanten, kokushiShanten, shanten, isAgari, getWaits };
})();
