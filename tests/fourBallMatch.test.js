const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

const context = { window: { OGSGolf: { rules: {} } }, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src/rules/fourBallMatch.js"), "utf8"), context);
const rules = context.window.OGSGolf.rules.fourBallMatch;

const players = [
  { id: "a1", name: "A1", tee: "white", matchTeam: "A" },
  { id: "a2", name: "A2", tee: "white", matchTeam: "A" },
  { id: "b1", name: "B1", tee: "white", matchTeam: "B" },
  { id: "b2", name: "B2", tee: "white", matchTeam: "B" }
];
const handicaps = { a1: 4, a2: 10, b1: 12, b2: 18 };
const automatic = rules.getPlayingHandicaps(players, handicaps, {
  format: "four-ball-match",
  fourBallMatch: { scoring: "net", handicapSource: "automatic", allowance: 90 }
});
assertEqual(automatic.a1, 0, "Lowest course handicap plays from zero");
assertEqual(automatic.a2, 5, "90 percent allowance applies to the difference");
assertEqual(automatic.b1, 7, "Automatic playing handicap rounds to the nearest integer");
assertEqual(automatic.b2, 12, "Allowance is applied before handicaps are adjusted relative to the lowest player");
const plusPlayers = [
  { id: "plus", name: "Plus", tee: "white", matchTeam: "A" },
  { id: "five", name: "Five", tee: "white", matchTeam: "B" }
];
const plusMatch = rules.getPlayingHandicaps(plusPlayers, { plus: -3, five: 5 }, {
  format: "four-ball-match",
  fourBallMatch: { scoring: "net", handicapSource: "automatic", allowance: 100 }
});
assertEqual(plusMatch.plus, 0, "Plus-three player plays from zero in match play");
assertEqual(plusMatch.five, 8, "Five handicap receives the eight-stroke difference from plus three");
assertEqual(rules.getStrokesOnHole(20, 1), 2, "Playing handicaps above 18 receive second strokes in rank order");
assertEqual(rules.getStrokesOnHole(20, 3), 1, "Second strokes stop after the remainder");

const course = { tees: { white: Array.from({ length: 18 }, (_, index) => ({ par: 4, handicap: index + 1 })) } };
const savedScores = Object.fromEntries(players.map((player) => [player.id, Array(18).fill(null)]));
savedScores.a1[0] = 4; savedScores.a2[0] = 5; savedScores.b1[0] = 5; savedScores.b2[0] = 4;
savedScores.a1[1] = 4; savedScores.a2[1] = 4; savedScores.b1[1] = 5; savedScores.b2[1] = 5;

const grossSummary = rules.getSummary({
  players,
  savedScores,
  course,
  courseHandicaps: handicaps,
  roundSettings: { format: "four-ball-match", fourBallMatch: { holes: 9, scoring: "gross", teamALabel: "Blue", teamBLabel: "Gold" } }
});
assertEqual(grossSummary.holeResults[0].winner, "tie", "Lower gross score from each side determines the hole");
assertEqual(grossSummary.holeResults[1].winner, "A", "Side with the lower better-ball score wins the hole");
assertEqual(grossSummary.status, "Blue 1 Up through 2", "Live match status reports side, margin, and holes played");
assertEqual(rules.buildHoleSequence(rules.getSettings({ fourBallMatch: { holes: 9, startingHole: 10 } }))[0], 10, "Back-nine matches start on Hole 10");

console.log("Four-Ball match rules test passed.");
