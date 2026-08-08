const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");

if (!htmlSource.includes('id="resetScores" type="button" class="reset-button is-hidden"')) {
  throw new Error("The device reset control must start hidden before app initialization.");
}

if (!appSource.includes('elements.resetScores.classList.toggle("is-hidden", !commissionerMode || !roundState);')) {
  throw new Error("The device reset control must require Commissioner Mode and an active round.");
}

if (!appSource.includes("if (!commissionerMode || !roundState)")) {
  throw new Error("Reset confirmation must recheck commissioner access and active-round state.");
}

if (!htmlSource.includes("The shared cloud round and its saved scores will not be deleted.")) {
  throw new Error("The reset warning must explain that shared cloud scores are preserved.");
}

console.log("reset visibility and safety tests passed");
