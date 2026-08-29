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

const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

if (!htmlSource.match(/id="todayScreen"[\s\S]*id="todayChangeGroups"[\s\S]*id="playerGroupPanel"/)) {
  throw new Error("Today's Round must contain the commissioner group-change button and panel.");
}
if (!appSource.includes('elements.todayChangeGroups.classList.toggle("is-hidden", !commissionerMode);')) {
  throw new Error("Change Player Groups must remain visible in Commissioner Mode.");
}
if (!appSource.includes("await autoSaveUnfinishedRound();")) {
  throw new Error("Group assignment changes must publish the active-round snapshot for other phones.");
}

const holes = Array.from({ length: 18 }, (_, index) => ({
  hole: index + 1,
  par: 4,
  handicap: index + 1,
  yards: 350
}));
const course = {
  id: "group-change-course",
  name: "Group Change Test",
  par: 72,
  teeOrder: ["white"],
  tees: { white: holes },
  teeRatings: { white: { courseRating: 72, slopeRating: 113, par: 72 } }
};
const players = ["p1", "p2", "p3", "p4"].map((id, index) => ({
  id,
  name: `Player ${index + 1}`,
  handicap: 10 + index,
  handicapIndex: 10 + index,
  tee: "white"
}));
const settings = {
  players,
  groups: [["p1", "p2"], ["p3", "p4"]],
  groupScorers: ["p1", "p3"],
  groupRecords: [
    { playerIds: ["p1", "p2"], scorekeeperId: "p1", startingHole: 1, currentHole: 6, holesToPlay: 18 },
    { playerIds: ["p3", "p4"], scorekeeperId: "p3", startingHole: 1, currentHole: 6, holesToPlay: 18 }
  ],
  games: { pointsGame: { enabled: true }, netSkins: { enabled: true }, teamChallenge: { enabled: false } }
};
const round = window.OGSGolf.state.createRoundState(course, players, settings);

for (let holeIndex = 0; holeIndex < 5; holeIndex += 1) {
  round.goToHole(holeIndex);
  players.forEach((player, playerIndex) => round.setDraftScore(player.id, 4 + ((holeIndex + playerIndex) % 2)));
  round.saveCurrentHole(players);
}

const earlierScores = Object.fromEntries(players.map((player) => [player.id, [...round.savedScores[player.id].slice(0, 5)]]));
const result = round.reassignPlayerGroups([["p1", "p3"], ["p2", "p4"]], { p2: 6, p3: 6 });

if (!result.ok || result.movedPlayers.length !== 2) {
  throw new Error("Two mid-round player moves should be applied.");
}
if (JSON.stringify(settings.groups) !== JSON.stringify([["p1", "p3"], ["p2", "p4"]])) {
  throw new Error("The active group assignments were not updated.");
}
players.forEach((player) => {
  if (JSON.stringify(round.savedScores[player.id].slice(0, 5)) !== JSON.stringify(earlierScores[player.id])) {
    throw new Error(`Earlier scores changed for ${player.id}.`);
  }
});
if (settings.games.pointsGame.enabled !== true || settings.games.netSkins.enabled !== true) {
  throw new Error("Changing groups altered active bets.");
}

round.goToHole(5);
players.forEach((player) => round.setDraftScore(player.id, 5));
round.saveCurrentHole(players);
if (!players.every((player) => round.savedScores[player.id][5] === 5)) {
  throw new Error("Players could not be scored on the next hole after changing groups.");
}

console.log("active group-change practice test passed");
