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
    throw new Error(`${message}. Expected ${expected}, received ${actual}`);
  }
}

const holes = Array.from({ length: 18 }, (_, index) => ({
  hole: index + 1,
  par: 4,
  handicap: index + 1,
  yards: 350
}));
const course = {
  id: "participation-test",
  name: "Participation Test",
  par: 72,
  teeOrder: ["white"],
  tees: { white: holes },
  teeRatings: { white: { label: "White", courseRating: 72, slopeRating: 113, par: 72 } }
};
const players = [
  { id: "player-a", name: "Player A", handicap: 0, tee: "white", inPoints: true, inSkins: true },
  { id: "player-b", name: "Player B", handicap: 0, tee: "white", inPoints: true, inSkins: true }
];
const settings = {
  players: players.map((player) => ({ ...player })),
  groups: [["player-a", "player-b"]],
  groupRecords: [{ playerIds: ["player-a", "player-b"], holesToPlay: 18 }],
  games: {
    pointsGame: { enabled: true, amount: 15 },
    netSkins: { enabled: true, amount: 5, skinsHandicapMode: "half" }
  },
  playerStatuses: {}
};
const roundState = window.OGSGolf.state.createRoundState(course, players, settings);

roundState.setDraftScore("player-a", 3);
roundState.setDraftScore("player-b", 4);
roundState.saveCurrentHole(players);

const originalGroup = JSON.stringify(settings.groups);
const originalScores = JSON.stringify(roundState.savedScores);
const initialPayout = roundState.getPayoutSummary();
assertEqual(initialPayout.points.totalPot, 30, "Two Points players fund the original Points pot");
assertEqual(initialPayout.skins.totalPot, 10, "Two Skins players fund the original Skins pot");

const update = roundState.updateRoundPlayerParticipation("player-a", {
  inPoints: false,
  inSkins: false
});

assertEqual(Boolean(update), true, "Participation update returns a result");
assertEqual(players[0].inPoints, false, "Player is removed from Points");
assertEqual(players[0].inSkins, false, "Player is removed from Skins");
assertEqual(JSON.stringify(settings.groups), originalGroup, "Foursome is preserved");
assertEqual(JSON.stringify(roundState.savedScores), originalScores, "Gross scores are preserved");
assertEqual(update.payoutSummary.points.participantCount, 1, "Points count recalculates");
assertEqual(update.payoutSummary.points.totalPot, 15, "Points pot removes the player's entry");
assertEqual(update.payoutSummary.skins.participantCount, 1, "Skins count recalculates");
assertEqual(update.payoutSummary.skins.totalPot, 5, "Skins pot removes the player's entry");
assertEqual(update.payoutSummary.skins.winners.some((winner) => winner.playerId === "player-a"), false,
  "Removed player cannot receive a Skins payout");

roundState.applyCloudRoundPlayers([
  { player_id: "player-a", handicap_index: 0, course_handicap: 0, tee: "white", points_enabled: true, skins_enabled: true },
  { player_id: "player-b", handicap_index: 0, course_handicap: 0, tee: "white", points_enabled: false, skins_enabled: false }
]);

const refreshedPayout = roundState.getPayoutSummary();
assertEqual(players[0].inPoints, true, "Cloud refresh restores Player A's Points flag");
assertEqual(players[1].inSkins, false, "Cloud refresh applies Player B's Skins flag");
assertEqual(refreshedPayout.points.participantCount, 1, "Cloud-refreshed Points count is current");
assertEqual(refreshedPayout.skins.totalPot, 5, "Cloud-refreshed Skins pot is current");

const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const domSource = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "dom.js"), "utf8");

if (!htmlSource.match(/id="todayEditGames"[\s\S]*id="gameParticipationPanel"/)) {
  throw new Error("Today's Round must contain the Edit Points & Skins control and form.");
}

if (!appSource.includes('elements.todayEditGames.classList.toggle("is-hidden", !commissionerMode);')
  || !appSource.includes("updateRoundPlayerParticipation(player.id, { inPoints, inSkins })")
  || !appSource.includes("The money pots, winners, and payouts will be recalculated.")) {
  throw new Error("Commissioner participation changes must be visible, confirmed, and recalculated.");
}

if (!domSource.includes('todayEditGames: document.querySelector("#todayEditGames")')) {
  throw new Error("Edit Points & Skins must be wired to the controller.");
}

console.log("Active-round Points and Skins participation test passed.");
