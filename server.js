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

const rooms = {};

io.on("connection", (socket) => {
  let currentRoom = "";

  socket.on("join", ({ name, room }) => {
    currentRoom = room;
    socket.join(room);
    if (!rooms[room]) {
      rooms[room] = { players: {}, questions: [], timerStarted: false };
    }
    rooms[room].players[socket.id] = { name, score: 0, question: null };
    io.to(room).emit("players", Object.values(rooms[room].players).map(p => p.name));

    if (!rooms[room].timerStarted && Object.keys(rooms[room].players).length >= 2) {
      rooms[room].timerStarted = true;
      let countdown = 180; // 3 minuten
      const timer = setInterval(() => {
        countdown--;
        io.to(room).emit("countdown", countdown);
        if (countdown <= 0) {
          clearInterval(timer);
          startQuiz(room);
        }
      }, 1000);
    }
  });

  socket.on("submitQuestion", (question) => {
    if (rooms[currentRoom]) {
      question.author = rooms[currentRoom].players[socket.id].name;
      rooms[currentRoom].questions.push(question);
      rooms[currentRoom].players[socket.id].question = question;
    }
  });

  socket.on("answer", ({ questionIndex, correct }) => {
    if (correct) rooms[currentRoom].players[socket.id].score++;
    const results = Object.values(rooms[currentRoom].players)
      .map(p => ({ name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
    io.to(currentRoom).emit("scoreboard", results);
  });

  socket.on("disconnect", () => {
    if (rooms[currentRoom]) {
      delete rooms[currentRoom].players[socket.id];
      io.to(currentRoom).emit("players", Object.values(rooms[currentRoom].players).map(p => p.name));
    }
  });
});

function startQuiz(room) {
  const roomData = rooms[room];
  if (!roomData) return;

  const validPlayers = Object.values(roomData.players).filter(p => p.question);
  if (validPlayers.length === 0) return;

  let questions = roomData.questions;
  questions = shuffle(questions).slice(0, Math.ceil(questions.length / 2));

  io.to(room).emit("startQuiz", questions);
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`✅ Server actief op poort ${PORT}`));
