const UNO = {};

UNO.Cards = (function () {
  const COLORS = ["red", "yellow", "green", "blue"];

  function makeCard(id, color, value) {
    return { id, color, value };
  }

  function buildDeck() {
    const deck = [];
    let id = 0;
    for (const color of COLORS) {
      deck.push(makeCard(id++, color, "0"));
      for (let n = 1; n <= 9; n++) {
        deck.push(makeCard(id++, color, String(n)));
        deck.push(makeCard(id++, color, String(n)));
      }
      for (let i = 0; i < 2; i++) {
        deck.push(makeCard(id++, color, "skip"));
        deck.push(makeCard(id++, color, "reverse"));
        deck.push(makeCard(id++, color, "draw2"));
      }
    }
    for (let i = 0; i < 4; i++) deck.push(makeCard(id++, "wild", "wild"));
    for (let i = 0; i < 4; i++) deck.push(makeCard(id++, "wild", "wild4"));
    return deck;
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  function isWild(card) {
    return card.color === "wild";
  }

  // activeColor: 場に対して現在有効な色（ワイルド宣言後の色も含む）
  function matchesTop(card, topCard, activeColor) {
    if (isWild(card)) return true;
    if (card.color === activeColor) return true;
    if (card.value === topCard.value) return true;
    return false;
  }

  // 本家UNO公式ルールの得点表（ラウンド終了時、勝者以外の残り手札を集計する用）
  function pointValue(card) {
    if (card.value === "wild" || card.value === "wild4") return 50;
    if (card.value === "skip" || card.value === "reverse" || card.value === "draw2") return 20;
    return Number(card.value);
  }

  function label(card) {
    if (card.value === "wild") return "ワイルド";
    if (card.value === "wild4") return "ワイルド+4";
    if (card.value === "skip") return "スキップ";
    if (card.value === "reverse") return "リバース";
    if (card.value === "draw2") return "ドロー2";
    return card.value;
  }

  return { COLORS, buildDeck, shuffle, isWild, matchesTop, pointValue, label };
})();
