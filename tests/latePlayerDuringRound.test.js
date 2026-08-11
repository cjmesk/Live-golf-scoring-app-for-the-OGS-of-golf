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

const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const domSource = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "dom.js"), "utf8");

if (!htmlSource.match(/id="todayScreen"[\s\S]*id="todayAddPlayer"[\s\S]*id="latePlayerPanel"/)) {
  throw new Error("Today's Round must contain the primary Add Player button and existing late-player form.");
}

if (!appSource.includes('elements.todayAddPlayer.classList.toggle("is-hidden", !commissionerMode);')) {
  throw new Error("The Today Add Player button must be visible whenever Commissioner Mode is active.");
}

if (!appSource.includes('elements.todayAddPlayer.addEventListener("click", openLatePlayerForm);')) {
  throw new Error("The Today button must reuse the existing late-player workflow.");
}

if (!domSource.includes('todayAddPlayer: document.querySelector("#todayAddPlayer")')) {
  throw new Error("The Today Add Player button must be wired to the controller.");
}

const holes = Array.from({ length: 18 }, (_, index) => ({
  hole: index + 1,
  par: 4,
  handicap: index + 1,
  yards: 350
}));
const course = {
  id: "practice-course",
  name: "Practice Course",
  par: 72,
  teeOrder: ["white"],
  tees: { white: holes },
  teeRatings: { white: { courseRating: 72, slopeRating: 113, par: 72 } }
};
const originalPlayers = [
  { id: "original-1", name: "Original One", handicap: 10, handicapIndex: 10, tee: "white" },
  { id: "original-2", name: "Original Two", handicap: 12, handicapIndex: 12, tee: "white" }
];
const initialSettings = {
  players: originalPlayers,
  groups: [["original-1", "original-2"]],
  groupRecords: [{ playerIds: ["original-1", "original-2"], startingHole: 1, currentHole: 1, holesToPlay: 18 }],
  games: { pointsGame: { enabled: false }, netSkins: { enabled: false }, teamChallenge: { enabled: false } }
};
let practiceRound = window.OGSGolf.state.createRoundState(course, originalPlayers, initialSettings);

for (let holeIndex = 0; holeIndex < 5; holeIndex += 1) {
  practiceRound.goToHole(holeIndex);
  practiceRound.setDraftScore("original-1", 4 + (holeIndex % 2));
  practiceRound.setDraftScore("original-2", 5);
  practiceRound.saveCurrentHole(originalPlayers);
}

const originalOneEarlierScores = practiceRound.savedScores["original-1"].slice(0, 5);
const originalTwoEarlierScores = practiceRound.savedScores["original-2"].slice(0, 5);
const preservedRound = practiceRound.getAutoSaveExport();
const latePlayer = {
  id: "late-player",
  name: "Late Player",
  handicap: 14,
  handicapIndex: 14,
  tee: "white",
  lateJoinHole: 6
};
const allPlayers = [...originalPlayers, latePlayer];
const joinedSettings = {
  ...initialSettings,
  players: allPlayers,
  groups: [["original-1", "original-2", "late-player"]],
  groupRecords: [{ playerIds: ["original-1", "original-2", "late-player"], startingHole: 1, currentHole: 6, holesToPlay: 18 }]
};

practiceRound = window.OGSGolf.state.createRoundState(course, allPlayers, joinedSettings, {
  ...preservedRound,
  players: allPlayers,
  roundSettings: joinedSettings,
  currentHoleIndex: 5
});

if (JSON.stringify(practiceRound.savedScores["original-1"].slice(0, 5)) !== JSON.stringify(originalOneEarlierScores)
  || JSON.stringify(practiceRound.savedScores["original-2"].slice(0, 5)) !== JSON.stringify(originalTwoEarlierScores)) {
  throw new Error("Adding a late player changed an original player's earlier scores.");
}

if (!practiceRound.savedScores["late-player"].slice(0, 5).every((score) => score === null)) {
  throw new Error("A late player must not receive or require scores for earlier holes.");
}

practiceRound.goToHole(5);
practiceRound.setDraftScore("original-1", 4);
practiceRound.setDraftScore("original-2", 5);
practiceRound.setDraftScore("late-player", 6);
practiceRound.saveCurrentHole(allPlayers);

if (practiceRound.savedScores["late-player"][5] !== 6) {
  throw new Error("The late player could not be scored on the group's next hole.");
}

if (JSON.stringify(practiceRound.savedScores["original-1"].slice(0, 5)) !== JSON.stringify(originalOneEarlierScores)
  || JSON.stringify(practiceRound.savedScores["original-2"].slice(0, 5)) !== JSON.stringify(originalTwoEarlierScores)) {
  throw new Error("Scoring the next hole changed original players' earlier scores.");
}

for (let holeIndex = 6; holeIndex < 18; holeIndex += 1) {
  practiceRound.goToHole(holeIndex);
  allPlayers.forEach((player) => practiceRound.setDraftScore(player.id, 4));
  practiceRound.saveCurrentHole(allPlayers);
}

if (!practiceRound.isRoundComplete()) {
  throw new Error("The round must complete without requiring the late player to backfill Holes 1-5.");
}

console.log("late-player active-round practice test passed");
