const fs = require("fs");
const path = require("path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "src/app.js"), "utf8");
const start = appSource.indexOf("async function showLeaderboard()");
const end = appSource.indexOf("\nfunction showSimpleScreen", start);
const showLeaderboardSource = appSource.slice(start, end);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(start >= 0 && end > start, "showLeaderboard function is present");
assert(
  !showLeaderboardSource.includes("showLiveScoring"),
  "Leaderboard access must not use the scorer identity route"
);
assert(
  showLeaderboardSource.indexOf("loadActiveRoundFromCloudFirst")
    < showLeaderboardSource.indexOf("if (roundState)"),
  "Leaderboard checks for a new active cloud round before using saved device state"
);
assert(
  showLeaderboardSource.indexOf("loadActiveRoundFromCloudFirst")
    < showLeaderboardSource.indexOf("if (summaryDisplayRoundState)"),
  "Active cloud rounds take priority over completed-round fallback results"
);
assert(
  showLeaderboardSource.includes("loadCompletedRoundsForNavigation"),
  "Leaderboard falls back to cloud completed rounds when no active round is loaded"
);
assert(
  showLeaderboardSource.includes("checkCompletedRoundFromCloud"),
  "Leaderboard checks whether a phone's active snapshot has become a completed cloud round"
);
assert(
  showLeaderboardSource.includes("showLeaderboardPage"),
  "Leaderboard renders the public view directly"
);

const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert(
  htmlSource.includes("src/app.js?v=20260829-active-round-usga"),
  "The active-round leaderboard fix has a new mobile cache version"
);

console.log("Public leaderboard access test passed.");
