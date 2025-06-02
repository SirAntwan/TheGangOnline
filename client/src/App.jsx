import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://thegangonline.onrender.com"); // replace with your deployed server URL when needed

function getCardImageFilename(card) {
  const suitMap = {
    "♠": "spades",
    "♥": "hearts",
    "♦": "diamonds",
    "♣": "clubs"
  };

  const valueMap = {
    "J": "jack",
    "Q": "queen",
    "K": "king",
    "A": "ace"
  };

  const value = valueMap[card.value] || card.value.toLowerCase(); // convert 2–10 as-is, face cards get mapped
  const suit = suitMap[card.suit] || "unknown";
  return `/cards/${value}_of_${suit}.png`;
}


export default function App() {
  const [gameId, setGameId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(0);
  const [communityCards, setCommunityCards] = useState([]);
  const [hand, setHand] = useState([]);
  const [chip, setChip] = useState({});
  const [result, setResult] = useState(null);
  const [playerStates, setPlayerStates] = useState([]);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected as", socket.id);
      setMySocketId(socket.id); 
    });

    socket.on("game_created", ({ gameId }) => alert(`Game ${gameId} created!`));
    socket.on("player_joined", ({ players }) => setPlayers(players));
    socket.on("game_started", ({ hand, round }) => {
      console.log("game_started received with hand:", hand);
      setHand(hand);     
      setRound(round);
      setResult(null);
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
    socket.on("player_chip_update", ({ players }) => {
      setPlayerStates(players);
    })
  }, []);

  const createGame = () => {
    const newGameId = Math.random().toString(36).substring(2, 7);
    setGameId(newGameId);
    socket.emit("create_game", { gameId: newGameId, playerName });
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
    setShowModal(true);
  };


  return (
    <div className="container">
      {/* Left Panel: Game UI */}
      <div className="left-panel">
        <h1>The Gang - Online</h1>

        <div>
          <input
            placeholder="Your Name"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
          />
          <input
            placeholder="Game ID"
            value={gameId}
            onChange={e => setGameId(e.target.value)}
          />
          <button onClick={joinGame}>Join Game</button>
          <button onClick={createGame}>Create Game</button>
        </div>

        <div>
          <button onClick={startGame}>Start Game</button>
          <button onClick={nextRound}>Next Round</button>
          <button onClick={showdown}>Showdown</button>
        </div>

        <div>
          <h2>{["Pre-flop", "Flop", "Turn", "River"][round] || `Round ${round}`}</h2>
          <p>Community Cards:</p>
            <div className="card-row">
              {communityCards.map((card, index) => (
                <img
                  key={index}
                  src={getCardImageFilename(card)}
                  alt={`${card.value} of ${card.suit}`}
                  className="card-image"
                />
              ))}
            </div>

            <p>Your Hand:</p>
            <div className="card-row">
              {hand.map((card, index) => (
                <img
                  key={index}
                  src={getCardImageFilename(card)}
                  alt={`${card.value} of ${card.suit}`}
                  className="card-image"
                />
              ))}
            </div>
        </div>

        <div>
          <h2>Pick a Chip</h2>
          {Array.from({ length: players.length }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => pickChip(`round${round}`, n)}>
              {n}★
            </button>
          ))}
        </div>

        {result && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          >
            <div className="modal-dialog modal-lg" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Showdown Result</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setResult(null)}
                  ></button>
                </div>

                <div className="modal-body">
                  {/* Community Cards */}
                  <div className="mb-4">
                    <h6>Community Cards</h6>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      {communityCards.map((card, index) => (
                        <img
                          key={index}
                          src={getCardImageFilename(card)}
                          alt={`${card.value} of ${card.suit}`}
                          style={{ width: "90px" }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Player Hands */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "24px",
                      marginTop: "1rem",
                    }}
                  >
                    {result.result.map((r, index) => (
                      <div
  key={r.playerId}
  style={{
    border: r.playerId === socket.id ? "2px solid #007bff" : "1px solid #ccc",
    backgroundColor: r.playerId === socket.id ? "#e7f1ff" : "transparent",
    borderRadius: "8px",
    padding: "1rem",
    marginBottom: "1rem"
  }}
>
  <strong>#{index + 1} – {r.playerId === socket.id ? "You" : r.name}:</strong> {r.description}
  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "0.5rem" }}>
    {r.hand.map((card, i) => (
      <img
        key={i}
        src={getCardImageFilename(card)}
        alt={`${card.value} of ${card.suit}`}
        style={{ width: "90px" }}
      />
    ))}
  </div>
</div>

                    ))}
                  </div>



                  <p>
                    <br></br>
                    <strong>Outcome: </strong> <b>{" " + result.outcome.toUpperCase()}</b>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}



      </div>

      {/* Right Panel: Player List */}
      <div className="right-panel">
        <h2>Player List</h2>
        {playerStates.map(p => (
          <div key={p.id} className="player-box">
            <h3>{p.name}</h3>
            <ul className="no-bullets">
              {Object.entries(p.chips).map(([roundKey, value]) => {
                const roundLabels = ["Pre-flop", "Flop", "Turn", "River"];
                const index = parseInt(roundKey.slice(5));
                return (
                  <li key={roundKey}>
                    <strong>{roundLabels[index] || `Round ${index}`}:</strong> {value}★
                  </li>
                );
              })}
              {Object.keys(p.chips).length === 0 && (
                <li className="italic">No chips selected yet</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );

}
