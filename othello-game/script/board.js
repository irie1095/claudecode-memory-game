const OTH = {};

OTH.Board = (function () {
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  function createInitialBoard() {
    const b = new Array(64).fill(EMPTY);
    b[3 * 8 + 3] = WHITE;
    b[3 * 8 + 4] = BLACK;
    b[4 * 8 + 3] = BLACK;
    b[4 * 8 + 4] = WHITE;
    return b;
  }

  function opponent(color) {
    return color === BLACK ? WHITE : BLACK;
  }

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  // (r,c)にcolorを置いたときにひっくり返る石のindex一覧（置けないなら空配列）
  function flipsForMove(board, color, r, c) {
    if (board[r * 8 + c] !== EMPTY) return [];
    const opp = opponent(color);
    const flips = [];

    for (const [dr, dc] of DIRECTIONS) {
      const run = [];
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc) && board[nr * 8 + nc] === opp) {
        run.push(nr * 8 + nc);
        nr += dr;
        nc += dc;
      }
      if (run.length > 0 && inBounds(nr, nc) && board[nr * 8 + nc] === color) {
        flips.push(...run);
      }
    }

    return flips;
  }

  function legalMoves(board, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r * 8 + c] !== EMPTY) continue;
        const flips = flipsForMove(board, color, r, c);
        if (flips.length > 0) moves.push({ row: r, col: c, flips });
      }
    }
    return moves;
  }

  function hasAnyLegalMove(board, color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r * 8 + c] !== EMPTY) continue;
        if (flipsForMove(board, color, r, c).length > 0) return true;
      }
    }
    return false;
  }

  function applyMove(board, color, row, col) {
    const flips = flipsForMove(board, color, row, col);
    board[row * 8 + col] = color;
    for (const idx of flips) board[idx] = color;
    return flips;
  }

  function cloneBoard(board) {
    return board.slice();
  }

  function countDiscs(board) {
    let black = 0;
    let white = 0;
    for (const cell of board) {
      if (cell === BLACK) black++;
      else if (cell === WHITE) white++;
    }
    return { black, white };
  }

  return {
    EMPTY,
    BLACK,
    WHITE,
    createInitialBoard,
    opponent,
    inBounds,
    flipsForMove,
    legalMoves,
    hasAnyLegalMove,
    applyMove,
    cloneBoard,
    countDiscs,
  };
})();
