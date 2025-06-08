const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let questions = [];
try {
  const rawData = fs.readFileSync("data/goldenbell.json", "utf-8");
  questions = JSON.parse(rawData);
} catch (error) {
  console.error("문제 로딩 오류:", error);
}

let players = {};
let roomCode = generateCode();
let currentQuestion = 0;
let gameStarted = false;

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("✅ 연결됨:", socket.id);

  socket.on("getCode", () => {
    socket.emit("code", roomCode);
  });

  socket.on("join", ({ nickname, code }) => {
    if (code !== roomCode || gameStarted) {
      socket.emit("reject", "잘못된 코드이거나 게임이 이미 시작됨");
      return;
    }

    players[socket.id] = { nickname, score: 0, eliminated: false };
    console.log(`👤 ${nickname} 입장`);
    io.emit("playerList", Object.values(players).map((p) => p.nickname));
  });

  socket.on("start", () => {
    gameStarted = true;
    currentQuestion = 0;
    broadcastQuestion();
  });

  socket.on("answer", (answerText) => {
    const player = players[socket.id];
    if (!player || player.eliminated) return;

    const q = questions[currentQuestion];
    const correct = q.choices[q.answer] === answerText;

    if (!correct) {
      player.eliminated = true;
      socket.emit("eliminated");
    }

    socket.emit("result", correct);

    const alive = Object.values(players).filter((p) => !p.eliminated);
    if (alive.length === 1) {
      const winner = Object.keys(players).find((id) => !players[id].eliminated);
      io.emit("winner", players[winner].nickname);
    }
  });

  socket.on("next", () => {
    currentQuestion++;
    if (currentQuestion < questions.length) {
      broadcastQuestion();
    } else {
      io.emit("winner", "👑 전원 생존");
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ 연결 해제:", socket.id);
    delete players[socket.id];
    io.emit("playerList", Object.values(players).map((p) => p.nickname));
  });
});

function broadcastQuestion() {
  const q = questions[currentQuestion];
  io.emit("question", {
    index: currentQuestion + 1,
    question: q.question,
    choices: q.choices,
  });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 골든벨 서버 실행 중 (포트: ${PORT})`);
});


