const fs = require("fs");
const path = require("path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

if (!appSource.includes('const showRosterCloudStatus = screenName === "setup" || screenName === "players";')) {
  throw new Error("Roster cloud status must be limited to setup and player management screens.");
}

if (!appSource.includes('elements.rosterCloudStatus.classList.toggle("is-hidden", !showRosterCloudStatus);')) {
  throw new Error("Scorer selection must hide the unrelated roster cloud status.");
}

console.log("scorer screen roster-status test passed");
