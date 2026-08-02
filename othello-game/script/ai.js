OTH.AI = (function () {
  const B = OTH.Board;

  // 角=高評価、角に隣接するX/C升は事前に減点（角を取られるリスクがあるため）。
  // その角が既に確定していればリスクは消えるので、evaluateBoard側で補正する。
  const WEIGHTS = [
    120, -20, 20, 5, 5, 20, -20, 120,
    -20, -40, -5, -5, -5, -5, -40, -20,
    20, -5, 15, 3, 3, 15, -5, 20,
    5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5,
    20, -5, 15, 3, 3, 15, -5, 20,
    -20, -40, -5, -5, -5, -5, -40, -20,
    120, -20, 20, 5, 5, 20, -20, 120,
  ];

  const CORNERS = [0, 7, 56, 63];
  const CORNER_ADJACENT = {
    0: [9, 1, 8],
    7: [14, 6, 15],
    56: [49, 57, 48],
    63: [54, 62, 55],
  };

  function positionalScore(board, color) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
      if (board[i] === B.EMPTY) continue;
      let w = WEIGHTS[i];
      for (const corner of CORNERS) {
        if (CORNER_ADJACENT[corner].includes(i) && board[corner] !== B.EMPTY) {
          w = 5;
          break;
        }
      }
      score += board[i] === color ? w : -w;
    }
    return score;
  }

  // mobilityの重み(8)は後で対戦を見ながら微調整する前提のマジックナンバー
  const MOBILITY_WEIGHT = 8;

  function evaluateBoard(board, color) {
    const opp = B.opponent(color);
    const mobility = B.legalMoves(board, color).length - B.legalMoves(board, opp).length;
    return positionalScore(board, color) + mobility * MOBILITY_WEIGHT;
  }

  // 弱い: 合法手からflips数に軽く重み付けした確率的選択（ほぼランダム）
  function chooseEasyMove(board, color) {
    const moves = B.legalMoves(board, color);
    const weighted = moves.map((m) => ({ move: m, w: 1 + m.flips.length }));
    const total = weighted.reduce((sum, x) => sum + x.w, 0);
    let r = Math.random() * total;
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) return x.move;
    }
    return weighted[weighted.length - 1].move;
  }

  // 普通: 1手先読みのみ。適用後の評価値が最大の手を選ぶ
  function chooseNormalMove(board, color) {
    const moves = B.legalMoves(board, color);
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      const b2 = B.cloneBoard(board);
      B.applyMove(b2, color, m.row, m.col);
      const score = evaluateBoard(b2, color);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  // 強い: negamax + alpha-beta。中盤はdepth固定、終盤（空きマスが少ない）は完全読みに切り替える。
  const HARD_DEPTH = 4;
  const ENDGAME_EMPTY_THRESHOLD = 10;

  function orderMoves(board, moves) {
    return moves.slice().sort((a, b) => WEIGHTS[b.row * 8 + b.col] - WEIGHTS[a.row * 8 + a.col]);
  }

  function terminalScore(board, perspective) {
    const { black, white } = B.countDiscs(board);
    const diff = perspective === B.BLACK ? black - white : white - black;
    return diff * 1000;
  }

  // negamax形式。moves.length===0（手番側がパス）はdepthを消費せず、相手側に手番を渡すだけの分岐。
  // 双方パス（=oppMovesも0）の時だけ本当の終局としてterminalScoreを返す。
  function minimax(board, toMove, depth, alpha, beta, perspective) {
    const moves = B.legalMoves(board, toMove);
    if (moves.length === 0) {
      const oppMoves = B.legalMoves(board, B.opponent(toMove));
      if (oppMoves.length === 0) return terminalScore(board, perspective);
      return -minimax(board, B.opponent(toMove), depth, -beta, -alpha, perspective);
    }
    if (depth <= 0) {
      return evaluateBoard(board, perspective) * (toMove === perspective ? 1 : -1);
    }

    let value = -Infinity;
    for (const m of orderMoves(board, moves)) {
      const b2 = B.cloneBoard(board);
      B.applyMove(b2, toMove, m.row, m.col);
      const score = -minimax(b2, B.opponent(toMove), depth - 1, -beta, -alpha, perspective);
      value = Math.max(value, score);
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  function chooseHardMove(board, color) {
    const emptyCount = board.filter((c) => c === B.EMPTY).length;
    const depth = emptyCount <= ENDGAME_EMPTY_THRESHOLD ? emptyCount : HARD_DEPTH;
    const moves = orderMoves(board, B.legalMoves(board, color));
    let best = moves[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;
    for (const m of moves) {
      const b2 = B.cloneBoard(board);
      B.applyMove(b2, color, m.row, m.col);
      const score = -minimax(b2, B.opponent(color), depth - 1, -beta, -alpha, color);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
      alpha = Math.max(alpha, score);
    }
    return best;
  }

  function chooseMove(board, color, difficulty) {
    if (difficulty === "easy") return chooseEasyMove(board, color);
    if (difficulty === "hard") return chooseHardMove(board, color);
    return chooseNormalMove(board, color);
  }

  return {
    evaluateBoard,
    positionalScore,
    chooseEasyMove,
    chooseNormalMove,
    chooseHardMove,
    chooseMove,
  };
})();
