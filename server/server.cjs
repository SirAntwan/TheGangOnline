// Server-side code using Node.js with Socket.IO to support multiplayer gameplay

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const gameLogic = require("./gameLogic.cjs");
const shuffleDeck = gameLogic.shuffleDeck;
const evaluateHands = gameLogic.evaluateHands;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const games = {}; // Map of gameId -> gameState

function createGame(gameId) {
  const deck = shuffleDeck();
  return {
    id: gameId,
    players: [],
    communityCards: [],
    vaults: 0,
    alarms: 0,
    round: 0,
    deck,
    status: "waiting"
  };
}

function dealCards(deck, count) {
  const cards = deck.splice(0, count);
  return cards;
}

io.on("connection", socket => {
  console.log("Socket connected:", socket.id);

  socket.on("create_game", ({ gameId }) => {
    if (!games[gameId]) {
      games[gameId] = createGame(gameId);
    }
    socket.join(gameId);
    socket.emit("game_created", { gameId });
  });

  socket.on("join_game", ({ gameId, playerName }) => {
    const game = games[gameId];
    console.log(`Player ${playerName} attempting to join game ${gameId}`);
    if (!game) {
      console.log(`Game ${gameId} not found.`);
      return;
    }
    if (game.players.length >= 6) {
      console.log(`Game ${gameId} full.`);
      return;
    }
    const player = {
      id: socket.id,
      name: playerName,
      hand: [],
      chips: {},
    };
    game.players.push(player);
    socket.join(gameId);
    console.log(`Player ${playerName} joined game ${gameId}`);
    io.to(gameId).emit("player_joined", { players: game.players });
  });

  socket.on("start_game", ({ gameId }) => {
    const game = games[gameId];
    if (!game || game.players.length < 2) return;

    game.deck = shuffleDeck();
    game.players.forEach(player => {
      player.hand = dealCards(game.deck, 2);
      player.chips = {};
    });
    game.communityCards = [];
    game.round = 0;
    game.status = "in-progress";

    console.log("=== Starting Game ===");
    game.players.forEach(player => {
      const recipientSocket = io.sockets.sockets.get(player.id);
      if (!recipientSocket) {
        console.log(`⚠ No active socket for ${player.name} (${player.id})`);
      } else {
        console.log(`Sending hand to ${player.name} (${player.id})`);
        console.log(`Sending (${player.name}) `, player.hand);
        recipientSocket.emit("game_started", {
          hand: player.hand,
          round: game.round
        });
      }
    });
  });

  socket.on("pick_chip", ({ gameId, color, value }) => {
    const game = games[gameId];
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    player.chips[color] = value;
    io.to(gameId).emit("chip_update", { playerId: player.id, color, value });
  });

  socket.on("next_round", ({ gameId }) => {
    const game = games[gameId];
    if (!game) return;
    if (game.round < 3) {
      game.round++;
      console.log(`${game.round}`);
      if (game.round === 1) {
        game.communityCards.push(...dealCards(game.deck, 3));
      } else if (game.round <= 3) {
        game.communityCards.push(...dealCards(game.deck, 1));
      }
      
      io.to(gameId).emit("round_update", {
        round: game.round,
        communityCards: game.communityCards
      });
    }
  });

  socket.on("showdown", ({ gameId }) => {
    const game = games[gameId];
    const result = evaluateHands(game.players, game.communityCards);
    // Validate chip order with ranking
    const isCorrect = result.every((r, i, arr) => !i || r.rank >= arr[i - 1].rank);
    if (isCorrect) {
      game.vaults++;
    } else {
      game.alarms++;
    }
    const outcome = game.vaults >= 3 ? "win" : game.alarms >= 3 ? "lose" : "continue";
    io.to(gameId).emit("showdown_result", { result, outcome });
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    Object.values(games).forEach(game => {
      game.players = game.players.filter(p => p.id !== socket.id);
    });
  });
});

server.listen(3000, () => console.log("Server running on port 3000"));