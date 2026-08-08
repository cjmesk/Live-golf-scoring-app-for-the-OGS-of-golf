const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const context = { window: { OGSGolf: { ui: {} } }, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src/ui/setupView.js"), "utf8"), context);

const course = {
  id: "course-1",
  name: "Test Course",
  teeOrder: ["white"],
  teeRatings: { white: { label: "White" } }
};
const members = ["a1", "a2", "b1", "b2"].map((id, index) => ({
  id,
  name: id.toUpperCase(),
  handicap: index * 4,
  tee: "white",
  active: true
}));
const elements = {
  courseSelect: { value: "course-1" },
  roundDate: { value: "2026-08-08" },
  roundName: { value: "Nine Hole Match" },
  roundTypeOptions: [{ value: "official", checked: true }],
  roundFormat: { value: "four-ball-match" },
  matchHoles: { value: "9" },
  matchStartingHole: { value: "10" },
  matchScoring: { value: "net" },
  matchHandicapSource: { value: "manual" },
  matchAllowance: { value: "90" },
  matchTeamALabel: { value: "Blue" },
  matchTeamBLabel: { value: "Gold" },
  memberList: {
    selectedMemberIds: new Set(members.map((member) => member.id)),
    teeOverrides: new Map(),
    pointsParticipation: new Map(),
    skinsParticipation: new Map(),
    matchTeams: new Map([["a1", "A"], ["a2", "A"], ["b1", "B"], ["b2", "B"]]),
    manualMatchHandicaps: new Map([["a1", 0], ["a2", 3], ["b1", 5], ["b2", 7]])
  },
  pointsGameAmount: { value: "15" },
  skinsGameAmount: { value: "5" }
};

const settings = context.window.OGSGolf.ui.readSetupSettings(elements, [course], members);
assert(settings.format === "four-ball-match", "Setup saves the Four-Ball format");
assert(settings.fourBallMatch.holes === 9 && settings.fourBallMatch.startingHole === 10, "Setup saves a back-nine match");
assert(settings.fourBallMatch.scoring === "net" && settings.fourBallMatch.handicapSource === "manual", "Setup saves net/manual handicap options");
assert(settings.players.filter((player) => player.matchTeam === "A").length === 2, "Setup saves two Team A players");
assert(settings.players.find((player) => player.id === "b2").matchPlayingHandicap === 7, "Setup saves manual playing handicaps");

console.log("Four-Ball setup test passed.");
