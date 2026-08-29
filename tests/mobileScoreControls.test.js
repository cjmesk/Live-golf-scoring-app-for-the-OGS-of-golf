const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const cssSource = fs.readFileSync(path.join(root, "src", "styles", "main.css"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const stepButtonRule = cssSource.match(/\.step-button\s*\{\s*width:\s*64px;([^}]*)\}/)?.[1] || "";

if (!stepButtonRule.includes("touch-action: manipulation;")) {
  throw new Error("Score step buttons must suppress browser double-tap zoom.");
}

if (!stepButtonRule.includes("user-select: none;") || !stepButtonRule.includes("-webkit-touch-callout: none;")) {
  throw new Error("Repeated score taps must not select text or open the iOS touch callout.");
}

if (!htmlSource.includes("src/styles/main.css?v=20260829-active-group-changes")) {
  throw new Error("The mobile score-control CSS fix must use a fresh cache version.");
}

console.log("mobile score-control interaction tests passed");
