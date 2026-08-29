const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "groupSetupView.js"), "utf8");
const context = { window: { OGSGolf: { ui: {} } } };
vm.createContext(context);
vm.runInContext(source, context);

const elements = {
  groupSetupList: {
    groupCount: 0,
    innerHTML: "",
    querySelector(selector) {
      const playerId = selector.match(/data-group-player="([^"]+)"/)?.[1];
      if (!playerId) return null;
      const selectPattern = new RegExp(`data-group-player="${playerId}"[\\s\\S]*?<option value="(\\d+)" selected>`);
      const value = this.innerHTML.match(selectPattern)?.[1];
      return value ? { value } : null;
    }
  },
  groupSetupCount: { textContent: "" },
  groupSetupStatus: { textContent: "" },
  removeGroup: { disabled: false },
  addGroup: { disabled: false },
  groupScorerList: { innerHTML: "", querySelector: () => null }
};

const players = [
  { id: "alan", name: "Alan", tee: "white", handicap: 8, setupGroupNumber: 2 },
  { id: "ben", name: "Ben", tee: "white", handicap: 9, setupGroupNumber: 1 },
  { id: "chris", name: "Chris", tee: "white", handicap: 10, setupGroupNumber: 2 },
  { id: "dave", name: "Dave", tee: "white", handicap: 11, setupGroupNumber: 1 }
];

context.window.OGSGolf.ui.renderGroupSetupView(elements, {
  players,
  format: "standard",
  groupCount: 2,
  groups: []
});

function selectedGroupFor(playerId) {
  const selectPattern = new RegExp(`data-group-player="${playerId}"[\\s\\S]*?<option value="(\\d+)" selected>`);
  return Number(elements.groupSetupList.innerHTML.match(selectPattern)?.[1]);
}

if (selectedGroupFor("alan") !== 2 || selectedGroupFor("chris") !== 2) {
  throw new Error("Players selected for Group 2 must arrive in Group 2 on Build Foursomes.");
}

if (selectedGroupFor("ben") !== 1 || selectedGroupFor("dave") !== 1) {
  throw new Error("Players selected for Group 1 must arrive in Group 1 on Build Foursomes.");
}

console.log("Selected setup groups carry into Build Foursomes test passed.");
