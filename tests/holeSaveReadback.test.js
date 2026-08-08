const fs = require("fs");
const path = require("path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const functionStart = appSource.indexOf("async function saveHoleScoresToCloud");
const functionEnd = appSource.indexOf("\nfunction mergeActiveRound", functionStart);
const saveHoleSource = appSource.slice(functionStart, functionEnd);

if (functionStart < 0 || functionEnd < 0) {
  throw new Error("Could not find saveHoleScoresToCloud in src/app.js.");
}

if (!saveHoleSource.includes('const writeVerified = verifyCloudReadBack({')) {
  throw new Error("The hole save must verify the database write response.");
}

const fallbackCount = (saveHoleSource.match(/scores: saveResult\.scores,/g) || []).length;
if (fallbackCount < 2) {
  throw new Error("A delayed or mismatched follow-up read-back must use the confirmed write response.");
}

if (/reason: "readback-mismatch"/.test(saveHoleSource)) {
  throw new Error("A follow-up read-back mismatch must not turn a confirmed save into a failure.");
}

console.log("hole save read-back fallback tests passed");
