const EMOJIS = ["🍎", "🍌", "🍇", "🍉", "🍓", "🍒", "🍍", "🥝", "🍑", "🍋", "🍈", "🥭", "🍐", "🥥", "🍅", "🌽", "🍆", "🥑"];

const DIFFICULTIES = {
  easy: { pairs: 8, columns: 4 },
  normal: { pairs: 12, columns: 4 },
  hard: { pairs: 18, columns: 6 },
};

const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart");
const difficultyEl = document.getElementById("difficulty");

let flippedCards = [];
let matchedCount = 0;
let totalPairs = 0;
let moves = 0;
let seconds = 0;
let timerId = null;
let isBusy = false;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function startTimer() {
  clearInterval(timerId);
  seconds = 0;
  timerEl.textContent = seconds;
  timerId = setInterval(() => {
    seconds++;
    timerEl.textContent = seconds;
  }, 1000);
}

function createBoard() {
  const { pairs, columns } = DIFFICULTIES[difficultyEl.value];
  const cards = shuffle([...EMOJIS.slice(0, pairs), ...EMOJIS.slice(0, pairs)]);

  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  flippedCards = [];
  matchedCount = 0;
  totalPairs = pairs;
  moves = 0;
  isBusy = false;
  movesEl.textContent = moves;
  messageEl.textContent = "";

  cards.forEach((emoji) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.emoji = emoji;
    card.addEventListener("click", () => onCardClick(card));
    boardEl.appendChild(card);
  });

  startTimer();
}

function onCardClick(card) {
  if (isBusy) return;
  if (card.classList.contains("flipped") || card.classList.contains("matched")) return;

  card.classList.add("flipped");
  card.textContent = card.dataset.emoji;
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    moves++;
    movesEl.textContent = moves;
    checkMatch();
  }
}

function checkMatch() {
  const [first, second] = flippedCards;

  if (first.dataset.emoji === second.dataset.emoji) {
    first.classList.add("matched");
    second.classList.add("matched");
    flippedCards = [];
    matchedCount++;

    if (matchedCount === totalPairs) {
      clearInterval(timerId);
      messageEl.textContent = `クリア！ ${moves}手・${seconds}秒でした`;
    }
    return;
  }

  isBusy = true;
  setTimeout(() => {
    first.classList.remove("flipped");
    second.classList.remove("flipped");
    first.textContent = "";
    second.textContent = "";
    flippedCards = [];
    isBusy = false;
  }, 800);
}

restartBtn.addEventListener("click", createBoard);
difficultyEl.addEventListener("change", createBoard);

createBoard();
