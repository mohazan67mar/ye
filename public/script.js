const socket = io();

// ── State ──────────────────────────────────────────────────────────────
let mySymbol = null;
let currentTurn = null;
let roomCode = null;
let currentBoard = Array(9).fill(null);
let wasLosingLastTurn = false;

// ── Audio Engine ────────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playClick() {
  const ctx = getAudio();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'sine';
  o.frequency.setValueAtTime(520, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.25, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  o.start(); o.stop(ctx.currentTime + 0.1);
}

function playOpponentMove() {
  const ctx = getAudio();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'sine';
  o.frequency.setValueAtTime(320, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  o.start(); o.stop(ctx.currentTime + 0.1);
}

function playWin() {
  const ctx = getAudio();
  [523, 659, 784, 1047].forEach((freq, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
    g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
    o.start(ctx.currentTime + i * 0.12);
    o.stop(ctx.currentTime + i * 0.12 + 0.25);
  });
}

function playLose() {
  const ctx = getAudio();
  [400, 320, 240].forEach((freq, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
    g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.2);
    o.start(ctx.currentTime + i * 0.15);
    o.stop(ctx.currentTime + i * 0.15 + 0.2);
  });
}

function playDraw() {
  const ctx = getAudio();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'sine';
  o.frequency.setValueAtTime(440, ctx.currentTime);
  g.gain.setValueAtTime(0.2, ctx.currentTime);
  g.gain.setValueAtTime(0.0, ctx.currentTime + 0.1);
  g.gain.setValueAtTime(0.2, ctx.currentTime + 0.18);
  g.gain.setValueAtTime(0.0, ctx.currentTime + 0.28);
  g.gain.setValueAtTime(0.2, ctx.currentTime + 0.36);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  o.start(); o.stop(ctx.currentTime + 0.5);
}

function playTrashTalk() {
  const ctx = getAudio();
  [0, 0.12].forEach(t => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'square';
    o.frequency.setValueAtTime(160, ctx.currentTime + t);
    g.gain.setValueAtTime(0.15, ctx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.1);
    o.start(ctx.currentTime + t);
    o.stop(ctx.currentTime + t + 0.1);
  });
}

// ── Jersey HTML builders ────────────────────────────────────────────────
function curryJerseyHTML(extraClass = '') {
  return `<div class="bj-shirt curry-shirt ${extraClass}">
    <div class="bj-collar"></div>
    <div class="bj-num">30</div>
    <div class="bj-name">CURRY</div>
  </div>`;
}

function ronaldoJerseyHTML(extraClass = '') {
  return `<div class="bj-shirt ronaldo-shirt ${extraClass}">
    <div class="bj-collar"></div>
    <div class="bj-num">7</div>
    <div class="bj-name">RONALDO</div>
  </div>`;
}

// ── Screen Helper ───────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── DOM References ──────────────────────────────────────────────────────
const createBtn     = document.getElementById('createBtn');
const joinBtn       = document.getElementById('joinBtn');
const joinInput     = document.getElementById('joinInput');
const menuError     = document.getElementById('menuError');
const roomCodeDisp  = document.getElementById('roomCodeDisplay');
const mySymbolEl    = document.getElementById('mySymbol');
const myJerseyTag   = document.getElementById('myJerseyTag');
const statusMsg     = document.getElementById('statusMsg');
const gameRoomCode  = document.getElementById('gameRoomCode');
const cells         = document.querySelectorAll('.cell');
const playAgainBtn  = document.getElementById('playAgainBtn');
const resultText    = document.getElementById('resultText');
const resultIcon    = document.getElementById('resultIcon');
const winnerDisplay = document.getElementById('winnerDisplay');

// ── Button Events ───────────────────────────────────────────────────────
createBtn.addEventListener('click', () => {
  menuError.textContent = '';
  socket.emit('createRoom');
});

joinBtn.addEventListener('click', () => {
  const code = joinInput.value.trim().toUpperCase();
  if (!code) { menuError.textContent = 'Please enter a room code.'; return; }
  menuError.textContent = '';
  socket.emit('joinRoom', { code });
});

joinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

playAgainBtn.addEventListener('click', () => {
  showScreen('menu');
  joinInput.value = '';
  menuError.textContent = '';
  resetBoard();
});

// ── Cell Click ──────────────────────────────────────────────────────────
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = parseInt(cell.dataset.index);
    if (currentTurn !== mySymbol) return;
    if (cell.classList.contains('taken')) return;
    playClick();
    socket.emit('makeMove', { code: roomCode, index });
  });
});

// ── Socket Events ───────────────────────────────────────────────────────
socket.on('roomCreated', ({ code }) => {
  roomCode = code;
  roomCodeDisp.textContent = code;
  showScreen('waiting');
});

socket.on('startGame', ({ symbol, turn, code }) => {
  mySymbol = symbol;
  currentTurn = turn;
  roomCode = code;
  currentBoard = Array(9).fill(null);
  wasLosingLastTurn = false;

  mySymbolEl.textContent = symbol;
  mySymbolEl.style.color = symbol === 'X' ? '#ffc72c' : '#1a1a1a';

  // Badge tag showing which player they are
  if (symbol === 'X') {
    myJerseyTag.textContent = '#30 CURRY';
    myJerseyTag.style.background = '#1d428a';
    myJerseyTag.style.color = '#ffc72c';
    myJerseyTag.style.border = '1px solid #ffc72c';
  } else {
    myJerseyTag.textContent = '#7 RONALDO';
    myJerseyTag.style.background = '#f0f0f0';
    myJerseyTag.style.color = '#1a1a1a';
    myJerseyTag.style.border = '1px solid #d4af37';
  }

  gameRoomCode.textContent = roomCode;
  updateStatus();
  resetBoard();
  showScreen('game');
});

socket.on('boardUpdate', ({ board, turn }) => {
  if (currentTurn !== mySymbol) playOpponentMove();
  currentTurn = turn;
  currentBoard = board;
  renderBoard(board);
  updateStatus();
});

socket.on('gameOver', ({ result, winner }) => {
  winnerDisplay.innerHTML = '';

  if (result === 'draw') {
    playDraw();
    resultIcon.textContent = '🤝';
    resultText.textContent = "It's a Draw!";
    // Show both jerseys side by side
    winnerDisplay.innerHTML = `
      <div style="display:flex;gap:14px;align-items:center;justify-content:center;">
        ${curryJerseyHTML('result-jersey')}
        <span style="color:var(--muted);font-weight:800;">VS</span>
        ${ronaldoJerseyHTML('result-jersey')}
      </div>
      <p class="winner-name-label">Nobody wins today</p>
    `;
  } else if (winner === 'X') {
    winner === mySymbol ? playWin() : playLose();
    resultIcon.textContent = winner === mySymbol ? '🏆' : '😞';
    resultText.textContent = winner === mySymbol ? 'Lets goooo brevvv!' : 'Night Night bihh!';
    winnerDisplay.innerHTML = `
      ${curryJerseyHTML('result-jersey')}
      <p class="winner-name-label">Steph Curry #30 🏀</p>
    `;
  } else {
    winner === mySymbol ? playWin() : playLose();
    resultIcon.textContent = winner === mySymbol ? '🏆' : '😞';
    resultText.textContent = winner === mySymbol ? 'lets goo brev' : 'Siuuuuu bihh';
    winnerDisplay.innerHTML = `
      ${ronaldoJerseyHTML('result-jersey')}
      <p class="winner-name-label">Cristiano Ronaldo #7 ⚽</p>
    `;
  }

  setTimeout(() => showScreen('result'), 700);
});

socket.on('playerLeft', ({ message }) => {
  resultIcon.textContent = '👋';
  resultText.textContent = message;
  winnerDisplay.innerHTML = '';
  showScreen('result');
});

socket.on('error', ({ message }) => {
  menuError.textContent = message;
  showScreen('menu');
});

// ── Losing Detection ────────────────────────────────────────────────────
function isAboutToLose(board, symbol) {
  const opponent = symbol === 'X' ? 'O' : 'X';
  const combos = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  return combos.some(([a, b, c]) => {
    const line = [board[a], board[b], board[c]];
    return line.filter(v => v === opponent).length === 2 && line.includes(null);
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────
function renderBoard(board) {
  cells.forEach((cell, i) => {
    const prev = cell.className;
    const val = board[i];
    cell.className = 'cell';
    cell.textContent = '';
    if (val) {
      cell.classList.add('taken', val.toLowerCase());
      if (!prev.includes(val.toLowerCase())) cell.classList.add('pop');
    }
  });
}

function resetBoard() {
  currentBoard = Array(9).fill(null);
  wasLosingLastTurn = false;
  cells.forEach(cell => {
    cell.textContent = '';
    cell.className = 'cell';
  });
}

function updateStatus() {
  if (!currentTurn) return;
  if (currentTurn === mySymbol) {
    const losing = isAboutToLose(currentBoard, mySymbol);
    if (losing && !wasLosingLastTurn) playTrashTalk();
    wasLosingLastTurn = losing;
    statusMsg.textContent = losing
      ? "Your turn 💀 lock dude u ain't shihh"
      : 'Your turn';
    statusMsg.style.color = mySymbol === 'X' ? '#ffc72c' : '#d4af37';
  } else {
    wasLosingLastTurn = false;
    statusMsg.textContent = "Opponent's turn...";
    statusMsg.style.color = 'var(--muted)';
  }
}