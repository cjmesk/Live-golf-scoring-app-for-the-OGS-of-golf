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
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", filePath), "utf8"), { filename: filePath });
});

const holes = Array.from({ length: 18 }, (_, index) => ({ hole: index + 1, par: 4, handicap: index + 1, yards: 350 }));
const course = {
  id: "match-finish-course",
  name: "Match Finish Test",
  par: 72,
  teeOrder: ["white"],
  tees: { white: holes },
  teeRatings: { white: { courseRating: 72, slopeRating: 113, par: 72 } }
};
const players = [
  { id: "a1", name: "A1", tee: "white", handicap: 0, matchTeam: "A" },
  { id: "a2", name: "A2", tee: "white", handicap: 0, matchTeam: "A" },
  { id: "b1", name: "B1", tee: "white", handicap: 0, matchTeam: "B" },
  { id: "b2", name: "B2", tee: "white", handicap: 0, matchTeam: "B" }
];
const settings = {
  format: "four-ball-match",
  fourBallMatch: { holes: 18, startingHole: 1, scoring: "gross", teamALabel: "Team A", teamBLabel: "Team B" },
  groups: [players.map((player) => player.id)],
  groupRecords: [{ playerIds: players.map((player) => player.id), startingHole: 1, currentHole: 1, holesToPlay: 18 }],
  games: { pointsGame: { enabled: false }, netSkins: { enabled: false }, teamChallenge: { enabled: false } }
};
const round = window.OGSGolf.state.createRoundState(course, players, settings);

for (let holeIndex = 0; holeIndex < 16; holeIndex += 1) {
  round.goToHole(holeIndex);
  const teamAWins = holeIndex < 3;
  round.setDraftScore("a1", teamAWins ? 3 : 4);
  round.setDraftScore("a2", 4);
  round.setDraftScore("b1", 4);
  round.setDraftScore("b2", 4);
  round.saveCurrentHole(players);
}

const match = round.getFourBallMatchSummary();
if (!match.complete || !match.status.includes("3 & 2")) {
  throw new Error(`Expected a closed 3 & 2 match after Hole 16, received: ${match.status}`);
}
if (round.isRoundComplete()) {
  throw new Error("A closed match must remain open for stroke scores on Holes 17 and 18.");
}

for (let holeIndex = 16; holeIndex < 18; holeIndex += 1) {
  round.goToHole(holeIndex);
  players.forEach((player) => round.setDraftScore(player.id, 5));
  round.saveCurrentHole(players);
}

if (!round.isRoundComplete()) {
  throw new Error("The match round must complete after all scheduled stroke scores are saved.");
}
if (!players.every((player) => round.savedScores[player.id][16] === 5 && round.savedScores[player.id][17] === 5)) {
  throw new Error("Stroke scores after the match closed were not preserved.");
}

console.log("match-play post-result stroke scoring test passed");
