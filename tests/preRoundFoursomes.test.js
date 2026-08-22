const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    throw new Error(message);
  }
}

assertIncludes(html, 'id="startRound" type="button" class="save-button start-button">Build Foursomes</button>',
  "Round setup must lead commissioners to foursome assignment before starting");
assertIncludes(html, '<h2 id="groupSetupTitle">Build Foursomes</h2>',
  "The pre-round group screen must identify itself as the foursome builder");
assertIncludes(html, 'id="beginGroupedRound" type="button" class="save-button">Review Foursomes</button>',
  "Foursomes must be reviewed before the Start Round confirmation");

const foursomeButtonIndex = html.indexOf('id="startRound"');
const startRoundConfirmationIndex = html.indexOf('id="confirmStartRound"');

if (foursomeButtonIndex < 0 || startRoundConfirmationIndex < 0 || foursomeButtonIndex >= startRoundConfirmationIndex) {
  throw new Error("Build Foursomes must appear before the final Start Round action");
}

console.log("Pre-round foursomes test passed.");
