// server.js (절대 Electron 코드 포함 X)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

let quizData = JSON.parse(fs.readFileSync('data/goldenbell.json', 'utf-8'));
let currentQuestionIndex = 0;
let players = {};

io.on('connection', (socket) => {
  console.log(`✅ 유저 접속: ${socket.id}`);
  socket.on('join', (nickname) => {
    players[socket.id] = { nickname, alive: true };
  });

  socket.on('answer', (answer) => {
    const q = quizData[currentQuestionIndex];
    if (!q) return;

    if (answer.trim() === q.answer.trim()) {
      // 생존
    } else {
      players[socket.id].alive = false;
      socket.emit('eliminated');
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
  });
});

function startQuizLoop() {
  const interval = setInterval(() => {
    if (currentQuestionIndex >= quizData.length) {
      clearInterval(interval);
      broadcastWinner();
      return;
    }

    const question = quizData[currentQuestionIndex];
    io.emit('question', {
      index: currentQuestionIndex + 1,
      question: question.question,
      time: 10
    });

    setTimeout(() => {
      currentQuestionIndex++;
    }, 10000);
  }, 12000);
}

function broadcastWinner() {
  const survivors = Object.values(players).filter(p => p.alive);
  if (survivors.length === 1) {
    io.emit('winner', survivors[0].nickname);
  } else if (survivors.length > 1) {
    io.emit('multiple-winners', survivors.map(p => p.nickname));
  } else {
    io.emit('no-winner');
  }
}

server.listen(PORT, () => {
  console.log(`🚀 서버 실행됨 on PORT ${PORT}`);
  startQuizLoop();
});
