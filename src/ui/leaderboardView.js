window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

function formatLeaderboardHandicap(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return window.OGSGolf.ui.formatHandicapIndex
    ? window.OGSGolf.ui.formatHandicapIndex(number)
    : (number < 0 ? `+${Math.abs(number)}` : String(number));
}

window.OGSGolf.ui.renderLeaderboard = function renderLeaderboard(elements, players, roundState) {
  const pointsEnabled = roundState.roundSettings.games.pointsGame.enabled;
  const skinsEnabled = roundState.roundSettings.games.netSkins?.enabled === true;
  const totalHoles = roundState.totalHoles || 18;
  const matchSummary = roundState.getFourBallMatchSummary?.();

  function isSavedScore(score) {
    const numericScore = Number(score);
    return score !== null
      && score !== undefined
      && score !== ""
      && Number.isFinite(numericScore)
      && numericScore > 0;
  }

  function getScoreToPar(player) {
    const savedScores = roundState.savedScores[player.id] || [];
    const savedHoles = savedScores
      .map((score, index) => ({ score, index }))
      .filter((item) => isSavedScore(item.score));
    const actualStrokes = savedHoles.reduce((total, item) => total + Number(item.score), 0);
    const parForSavedHoles = savedHoles.reduce(
      (total, item) => total + Number(roundState.getHoleForPlayer(player, item.index).par),
      0
    );
    const toPar = actualStrokes - parForSavedHoles;

    return {
      actualStrokes,
      holesCompleted: savedHoles.length,
      toPar,
      display: savedHoles.length === 0
        ? "-"
        : toPar === 0
          ? "Even"
          : `${toPar > 0 ? "+" : ""}${toPar} to par`
    };
  }

  function getGameStatus(player) {
    return [
      roundState.isInSkins(player) ? "Skins" : "Not in Skins",
      roundState.isInPoints(player) ? "Points" : "Not in Points",
      player.inTeamChallenge === true ? "Team Event" : "Not in Team Event"
    ].join(" | ");
  }

  function makeSection(title) {
    const section = document.createElement("section");
    section.className = "leaderboard-subsection";
    section.innerHTML = `<h3>${title}</h3>`;
    elements.leaderboard.appendChild(section);
    return section;
  }

  function renderPlayerNameButton(player, label = player.name) {
    return `<button type="button" class="player-name player-scorecard-link" data-open-player-scorecard="${player.id}">${label}</button>`;
  }

  function addRankLabels(standings, isTie) {
    let currentRank = 1;

    return standings.map((standing, index) => {
      const tiedWithPrevious = index > 0 && isTie(standing, standings[index - 1]);
      const tiedWithNext = index < standings.length - 1 && isTie(standing, standings[index + 1]);

      if (!tiedWithPrevious) {
        currentRank = index + 1;
      }

      return {
        ...standing,
        rank: currentRank,
        rankLabel: tiedWithPrevious || tiedWithNext ? `T${currentRank}` : String(currentRank)
      };
    });
  }

  function renderGrossRow(section, standing) {
    const { player, totals, scoreToPar } = standing;
    const isDnf = roundState.isPlayerDnf(player);
    const dnfText = roundState.formatDnfStatus(player);
    const row = document.createElement("div");

    row.className = "leaderboard-row";
    row.innerHTML = `
      <div class="rank">${standing.rankLabel}</div>
      <div>
        ${renderPlayerNameButton(player)}
        <div class="player-details">Index ${formatLeaderboardHandicap(player.handicap)} | Course Handicap ${formatLeaderboardHandicap(roundState.courseHandicaps[player.id])} | ${player.tee} tees</div>
        <div class="player-details">${isDnf ? dnfText : `${totals.holesPlayed}/${totalHoles} holes saved`}</div>
        <div class="player-details">${getGameStatus(player)}</div>
      </div>
      <div class="leaderboard-totals">
        ${isDnf ? `<span class="points">DNF</span>` : ""}
        <span class="gross">Strokes ${scoreToPar.holesCompleted === 0 ? "-" : scoreToPar.actualStrokes}</span>
        <span class="gross">${scoreToPar.holesCompleted}/${totalHoles} holes</span>
        <span class="gross">${scoreToPar.display}</span>
      </div>
    `;
    section.appendChild(row);
  }

  function renderPointsRow(section, standing) {
    const { player, totals } = standing;
    const frontPointsResult = roundState.getPointsDifferential(player, "front");
    const backPointsResult = roundState.getPointsDifferential(player, "back");
    const overallPointsResult = standing.pointsResult;
    const row = document.createElement("div");

    row.className = "leaderboard-row leaderboard-points-row";
    row.innerHTML = `
      <div class="rank">${standing.rankLabel}</div>
      <div>
        ${renderPlayerNameButton(player, `${player.name} ${overallPointsResult.display}`)}
        <div class="player-details">Front: ${totals.frontPoints} pts (Target: ${frontPointsResult.target}) ${frontPointsResult.display}</div>
        <div class="player-details">Back: ${totals.backPoints} pts (Target: ${backPointsResult.target}) ${backPointsResult.display}</div>
        <div class="player-details">Total: ${totals.points} pts (Target: ${overallPointsResult.target}) ${overallPointsResult.display}</div>
        <div class="player-details">${totals.holesPlayed}/${totalHoles} holes saved</div>
      </div>
      <div class="leaderboard-totals">
        <span class="points">${overallPointsResult.display}</span>
        <span class="gross">${totals.points} pts</span>
      </div>
    `;
    section.appendChild(row);
  }

  function formatCurrency(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? `$${numericValue.toFixed(2)}` : "$0.00";
  }

  function formatSkinHoleDetails(details = []) {
    if (!details.length) return "-";

    return details
      .map((detail) => {
        const skinsNetScore = detail.skinsNetScore ?? detail.skinScore ?? detail.netScore;
        const netText = Number.isFinite(Number(skinsNetScore))
          ? ` — Net ${skinsNetScore}`
          : "";
        return `Hole ${detail.hole}${netText}`;
      })
      .join(", ");
  }

  function renderSkinsRow(section, standing, payoutSummary) {
    const { player, skins } = standing;
    const winnerPayout = payoutSummary?.skins?.winners?.find((winner) => winner.playerId === player.id);
    const estimatedText = winnerPayout && payoutSummary.skins.totalWinningSkins > 0
      ? `Estimated value: ${formatCurrency(winnerPayout.payout)}`
      : "Estimated value: -";
    const row = document.createElement("div");

    row.className = "leaderboard-row leaderboard-skins-row";
    row.innerHTML = `
      <div class="rank">${standing.rankLabel}</div>
      <div>
        ${renderPlayerNameButton(player)}
        <div class="player-details">${skins.totalSkins} skin${skins.totalSkins === 1 ? "" : "s"} won</div>
        <div class="player-details">${formatSkinHoleDetails(skins.holesWonDetails)}</div>
        <div class="player-details">${estimatedText}</div>
      </div>
      <div class="leaderboard-totals">
        <span class="points">${skins.totalSkins}</span>
        <span class="gross">skins</span>
      </div>
    `;
    section.appendChild(row);
  }

  const grossStandings = addRankLabels(players
    .map((player) => ({
      player,
      totals: roundState.getPlayerTotals(player),
      scoreToPar: getScoreToPar(player)
    }))
    .sort((a, b) => {
      if (a.scoreToPar.holesCompleted === 0 && b.scoreToPar.holesCompleted > 0) {
        return 1;
      }

      if (b.scoreToPar.holesCompleted === 0 && a.scoreToPar.holesCompleted > 0) {
        return -1;
      }

      if (a.scoreToPar.toPar !== b.scoreToPar.toPar) {
        return a.scoreToPar.toPar - b.scoreToPar.toPar;
      }

      if (a.scoreToPar.actualStrokes !== b.scoreToPar.actualStrokes) {
        return a.scoreToPar.actualStrokes - b.scoreToPar.actualStrokes;
      }

      return a.player.name.localeCompare(b.player.name);
    }), (a, b) =>
      a.scoreToPar.toPar === b.scoreToPar.toPar
      && a.scoreToPar.actualStrokes === b.scoreToPar.actualStrokes
    );
  const pointsStandings = addRankLabels(players
    .filter((player) => pointsEnabled && roundState.isInPoints(player) && !roundState.isPlayerDnf(player))
    .map((player) => ({
      player,
      totals: roundState.getPlayerTotals(player),
      pointsResult: roundState.getPointsDifferential(player, "overall")
    }))
    .sort((a, b) => {
      if (b.pointsResult.differential !== a.pointsResult.differential) {
        return b.pointsResult.differential - a.pointsResult.differential;
      }

      if (b.totals.points !== a.totals.points) {
        return b.totals.points - a.totals.points;
      }

      return a.player.name.localeCompare(b.player.name);
    }), (a, b) =>
      a.pointsResult.differential === b.pointsResult.differential
      && a.totals.points === b.totals.points
    );
  const skinSummary = roundState.getSkinSummary();
  const payoutSummary = roundState.getPayoutSummary?.();
  const skinsStandings = addRankLabels(players
    .filter((player) => skinsEnabled && roundState.isInSkins(player) && !roundState.isPlayerDnf(player))
    .map((player) => ({
      player,
      skins: skinSummary[player.id] || {
        totalSkins: 0,
        holesWon: [],
        holesWonDetails: []
      }
    }))
    .sort((a, b) => {
      if (b.skins.totalSkins !== a.skins.totalSkins) {
        return b.skins.totalSkins - a.skins.totalSkins;
      }

      return a.player.name.localeCompare(b.player.name);
    }), (a, b) => a.skins.totalSkins === b.skins.totalSkins
    );

  elements.leaderboard.innerHTML = "";

  if (matchSummary?.settings.enabled) {
    const matchSection = makeSection("Four-Ball Match Play");
    const teamAPlayers = matchSummary.teams.A.map((player) => player.name).join(" / ");
    const teamBPlayers = matchSummary.teams.B.map((player) => player.name).join(" / ");
    const holeRows = matchSummary.holeResults.map((hole) => `
      <div class="summary-row">
        <span>Hole ${hole.hole}</span>
        <strong>${hole.teamAScore} - ${hole.teamBScore}</strong>
        <small>${hole.winner === "tie" ? "Tied" : `${hole.winner === "A" ? matchSummary.settings.teamALabel : matchSummary.settings.teamBLabel} won`}</small>
      </div>
    `).join("");
    matchSection.innerHTML += `
      <div class="match-score-card">
        <div class="summary-card"><span>${matchSummary.settings.teamALabel}</span><strong>${teamAPlayers}</strong></div>
        <div class="summary-card"><span>${matchSummary.settings.teamBLabel}</span><strong>${teamBPlayers}</strong></div>
        <div class="summary-card"><span>Match Status</span><strong>${matchSummary.status}</strong><small>${matchSummary.settings.holes} holes | ${matchSummary.settings.scoring === "net" ? `Net, ${matchSummary.settings.allowance}% allowance` : "Gross"}</small></div>
      </div>
      <div class="summary-list">${holeRows || '<div class="empty-state">No match holes saved yet.</div>'}</div>
    `;
  }

  if (pointsStandings.length > 0) {
    const pointsSection = makeSection("Points Leaderboard");
    pointsStandings.forEach((standing) => renderPointsRow(pointsSection, standing));
  }

  if (skinsEnabled) {
    const skinsSection = makeSection("Skins Leaderboard");
    if (skinsStandings.some((standing) => standing.skins.totalSkins > 0)) {
      skinsStandings.forEach((standing) => renderSkinsRow(skinsSection, standing, payoutSummary));
    } else {
      skinsSection.innerHTML += `
        <div class="leaderboard-row">
          <div>
            <div class="player-name">No skins won yet</div>
            <div class="player-details">A skin appears after a completed hole has one unique net winner.</div>
          </div>
        </div>
      `;
    }
  }

  const grossSection = makeSection("Gross Leaderboard");
  grossStandings.forEach((standing) => renderGrossRow(grossSection, standing));
};
