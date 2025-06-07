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
    methods: ["GET", "POST"]
  }
});

// ✅ 문제 데이터 로드
let questions = [];
try {
  const rawData = fs.readFileSync("data/goldenbell.json", "utf-8");
  questions = JSON.parse(rawData);
} catch (error) {
  console.error("문제 파일 로딩 오류:", error);
}

let players = {};
let currentQuestion = 0;

io.on("connection", (socket) => {
  console.log("✅ 연결됨:", socket.id);

  socket.on("join", (nickname) => {
    players[socket.id] = { nickname, score: 0, eliminated: false };
    console.log(`👤 ${nickname} 입장`);
  });

  socket.on("start", () => {
    currentQuestion = 0;
    broadcastQuestion();
  });

  socket.on("answer", (answerText) => {
    const player = players[socket.id];
    if (!player || player.eliminated) return;

    const q = questions[currentQuestion];
    const correct = q.choices[q.answer] === answerText;

    // ✅ 먼저 결과를 보냄 (정답/오답 여부)
    socket.emit("result", correct);

    if (!correct) {
      // ✅ 오답이라도 바로 탈락시키지 않고 1.5초 후에 탈락 처리
      setTimeout(() => {
        player.eliminated = true;
        socket.emit("eliminated");
      }, 1500);
    }

    // ✅ 생존자 수 체크
    const activePlayers = Object.values(players).filter((p) => !p.eliminated);
    if (activePlayers.length === 1) {
      const winnerId = Object.keys(players).find(
        (id) => players[id].eliminated === false
      );
      io.emit("winner", players[winnerId].nickname);
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
  });
});

function broadcastQuestion() {
  const q = questions[currentQuestion];
  io.emit("question", {
    index: currentQuestion + 1,
    question: q.question,
    choices: q.choices
  });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 서버 실행됨 on PORT ${PORT}`);
});


