const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "previousRoundsView.js"), "utf8");

if (!source.includes("<h3>Latest Completed Round</h3>")) {
  throw new Error("Round History must feature the newest completed round first.");
}

if (!source.includes('renderRoundCards([latestRound], { latest: true })')) {
  throw new Error("The latest-round card must use the newest timestamp-sorted round.");
}

if (!source.includes('Players (${playerCount}): ${playerNames.join(", ")')) {
  throw new Error("History cards must identify rounds by player names.");
}

if (!source.includes('Game: ${roundName || formatLabel}')) {
  throw new Error("History cards must identify the saved game format or round name.");
}

console.log("latest Round History card tests passed");
