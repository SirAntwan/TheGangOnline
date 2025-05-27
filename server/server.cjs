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

  socket.on("create_game", ({ gameId, playerName }) => {
    if (!games[gameId]) {
      games[gameId] = createGame(gameId);
    }

    const game = games[gameId];
    console.log(`Game Created by ${playerName} attempting to join game ${gameId}`);
    // Prevent duplicate joins
    const alreadyJoined = game.players.find(p => p.id === socket.id);
    if (!alreadyJoined) {
      const player = {
        id: socket.id,
        name: playerName,
        hand: [],
        chips: {},
      };
      game.players.push(player);
    }

    socket.join(gameId);
    socket.emit("game_created", { gameId });
    io.to(gameId).emit("player_joined", { players: game.players });
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
      player.chips = {}; // ✅ Reset chips
    });

    game.communityCards = [];   // ✅ Clear board
    game.round = 0;             // ✅ Reset round
    game.status = "in-progress";

    console.log("=== Starting New Game ===");

    game.players.forEach(player => {
      const recipientSocket = io.sockets.sockets.get(player.id);
      if (!recipientSocket) {
        console.log(`⚠ No active socket for ${player.name} (${player.id})`);
      } else {
        recipientSocket.emit("game_started", {
          hand: player.hand,
          round: game.round
        });
      }
    });

    // 🔄 Sync fresh player state (cleared chips)
    io.to(gameId).emit("player_chip_update", {
      players: game.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: {}
      }))
    });

    // Optionally, send cleared community cards
    io.to(gameId).emit("round_update", {
      round: game.round,
      communityCards: []
    });
  });


  socket.on("pick_chip", ({ gameId, color, value }) => {
    const game = games[gameId];
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    // Ensure chip is updated for this round
    player.chips[color] = value;

    // Emit fresh player state after each chip pick
    io.to(gameId).emit("player_chip_update", {
      players: game.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: { ...p.chips } // clone to avoid mutation issues
      }))
    });
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

    // Step 1: Group players by identical hand strength
    const groups = [];
    let i = 0;
    while (i < result.length) {
      const current = result[i];
      const tiedGroup = [current];

      while (
        i + 1 < result.length &&
        result[i + 1].rank === current.rank &&
        JSON.stringify(result[i + 1].tiebreakers) === JSON.stringify(current.tiebreakers)
      ) {
        tiedGroup.push(result[i + 1]);
        i++;
      }

      groups.push(tiedGroup);
      i++;
    }

    // Step 2: Assign chip ranges to each group
    let chipIndex = 1; // start with worst chip
    const expectedChipsByPlayer = {};

    for (const group of [...groups].reverse()) {
      const validChips = [];
      for (let offset = 0; offset < group.length; offset++) {
        validChips.push(chipIndex + offset);
      }

      group.forEach(player => {
        expectedChipsByPlayer[player.playerId] = validChips;
      });

      chipIndex += group.length;
    }

    // Step 3: Check if each player's chip matches their allowed range
    const allCorrect = game.players.every(p => {
      const selectedChip = p.chips[`round${game.round}`];
      const expected = expectedChipsByPlayer[p.id];
      return expected.includes(selectedChip);
    });

    const outcome = allCorrect ? "WINNER" : "LOSER";
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