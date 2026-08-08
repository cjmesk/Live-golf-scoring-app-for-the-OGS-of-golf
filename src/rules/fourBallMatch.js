window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.rules = window.OGSGolf.rules || {};

(function registerFourBallMatchRules() {
  function roundHandicap(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.round(numericValue);
  }

  function getSettings(roundSettings = {}) {
    const saved = roundSettings.fourBallMatch || {};
    const holes = Number(saved.holes) === 9 ? 9 : 18;
    const startingHole = holes === 9 && Number(saved.startingHole) === 10 ? 10 : 1;

    return {
      enabled: saved.enabled === true || roundSettings.format === "four-ball-match",
      holes,
      startingHole,
      scoring: saved.scoring === "gross" ? "gross" : "net",
      handicapSource: saved.handicapSource === "manual" ? "manual" : "automatic",
      allowance: Math.max(0, Math.min(100, Number(saved.allowance ?? 90))),
      teamALabel: String(saved.teamALabel || "Team A"),
      teamBLabel: String(saved.teamBLabel || "Team B")
    };
  }

  function buildHoleSequence(settings) {
    return Array.from({ length: settings.holes }, (_, index) =>
      ((settings.startingHole - 1 + index) % 18) + 1
    );
  }

  function getPlayingHandicaps(players, courseHandicaps, roundSettings) {
    const settings = getSettings(roundSettings);
    const handicaps = {};

    if (settings.scoring === "gross") {
      players.forEach((player) => { handicaps[player.id] = 0; });
      return handicaps;
    }

    if (settings.handicapSource === "manual") {
      players.forEach((player) => {
        handicaps[player.id] = roundHandicap(player.matchPlayingHandicap);
      });
      return handicaps;
    }

    const values = players.map((player) => Number(courseHandicaps[player.id] ?? player.courseHandicap ?? 0));
    const lowest = values.length ? Math.min(...values) : 0;

    players.forEach((player) => {
      const courseHandicap = Number(courseHandicaps[player.id] ?? player.courseHandicap ?? 0);
      handicaps[player.id] = roundHandicap(
        (courseHandicap - lowest) * (settings.allowance / 100) * (settings.holes / 18)
      );
    });

    return handicaps;
  }

  function getStrokesOnHole(playingHandicap, strokeIndex, holes = 18) {
    const handicap = Math.max(0, roundHandicap(playingHandicap));
    const holeRank = Math.max(1, Number(strokeIndex) || 1);
    const holeCount = Number(holes) === 9 ? 9 : 18;
    return Math.floor(handicap / holeCount) + (holeRank <= handicap % holeCount ? 1 : 0);
  }

  function isScore(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) > 0;
  }

  function getSummary({ players, savedScores, course, courseHandicaps, roundSettings }) {
    const settings = getSettings(roundSettings);
    const sequence = buildHoleSequence(settings);
    const playingHandicaps = getPlayingHandicaps(players, courseHandicaps, roundSettings);
    const teams = {
      A: players.filter((player) => player.matchTeam === "A"),
      B: players.filter((player) => player.matchTeam === "B")
    };
    const holeResults = [];
    let teamAWins = 0;
    let teamBWins = 0;

    sequence.forEach((holeNumber) => {
      const holeIndex = holeNumber - 1;
      const sideScores = {};

      ["A", "B"].forEach((teamId) => {
        const scores = teams[teamId]
          .map((player) => {
            const gross = savedScores[player.id]?.[holeIndex];
            if (!isScore(gross)) return null;
            const hole = course.tees[player.tee][holeIndex];
            const rankedHoles = sequence
              .map((number) => ({ number, handicap: Number(course.tees[player.tee][number - 1].handicap) }))
              .sort((first, second) => first.handicap - second.handicap);
            const matchStrokeIndex = rankedHoles.findIndex((item) => item.number === holeNumber) + 1;
            const strokes = settings.scoring === "net"
              ? getStrokesOnHole(playingHandicaps[player.id], matchStrokeIndex, settings.holes)
              : 0;
            return { playerId: player.id, gross: Number(gross), strokes, score: Number(gross) - strokes };
          })
          .filter(Boolean);
        sideScores[teamId] = scores.length ? Math.min(...scores.map((score) => score.score)) : null;
      });

      if (sideScores.A === null || sideScores.B === null) return;

      const winner = sideScores.A < sideScores.B ? "A" : sideScores.B < sideScores.A ? "B" : "tie";
      if (winner === "A") teamAWins += 1;
      if (winner === "B") teamBWins += 1;
      holeResults.push({ hole: holeNumber, teamAScore: sideScores.A, teamBScore: sideScores.B, winner });
    });

    const holesPlayed = holeResults.length;
    const holesRemaining = Math.max(0, settings.holes - holesPlayed);
    const lead = teamAWins - teamBWins;
    const leader = lead > 0 ? "A" : lead < 0 ? "B" : null;
    const margin = Math.abs(lead);
    const decidedEarly = margin > holesRemaining;
    const complete = decidedEarly || holesPlayed >= settings.holes;
    const dormie = !complete && margin > 0 && margin === holesRemaining;
    let status = holesPlayed === 0 ? "Match not started" : "Tied";
    let result = "";

    if (leader) {
      const label = leader === "A" ? settings.teamALabel : settings.teamBLabel;
      status = `${label} ${margin} Up${dormie ? " (Dormie)" : ""}`;
    }
    if (!complete && holesPlayed > 0) status += ` through ${holesPlayed}`;

    if (complete) {
      if (!leader) {
        result = "Match Tied";
        status = result;
      } else {
        const label = leader === "A" ? settings.teamALabel : settings.teamBLabel;
        result = decidedEarly ? `${label} wins ${margin} & ${holesRemaining}` : `${label} wins ${margin} Up`;
        status = result;
      }
    }

    return {
      settings,
      teams,
      playingHandicaps,
      holeResults,
      teamAWins,
      teamBWins,
      holesPlayed,
      holesRemaining,
      lead,
      leader,
      margin,
      dormie,
      complete,
      status,
      result
    };
  }

  window.OGSGolf.rules.fourBallMatch = {
    getSettings,
    buildHoleSequence,
    getPlayingHandicaps,
    getStrokesOnHole,
    getSummary
  };
})();
