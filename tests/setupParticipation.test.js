const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
global.OGSGolf = {};

const source = fs.readFileSync(path.join(__dirname, "..", "src/ui/setupView.js"), "utf8");
vm.runInThisContext(source, { filename: "src/ui/setupView.js" });

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, received ${actual}`);
  }
}

const courses = [{
  id: "twelve-stones",
  name: "Twelve Stones",
  teeOrder: ["white"],
  teeRatings: {
    white: { label: "White" }
  }
}];
const members = [
  { id: "player-a", name: "Player A", ghin: "", handicap: 10, tee: "white", active: true },
  { id: "player-b", name: "Player B", ghin: "", handicap: 8, tee: "white", active: true }
];
const elements = {
  courseSelect: { value: "twelve-stones", innerHTML: "", onchange: null },
  roundDate: { value: "2026-07-14" },
  roundName: { value: "" },
  memberSearch: { value: "", oninput: null },
  selectedPlayerCount: { textContent: "" },
  memberList: {
    innerHTML: "",
    selectedMemberIds: new Set(["player-a", "player-b"]),
    teeOverrides: new Map(),
    pointsParticipation: new Map([["player-a", true]]),
    groupAssignments: new Map([["player-a", 2], ["player-b", 1]]),
    rows: [],
    appendChild(row) {
      this.rows.push(row);
    },
    onchange: null
  },
  gameList: { innerHTML: "" },
  teamAssignmentPanel: { classList: { add() {} } },
  teamAssignmentList: { innerHTML: "" }
};

global.document = {
  createElement() {
    return {
      className: "",
      innerHTML: ""
    };
  }
};

window.OGSGolf.ui.renderSetupView(elements, courses, members);

const settings = window.OGSGolf.ui.readSetupSettings(elements, courses, members);
const playerA = settings.players.find((player) => player.id === "player-a");
const playerB = settings.players.find((player) => player.id === "player-b");

assertEqual(playerA.inPoints, true, "Selected player checked into Points Game");
assertEqual(playerB.inPoints, false, "Selected player not checked into Points Game");
assertEqual(settings.games.pointsGame.enabled, true, "Points Game enabled when at least one player is checked in");
assertEqual(settings.groups.length, 2, "Setup creates the selected groups");
assertEqual(settings.groups[0][0], "player-b", "Player B stays in Group 1");
assertEqual(settings.groups[1][0], "player-a", "Player A stays in Group 2");

elements.memberList.pointsParticipation = new Map();
const settingsWithoutPoints = window.OGSGolf.ui.readSetupSettings(elements, courses, members);

assertEqual(settingsWithoutPoints.players.every((player) => player.inPoints === false), true, "Points defaults off");
assertEqual(settingsWithoutPoints.games.pointsGame.enabled, false, "Points Game disabled when no players are checked in");

console.log("Setup participation test passed.");

