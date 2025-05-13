import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000"); // replace with your deployed server URL when needed

export default function App() {
  const [gameId, setGameId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(0);
  const [communityCards, setCommunityCards] = useState([]);
  const [hand, setHand] = useState([]);
  const [chip, setChip] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    socket.on("connect", () => console.log("Connected as", socket.id));

    socket.on("game_created", ({ gameId }) => alert(`Game ${gameId} created!`));
    socket.on("player_joined", ({ players }) => setPlayers(players));
    socket.on("game_started", ({ hand, round }) => {
      console.log("game_started received with hand:", hand);
      setHand(hand);      // ✅ now populated
      setRound(round);
    });
    socket.on("round_update", ({ round, communityCards }) => {
      setRound(round);
      setCommunityCards(communityCards);
    });

    socket.on("chip_update", ({ playerId, color, value }) => {
      if (playerId === socket.id) setChip(prev => ({ ...prev, [color]: value }));
    });
    socket.on("showdown_result", ({ result, outcome }) => {
      setResult({ result, outcome });
    });
  }, []);

  const createGame = () => {
    const newGameId = Math.random().toString(36).substring(2, 7);
    setGameId(newGameId);
    socket.emit("create_game", { gameId: newGameId });
  };

  const joinGame = () => {
    if (gameId && playerName) {
      socket.emit("join_game", { gameId, playerName });
    }
  };

  const startGame = () => {
    socket.emit("start_game", { gameId });
  };

  const pickChip = (color, value) => {
    socket.emit("pick_chip", { gameId, color, value });
  };

  const nextRound = () => {
    socket.emit("next_round", { gameId });
  };

  const showdown = () => {
    socket.emit("showdown", { gameId });
  };

  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">The Gang - Online</h1>
      <div>
        <input
          placeholder="Your Name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          className="border p-2 mr-2"
        />
        <input
          placeholder="Game ID"
          value={gameId}
          onChange={e => setGameId(e.target.value)}
          className="border p-2 mr-2"
        />
        <button onClick={joinGame} className="bg-blue-500 text-white px-4 py-2 rounded">
          Join Game
        </button>
        <button onClick={createGame} className="bg-green-500 text-white px-4 py-2 rounded ml-2">
          Create Game
        </button>
      </div>

      <div>
        <button onClick={startGame} className="bg-purple-500 text-white px-4 py-2 rounded">
          Start Game
        </button>
        <button onClick={nextRound} className="bg-yellow-500 text-white px-4 py-2 rounded ml-2">
          Next Round
        </button>
        <button onClick={showdown} className="bg-red-500 text-white px-4 py-2 rounded ml-2">
          Showdown
        </button>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Round {round}</h2>
        <p>Community Cards: {communityCards.map(c => `${c.value}${c.suit}`).join(" ")}</p>
        <p>Your Hand: {hand.map(c => `${c.value}${c.suit}`).join(" ")}</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Pick a Chip</h2>
        {[1, 2, 3, 4, 5, 6].map(n => (
          <button
            key={n}
            onClick={() => pickChip(`round${round}`, n)}
            className="border px-3 py-1 m-1"
          >
            {n}★
          </button>
        ))}
      </div>

      {result && (
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="text-xl font-bold">Showdown Result</h3>
          <ul>
            {result.result.map(r => (
              <li key={r.playerId}>
                {r.playerId === socket.id ? "You" : r.playerId.slice(0, 5)}: {r.description}
              </li>
            ))}
          </ul>
          <p className="mt-2">Outcome: {result.outcome.toUpperCase()}</p>
        </div>
      )}
    </div>
  );
}
