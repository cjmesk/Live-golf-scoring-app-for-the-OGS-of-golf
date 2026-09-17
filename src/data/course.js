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

const fightingJoeParByHole = [5, 4, 4, 4, 3, 4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3];
const fightingJoeHandicapByHole = [3, 9, 7, 13, 15, 5, 1, 11, 17, 6, 14, 2, 16, 10, 12, 8, 4, 18];
const fightingJoeBlackYardages = [611, 466, 478, 426, 236, 497, 607, 477, 236, 489, 413, 716, 223, 476, 466, 483, 592, 200];
const fightingJoePurpleYardages = [567, 413, 416, 379, 193, 468, 576, 434, 190, 468, 389, 622, 195, 417, 397, 437, 537, 158];
const fightingJoeOrangeYardages = [540, 388, 396, 360, 175, 432, 537, 406, 157, 428, 345, 581, 184, 403, 379, 423, 483, 151];
const fightingJoeWhiteYardages = [512, 370, 373, 326, 160, 408, 524, 375, 145, 412, 332, 505, 163, 369, 353, 390, 440, 137];
const fightingJoeGoldYardages = [400, 347, 324, 313, 137, 330, 467, 332, 118, 357, 310, 450, 153, 319, 326, 370, 416, 126];
const fightingJoeTealYardages = [390, 302, 316, 279, 133, 325, 408, 283, 101, 256, 255, 441, 136, 244, 260, 304, 377, 101];

const hamptonCoveHighlandsParByHole = [4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 3, 4, 4, 4, 5, 3, 5, 4];
const hamptonCoveHighlandsHandicapByHole = [5, 15, 17, 9, 7, 1, 3, 13, 11, 4, 14, 16, 12, 2, 18, 10, 6, 8];
const hamptonCoveHighlandsWomenHandicapByHole = [5, 9, 11, 15, 7, 1, 3, 17, 13, 14, 18, 6, 2, 8, 10, 16, 4, 12];
const hamptonCoveHighlandsPurpleYardages = [409, 403, 550, 215, 412, 435, 453, 238, 526, 461, 206, 435, 415, 414, 539, 259, 621, 437];
const hamptonCoveHighlandsOrangeYardages = [394, 372, 518, 183, 378, 406, 424, 190, 511, 434, 177, 347, 391, 382, 520, 211, 570, 398];
const hamptonCoveHighlandsWhiteYardages = [372, 330, 452, 165, 334, 381, 387, 158, 444, 371, 154, 308, 336, 342, 470, 161, 541, 364];
const hamptonCoveHighlandsGoldYardages = [347, 303, 445, 128, 285, 354, 341, 141, 416, 337, 138, 300, 320, 307, 431, 132, 480, 330];
const hamptonCoveHighlandsTealYardages = [309, 303, 377, 94, 273, 336, 318, 94, 361, 257, 108, 265, 319, 298, 390, 101, 475, 304];

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
  },
  {
    id: "fighting-joe",
    name: "The Fighting Joe at The Shoals",
    par: 72,
    scorecardSource: "https://www.rtjgolf.com/scorecards",
    defaultTeeId: "white",
    teeOrder: ["black", "purple", "orange", "white", "gold", "teal"],
    teeRatings: {
      black: buildTeeSummary("Black", fightingJoeBlackYardages, 78.6, 146, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 78.6, slopeRating: 146 }
      }, fightingJoeParByHole),
      purple: buildTeeSummary("Purple", fightingJoePurpleYardages, 74.5, 139, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 74.5, slopeRating: 139 }
      }, fightingJoeParByHole),
      orange: buildTeeSummary("Orange", fightingJoeOrangeYardages, 72.1, 134, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 72.1, slopeRating: 134 }
      }, fightingJoeParByHole),
      white: buildTeeSummary("White", fightingJoeWhiteYardages, 70.0, 124, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 70.0, slopeRating: 124 }
      }, fightingJoeParByHole),
      gold: buildTeeSummary("Gold", fightingJoeGoldYardages, 67.6, 120, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 67.6, slopeRating: 120 }
      }, fightingJoeParByHole),
      teal: buildTeeSummary("Teal", fightingJoeTealYardages, 64.2, 113, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 64.2, slopeRating: 113 },
        women: { courseRating: 69.1, slopeRating: 117 }
      }, fightingJoeParByHole)
    },
    tees: {
      black: buildTeeHoles(fightingJoeBlackYardages, "Official RTJ Golf Trail scorecard", fightingJoeParByHole, fightingJoeHandicapByHole),
      purple: buildTeeHoles(fightingJoePurpleYardages, "Official RTJ Golf Trail scorecard", fightingJoeParByHole, fightingJoeHandicapByHole),
      orange: buildTeeHoles(fightingJoeOrangeYardages, "Official RTJ Golf Trail scorecard", fightingJoeParByHole, fightingJoeHandicapByHole),
      white: buildTeeHoles(fightingJoeWhiteYardages, "Official RTJ Golf Trail scorecard", fightingJoeParByHole, fightingJoeHandicapByHole),
      gold: buildTeeHoles(fightingJoeGoldYardages, "Official RTJ Golf Trail scorecard", fightingJoeParByHole, fightingJoeHandicapByHole),
      teal: buildTeeHoles(fightingJoeTealYardages, "Official RTJ Golf Trail scorecard", fightingJoeParByHole, fightingJoeHandicapByHole)
    }
  },
  {
    id: "hampton-cove-highlands",
    name: "The Highlands at Hampton Cove",
    par: 72,
    scorecardSource: "https://www.rtjgolf.com/scorecards",
    defaultTeeId: "white",
    womenHandicapByHole: hamptonCoveHighlandsWomenHandicapByHole,
    teeOrder: ["purple", "orange", "white", "gold", "teal"],
    teeRatings: {
      purple: buildTeeSummary("Purple", hamptonCoveHighlandsPurpleYardages, 76.2, 143, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 76.2, slopeRating: 143 }
      }, hamptonCoveHighlandsParByHole),
      orange: buildTeeSummary("Orange", hamptonCoveHighlandsOrangeYardages, 73.4, 138, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 73.4, slopeRating: 138 }
      }, hamptonCoveHighlandsParByHole),
      white: buildTeeSummary("White", hamptonCoveHighlandsWhiteYardages, 70.9, 130, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 70.9, slopeRating: 130 },
        women: { courseRating: 76.9, slopeRating: 136 }
      }, hamptonCoveHighlandsParByHole),
      gold: buildTeeSummary("Gold", hamptonCoveHighlandsGoldYardages, 67.8, 126, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 67.8, slopeRating: 126 },
        women: { courseRating: 73.7, slopeRating: 129 }
      }, hamptonCoveHighlandsParByHole),
      teal: buildTeeSummary("Teal", hamptonCoveHighlandsTealYardages, 65.0, 120, "Official RTJ Golf Trail scorecard", {
        men: { courseRating: 65.0, slopeRating: 120 },
        women: { courseRating: 70.2, slopeRating: 120 }
      }, hamptonCoveHighlandsParByHole)
    },
    tees: {
      purple: buildTeeHoles(hamptonCoveHighlandsPurpleYardages, "Official RTJ Golf Trail scorecard", hamptonCoveHighlandsParByHole, hamptonCoveHighlandsHandicapByHole),
      orange: buildTeeHoles(hamptonCoveHighlandsOrangeYardages, "Official RTJ Golf Trail scorecard", hamptonCoveHighlandsParByHole, hamptonCoveHighlandsHandicapByHole),
      white: buildTeeHoles(hamptonCoveHighlandsWhiteYardages, "Official RTJ Golf Trail scorecard", hamptonCoveHighlandsParByHole, hamptonCoveHighlandsHandicapByHole),
      gold: buildTeeHoles(hamptonCoveHighlandsGoldYardages, "Official RTJ Golf Trail scorecard", hamptonCoveHighlandsParByHole, hamptonCoveHighlandsHandicapByHole),
      teal: buildTeeHoles(hamptonCoveHighlandsTealYardages, "Official RTJ Golf Trail scorecard", hamptonCoveHighlandsParByHole, hamptonCoveHighlandsHandicapByHole)
    }
  }
];

window.OGSGolf.data.course = window.OGSGolf.data.courses[0];
