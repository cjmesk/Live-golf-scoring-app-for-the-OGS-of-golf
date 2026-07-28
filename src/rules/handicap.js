window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.rules = window.OGSGolf.rules || {};

window.OGSGolf.rules.getCourseHandicapDetails = function getCourseHandicapDetails(player, course, teeId = player.tee) {
  const teeRating = course.teeRatings[teeId];
  const teePar = teeRating.par || course.par;
  const handicapIndex = Number(player.handicapIndex ?? player.handicap) || 0;
  const unrounded = handicapIndex * (teeRating.slopeRating / 113) + (teeRating.courseRating - teePar);

  return {
    handicapIndex,
    teeId,
    courseRating: teeRating.courseRating,
    slopeRating: teeRating.slopeRating,
    par: teePar,
    unrounded,
    courseHandicap: Math.round(unrounded)
  };
};

window.OGSGolf.rules.getCourseHandicap = function getCourseHandicap(player, course) {
  // Course Handicap turns a player's Handicap Index into the number of strokes
  // they receive from a specific tee. Slope adjusts for difficulty compared with
  // an average course. Course Rating minus par adjusts when the tee plays easier
  // or harder than par.
  return window.OGSGolf.rules.getCourseHandicapDetails(player, course).courseHandicap;
};

window.OGSGolf.rules.getStrokesOnHole = function getStrokesOnHole(courseHandicap, holeHandicap) {
  if (courseHandicap <= 0) return 0;

  // Handicap holes are ranked 1 through 18. A player with a Course Handicap of
  // 12 gets one stroke on holes ranked 1 through 12. A player with a Course
  // Handicap of 20 gets one stroke on every hole, plus a second stroke on the
  // holes ranked 1 and 2.
  const fullRounds = Math.floor(courseHandicap / 18);
  const extraStrokes = courseHandicap % 18;

  return fullRounds + (holeHandicap <= extraStrokes ? 1 : 0);
};

window.OGSGolf.rules.getNetScore = function getNetScore(grossScore, strokesReceived) {
  if (grossScore === null || grossScore === undefined) return null;
  return Number(grossScore) - strokesReceived;
};
