const fs = require("fs");
const path = require("path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const storageSource = fs.readFileSync(path.join(__dirname, "..", "src", "state", "roundStorage.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

assertIncludes(html, 'id="saveRoundSetup"', "Pre-round review must offer Save Setup for Later.");
assertIncludes(storageSource, 'setupDraftKey: "ogsGolfRoundSetupDraft"', "Setup drafts must use storage separate from active rounds.");
assertIncludes(appSource, "roundStorage.saveSetupDraft(savedSetup)", "Saving must persist the reviewed setup.");
assertIncludes(appSource, '"Resume Round Setup"', "Today's Round must identify a saved setup.");
assertIncludes(appSource, "roundStorage.clearSetupDraft()", "Starting the round must remove its saved setup draft.");

const saveStart = appSource.indexOf("function saveRoundSetupForLater()");
const saveEnd = appSource.indexOf("\nasync function beginGroupedRound", saveStart);
const saveSource = appSource.slice(saveStart, saveEnd);
if (saveSource.includes("autoSaveUnfinishedRound") || saveSource.includes("roundCloudService")) {
  throw new Error("Saving a setup draft must not publish or start an active cloud round.");
}

console.log("Pre-round Save Setup for Later test passed.");
