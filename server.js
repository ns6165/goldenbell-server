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
let answered = new Set(); // ✅ 문제당 응답 추적용

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("✅ 연결됨:", socket.id);

  socket.on("getCode", () => {
    socket.emit("code", roomCode);
  });

  socket.on("join", (nickname) => {
    if (gameStarted) {
      socket.emit("reject", "게임이 이미 시작되었습니다.");
      return;
    }

    players[socket.id] = { nickname, score: 0, eliminated: false };
    console.log(`👤 ${nickname} 입장`);
    io.emit("playerList", Object.values(players).map((p) => p.nickname));
  });

  socket.on("start", () => {
    gameStarted = true;
    currentQuestion = 0;
    answered.clear();
    broadcastQuestion();
  });

  socket.on("answer", (answerText) => {
    const player = players[socket.id];
    if (!player || player.eliminated || answered.has(socket.id)) return;

    const q = questions[currentQuestion];
    const correct = q.choices[q.answer] === answerText;

    answered.add(socket.id);

    if (!correct) {
      player.eliminated = true;
      socket.emit("eliminated");
    }

    socket.emit("result", correct);
  });

  socket.on("next", () => {
    const totalAlive = Object.keys(players).filter((id) => !players[id].eliminated);
    const totalAnswered = Array.from(answered).filter(id => players[id] && !players[id].eliminated);

    if (totalAnswered.length < totalAlive.length) return; // 아직 응답 안 한 사람 있음

    const survivors = Object.entries(players).filter(([_, p]) => !p.eliminated);

    if (survivors.length === 1) {
      const winnerNickname = survivors[0][1].nickname;
      io.emit("winner", winnerNickname);
    } else if (currentQuestion + 1 < questions.length) {
      currentQuestion++;
      answered.clear();
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

