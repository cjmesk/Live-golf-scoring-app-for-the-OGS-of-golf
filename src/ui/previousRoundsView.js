window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

function getLeaderNames(winner) {
  if (!winner || !winner.leaders || winner.leaders.length === 0) {
    return "Not available";
  }

  return winner.leaders.map((item) => item.player.name).join(", ");
}

function getSkinsWinner(round) {
  if (!round.totals || round.totals.length === 0) {
    return "Not available";
  }

  const maxSkins = Math.max(...round.totals.map((total) => total.skinsWon || 0));

  if (maxSkins === 0) {
    return "No skins";
  }

  return round.totals
    .filter((total) => total.skinsWon === maxSkins)
    .map((total) => total.playerName)
    .join(", ");
}

function getRoundCompletedTime(round) {
  return new Date(
    round?.completedAt
    || round?.roundSettings?.completedAt
    || round?.savedAt
    || round?.date
    || 0
  ).getTime();
}

function getHolesPlayedLabel(round) {
  const groupHoles = (round.roundSettings?.groupRecords || [])
    .map((group) => Number(group.holesToPlay || group.requiredHoles || 0))
    .filter((holes) => Number.isFinite(holes) && holes > 0);
  const holeCount = round.holeByHole?.length || round.course?.par?.length || 0;
  const holesPlayed = groupHoles.length ? Math.max(...groupHoles) : holeCount;

  return holesPlayed ? `${holesPlayed} holes` : "Holes not available";
}

function getRoundScoresByPlayer(round) {
  const scoresByPlayer = {};

  (round.players || []).forEach((player) => {
    scoresByPlayer[player.id] = {
      playerId: player.id,
      playerName: player.name,
      dnf: player.dnf || null,
      grossScores: [],
      netScores: []
    };
  });

  if (round.savedScores) {
    Object.entries(round.savedScores).forEach(([playerId, scores]) => {
      scoresByPlayer[playerId] = scoresByPlayer[playerId] || {
        playerId,
        playerName: playerId,
        dnf: null,
        grossScores: [],
        netScores: []
      };
      scoresByPlayer[playerId].grossScores = scores || [];
    });
  }

  (round.holeByHole || []).forEach((hole, holeIndex) => {
    (hole.scores || []).forEach((score) => {
      scoresByPlayer[score.playerId] = scoresByPlayer[score.playerId] || {
        playerId: score.playerId,
        playerName: score.playerName || score.playerId,
        dnf: null,
        grossScores: [],
        netScores: []
      };
      scoresByPlayer[score.playerId].playerName = score.playerName || scoresByPlayer[score.playerId].playerName;
      scoresByPlayer[score.playerId].grossScores[holeIndex] = score.gross;
      scoresByPlayer[score.playerId].netScores[holeIndex] = score.net;
    });
  });

  return scoresByPlayer;
}

function calculateHistoryTotal(round, total) {
  const scoresByPlayer = getRoundScoresByPlayer(round);
  const scoreRecord = scoresByPlayer[total.playerId] || {};
  const grossScores = scoreRecord.grossScores || [];
  const netScores = scoreRecord.netScores || [];
  const dnf = total.dnf || scoreRecord.dnf || null;
  const scoredGross = grossScores
    .map((score, index) => ({ score, index }))
    .filter(({ score }) => score !== null && score !== undefined && Number.isFinite(Number(score)));
  const scoredNet = netScores
    .map((score, index) => ({ score, index }))
    .filter(({ score }) => score !== null && score !== undefined && Number.isFinite(Number(score)));
  const frontGrossScores = scoredGross.filter(({ index }) => index < 9);
  const backGrossScores = scoredGross.filter(({ index }) => index >= 9);
  const frontNetScores = scoredNet.filter(({ index }) => index < 9);
  const backNetScores = scoredNet.filter(({ index }) => index >= 9);
  const gross = scoredGross.reduce((sum, item) => sum + Number(item.score), 0);
  const net = scoredNet.reduce((sum, item) => sum + Number(item.score), 0);
  const requiredHoles = Math.max(round.holeByHole?.length || 0, grossScores.length || 0, 18);
  const shouldRecalculate =
    scoredGross.length > 0
    && (!total.holesPlayed || total.gross === 0 || total.gross === null || total.gross === undefined);

  if (!shouldRecalculate) {
    return total;
  }

  return {
    ...total,
    playerName: total.playerName || scoreRecord.playerName,
    gross,
    frontGross: frontGrossScores.length >= 9
      ? frontGrossScores.reduce((sum, item) => sum + Number(item.score), 0)
      : null,
    backGross: backGrossScores.length >= 9
      ? backGrossScores.reduce((sum, item) => sum + Number(item.score), 0)
      : null,
    frontGrossHoles: frontGrossScores.length,
    backGrossHoles: backGrossScores.length,
    net: scoredNet.length >= requiredHoles && !dnf ? net : null,
    frontNet: frontNetScores.length >= 9
      ? frontNetScores.reduce((sum, item) => sum + Number(item.score), 0)
      : null,
    backNet: backNetScores.length >= 9
      ? backNetScores.reduce((sum, item) => sum + Number(item.score), 0)
      : null,
    holesPlayed: scoredGross.length,
    dnf: dnf ? {
      ...dnf,
      holesCompleted: dnf.holesCompleted ?? scoredGross.length,
      grossStrokes: dnf.grossStrokes ?? gross
    } : null
  };
}

function getHistoryTotals(round) {
  return (round.totals || []).map((total) => calculateHistoryTotal(round, total));
}

function formatPreviousGross(total) {
  if (total.dnf) {
    return `DNF · ${total.dnf.holesCompleted} holes · ${total.dnf.grossStrokes} strokes`;
  }

  const holesPlayed = total.holesPlayed || 18;
  const grossText = holesPlayed >= 18
    ? `Gross ${total.gross}`
    : `Gross ${total.gross} through ${holesPlayed} holes`;
  const frontText = total.frontGrossHoles && total.frontGrossHoles < 9
    ? `Front ${total.frontGross} through ${total.frontGrossHoles}`
    : `Front ${total.frontGross ?? "-"}`;
  const backText = total.backGrossHoles && total.backGrossHoles < 9
    ? `Back ${total.backGross} through ${total.backGrossHoles}`
    : `Back ${total.backGross ?? "-"}`;

  const frontNet = total.frontNet === null || total.frontNet === undefined ? "Front Net -" : `Front Net ${total.frontNet}`;
  const backNet = total.backNet === null || total.backNet === undefined ? "Back Net -" : `Back Net ${total.backNet}`;
  const net = total.net === null || total.net === undefined ? "Net -" : `Net ${total.net}`;

  return `${grossText} | ${frontText} | ${backText} | ${frontNet} | ${backNet} | ${net}`;
}

window.OGSGolf.ui.renderPreviousRounds = function renderPreviousRounds(elements, rounds) {
  const sortedRounds = [...rounds].sort((a, b) => getRoundCompletedTime(b) - getRoundCompletedTime(a));

  if (sortedRounds.length === 0) {
    elements.previousRoundsList.innerHTML = `
      <div class="empty-state">No completed rounds saved yet.</div>
    `;
    return;
  }

  const isTestRound = (round) => round.roundType === "test"
    || round.roundSettings?.roundType === "test"
    || round.countsTowardStats === false;
  const getFormatLabel = (round) => {
    const format = round.roundSettings?.format;
    if (format === "four-ball-match") return "Four-Ball Match Play";
    if (format === "standard") return "Standard Stroke Play";
    return round.roundSettings?.roundName || "Golf Round";
  };
  const renderRoundCards = (roundList, { latest = false } = {}) => roundList
    .map((round) => {
      const roundDate = new Date(round.date).toLocaleDateString();
      const courseName = round.course?.name || "Unknown course";
      const playerNames = (round.players || []).map((player) => player.name).filter(Boolean);
      const playerCount = playerNames.length;
      const completedAt = round.completedAt || round.roundSettings?.completedAt;
      const completedLabel = completedAt
        ? `Completed ${new Date(completedAt).toLocaleString()}`
        : "Completed round";
      const testRound = isTestRound(round);
      const roundName = round.roundSettings?.roundName?.trim();
      const formatLabel = getFormatLabel(round);

      return `
        <article class="previous-round-card previous-round-card-button${latest ? " latest-round-card" : ""}" data-open-completed-round-id="${round.id}">
          <div class="previous-round-header">
            <div>
              ${latest ? "<span><b>Newest completed round</b></span>" : ""}
              <strong>${courseName}</strong>
              <span>${roundDate}</span>
              <span>${testRound ? "Test Round - excluded from official statistics" : "Official Round"}</span>
            </div>
            <button type="button" class="secondary-button compact-button" data-open-completed-round-id="${round.id}">
              ${latest ? "Open Latest Results" : "Open Results"}
            </button>
          </div>
          <div class="player-details">Game: ${roundName || formatLabel}</div>
          <div class="player-details">Players (${playerCount}): ${playerNames.join(", ") || "Names not available"}</div>
          <div class="player-details">Holes played: ${getHolesPlayedLabel(round)}</div>
          <div class="player-details">${completedLabel}</div>
        </article>
      `;
    })
    .join("");
  const officialRounds = sortedRounds.filter((round) => !isTestRound(round));
  const testRounds = sortedRounds.filter(isTestRound);
  const latestRound = sortedRounds[0];
  const olderOfficialRounds = officialRounds.filter((round) => round.id !== latestRound.id);
  const olderTestRounds = testRounds.filter((round) => round.id !== latestRound.id);

  elements.previousRoundsList.innerHTML = `
    <section class="round-history-group latest-round-group">
      <h3>Latest Completed Round</h3>
      ${renderRoundCards([latestRound], { latest: true })}
    </section>
    <section class="round-history-group">
      <h3>Official Rounds</h3>
      ${olderOfficialRounds.length ? renderRoundCards(olderOfficialRounds) : '<div class="empty-state">No other official rounds saved yet.</div>'}
    </section>
    <section class="round-history-group">
      <h3>Test Rounds</h3>
      <span class="player-details">These rounds do not count toward official statistics or winnings.</span>
      ${olderTestRounds.length ? renderRoundCards(olderTestRounds) : '<div class="empty-state">No other test rounds saved yet.</div>'}
    </section>
  `;
};
