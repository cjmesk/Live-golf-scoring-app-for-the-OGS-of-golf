const fs = require("fs");
const path = require("path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

function functionSource(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  const end = appSource.indexOf(`\nfunction ${nextName}`, start);
  if (start < 0 || end <= start) throw new Error(`${name} function is present.`);
  return appSource.slice(start, end);
}

const enterScorerSource = functionSource("enterScorer", "changeScorerOrCommissionerGroup");
const changeScorerSource = functionSource("changeScorerOrCommissionerGroup", "showSaveStatus");

if (enterScorerSource.includes("commissionerMode = false")) {
  throw new Error("Selecting a scorer must not turn off an active Commissioner session.");
}

if (!enterScorerSource.includes("scorerStorage.setCommissionerMode(enteringAsCommissioner)")) {
  throw new Error("Scorer entry must preserve the existing Commissioner session state.");
}

if (!changeScorerSource.includes("if (commissionerMode)")) {
  throw new Error("Changing groups must retain Commissioner access when it is active.");
}

if (!changeScorerSource.includes("showCommissionerGroupSelection({ refresh: false })")) {
  throw new Error("A Commissioner changing scorer must return to the group chooser.");
}

if (!appSource.includes('elements.changeScorer.addEventListener("click", changeScorerOrCommissionerGroup)')) {
  throw new Error("The standard change-scorer control must use the persistent Commissioner route.");
}

if (!appSource.includes('elements.changeScorerQuick.addEventListener("click", changeScorerOrCommissionerGroup)')) {
  throw new Error("The mobile change-scorer control must use the persistent Commissioner route.");
}

console.log("Commissioner session persistence test passed.");
