const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
global.OGSGolf = {};

[
  "src/rules/points.js",
  "src/rules/handicap.js",
  "src/rules/fourBallMatch.js",
  "src/rules/skins.js",
  "src/state/roundState.js"
].forEach((filePath) => {
  const source = fs.readFileSync(path.join(__dirname, "..", filePath), "utf8");
  vm.runInThisContext(source, { filename: filePath });
});

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

const holes = Array.from({ length: 18 }, (_, index) => ({
  hole: index + 1,
  par: 4,
  handicap: index + 1,
  yards: 350
}));
const course = {
  id: "skins-payout-test",
  name: "Skins Payout Test",
  par: 72,
  teeOrder: ["white"],
  tees: { white: holes },
  teeRatings: { white: { courseRating: 72, slopeRating: 113, par: 72 } }
};
const players = [
  { id: "player-a", name: "Player A", handicap: 0, handicapIndex: 0, tee: "white", inSkins: true },
  { id: "player-b", name: "Player B", handicap: 0, handicapIndex: 0, tee: "white", inSkins: true }
];
const settings = {
  players,
  groups: [["player-a", "player-b"]],
  groupRecords: [{ playerIds: ["player-a", "player-b"], startingHole: 1, currentHole: 1, holesToPlay: 18 }],
  games: {
    pointsGame: { enabled: false, amount: 15 },
    netSkins: { enabled: true, amount: 5, skinsHandicapMode: "none" },
    teamChallenge: { enabled: false }
  }
};
const round = OGSGolf.state.createRoundState(course, players, settings);

for (let holeIndex = 0; holeIndex < 18; holeIndex += 1) {
  round.goToHole(holeIndex);
  const playerAWins = holeIndex === 0 || holeIndex === 2;
  const playerBWins = holeIndex === 1;
  round.setDraftScore("player-a", playerAWins ? 3 : 4);
  round.setDraftScore("player-b", playerBWins ? 3 : 4);
  round.saveCurrentHole(players);
}

const payout = round.getPayoutSummary();
const playerA = payout.skins.winners.find((winner) => winner.playerId === "player-a");
const playerB = payout.skins.winners.find((winner) => winner.playerId === "player-b");
const playerATotal = payout.playerTotals.find((player) => player.playerId === "player-a");
const playerBTotal = payout.playerTotals.find((player) => player.playerId === "player-b");

assertEqual(payout.skins.totalPot, 10, "The Skins pot stays unchanged");
assertEqual(payout.skins.totalWinningSkins, 3, "The winning-skin count stays unchanged");
assertEqual(payout.skins.valuePerSkin, 3.33, "Every skin receives the same cent-rounded value");
assertEqual(payout.skins.payoutPerSkin, 3.33, "The displayed per-skin payout is equal");
assertEqual(playerA.payout, 6.66, "Two skins pay exactly twice the equal per-skin value");
assertEqual(playerB.payout, 3.33, "One skin receives the same per-skin value");
assertEqual(playerATotal.skinsWinnings, 6.66, "The final player total uses the equal Skins payout");
assertEqual(playerBTotal.skinsWinnings, 3.33, "Every final leaderboard total uses the equal Skins payout");
assertEqual(payout.points.enabled, false, "The Skins payout change does not enable or alter Points");

console.log("equal Skins payout rounding test passed");
