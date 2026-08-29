const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
global.OGSGolf = {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "src/rules/handicap.js"), "utf8"));

const rules = window.OGSGolf.rules;
if (rules.parseHandicapIndex("+3.0") !== -3) throw new Error("+3.0 must be stored as mathematical -3.0.");
if (rules.parseHandicapIndex("3.0") !== 3) throw new Error("Plain 3.0 must remain a regular three handicap.");
if (rules.formatHandicapIndex(-3) !== "+3") throw new Error("A plus handicap must display with a plus sign.");
if (rules.getStrokesOnHole(-3, 18) !== -1 || rules.getStrokesOnHole(-3, 17) !== -1 || rules.getStrokesOnHole(-3, 16) !== -1) {
  throw new Error("A plus-three Course Handicap must give strokes on indexes 18, 17, and 16.");
}
if (rules.getStrokesOnHole(-3, 15) !== 0) throw new Error("A plus-three must not give a stroke on index 15.");
if (rules.getNetScore(4, -1) !== 5) throw new Error("Giving a stroke back must add one to the net score.");

const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
if (!htmlSource.includes("Enter +3.0 for a plus-three golfer")) {
  throw new Error("Player Management must explain how to enter a plus handicap.");
}

console.log("plus-handicap entry and USGA stroke-allocation tests passed");
