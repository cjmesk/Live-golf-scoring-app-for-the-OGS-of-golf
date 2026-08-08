const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
const domSource = fs.readFileSync(path.join(root, "src", "ui", "dom.js"), "utf8");

for (const label of ["Today's Round - In Progress", "Today's Results - Complete", "View Today's Results", "View Live Leaderboard", "Enter Scores"]) {
  if (!appSource.includes(label) && !htmlSource.includes(label)) {
    throw new Error(`Missing status-aware Today screen label: ${label}`);
  }
}

if (!appSource.includes("return uniqueRounds.find(wasCompletedToday) || null;")) {
  throw new Error("Today's completed result must be recovered from saved Round History.");
}

if (!appSource.includes('title: "Today\'s Results"')) {
  throw new Error("A completed Today screen must open final results directly.");
}

if (!appSource.includes('elements.viewLiveMatch.addEventListener("click", openTodayRoundPrimaryAction);')) {
  throw new Error("The Today primary action must route according to round status.");
}

if (!domSource.includes('todayTitle: document.querySelector("#todayTitle")')) {
  throw new Error("The dynamic Today screen title must be available to the controller.");
}

console.log("status-aware Today's Round tests passed");
