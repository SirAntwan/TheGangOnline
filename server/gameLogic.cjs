// gameLogic.js

function shuffleDeck() {
    const suits = ["♠", "♥", "♦", "♣"];
    const values = [
      "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"
    ];
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  
  function cardValue(value) {
    const order = {
      "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
      "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14
    };
    return order[value];
  }
  
  function getHandValue(cards) {
    const allCombos = combinations(cards, 5);
    let best = { rank: 0, description: "High Card" };
  
    for (const combo of allCombos) {
      const values = combo.map(c => c.value);
      const suits = combo.map(c => c.suit);
      const counts = {};
      values.forEach(v => counts[v] = (counts[v] || 0) + 1);
      const countVals = Object.values(counts).sort((a, b) => b - a);
      const sortedVals = [...new Set(values.map(cardValue))].sort((a, b) => b - a);
  
      const isFlush = new Set(suits).size === 1;
      const isStraight = sortedVals.length === 5 && sortedVals[0] - sortedVals[4] === 4;
      const lowAceStraight = sortedVals.includes(14) && [2, 3, 4, 5].every(n => sortedVals.includes(n));
  
      if (isFlush && isStraight && sortedVals[0] === 14) {
        best = { rank: 10, description: "Royal Flush" };
      } else if (isFlush && (isStraight || lowAceStraight)) {
        best = best.rank < 9 ? { rank: 9, description: "Straight Flush" } : best;
      } else if (countVals[0] === 4) {
        best = best.rank < 8 ? { rank: 8, description: "Four of a Kind" } : best;
      } else if (countVals[0] === 3 && countVals[1] === 2) {
        best = best.rank < 7 ? { rank: 7, description: "Full House" } : best;
      } else if (isFlush) {
        best = best.rank < 6 ? { rank: 6, description: "Flush" } : best;
      } else if (isStraight || lowAceStraight) {
        best = best.rank < 5 ? { rank: 5, description: "Straight" } : best;
      } else if (countVals[0] === 3) {
        best = best.rank < 4 ? { rank: 4, description: "Three of a Kind" } : best;
      } else if (countVals[0] === 2 && countVals[1] === 2) {
        best = best.rank < 3 ? { rank: 3, description: "Two Pair" } : best;
      } else if (countVals[0] === 2) {
        best = best.rank < 2 ? { rank: 2, description: "Pair" } : best;
      } else {
        const highCard = Math.max(...combo.map(c => cardValue(c.value)));
        if (best.rank < 1) best = { rank: 1, description: `High Card: ${highCard}` };
      }
    }
  
    return best;
  }
  
  function combinations(arr, k) {
    const results = [];
    function combine(start, path) {
      if (path.length === k) {
        results.push(path);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combine(i + 1, [...path, arr[i]]);
      }
    }
    combine(0, []);
    return results;
  }
  
  function evaluateHands(players, communityCards) {
    return players.map(player => {
      const allCards = player.hand.concat(communityCards);
      const value = getHandValue(allCards);
      return {
        playerId: player.id,
        name: player.name,
        hand: player.hand,
        rank: value.rank,
        description: value.description
      };
    }).sort((a, b) => b.rank - a.rank);
  }
  
  module.exports = {
    shuffleDeck,
    evaluateHands
  };
  