UNO.AI = (function () {
  const C = UNO.Cards;

  function colorCounts(hand) {
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    for (const c of hand) {
      if (c.color !== "wild") counts[c.color]++;
    }
    return counts;
  }

  function bestColorFor(hand) {
    const counts = colorCounts(hand);
    let best = C.COLORS[0];
    let bestN = -1;
    for (const color of C.COLORS) {
      if (counts[color] > bestN) {
        bestN = counts[color];
        best = color;
      }
    }
    return best;
  }

  // 出せる候補の中から、手札に多く残っている色を優先して選ぶ。
  // ワイルド+4は他に出せる札があれば温存する（浅いヒューリスティック）。
  function chooseCard(seat, state, top) {
    const playable = seat.hand.filter((c) => C.matchesTop(c, top, state.activeColor));
    const nonWild4 = playable.filter((c) => c.value !== "wild4");
    const candidates = nonWild4.length > 0 ? nonWild4 : playable;

    const counts = colorCounts(seat.hand);
    let best = candidates[0];
    let bestScore = -1;
    for (const card of candidates) {
      const score = card.color === "wild" ? 0 : counts[card.color];
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }
    return best;
  }

  function chooseColor(seat) {
    return bestColorFor(seat.hand);
  }

  return { chooseCard, chooseColor };
})();
