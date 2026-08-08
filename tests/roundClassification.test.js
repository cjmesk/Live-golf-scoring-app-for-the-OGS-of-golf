const fs = require("fs");
const path = require("path");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const setupSource = fs.readFileSync(path.join(__dirname, "..", "src/ui/setupView.js"), "utf8");
const historySource = fs.readFileSync(path.join(__dirname, "..", "src/ui/previousRoundsView.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "src/app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const context = {
  window: { OGSGolf: { ui: {} } },
  console
};
vm.createContext(context);
vm.runInContext(setupSource, context);

const course = {
  id: "test-course",
  name: "Test Course",
  teeOrder: ["white"],
  teeRatings: { white: { label: "White" } }
};
const members = [{
  id: "player-1",
  name: "Player One",
  handicap: 10,
  tee: "white",
  active: true
}];
const elements = {
  courseSelect: { value: "test-course" },
  roundDate: { value: "2026-08-08" },
  roundName: { value: "Classification Test" },
  roundTypeOptions: [
    { value: "official", checked: false },
    { value: "test", checked: true }
  ],
  memberList: {
    selectedMemberIds: new Set(["player-1"]),
    teeOverrides: new Map(),
    pointsParticipation: new Map(),
    skinsParticipation: new Map()
  },
  pointsGameAmount: { value: "15" },
  skinsGameAmount: { value: "5" }
};

const settings = context.window.OGSGolf.ui.readSetupSettings(elements, [course], members);
assert(settings.roundType === "test", "Setup preserves the selected Test Round classification");
assert(settings.countsTowardStats === false, "Test rounds are explicitly excluded from official statistics");
assert(htmlSource.includes('value="official" checked'), "New rounds default to Official");
assert(htmlSource.includes('value="test"'), "Round setup offers a Test Round option");
assert(appSource.includes("find(isOfficialRound)"), "Latest Round Results filters out test rounds");
assert(!appSource.includes("const latestRound = sortCompletedRounds(result.rounds)[0]"), "Every Latest Round path excludes test rounds");
assert(historySource.includes("Official Rounds") && historySource.includes("Test Rounds"), "Round history separates official and test rounds");

console.log("Round classification test passed.");
