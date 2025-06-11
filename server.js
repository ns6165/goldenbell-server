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

  socket.on("getCode", () => {
    socket.emit("code", roomCode);
  });

  socket.on("verifyCode", (code) => {
    const isValid = code === roomCode;
    socket.emit("codeVerified", isValid);
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

    socket.on("getPlayerList", () => {
    socket.emit("playerList", Object.values(players).map(p => p.nickname));
  });

socket.on("start", () => {
  if (gameStarted) return;
  gameStarted = true;
  currentQuestion = 0;
  answered.clear();

  io.emit("startGame");  // ✅ 클라이언트에 카운트다운 시작

  // ✅ 4초 후 문제 출제 (카운트다운 완료 후)
  setTimeout(() => {
    broadcastQuestion();
  }, 4000);
});

socket.on("answer", ({ answerText, scoreDelta }) => {
  const player = players[socket.id];
  if (!player || answered.has(socket.id)) return;

  const q = questions[currentQuestion];
  const correct = q.choices[q.answer] === answerText;

  if (correct) {
    player.score += scoreDelta || 1;  // scoreDelta가 없으면 기본 1점
  }

  answered.add(socket.id);
  socket.emit("result", correct);

  // ✅ 관리자에게 실시간 점수 전송
  io.emit("playerUpdate", Object.entries(players).map(([id, p]) => ({
    nickname: p.nickname,
    score: p.score
  })));

  // 다음 문제로 진행
  setTimeout(() => {
    if (currentQuestion + 1 < questions.length) {
      currentQuestion++;
      answered.clear();
      broadcastQuestion();
    } else {
      sendFinalResults();
    }
  }, 1000);
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
  const sortedResults = Object.values(players)
    .sort((a, b) => b.score - a.score)  // 점수 기준 내림차순 정렬
    .map((player, index) => ({
      rank: index + 1,
      nickname: player.nickname,
      score: player.score
    }));

  io.emit("finalResult", sortedResults);  // 정렬된 배열 전송

  console.log("📊 최종 점수표:");
  sortedResults.forEach(p => {
    console.log(`- ${p.rank}등 ${p.nickname}: ${p.score}점`);
  });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
 console.log(`🚀 골든벨 서버 실행 중 (포트: ${PORT})`);
});



