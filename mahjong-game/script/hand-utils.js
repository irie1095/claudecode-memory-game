MJ.HandUtils = (function () {
  function toCounts(tiles) {
    const counts = new Array(34).fill(0);
    for (const t of tiles) counts[t]++;
    return counts;
  }

  function fromCounts(counts) {
    const tiles = [];
    for (let t = 0; t < 34; t++) {
      for (let i = 0; i < counts[t]; i++) tiles.push(t);
    }
    return tiles;
  }

  function cloneCounts(counts) {
    return counts.slice();
  }

  function addTile(tiles, tile) {
    tiles.push(tile);
    return tiles;
  }

  function removeTile(tiles, tile) {
    const idx = tiles.indexOf(tile);
    if (idx === -1) return false;
    tiles.splice(idx, 1);
    return true;
  }

  function sortTiles(tiles) {
    return tiles.slice().sort((a, b) => a - b);
  }

  function totalCount(counts) {
    return counts.reduce((a, b) => a + b, 0);
  }

  return { toCounts, fromCounts, cloneCounts, addTile, removeTile, sortTiles, totalCount };
})();
