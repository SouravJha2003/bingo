const welcomeScreen = document.getElementById('welcome-screen');
const gameScreen = document.getElementById('game-screen');
const welcomeForm = document.getElementById('welcome-form');
const boardElement = document.getElementById('board');
const letters = [...document.querySelectorAll('#bingo-letters span')];
const announce = document.getElementById('announcement');

const lines = [
  ...Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => row * 5 + col)),
  ...Array.from({ length: 5 }, (_, col) => Array.from({ length: 5 }, (_, row) => row * 5 + col)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];

let playerName = '';
let phase = 'welcome';
let board = Array(25).fill(null);
let selected = new Set();
let clickSequence = [];
let completedLines = new Set();
let replayIndex = 0;
let replayPaused = false;
let replayTimer = null;

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function renderBoard() {
  const disabledCells = new Set([...completedLines].flatMap(index => lines[index]));
  boardElement.replaceChildren();

  board.forEach((number, index) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'board-cell';
    cell.textContent = number ?? '';
    cell.setAttribute('aria-label', phase === 'setup'
      ? `Row ${Math.floor(index / 5) + 1}, column ${index % 5 + 1}${number ? `, number ${number}` : ', empty'}`
      : `Number ${number}${selected.has(number) ? ', selected' : ''}${disabledCells.has(index) ? ', completed line' : ''}`);
    if (number !== null && phase === 'setup') cell.classList.add('filled');
    if (selected.has(number) && phase !== 'setup') cell.classList.add('selected');
    if (disabledCells.has(index)) cell.classList.add('completed');
    cell.disabled = phase === 'won' || phase === 'replay' || (phase === 'play' && selected.has(number)) || (phase === 'setup' && number !== null);
    cell.addEventListener('click', () => handleCellClick(index));
    boardElement.append(cell);
  });
}

function renderTracker() {
  const tracker = document.getElementById('number-tracker');
  tracker.replaceChildren();
  const numbers = phase === 'setup' ? board.filter(number => number !== null) : phase === 'replay' ? clickSequence.slice(0, replayIndex) : clickSequence;
  if (!numbers.length) {
    const empty = document.createElement('span');
    empty.className = 'tracker-empty';
    empty.textContent = phase === 'setup' ? 'Your numbers will appear here.' : 'Your picks will appear here.';
    tracker.append(empty);
  } else {
    numbers.forEach(number => {
      const chip = document.createElement('span');
      chip.className = `number-chip${phase === 'setup' ? '' : ' played'}`;
      chip.textContent = String(number).padStart(2, '0');
      tracker.append(chip);
    });
  }
  setText('tracker-count', `${String(numbers.length).padStart(2, '0')} / 25`);
}

function render() {
  const isSetup = phase === 'setup';
  const isWon = phase === 'won';
  const isReplay = phase === 'replay';
  const numberPlaced = board.filter(number => number !== null).length;
  const lineCount = completedLines.size;

  setText('phase-label', isSetup ? ' SET YOUR BOARD' : isReplay ? ' REPLAY' : isWon ? ' GAME COMPLETE' : ' LET’S PLAY');
  setText('screen-title', isSetup ? 'Make it yours.' : isReplay ? 'Your winning run.' : isWon ? 'Bingo! You won.' : 'Find your five.');
  setText('phase-description', isSetup ? 'Tap each square to place numbers 1 through 25.' : isWon ? `${playerName}, you completed five lines!` : 'Tap numbers to complete five rows, columns, or diagonals.');
  document.getElementById('phase-description').classList.toggle('hidden', !isSetup);
  setText('count-value', isSetup ? numberPlaced : Math.min(lineCount, 5));
  setText('count-total', isSetup ? '/ 25' : '/ 5 lines');
  setText('board-hint', isSetup ? 'YOUR BOARD' : isReplay ? replayPaused ? 'REPLAY PAUSED' : 'REPLAYING' : 'TAP A NUMBER');
  document.getElementById('board-hint').classList.toggle('hidden', isSetup || isWon);
  document.getElementById('clear-button').classList.toggle('hidden', !isSetup);
  document.getElementById('bingo-letters').classList.toggle('hidden', isWon);
  setText('panel-step', isSetup ? 'THE SETUP' : isWon ? 'THE WIN' : 'THE GAME');
  document.getElementById('panel-title').innerHTML = isSetup ? 'Your board,<br />your rules.' : isWon ? 'A beautiful<br />BINGO.' : 'Every mark<br />counts.';
  setText('panel-description', isSetup ? 'Choose where every number goes. Once all 25 squares are filled, you’re ready to play.' : isWon ? 'Five complete lines. Well played. Ready to build another board?' : 'Complete any row, column, or diagonal. Each line lights up one letter.');
  setText('tracker-label', isSetup ? 'NUMBERS PLACED' : 'PICKS IN ORDER');
  setText('panel-bottom-text', isSetup ? 'ONE SQUARE AT A TIME' : isWon ? 'YOU MADE YOUR MARK' : 'FIVE LINES TO WIN');
  document.getElementById('side-panel').classList.toggle('tracker-only', !isSetup);
  document.getElementById('win-overlay').classList.toggle('hidden', !isWon);
  document.getElementById('setup-actions').classList.toggle('hidden', !isSetup);
  document.getElementById('play-actions').classList.toggle('hidden', isSetup);
  document.getElementById('play-actions').classList.toggle('win-actions', isWon || isReplay);
  document.getElementById('play-tip').classList.toggle('hidden', isWon || isReplay);
  document.getElementById('replay-button').classList.toggle('hidden', !isWon);
  document.getElementById('pause-replay-button').classList.toggle('hidden', !isReplay);
  setText('pause-replay-button', replayPaused ? 'Resume' : 'Pause');
  document.getElementById('restart-button').classList.toggle('hidden', !isWon && !isReplay);
  document.getElementById('start-button').disabled = numberPlaced !== 25;
  letters.forEach((letter, index) => letter.classList.toggle('active', !isSetup && index < lineCount));
  renderBoard();
  renderTracker();
}

function clearReplayTimer() {
  if (replayTimer !== null) clearTimeout(replayTimer);
  replayTimer = null;
}

function scheduleReplayStep() {
  clearReplayTimer();
  if (phase === 'replay' && !replayPaused) replayTimer = setTimeout(replayStep, 650);
}

function replayStep() {
  replayTimer = null;
  if (phase !== 'replay' || replayPaused) return;
  if (replayIndex >= clickSequence.length) {
    phase = 'won';
    render();
    announce.textContent = 'Replay complete. Bingo!';
    return;
  }
  const number = clickSequence[replayIndex++];
  selected.add(number);
  lines.forEach((line, lineIndex) => {
    if (line.every(cellIndex => selected.has(board[cellIndex]))) completedLines.add(lineIndex);
  });
  render();
  announce.textContent = `Replay: number ${number}. ${completedLines.size} ${completedLines.size === 1 ? 'line' : 'lines'} complete.`;
  scheduleReplayStep();
}

function handleCellClick(index) {
  if (phase === 'setup') {
    if (board[index] !== null) return;
    board[index] = board.filter(number => number !== null).length + 1;
    render();
    if (board.every(number => number !== null)) announce.textContent = 'Board complete. Start game is now available.';
    return;
  }
  if (phase !== 'play') return;
  const number = board[index];
  if (selected.has(number)) return;
  selected.add(number);
  clickSequence.push(number);
  const before = completedLines.size;
  lines.forEach((line, lineIndex) => {
    if (line.every(cellIndex => selected.has(board[cellIndex]))) completedLines.add(lineIndex);
  });
  if (completedLines.size >= 5) phase = 'won';
  render();
  announce.textContent = phase === 'won'
    ? `Bingo! ${playerName} completed five lines and won.`
    : completedLines.size > before
      ? `Number ${number} selected. ${completedLines.size} ${completedLines.size === 1 ? 'line' : 'lines'} complete.`
      : `Number ${number} selected.`;
}

welcomeForm.addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('player-name');
  if (!input.reportValidity()) return;
  playerName = input.value.trim();
  if (!playerName) {
    input.setCustomValidity('Please enter your name.');
    input.reportValidity();
    return;
  }
  input.setCustomValidity('');
  setText('player-display', playerName);
  phase = 'setup';
  welcomeScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  render();
  document.getElementById('screen-title').focus?.();
});

document.getElementById('player-name').addEventListener('input', event => event.target.setCustomValidity(''));
document.getElementById('clear-button').addEventListener('click', () => {
  board = Array(25).fill(null);
  render();
  announce.textContent = 'Board cleared.';
});
document.getElementById('quick-fill-button').addEventListener('click', () => {
  if (phase !== 'setup') return;
  board = Array.from({ length: 25 }, (_, index) => index + 1);
  for (let index = board.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [board[index], board[randomIndex]] = [board[randomIndex], board[index]];
  }
  render();
  announce.textContent = 'Board filled with random numbers. Start game is now available.';
});
document.getElementById('start-button').addEventListener('click', () => {
  if (board.some(number => number === null)) return;
  phase = 'play';
  selected = new Set();
  clickSequence = [];
  completedLines = new Set();
  render();
  announce.textContent = 'Game started. Select a number.';
});
document.getElementById('replay-button').addEventListener('click', () => {
  if (phase !== 'won') return;
  clearReplayTimer();
  phase = 'replay';
  replayIndex = 0;
  replayPaused = false;
  selected = new Set();
  completedLines = new Set();
  render();
  announce.textContent = 'Replay started.';
  scheduleReplayStep();
});
document.getElementById('pause-replay-button').addEventListener('click', () => {
  if (phase !== 'replay') return;
  replayPaused = !replayPaused;
  if (replayPaused) clearReplayTimer();
  else scheduleReplayStep();
  render();
  announce.textContent = replayPaused ? 'Replay paused.' : 'Replay resumed.';
});
document.getElementById('restart-button').addEventListener('click', () => {
  clearReplayTimer();
  phase = 'welcome';
  playerName = '';
  board = Array(25).fill(null);
  selected = new Set();
  clickSequence = [];
  completedLines = new Set();
  replayIndex = 0;
  replayPaused = false;
  welcomeForm.reset();
  gameScreen.classList.add('hidden');
  welcomeScreen.classList.remove('hidden');
  document.getElementById('player-name').focus();
  announce.textContent = 'New game. Enter your name to begin.';
});
