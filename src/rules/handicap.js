window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.rules = window.OGSGolf.rules || {};

window.OGSGolf.rules.parseHandicapIndex = function parseHandicapIndex(value) {
  const input = String(value ?? "").trim();
  if (!input) return NaN;

  const numericValue = Number(input);
  if (!Number.isFinite(numericValue)) return NaN;
  return input.startsWith("+") ? -Math.abs(numericValue) : numericValue;
};

window.OGSGolf.rules.formatHandicapIndex = function formatHandicapIndex(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";

  const absoluteText = Number.isInteger(Math.abs(numericValue))
    ? String(Math.abs(numericValue))
    : String(Math.abs(numericValue));
  return numericValue < 0 ? `+${absoluteText}` : absoluteText;
};

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
  const roundedHandicap = Number(courseHandicap) < 0
    ? -Math.round(Math.abs(Number(courseHandicap)))
    : Math.round(Number(courseHandicap) || 0);
  const strokeIndex = Math.max(1, Math.min(18, Number(holeHandicap) || 1));
  if (roundedHandicap === 0) return 0;

  if (roundedHandicap < 0) {
    const strokesToGive = Math.abs(roundedHandicap);
    const fullRounds = Math.floor(strokesToGive / 18);
    const extraStrokes = strokesToGive % 18;
    return -(fullRounds + (extraStrokes > 0 && strokeIndex > 18 - extraStrokes ? 1 : 0));
  }

  // Handicap holes are ranked 1 through 18. A player with a Course Handicap of
  // 12 gets one stroke on holes ranked 1 through 12. A player with a Course
  // Handicap of 20 gets one stroke on every hole, plus a second stroke on the
  // holes ranked 1 and 2.
  const fullRounds = Math.floor(roundedHandicap / 18);
  const extraStrokes = roundedHandicap % 18;

  return fullRounds + (strokeIndex <= extraStrokes ? 1 : 0);
};

window.OGSGolf.rules.getNetScore = function getNetScore(grossScore, strokesReceived) {
  if (grossScore === null || grossScore === undefined) return null;
  return Number(grossScore) - strokesReceived;
};
