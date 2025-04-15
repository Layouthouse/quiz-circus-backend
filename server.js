
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let players = {};
let phase = "join";
let allQuestions = [];
let currentQuiz = [];

io.on("connection", (socket) => {
  socket.on("join", (name) => {
    players[socket.id] = { name, score: 0, questions: [] };
    io.emit("players", Object.values(players).map((p) => p.name));
  });

  socket.on("submitQuestion", (question) => {
    if (players[socket.id]) {
      players[socket.id].questions.push(question);
    }
  });

  socket.on("startQuiz", () => {
    if (phase === "join" || phase === "questionInput") {
      allQuestions = Object.values(players).flatMap((p) => p.questions);
      currentQuiz = shuffle(allQuestions).slice(0, 10);
      io.emit("startQuiz", currentQuiz);
      phase = "quiz";
    }
  });

  socket.on("answer", ({ questionIndex, correct }) => {
    if (correct && players[socket.id]) {
      players[socket.id].score++;
    }
  });

  socket.on("endQuiz", () => {
    const results = Object.values(players)
      .map((p) => ({ name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
    io.emit("scoreboard", results);
    phase = "scoreboard";
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", Object.values(players).map((p) => p.name));
  });
});

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`✅ Server draait op poort ${PORT}`));
