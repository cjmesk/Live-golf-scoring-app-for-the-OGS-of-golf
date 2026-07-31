window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.data = window.OGSGolf.data || {};

const twelveStonesParByHole = [4, 3, 5, 4, 4, 3, 5, 4, 4, 5, 4, 4, 4, 5, 3, 4, 3, 4];
const twelveStonesHandicapByHole = [6, 4, 8, 14, 18, 12, 2, 16, 10, 9, 7, 5, 13, 3, 17, 11, 15, 1];

function buildTeeHoles(yardages, status = "verified", parByHole = twelveStonesParByHole, handicapByHole = twelveStonesHandicapByHole) {
  return parByHole.map((par, index) => ({
    hole: index + 1,
    par,
    handicap: handicapByHole[index],
    yards: yardages[index],
    status
  }));
}

function getTotalYardage(yardages) {
  if (yardages.some((yards) => yards === null)) {
    return null;
  }

  return yardages.reduce((total, yards) => total + yards, 0);
}

function buildTeeSummary(label, yardages, courseRating, slopeRating, status = "verified", genderRatings = {}, parByHole = twelveStonesParByHole) {
  return {
    label,
    par: parByHole.reduce((total, par) => total + par, 0),
    totalYardage: getTotalYardage(yardages),
    courseRating,
    slopeRating,
    genderRatings,
    status
  };
}

const blackYardages = [424, 203, 537, 375, 295, 228, 534, 367, 395, 539, 434, 388, 319, 589, 165, 407, 192, 436];
const silverYardages = [396, 183, 520, 352, 245, 198, 512, 330, 371, 515, 404, 362, 291, 549, 153, 398, 178, 401];
const whiteYardages = [364, 155, 454, 331, 201, 184, 485, 304, 363, 474, 378, 338, 267, 492, 142, 376, 167, 367];
const goldYardages = [331, 131, 437, 324, 195, 164, 442, 263, 324, 444, 373, 315, 237, 448, 136, 351, 161, 338];
const redYardages = [287, 107, 419, 290, 188, 139, 400, 229, 319, 418, 322, 271, 221, 441, 109, 311, 147, 309];

const parkMammothParByHole = [4, 4, 5, 4, 3, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 3, 5, 4];
const parkMammothHandicapByHole = [7, 11, 1, 3, 13, 5, 17, 9, 15, 12, 18, 2, 8, 16, 6, 14, 4, 10];
const parkMammothBlackYardages = [394, 318, 564, 452, 203, 410, 164, 348, 308, 333, 109, 422, 374, 351, 389, 240, 520, 316];
const parkMammothYellowYardages = [358, 291, 512, 359, 195, 354, 140, 280, 254, 303, 96, 365, 324, 320, 335, 205, 451, 284];
const parkMammothRedYardages = [313, 215, 487, 289, 164, 312, 118, 250, 218, 256, 80, 315, 273, 292, 303, 147, 396, 236];

window.OGSGolf.data.courses = [
  {
    id: "twelve-stones",
    name: "Twelve Stones Crossing Golf Club",
    par: 72,
    teeOrder: ["black", "silver", "white", "gold", "red"],
    teeRatings: {
      black: buildTeeSummary("Black", blackYardages, 73.3, 145, "Men's rating and slope confirmed", {
        men: { courseRating: 73.3, slopeRating: 145 }
      }),
      silver: buildTeeSummary("Silver", silverYardages, 71.3, 141, "Men's rating and slope confirmed", {
        men: { courseRating: 71.3, slopeRating: 141 }
      }),
      white: buildTeeSummary("White", whiteYardages, 69.1, 132, "Men's and women's rating and slope confirmed", {
        men: { courseRating: 69.1, slopeRating: 132 },
        women: { courseRating: 75.2, slopeRating: 137 }
      }),
      gold: buildTeeSummary("Gold", goldYardages, 67.5, 122, "Men's rating and slope confirmed", {
        men: { courseRating: 67.5, slopeRating: 122 }
      }),
      red: buildTeeSummary("Red", redYardages, 70.2, 125, "Women's rating and slope confirmed", {
        women: { courseRating: 70.2, slopeRating: 125 }
      })
    },
    tees: {
      black: buildTeeHoles(blackYardages),
      silver: buildTeeHoles(silverYardages),
      white: buildTeeHoles(whiteYardages),
      gold: buildTeeHoles(goldYardages),
      red: buildTeeHoles(redYardages)
    }
  },
  {
    id: "park-mammoth",
    name: "Park Mammoth Golf Club",
    par: 70,
    teeOrder: ["black", "yellow", "red"],
    teeRatings: {
      black: buildTeeSummary("Black", parkMammothBlackYardages, 70.1, 127, "Public scorecard data added for weekend trip", {
        men: { courseRating: 70.1, slopeRating: 127 },
        women: { courseRating: 76.6, slopeRating: 138 }
      }, parkMammothParByHole),
      yellow: buildTeeSummary("Yellow", parkMammothYellowYardages, 66.9, 118, "Public scorecard data added for weekend trip", {
        men: { courseRating: 66.9, slopeRating: 118 },
        women: { courseRating: 72.3, slopeRating: 127 }
      }, parkMammothParByHole),
      red: buildTeeSummary("Red", parkMammothRedYardages, 63.6, 114, "Public scorecard data added for weekend trip", {
        men: { courseRating: 63.6, slopeRating: 114 },
        women: { courseRating: 68.5, slopeRating: 117 }
      }, parkMammothParByHole)
    },
    tees: {
      black: buildTeeHoles(
        parkMammothBlackYardages,
        "Public scorecard data added for weekend trip",
        parkMammothParByHole,
        parkMammothHandicapByHole
      ),
      yellow: buildTeeHoles(
        parkMammothYellowYardages,
        "Public scorecard data added for weekend trip",
        parkMammothParByHole,
        parkMammothHandicapByHole
      ),
      red: buildTeeHoles(
        parkMammothRedYardages,
        "Public scorecard data added for weekend trip",
        parkMammothParByHole,
        parkMammothHandicapByHole
      )
    }
  }
];

window.OGSGolf.data.course = window.OGSGolf.data.courses[0];
