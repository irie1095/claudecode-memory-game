// フェーズ4時点では仮のCPUロジック（ランダム打牌・和了できれば必ず和了）。
// 本実装（シャンテン数最小化）はフェーズ7で置き換える。
MJ.AI = (function () {
  function chooseDiscard(player) {
    const idx = Math.floor(Math.random() * player.hand.length);
    return player.hand[idx];
  }

  function wantsToWin() {
    return true;
  }

  // フェーズ5時点では仮ロジック（鳴ける時は常に鳴く）。本実装はフェーズ7。
  function wantsToCall() {
    return true;
  }

  return { chooseDiscard, wantsToWin, wantsToCall };
})();
