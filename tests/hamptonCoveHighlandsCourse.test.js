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

const course = window.OGSGolf.data.courses.find((item) => item.id === "hampton-cove-highlands");

if (!course) {
  throw new Error("The Highlands at Hampton Cove is available in the course list");
}

assertEqual(course.name, "The Highlands at Hampton Cove", "Course name matches the Hampton Cove listing");
assertEqual(course.par, 72, "Course par matches the official scorecard");
assertEqual(course.scorecardSource, "https://www.rtjgolf.com/scorecards", "Official scorecard source is recorded");
assertEqual(course.defaultTeeId, "white", "Players without a matching preferred tee start from White");
assertEqual(course.teeOrder.join(","), "purple,orange,white,gold,teal", "All five tees are selectable in order");

const expectedTeeData = {
  purple: { yards: 7428, rating: 76.2, slope: 143 },
  orange: { yards: 6806, rating: 73.4, slope: 138 },
  white: { yards: 6070, rating: 70.9, slope: 130 },
  gold: { yards: 5535, rating: 67.8, slope: 126 },
  teal: { yards: 4982, rating: 65.0, slope: 120 }
};

Object.entries(expectedTeeData).forEach(([teeId, expected]) => {
  assertEqual(course.tees[teeId].length, 18, `${teeId} tee has all 18 holes`);
  assertEqual(course.teeRatings[teeId].totalYardage, expected.yards, `${teeId} tee yardage is exact`);
  assertEqual(course.teeRatings[teeId].courseRating, expected.rating, `${teeId} tee rating is exact`);
  assertEqual(course.teeRatings[teeId].slopeRating, expected.slope, `${teeId} tee slope is exact`);
});

assertEqual(course.teeRatings.white.genderRatings.women.courseRating, 76.9, "Ladies White rating is preserved");
assertEqual(course.teeRatings.gold.genderRatings.women.slopeRating, 129, "Ladies Gold slope is preserved");
assertEqual(course.teeRatings.teal.genderRatings.women.courseRating, 70.2, "Ladies Teal rating is preserved");
assertEqual(course.tees.white.map((hole) => hole.handicap).sort((a, b) => a - b).join(","),
  "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18",
  "Men's hole handicaps include every stroke index exactly once");
assertEqual([...course.womenHandicapByHole].sort((a, b) => a - b).join(","),
  "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18",
  "Ladies hole handicaps are preserved from the official card");

console.log("Hampton Cove Highlands course data test passed.");
