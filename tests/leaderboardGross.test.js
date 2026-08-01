const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
global.OGSGolf = {};

[
  "src/rules/points.js",
  "src/rules/handicap.js",
  "src/rules/skins.js",
  "src/state/roundState.js",
  "src/ui/holeView.js",
  "src/ui/leaderboardView.js",
  "src/ui/finalSummaryView.js"
].forEach((filePath) => {
  const source = fs.readFileSync(path.join(__dirname, "..", filePath), "utf8");
  vm.runInThisContext(source, { filename: filePath });
});

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${expected}, received ${actual}`);
  }
}

assertEqual(window.OGSGolf.rules.getHoleResult(1, 5), "Condor", "Four under or better");
assertEqual(window.OGSGolf.rules.getHoleResult(2, 5), "Albatross", "Three under");
assertEqual(window.OGSGolf.rules.getHoleResult(3, 5), "Eagle", "Two under");
assertEqual(window.OGSGolf.rules.getHoleResult(4, 5), "Birdie", "One under");
assertEqual(window.OGSGolf.rules.getHoleResult(5, 5), "Par", "Even par");
assertEqual(window.OGSGolf.rules.getHoleResult(6, 5), "Bogey", "One over");
assertEqual(window.OGSGolf.rules.getHoleResult(7, 5), "Double Bogey", "Two over");
assertEqual(window.OGSGolf.rules.getHoleResult(8, 5), "Triple Bogey", "Three over");
assertEqual(window.OGSGolf.rules.getHoleResult(9, 5), "Quadruple Bogey", "Four over");
assertEqual(window.OGSGolf.rules.getHoleResult(10, 5), "+5", "Five over");
assertEqual(window.OGSGolf.rules.getPoints(2, 5), 16, "Albatross Chicago points");
assertEqual(window.OGSGolf.rules.getPoints(3, 5), 8, "Eagle Chicago points");
assertEqual(window.OGSGolf.rules.getPoints(4, 5), 4, "Birdie Chicago points");
assertEqual(window.OGSGolf.rules.getPoints(5, 5), 2, "Par Chicago points");
assertEqual(window.OGSGolf.rules.getPoints(6, 5), 1, "Bogey Chicago points");
assertEqual(window.OGSGolf.rules.getPoints(7, 5), 0, "Double bogey Chicago points");

const pars = [4, 3, 5, 4, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 4];
const course = {
  id: "test-course",
  name: "Gross Test Course",
  par: 72,
  tees: {
    white: pars.map((par, index) => ({
      hole: index + 1,
      par,
      handicap: index + 1,
      yards: 100 + index
    })),
    gold: pars.map((par, index) => ({
      hole: index + 1,
      par,
      handicap: index + 1,
      yards: 80 + index
    }))
  },
  teeRatings: {
    white: {
      courseRating: 72,
      slopeRating: 113,
      par: 72
    },
    gold: {
      courseRating: 66,
      slopeRating: 113,
      par: 72
    }
  }
};
const players = [
  { id: "player-a", name: "Player A", handicap: 0, tee: "white", inPoints: false, inSkins: false },
  { id: "player-b", name: "Player B", handicap: 0, tee: "white", inPoints: false, inSkins: false }
];
const chicagoPlayer = { id: "chicago-player", name: "Chicago Player", handicap: 10, tee: "white", inPoints: true, inSkins: false };
const chicagoRoundState = window.OGSGolf.state.createRoundState(course, [chicagoPlayer], {
  course,
  players: [chicagoPlayer],
  groups: [["chicago-player"]],
  groupRecords: [{ holesToPlay: 18 }],
  games: {
    pointsGame: { enabled: true },
    netSkins: { enabled: false }
  },
  playerStatuses: {}
});
const chicagoNineRoundState = window.OGSGolf.state.createRoundState(course, [chicagoPlayer], {
  course,
  players: [chicagoPlayer],
  groups: [["chicago-player"]],
  groupRecords: [{ holesToPlay: 9 }],
  games: {
    pointsGame: { enabled: true },
    netSkins: { enabled: false }
  },
  playerStatuses: {}
});

assertEqual(chicagoRoundState.getPointsQuota(chicagoPlayer), 26, "Chicago overall quota uses 36 minus Course Handicap");
assertEqual(chicagoRoundState.getPointsDifferential(chicagoPlayer, "front").target, 13, "Chicago front quota is half overall quota");
assertEqual(chicagoRoundState.getPointsDifferential(chicagoPlayer, "back").target, 13, "Chicago back quota is half overall quota");
assertEqual(chicagoRoundState.getPointsDifferential(chicagoPlayer, "overall").target, 26, "Chicago 18-hole overall target");
assertEqual(chicagoNineRoundState.getPointsDifferential(chicagoPlayer, "overall").target, 13, "Chicago 9-hole target is half overall quota");

const teeChangePlayer = { id: "tee-change-player", name: "Tee Change Player", handicap: 6, tee: "white", inPoints: true, inSkins: true };
const teeChangeRoundState = window.OGSGolf.state.createRoundState(course, [teeChangePlayer], {
  course,
  players: [teeChangePlayer],
  groups: [["tee-change-player"]],
  groupRecords: [{ holesToPlay: 18 }],
  games: {
    pointsGame: { enabled: true },
    netSkins: { enabled: true }
  },
  playerStatuses: {}
});

teeChangeRoundState.setDraftScore("tee-change-player", 5);
teeChangeRoundState.saveCurrentHole([teeChangePlayer]);

assertEqual(teeChangeRoundState.savedScores["tee-change-player"][0], 5, "Tee change test starts with saved gross score");
assertEqual(teeChangeRoundState.courseHandicaps["tee-change-player"], 6, "White tee course handicap is based on the starting tee");
assertEqual(teeChangeRoundState.getPlayerHoleResult(teeChangePlayer, 0).strokesReceived, 1, "White tee strokes are applied before tee change");
assertEqual(teeChangeRoundState.getPlayerHoleResult(teeChangePlayer, 0).netScore, 4, "White tee net score is gross minus stroke");

const teeUpdate = teeChangeRoundState.updateRoundPlayerTee("tee-change-player", "gold");

assertEqual(Boolean(teeUpdate), true, "Round-only tee update returns a result");
assertEqual(teeChangePlayer.tee, "gold", "Round-only player tee changes to selected tee");
assertEqual(teeChangeRoundState.savedScores["tee-change-player"][0], 5, "Gross score is preserved after tee change");
assertEqual(teeChangeRoundState.courseHandicaps["tee-change-player"], 0, "Course handicap recalculates from the new tee");
assertEqual(teeChangeRoundState.getPlayerHoleResult(teeChangePlayer, 0).strokesReceived, 0, "Strokes received rebuild from the new tee");
assertEqual(teeChangeRoundState.getPlayerHoleResult(teeChangePlayer, 0).netScore, 5, "Net score recalculates without changing gross score");
assertEqual(teeChangeRoundState.getPointsDifferential(teeChangePlayer, "overall").target, 36, "Chicago target recalculates from the new course handicap");

const roundState = window.OGSGolf.state.createRoundState(course, players, {
  course,
  players,
  games: {
    pointsGame: { enabled: false },
    netSkins: { enabled: false }
  },
  playerStatuses: {}
});
const playerAScores = [5, 4, 3, 6, 4, 5];
const playerBScores = [4, 3, 3, 5, 4, 4];

roundState.applyCloudHoleScores([
  ...playerAScores.map((gross, index) => ({
    player_id: "player-a",
    hole: index + 1,
    gross,
    strokes_received: 0,
    net: gross
  })),
  ...playerBScores.map((gross, index) => ({
    player_id: "player-b",
    hole: index + 1,
    gross,
    strokes_received: 0,
    net: gross
  }))
]);

const playerATotals = roundState.getPlayerTotals(players[0]);
const playerBTotals = roundState.getPlayerTotals(players[1]);

assertEqual(pars.slice(0, 6).reduce((total, par) => total + par, 0), 23, "Course par through six holes");
assertEqual(playerATotals.gross, 27, "Player A live gross must use entered scores");
assertEqual(playerBTotals.gross, 23, "Player B live gross must use entered scores");
assertEqual(playerATotals.frontGross, 27, "Player A front gross must use entered scores");
assertEqual(playerBTotals.frontGross, 23, "Player B front gross must use entered scores");
assertEqual(playerATotals.net, 27, "Player A net must use entered gross scores");
assertEqual(playerBTotals.net, 23, "Player B net must use entered gross scores");
assertEqual(playerATotals.holesPlayed, 6, "Player A holes played");
assertEqual(playerBTotals.holesPlayed, 6, "Player B holes played");

const leaderboardElement = {
  innerHTML: "",
  rows: [],
  appendChild(row) {
    row.onChildAppend = (html) => {
      this.innerHTML += html;
    };
    this.rows.push(row);
    this.innerHTML += row.innerHTML;
  }
};

global.document = {
  createElement() {
    return {
      className: "",
      innerHTML: "",
      appendChild(child) {
        this.innerHTML += child.innerHTML;
        if (typeof this.onChildAppend === "function") {
          this.onChildAppend(child.innerHTML);
        }
      },
      insertAdjacentHTML(_position, html) {
        this.innerHTML += html;
        if (typeof this.onChildAppend === "function") {
          this.onChildAppend(html);
        }
      }
    };
  }
};

window.OGSGolf.ui.renderLeaderboard({ leaderboard: leaderboardElement }, players, roundState);

if (!leaderboardElement.innerHTML.includes("Strokes 27")) {
  throw new Error("Rendered leaderboard did not show Player A strokes 27.");
}

if (!leaderboardElement.innerHTML.includes("Strokes 23")) {
  throw new Error("Rendered leaderboard did not show Player B strokes 23.");
}

if (!leaderboardElement.innerHTML.includes("+4 to par")) {
  throw new Error("Rendered leaderboard did not show Player A +4 to par.");
}

if (!leaderboardElement.innerHTML.includes("Even")) {
  throw new Error("Rendered leaderboard did not show Player B Even.");
}

console.log("Leaderboard gross test passed.");

const entryRoundState = window.OGSGolf.state.createRoundState(course, players, {
  course,
  players,
  games: {
    pointsGame: { enabled: false },
    netSkins: { enabled: false }
  },
  playerStatuses: {}
});
const entryElements = {
  holeTitle: { textContent: "" },
  holeDetails: { innerHTML: "" },
  previousHole: { disabled: false },
  nextHole: { disabled: false },
  holePlayers: {
    innerHTML: "",
    children: [],
    appendChild(row) {
      this.children.push(row);
      this.innerHTML += row.innerHTML;
    }
  }
};

window.OGSGolf.ui.renderHoleView(entryElements, course, players, entryRoundState);

playerAScores.forEach((score, index) => {
  entryRoundState.goToHole(index);
  entryRoundState.setDraftScore("player-a", score);
  entryRoundState.setDraftScore("player-b", playerBScores[index]);
  entryRoundState.saveCurrentHole(players);
});

const entryLeaderboardElement = {
  innerHTML: "",
  rows: [],
  appendChild(row) {
    row.onChildAppend = (html) => {
      this.innerHTML += html;
    };
    this.rows.push(row);
    this.innerHTML += row.innerHTML;
  }
};

window.OGSGolf.ui.renderLeaderboard({ leaderboard: entryLeaderboardElement }, players, entryRoundState);

if (!entryLeaderboardElement.innerHTML.includes("Strokes 27")) {
  throw new Error("Actual score-entry path did not render Player A strokes 27.");
}

if (!entryLeaderboardElement.innerHTML.includes("Strokes 23")) {
  throw new Error("Actual score-entry path did not render Player B strokes 23.");
}

console.log("Leaderboard score-entry integration test passed.");

const savePathRoundState = window.OGSGolf.state.createRoundState(course, players, {
  course,
  players,
  games: {
    pointsGame: { enabled: false },
    netSkins: { enabled: false }
  },
  playerStatuses: {}
});
const displayedParForPlayerA = savePathRoundState.draftScores["player-a"];

savePathRoundState.setDraftScore("player-b", 9);
savePathRoundState.saveCurrentHole(players);

const localStorageShape = savePathRoundState.getAutoSaveExport();
const playerASavedGross = savePathRoundState.savedScores["player-a"][0];
const playerBSavedGross = savePathRoundState.savedScores["player-b"][0];
const playerALocalGross = localStorageShape.savedScores["player-a"][0];
const playerBLocalGross = localStorageShape.savedScores["player-b"][0];

assertEqual(displayedParForPlayerA, 4, "Player A displayed par for Hole 1");
assertEqual(playerASavedGross, displayedParForPlayerA, "Player A untouched displayed par must save as gross");
assertEqual(playerBSavedGross, 9, "Player B changed score must save as gross 9");
assertEqual(playerALocalGross, displayedParForPlayerA, "Player A localStorage-shaped gross");
assertEqual(playerBLocalGross, 9, "Player B localStorage-shaped gross");

const savePathLeaderboardElement = {
  innerHTML: "",
  rows: [],
  sections: [],
  appendChild(row) {
    row.onChildAppend = (html) => {
      this.innerHTML += html;
    };
    if (row.className === "leaderboard-subsection") {
      this.sections.push(row);
    } else {
      this.rows.push(row);
    }
    this.innerHTML += row.innerHTML;
  }
};

window.OGSGolf.ui.renderLeaderboard({ leaderboard: savePathLeaderboardElement }, players, savePathRoundState);

if (!savePathLeaderboardElement.innerHTML.includes("Strokes 4")) {
  throw new Error("Actual save path did not render Player A strokes 4.");
}

if (!savePathLeaderboardElement.innerHTML.includes("Strokes 9")) {
  throw new Error("Actual save path did not render Player B strokes 9.");
}

console.log("Displayed-score save path test passed.");

const splitLeaderboardPlayers = [
  { id: "gross-only", name: "Gross Only", handicap: 0, tee: "white", inPoints: false, inSkins: false },
  { id: "points-player", name: "Points Player", handicap: 0, tee: "white", inPoints: true, inSkins: false },
  { id: "tie-player", name: "Tie Player", handicap: 0, tee: "white", inPoints: true, inSkins: false }
];
const splitLeaderboardRoundState = window.OGSGolf.state.createRoundState(course, splitLeaderboardPlayers, {
  course,
  players: splitLeaderboardPlayers,
  groups: [["gross-only", "points-player", "tie-player"]],
  groupRecords: [{ holesToPlay: 18 }],
  games: {
    pointsGame: { enabled: true },
    netSkins: { enabled: false }
  },
  playerStatuses: {}
});

splitLeaderboardRoundState.applyCloudHoleScores([
  { player_id: "gross-only", hole: 1, gross: 4, strokes_received: 0, net: 4 },
  { player_id: "points-player", hole: 1, gross: 3, strokes_received: 0, net: 3 },
  { player_id: "tie-player", hole: 1, gross: 3, strokes_received: 0, net: 3 }
]);

const splitLeaderboardElement = {
  innerHTML: "",
  sections: [],
  appendChild(section) {
    section.onChildAppend = (html) => {
      this.innerHTML += html;
    };
    this.sections.push(section);
    this.innerHTML += section.innerHTML;
  }
};

window.OGSGolf.ui.renderLeaderboard({ leaderboard: splitLeaderboardElement }, splitLeaderboardPlayers, splitLeaderboardRoundState);

if (!splitLeaderboardElement.innerHTML.includes("Gross Leaderboard")) {
  throw new Error("Leaderboard did not render a separate Gross Leaderboard section.");
}

if (!splitLeaderboardElement.innerHTML.includes("Points Leaderboard")) {
  throw new Error("Leaderboard did not render a separate Points Leaderboard section.");
}

const grossSection = splitLeaderboardElement.sections.find((section) => section.innerHTML.includes("Gross Leaderboard"));
const pointsSection = splitLeaderboardElement.sections.find((section) => section.innerHTML.includes("Points Leaderboard"));

if (splitLeaderboardElement.sections.indexOf(pointsSection) > splitLeaderboardElement.sections.indexOf(grossSection)) {
  throw new Error("Points leaderboard must appear above Gross leaderboard when points players exist.");
}

if (!grossSection.innerHTML.includes("Gross Only") || !grossSection.innerHTML.includes("Points Player") || !grossSection.innerHTML.includes("Tie Player")) {
  throw new Error("Gross leaderboard must include every player.");
}

if (grossSection.innerHTML.indexOf("Points Player") > grossSection.innerHTML.indexOf("Gross Only")) {
  throw new Error("Gross leaderboard must rank better score-to-par above roster order.");
}

if (!grossSection.innerHTML.includes("<div class=\"rank\">T1</div>")) {
  throw new Error("Gross leaderboard must display tied players with tied rank labels.");
}

if (pointsSection.innerHTML.includes("Gross Only") || !pointsSection.innerHTML.includes("Points Player") || !pointsSection.innerHTML.includes("Tie Player")) {
  throw new Error("Chicago points leaderboard must include only points participants.");
}

if (!pointsSection.innerHTML.includes("<div class=\"rank\">T1</div>")) {
  throw new Error("Chicago points leaderboard must display tied players with tied rank labels.");
}

if (!pointsSection.innerHTML.includes("Front: 4 pts (Target: 18)")
  || !pointsSection.innerHTML.includes("Total: 4 pts (Target: 36)")) {
  throw new Error("Live Points leaderboard must show points earned, target, and result in the uniform format.");
}

console.log("Split gross and Chicago leaderboard test passed.");

const finalSummaryRoundState = window.OGSGolf.state.createRoundState(course, splitLeaderboardPlayers, {
  course,
  players: splitLeaderboardPlayers,
  groups: [["gross-only", "points-player", "tie-player"]],
  groupRecords: [{ holesToPlay: 18 }],
  games: {
    pointsGame: { enabled: true },
    netSkins: { enabled: false }
  },
  playerStatuses: {}
});

finalSummaryRoundState.applyCloudHoleScores([
  ...pars.map((par, index) => ({
    player_id: "gross-only",
    hole: index + 1,
    gross: par,
    strokes_received: 0,
    net: par
  })),
  ...pars.map((par, index) => ({
    player_id: "points-player",
    hole: index + 1,
    gross: par - 1,
    strokes_received: 0,
    net: par - 1
  })),
  ...pars.map((par, index) => ({
    player_id: "tie-player",
    hole: index + 1,
    gross: par,
    strokes_received: 0,
    net: par
  }))
]);

const finalSummaryElement = { innerHTML: "" };
window.OGSGolf.ui.renderFinalSummary({ finalSummary: finalSummaryElement }, finalSummaryRoundState);
const finalSummaryText = finalSummaryElement.innerHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

if (finalSummaryElement.innerHTML.indexOf("Points Results") > finalSummaryElement.innerHTML.indexOf("Gross Results")) {
  throw new Error("Round Complete page must show Points Results above Gross Results.");
}

if (finalSummaryElement.innerHTML.includes("Gross Only</span>\n        <strong>") && finalSummaryElement.innerHTML.indexOf("Gross Only") < finalSummaryElement.innerHTML.indexOf("Gross Results")) {
  throw new Error("Points Results must not include players who are not in the points game.");
}

if (!finalSummaryElement.innerHTML.includes("Overall Points")
  || !finalSummaryElement.innerHTML.includes("Front Nine Points")
  || !finalSummaryElement.innerHTML.includes("Back Nine Points")) {
  throw new Error("Round Complete page must show overall, front, and back points sections.");
}

if (finalSummaryElement.innerHTML.indexOf("Overall Points") > finalSummaryElement.innerHTML.indexOf("Gross Results")
  || finalSummaryElement.innerHTML.indexOf("Front Nine Points") > finalSummaryElement.innerHTML.indexOf("Gross Results")
  || finalSummaryElement.innerHTML.indexOf("Back Nine Points") > finalSummaryElement.innerHTML.indexOf("Gross Results")) {
  throw new Error("All Points sections must appear above Gross Results.");
}

if (finalSummaryElement.innerHTML.indexOf("Full Points Standings") < finalSummaryElement.innerHTML.indexOf("Back Nine Points")) {
  throw new Error("Full points standings must appear below the top-three points sections.");
}

if (!finalSummaryText.includes("1. Points Player")
  || !finalSummaryText.includes("2. Tie Player")) {
  throw new Error("Points Results must rank the best quota result first.");
}

if (!finalSummaryText.includes("72 points / 36 needed")
  || !finalSummaryText.includes("36 points / 18 needed")) {
  throw new Error("Points Results must show points earned and points needed to break even.");
}

const exportedRound = finalSummaryRoundState.getRoundExport();

if (!exportedRound.pointsResults?.standings?.length) {
  throw new Error("Completed round export must preserve points result standings.");
}

console.log("Final points results test passed.");
