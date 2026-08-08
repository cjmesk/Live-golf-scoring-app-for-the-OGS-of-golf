const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");

if (!htmlSource.includes('data-menu-action="today">Today\'s Round</button>')) {
  throw new Error("The main menu must provide one Today's Round destination.");
}

if (!htmlSource.includes('data-menu-action="previous">Round History</button>')) {
  throw new Error("The main menu must provide one Round History destination.");
}

for (const removedAction of ["scoring", "leaderboard", "lastResults"]) {
  if (htmlSource.includes(`data-menu-action="${removedAction}"`)) {
    throw new Error(`The duplicate ${removedAction} menu destination must be removed.`);
  }
}

if (!appSource.includes('elements.todayLastRoundResults.addEventListener("click", showPreviousRounds);')) {
  throw new Error("The home-page history shortcut must open the consolidated Round History.");
}

if (!htmlSource.includes('<h2 id="previousRoundsTitle">Round History</h2>')) {
  throw new Error("The archive screen must use the consolidated Round History title.");
}

console.log("navigation consolidation tests passed");
