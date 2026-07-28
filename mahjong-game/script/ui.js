MJ.UI = (function () {
  const G = MJ.Game;
  const T = MJ.Tiles;

  let selectedTileIndex = null;
  let selectedTile = null;
  let lastHandLength = null;

  function clearSelection() {
    selectedTileIndex = null;
    selectedTile = null;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function render() {
    const state = G.getState();
    if (!state) return;
    renderStatusBar(state);
    renderScores(state);
    renderTable(state);
    renderMessage(state);
    renderHand(state);
    renderActions(state);
    renderResult(state);
  }

  function renderStatusBar(state) {
    const roundLabel = (G.round() === "east" ? "東" : "南") + G.kyokuNumber() + "局";
    el("status-bar").innerHTML = `
      <span class="chip chip-round">${roundLabel}</span>
      <span class="chip">${state.honba}本場</span>
      <span class="chip">供託${state.riichiSticks}</span>
      <span class="chip">残り${G.remainingLiveWall()}枚</span>
    `;
  }

  function renderScores(state) {
    el("scores-bar").innerHTML = state.players
      .map((p, i) => {
        const dealerMark = G.isDealer(i) ? "(親)" : "";
        const label = i === 0 ? "あなた" : G.seatLabel(i);
        return `<span class="score-chip">${label}${dealerMark} ${p.score}</span>`;
      })
      .join("");
  }

  function discardHtml(discards) {
    return discards
      .map((d) => `<div class="d-tile ${T.tileFaceClass(d.tile)}">${T.tileVisualHtml(d.tile, true)}</div>`)
      .join("");
  }

  function renderTable(state) {
    el("discard-top").innerHTML = discardHtml(state.players[2].discards);
    el("discard-left").innerHTML = discardHtml(state.players[3].discards);
    el("discard-right").innerHTML = discardHtml(state.players[1].discards);

    el("hand-count-right").innerHTML = `<span class="back-tile"></span><span class="back-count">${state.players[1].hand.length}</span>`;
    el("hand-count-top").innerHTML = `<span class="back-tile"></span><span class="back-count">${state.players[2].hand.length}</span>`;
    el("hand-count-left").innerHTML = `<span class="back-tile"></span><span class="back-count">${state.players[3].hand.length}</span>`;

    el("dora-tiles").innerHTML = state.doraIndicators
      .map((t) => `<div class="tile tile-mini ${T.tileFaceClass(t)}">${T.tileVisualHtml(t, false)}</div>`)
      .join("");
  }

  function renderMessage(state) {
    el("message").textContent = state.message || "";
  }

  function renderHand(state) {
    const hand = state.players[0].hand;
    if (hand.length !== lastHandLength) {
      clearSelection();
      lastHandLength = hand.length;
    }
    const sorted = hand.slice().sort((a, b) => a - b);
    const drawnTile = hand.length % 3 === 2 ? hand[hand.length - 1] : null;
    const canDiscard = state.phase === "HUMAN_DISCARD_WAIT";

    el("hand-row").innerHTML = sorted
      .map((tile, i) => {
        const classes = ["tile", T.tileFaceClass(tile)];
        if (drawnTile !== null && tile === drawnTile && sorted.lastIndexOf(tile) === i) classes.push("drawn");
        if (selectedTileIndex === i) classes.push("selected");
        return `<div class="${classes.join(" ")}" data-index="${i}">${T.tileVisualHtml(tile, false)}</div>`;
      })
      .join("");

    if (canDiscard) {
      el("hand-row")
        .querySelectorAll(".tile")
        .forEach((elm) => {
          const i = Number(elm.dataset.index);
          elm.addEventListener("click", () => onTileClick(i, sorted[i]));
        });
    }
  }

  function onTileClick(index, tile) {
    if (selectedTileIndex === index) {
      clearSelection();
      G.humanDiscard(tile);
      return;
    }
    selectedTileIndex = index;
    selectedTile = tile;
    render();
  }

  function renderActions(state) {
    el("btn-discard").hidden = !(state.phase === "HUMAN_DISCARD_WAIT" && selectedTile !== null);
    el("btn-tsumo").hidden = !(state.phase === "HUMAN_DISCARD_WAIT" && state.humanActions.canTsumo);
    el("btn-ron").hidden = !(state.phase === "HUMAN_RON_WAIT" && state.humanActions.canRon);
    el("btn-skip").hidden = state.phase !== "HUMAN_RON_WAIT";
    el("btn-riichi").hidden = true;
    el("btn-pon").hidden = true;
    el("btn-chi").hidden = true;
    el("btn-kan").hidden = true;
  }

  function yakuListHtml(list) {
    return list.map((y) => (y.yakuman ? `${y.name} 役満` : `${y.name} ${y.han}翻`)).join(" / ");
  }

  function renderResult(state) {
    const overlay = el("result-overlay");

    if (state.phase === "GAME_END") {
      const ranked = state.players
        .map((p, i) => ({ score: p.score, label: i === 0 ? "あなた" : G.seatLabel(i) }))
        .sort((a, b) => b.score - a.score);
      overlay.innerHTML = `
        <div class="result-card">
          <p class="result-title">半荘終了</p>
          <p class="result-yaku">${ranked.map((p, i) => `${i + 1}位 ${p.label} ${p.score}点`).join("<br>")}</p>
          <button class="result-next-btn" id="btn-restart">もう一度</button>
        </div>
      `;
      overlay.classList.add("show");
      el("btn-restart").addEventListener("click", () => MJ.Main.restart());
      return;
    }

    if (state.phase !== "ROUND_OVER") {
      overlay.classList.remove("show");
      overlay.innerHTML = "";
      return;
    }

    const r = state.result;
    let title, scoreLine, yakuLine;
    if (r.type === "ryuukyoku") {
      title = "流局";
      yakuLine = `聴牌: ${r.tenpaiSeats.map((s) => (s === 0 ? "あなた" : G.seatLabel(s))).join("・") || "なし"}`;
      scoreLine = "";
    } else {
      title = `${r.seat === 0 ? "あなた" : G.seatLabel(r.seat)}の${r.type === "tsumo" ? "ツモ" : "ロン"}`;
      yakuLine = yakuListHtml(r.yakuList);
      scoreLine = r.isYakuman ? `役満 ${r.score.total}点` : `${r.han}翻${r.fu}符 ${r.score.total}点相当`;
    }

    overlay.innerHTML = `
      <div class="result-card">
        <p class="result-title">${title}</p>
        <p class="result-yaku">${yakuLine}</p>
        <p class="result-score">${scoreLine}</p>
        <button class="result-next-btn" id="btn-next">次の局へ</button>
      </div>
    `;
    overlay.classList.add("show");
    el("btn-next").addEventListener("click", () => {
      clearSelection();
      MJ.Game.nextHand();
    });
  }

  function bindStaticButtons() {
    el("btn-discard").addEventListener("click", () => {
      if (selectedTile === null) return;
      const tile = selectedTile;
      clearSelection();
      G.humanDiscard(tile);
    });
    el("btn-tsumo").addEventListener("click", () => G.humanTsumo());
    el("btn-ron").addEventListener("click", () => G.humanRon());
    el("btn-skip").addEventListener("click", () => G.humanSkipRon());
  }

  return { render, bindStaticButtons };
})();
