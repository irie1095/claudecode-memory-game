const MJ = {};

MJ.Tiles = (function () {
  const EAST = 27, SOUTH = 28, WEST = 29, NORTH = 30, HAKU = 31, HATSU = 32, CHUN = 33;

  const LABELS = [
    "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m",
    "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p",
    "1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s",
    "東", "南", "西", "北", "白", "發", "中",
  ];

  function isSuited(tile) {
    return tile < 27;
  }

  function isHonor(tile) {
    return tile >= 27;
  }

  function suitOf(tile) {
    if (tile < 9) return "m";
    if (tile < 18) return "p";
    if (tile < 27) return "s";
    return "z";
  }

  function rankOf(tile) {
    if (tile >= 27) return tile - 26; // 1-7 : 東南西北白發中
    return (tile % 9) + 1;
  }

  function isTerminal(tile) {
    return isSuited(tile) && (rankOf(tile) === 1 || rankOf(tile) === 9);
  }

  function isTerminalOrHonor(tile) {
    return isTerminal(tile) || isHonor(tile);
  }

  function isWindTile(tile) {
    return tile >= EAST && tile <= NORTH;
  }

  function isDragonTile(tile) {
    return tile >= HAKU && tile <= CHUN;
  }

  function label(tile) {
    return LABELS[tile];
  }

  const KANJI_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

  // 牌の見た目（内部HTML）を返す
  function tileVisualHtml(tile) {
    const suit = suitOf(tile);
    const rank = rankOf(tile);

    if (suit === "m") {
      return `<span class="pai-kanji pai-kanji-red">${KANJI_NUM[rank]}</span><span class="pai-suit-label">萬</span>`;
    }

    if (suit === "p" || suit === "s") {
      const shapeClass = suit === "p" ? "pip-dot" : "pip-bar";
      const items = new Array(rank).fill(`<span class="pip ${shapeClass}"></span>`).join("");
      return `<span class="pip-grid" data-count="${rank}">${items}</span>`;
    }

    if (tile === HAKU) {
      return `<span class="pai-haku"></span>`;
    }
    return `<span class="pai-kanji">${label(tile)}</span>`;
  }

  // 牌の色分け用CSSクラス
  function tileFaceClass(tile) {
    if (suitOf(tile) === "m") return "pai-m";
    if (suitOf(tile) === "p") return "pai-p";
    if (suitOf(tile) === "s") return "pai-s";
    if (tile === HATSU) return "pai-green";
    if (tile === CHUN) return "pai-red";
    if (tile === HAKU) return "pai-haku-face";
    return "pai-wind";
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function buildWall() {
    const wall = [];
    for (let t = 0; t < 34; t++) {
      for (let i = 0; i < 4; i++) wall.push(t);
    }
    return shuffle(wall);
  }

  // 表示牌からドラそのものを返す（数牌は9→1、風牌は北→東、三元牌は中→白で一周）
  function doraFromIndicator(indicator) {
    if (isSuited(indicator)) {
      const suitStart = indicator - (indicator % 9);
      const rank = rankOf(indicator);
      const nextRank = (rank % 9) + 1;
      return suitStart + (nextRank - 1);
    }
    if (isWindTile(indicator)) {
      return indicator === NORTH ? EAST : indicator + 1;
    }
    return indicator === CHUN ? HAKU : indicator + 1;
  }

  return {
    EAST, SOUTH, WEST, NORTH, HAKU, HATSU, CHUN,
    LABELS,
    isSuited, isHonor, suitOf, rankOf,
    isTerminal, isTerminalOrHonor, isWindTile, isDragonTile,
    label, shuffle, buildWall, doraFromIndicator,
    tileVisualHtml, tileFaceClass,
  };
})();
