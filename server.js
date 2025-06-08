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
let currentQuestion = 0;
let answered = new Set();
let gameStarted = false;

let roomCode = generateCode();

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("✅ 연결됨:", socket.id);

  // ✅ 관리자용 게임 코드 요청 처리
  socket.on("getCode", () => {
    socket.emit("code", roomCode);
  });


  socket.on("join", (nickname) => {
    if (gameStarted) {
      socket.emit("reject", "게임이 이미 시작되었습니다.");
      return;
    }

    players[socket.id] = { nickname, score: 0 };
    console.log(`👤 ${nickname} 입장`);
    io.emit("playerList", Object.values(players).map(p => p.nickname));
  });

  socket.on("start", () => {
    gameStarted = true;
    currentQuestion = 0;
    answered.clear();
    broadcastQuestion();
  });

 socket.on("answer", (answerText) => {
  const player = players[socket.id];
  if (!player || answered.has(socket.id)) return;

  const q = questions[currentQuestion];
  const correct = q.choices[q.answer] === answerText;

  if (correct) {
    player.score++;
  }

  answered.add(socket.id);
  socket.emit("result", correct);

  // ✅ 1명만 있어도 진행되도록 수정
  setTimeout(() => {
    if (currentQuestion + 1 < questions.length) {
      currentQuestion++;
      answered.clear();
      broadcastQuestion();
    } else {
      sendFinalResults();
    }
  }, 1500);
});


  socket.on("disconnect", () => {
    console.log("❌ 연결 해제:", socket.id);
    delete players[socket.id];
    io.emit("playerList", Object.values(players).map(p => p.nickname));
  });
});

function broadcastQuestion() {
  const q = questions[currentQuestion];
 console.log(`🧠 문제 ${currentQuestion + 1}: ${q.question}`);
  io.emit("question", {
    index: currentQuestion + 1,
    question: q.question,
    choices: q.choices,
  });
}

function sendFinalResults() {
  Object.entries(players).forEach(([id, player]) => {
    io.to(id).emit("finalResult", {
      score: player.score,
    });
  });

  // 🧪 관리자 용도: 전체 점수 콘솔 출력 (향후 admin 화면에서 사용)
  console.log("📊 최종 점수표:");
  for (const p of Object.values(players)) {
   console.log(`- ${p.nickname}: ${p.score}점`);
  }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
 console.log(`🚀 골든벨 서버 실행 중 (포트: ${PORT})`);
});


