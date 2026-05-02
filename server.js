const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Store all active rooms
const rooms = {};

// Generate a random 5-character room code
function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Check for winner
function checkWinner(board) {
  const combos = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]              // diagonals
  ];
  for (const [a, b, c] of combos) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // returns "X" or "O"
    }
  }
  if (board.every(cell => cell !== null)) return 'draw';
  return null;
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Player 1 creates a room
  socket.on('createRoom', () => {
    const code = generateCode();
    rooms[code] = {
      players: { X: socket.id, O: null },
      board: Array(9).fill(null),
      currentTurn: 'X'
    };
    socket.join(code);
    socket.emit('roomCreated', { code });
    console.log(`Room created: ${code}`);
  });

  // Player 2 joins a room
  socket.on('joinRoom', ({ code }) => {
    const room = rooms[code];

    if (!room) {
      socket.emit('error', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    if (room.players.O !== null) {
      socket.emit('error', { message: 'Room is full. Game already started.' });
      return;
    }

    room.players.O = socket.id;
    socket.join(code);

    // Tell both players the game is starting — include code so both clients know their room
    io.to(room.players.X).emit('startGame', { symbol: 'X', turn: 'X', code });
    io.to(room.players.O).emit('startGame', { symbol: 'O', turn: 'X', code });

    console.log(`Room ${code} game started.`);
  });

  // A player makes a move
  socket.on('makeMove', ({ code, index }) => {
    const room = rooms[code];

    if (!room) return;

    const { players, board, currentTurn } = room;

    // Validate: Is it this player's turn?
    if (players[currentTurn] !== socket.id) {
      socket.emit('error', { message: "It's not your turn." });
      return;
    }

    // Validate: Is the cell empty?
    if (board[index] !== null) {
      socket.emit('error', { message: 'Cell is already taken.' });
      return;
    }

    // Apply the move
    board[index] = currentTurn;

    // Check result
    const result = checkWinner(board);

    if (result) {
      // Send final board state
      io.to(code).emit('boardUpdate', { board, turn: null });

      if (result === 'draw') {
        io.to(code).emit('gameOver', { result: 'draw', winner: null });
      } else {
        io.to(code).emit('gameOver', { result: 'win', winner: result });
      }

      // Clean up room
      delete rooms[code];
    } else {
      // Switch turn
      room.currentTurn = currentTurn === 'X' ? 'O' : 'X';
      io.to(code).emit('boardUpdate', { board, turn: room.currentTurn });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);

    // Find if this player was in a room and notify opponent
    for (const code in rooms) {
      const room = rooms[code];
      if (room.players.X === socket.id || room.players.O === socket.id) {
        io.to(code).emit('playerLeft', { message: 'Your opponent disconnected. Game over.' });
        delete rooms[code];
        break;
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});