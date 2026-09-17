const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
global.OGSGolf = {};

const source = fs.readFileSync(path.join(__dirname, "..", "src/data/course.js"), "utf8");
vm.runInThisContext(source, { filename: "src/data/course.js" });

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

const course = window.OGSGolf.data.courses.find((item) => item.id === "fighting-joe");

if (!course) {
  throw new Error("The Fighting Joe course is available in the course list");
}

assertEqual(course.name, "The Fighting Joe at The Shoals", "Course name matches The Shoals listing");
assertEqual(course.par, 72, "Course par matches the official scorecard");
assertEqual(course.scorecardSource, "https://www.rtjgolf.com/scorecards", "Official scorecard source is recorded");
assertEqual(course.defaultTeeId, "white", "Players without a matching preferred tee start from White, not Black");
assertEqual(course.teeOrder.join(","), "black,purple,orange,white,gold,teal", "All six tees are selectable in order");

const expectedTeeData = {
  black: { yards: 8092, rating: 78.6, slope: 146 },
  purple: { yards: 7256, rating: 74.5, slope: 139 },
  orange: { yards: 6768, rating: 72.1, slope: 134 },
  white: { yards: 6294, rating: 70.0, slope: 124 },
  gold: { yards: 5595, rating: 67.6, slope: 120 },
  teal: { yards: 4911, rating: 64.2, slope: 113 }
};

Object.entries(expectedTeeData).forEach(([teeId, expected]) => {
  assertEqual(course.tees[teeId].length, 18, `${teeId} tee has all 18 holes`);
  assertEqual(course.teeRatings[teeId].totalYardage, expected.yards, `${teeId} tee yardage is exact`);
  assertEqual(course.teeRatings[teeId].courseRating, expected.rating, `${teeId} tee rating is exact`);
  assertEqual(course.teeRatings[teeId].slopeRating, expected.slope, `${teeId} tee slope is exact`);
});

assertEqual(course.teeRatings.teal.genderRatings.women.courseRating, 69.1, "Ladies Teal rating is preserved");
assertEqual(course.teeRatings.teal.genderRatings.women.slopeRating, 117, "Ladies Teal slope is preserved");
assertEqual(course.tees.white.map((hole) => hole.handicap).sort((a, b) => a - b).join(","),
  "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18",
  "Hole handicaps include every stroke index exactly once");

console.log("Fighting Joe course data test passed.");
