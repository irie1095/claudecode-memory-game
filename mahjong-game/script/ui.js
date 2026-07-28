MJ.UI = (function () {
  const G = MJ.Game;
  const T = MJ.Tiles;

  let selectedTileIndex = null;
  let selectedTile = null;
  let lastHandLength = null;
  let riichiArmed = false;

  function clearSelection() {
    selectedTileIndex = null;
    selectedTile = null;
    riichiArmed = false;
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
        return `<span class="score-chip${p.riichi ? " riichi-chip" : ""}">${label}${dealerMark} ${p.score}</span>`;
      })
      .join("");
  }

  // mode: 'up'(回転なし) / 'r90'(上家:90度) / 'r180'(対面:180度) / 'r270'(下家:270度)
  function discardHtml(discards, mode) {
    const tiles = discards
      .filter((d) => d.calledBy === null)
      .map((d) => `<div class="d-tile ${T.tileFaceClass(d.tile)}">${T.tileVisualHtml(d.tile)}</div>`);
    if (mode === "up") return tiles.join("");
    return tiles.map((t) => `<div class="d-tile-wrap-${mode.slice(1)}">${t}</div>`).join("");
  }

  const MELD_LABEL = { pon: "ポン", chi: "チー", minkan: "カン", kakan: "カン", ankan: "暗カン" };

  function meldSummaryText(melds) {
    if (melds.length === 0) return "";
    return " " + melds.map((m) => `[${MELD_LABEL[m.kind]}${T.label(m.tiles[0])}]`).join("");
  }

  function meldGroupHtml(melds) {
    return melds
      .map((m) => {
        const tiles = m.kind === "ankan" ? [null, m.tiles[0], m.tiles[0], null] : m.tiles;
        const inner = tiles
          .map((t) =>
            t === null
              ? `<div class="tile back-mini"></div>`
              : `<div class="tile ${T.tileFaceClass(t)}">${T.tileVisualHtml(t)}</div>`
          )
          .join("");
        return `<div class="meld-group">${inner}</div>`;
      })
      .join("");
  }

  function renderTable(state) {
    el("discard-top").innerHTML = discardHtml(state.players[2].discards, "r180");
    el("discard-left").innerHTML = discardHtml(state.players[3].discards, "r90");
    el("discard-right").innerHTML = discardHtml(state.players[1].discards, "r270");
    el("discard-self").innerHTML = discardHtml(state.players[0].discards, "up");

    el("hand-count-right").innerHTML = `<span class="back-tile"></span><span class="back-count">${state.players[1].hand.length}</span>${meldSummaryText(state.players[1].melds)}`;
    el("hand-count-top").innerHTML = `<span class="back-tile"></span><span class="back-count">${state.players[2].hand.length}</span>${meldSummaryText(state.players[2].melds)}`;
    el("hand-count-left").innerHTML = `<span class="back-tile"></span><span class="back-count">${state.players[3].hand.length}</span>${meldSummaryText(state.players[3].melds)}`;

    el("dora-tiles").innerHTML = state.doraIndicators
      .map((t) => `<div class="tile tile-mini ${T.tileFaceClass(t)}">${T.tileVisualHtml(t)}</div>`)
      .join("");

    el("human-melds").innerHTML = meldGroupHtml(state.players[0].melds);
  }

  function renderMessage(state) {
    const furitenNote = state.humanFuriten ? "【フリテン中：ロン不可】" : "";
    el("message").textContent = [furitenNote, state.message].filter(Boolean).join(" ");
  }

  function renderHand(state) {
    const hand = state.players[0].hand;
    if (hand.length !== lastHandLength) {
      clearSelection();
      lastHandLength = hand.length;
    }
    const sorted = hand.slice().sort((a, b) => a - b);
    const drawnTile = state.lastDrawnTile;
    const canDiscard = state.phase === "HUMAN_DISCARD_WAIT";

    el("hand-row").innerHTML = sorted
      .map((tile, i) => {
        const classes = ["tile", T.tileFaceClass(tile)];
        if (drawnTile !== null && tile === drawnTile && sorted.lastIndexOf(tile) === i) classes.push("drawn");
        if (selectedTileIndex === i) classes.push("selected");
        return `<div class="${classes.join(" ")}" data-index="${i}">${T.tileVisualHtml(tile)}</div>`;
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
      const declareRiichi = riichiArmed;
      clearSelection();
      G.humanDiscard(tile, declareRiichi);
      return;
    }
    selectedTileIndex = index;
    selectedTile = tile;
    render();
  }

  function renderActions(state) {
    const isDiscardWait = state.phase === "HUMAN_DISCARD_WAIT";
    const isCallWait = state.phase === "HUMAN_CALL_WAIT";

    el("btn-discard").hidden = !(isDiscardWait && selectedTile !== null);
    el("btn-tsumo").hidden = !(isDiscardWait && state.humanActions.canTsumo);
    el("btn-ron").hidden = !(state.phase === "HUMAN_RON_WAIT" && state.humanActions.canRon);
    el("btn-riichi").hidden = !(isDiscardWait && state.humanCanRiichi);
    el("btn-riichi").classList.toggle("act-armed", riichiArmed);

    el("btn-pon").hidden = !(isCallWait && state.pendingCallOptions.some((o) => o.type === "pon"));
    el("btn-chi").hidden = !(isCallWait && state.pendingCallOptions.some((o) => o.type === "chi"));

    const canClaimKan = isCallWait && state.pendingCallOptions.some((o) => o.type === "kan");
    const canSelfKan = isDiscardWait && state.humanKanOptions.length > 0;
    el("btn-kan").hidden = !(canClaimKan || canSelfKan);

    el("btn-skip").hidden = !(state.phase === "HUMAN_RON_WAIT" || isCallWait);
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
      title = r.abortive ? "四開槓（途中流局）" : "流局";
      yakuLine = r.abortive
        ? "カンが4回続いたため途中流局となりました"
        : `聴牌: ${r.tenpaiSeats.map((s) => (s === 0 ? "あなた" : G.seatLabel(s))).join("・") || "なし"}`;
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
      const declareRiichi = riichiArmed;
      clearSelection();
      G.humanDiscard(tile, declareRiichi);
    });
    el("btn-riichi").addEventListener("click", () => {
      riichiArmed = !riichiArmed;
      render();
    });
    el("btn-tsumo").addEventListener("click", () => G.humanTsumo());
    el("btn-ron").addEventListener("click", () => G.humanRon());
    el("btn-pon").addEventListener("click", () => G.humanCall("pon"));
    el("btn-chi").addEventListener("click", () => G.humanCall("chi"));
    el("btn-kan").addEventListener("click", () => {
      const state = G.getState();
      if (state.phase === "HUMAN_CALL_WAIT") {
        G.humanCall("kan");
        return;
      }
      const opt = state.humanKanOptions[0];
      if (!opt) return;
      if (opt.kind === "ankan") G.humanAnkan(opt.tile);
      else G.humanKakan(opt.tile);
    });
    el("btn-skip").addEventListener("click", () => {
      const state = G.getState();
      if (state.phase === "HUMAN_CALL_WAIT") G.humanSkipCall();
      else G.humanSkipRon();
    });
  }

  return { render, bindStaticButtons };
})();
