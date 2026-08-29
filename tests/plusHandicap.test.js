const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
global.OGSGolf = {};

[
  "src/ui/formatters.js",
  "src/ui/playerManagementView.js",
  "src/rules/handicap.js"
].forEach((filePath) => {
  const source = fs.readFileSync(path.join(__dirname, "..", filePath), "utf8");
  vm.runInThisContext(source, { filename: filePath });
});

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, received ${actual}`);
  }
}

assertEqual(window.OGSGolf.ui.parseHandicapIndex("+1.4"), -1.4,
  "A plus-sign GHIN entry is stored as a plus golfer");
assertEqual(window.OGSGolf.ui.parseHandicapIndex("1.4"), 1.4,
  "An unsigned GHIN entry remains a standard positive index");
assertEqual(window.OGSGolf.ui.formatHandicapIndex(-1.4), "+1.4",
  "A stored plus index displays with golf notation");

const formResult = window.OGSGolf.ui.readPlayerForm({
  playerName: { value: "Plus Golfer" },
  playerGhin: { value: "" },
  playerHandicap: { value: "+1.4" },
  playerTee: { value: "white" },
  playerActive: { checked: true },
  editingPlayerId: { value: "plus-golfer" }
});
assertEqual(formResult.player.handicap, -1.4, "Roster form preserves a plus golfer correctly");

const course = {
  par: 72,
  teeRatings: {
    white: { courseRating: 72, slopeRating: 113, par: 72 }
  }
};
const plusGolfer = { handicap: -1.4, handicapIndex: -1.4, tee: "white" };
const details = window.OGSGolf.rules.getCourseHandicapDetails(plusGolfer, course, "white");

assertEqual(details.courseHandicap, -1, "Plus 1.4 calculates a plus-one Course Handicap on a neutral tee");
assertEqual(window.OGSGolf.rules.getStrokesOnHole(details.courseHandicap, 18), -1,
  "Plus-one golfer adds a stroke on the 18-ranked hole");
assertEqual(window.OGSGolf.rules.getStrokesOnHole(details.courseHandicap, 1), 0,
  "Plus-one golfer does not add a stroke on the 1-ranked hole");
assertEqual(window.OGSGolf.rules.getNetScore(4, -1), 5,
  "A plus-handicap stroke increases the net score");

console.log("Plus-handicap input and scoring test passed.");
