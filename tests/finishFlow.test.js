const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");

if (!htmlSource.includes('id="saveRound" type="button" class="save-button is-hidden"')) {
  throw new Error("The redundant final-score confirmation must stay hidden.");
}

if (!htmlSource.includes('id="saveRoundCloud" type="button" class="save-button is-hidden">Retry Cloud Save')) {
  throw new Error("Cloud save should appear only as a retry action.");
}

if (!appSource.includes('elements.summaryPreviousRounds.classList.remove("is-hidden");')) {
  throw new Error("Previous Rounds must remain available from reopened results.");
}

if (!appSource.includes('elements.saveRoundCloud.classList.remove("is-hidden");')) {
  throw new Error("A failed automatic cloud save must expose the retry action.");
}

if (!htmlSource.includes("Round History")) {
  throw new Error("Completed rounds must link to the consolidated Round History.");
}

console.log("finish flow tests passed");
