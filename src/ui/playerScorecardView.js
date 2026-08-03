window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

window.OGSGolf.ui.renderPlayerScorecard = function renderPlayerScorecard(elements, roundState, player, options = {}) {
  const { getHoleResult, getPoints } = window.OGSGolf.rules;
  const totalHoles = roundState.totalHoles || 18;
  const payoutSummary = roundState.getPayoutSummary?.();
  const skinsSummary = roundState.getSkinSummary?.() || {};
  const playerSkins = skinsSummary[player.id] || { totalSkins: 0, holesWon: [], holesWonDetails: [] };
  const dnfStatus = roundState.getPlayerDnfStatus(player);
  const totals = roundState.getPlayerTotals(player);
  const statusText = dnfStatus
    ? "DNF"
    : roundState.isRoundComplete?.()
      ? "Complete"
      : "In Progress";
  const returnLabel = options.returnLabel || "Back";

  function formatCurrency(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? `$${numericValue.toFixed(2)}` : "-";
  }

  function formatSigned(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "-";
    if (numericValue === 0) return "Even";
    return `${numericValue > 0 ? "+" : ""}${numericValue}`;
  }

  function hasScore(score) {
    return score !== null
      && score !== undefined
      && score !== ""
      && Number.isFinite(Number(score))
      && Number(score) > 0;
  }

  function getPlayerPointsPayout(section) {
    const payouts = payoutSummary?.points?.[`${section}Payouts`]
      || payoutSummary?.points?.[section]?.payouts
      || payoutSummary?.points?.[section]?.winners
      || [];
    const payout = payouts.find((winner) => winner.playerId === player.id);
    return Number(payout?.payout || 0);
  }

  function getPlayerSkinsPayout() {
    const payout = payoutSummary?.skins?.winners?.find((winner) => winner.playerId === player.id);
    return Number(payout?.payout || 0);
  }

  function getSideHoleIndexes(side) {
    return side === "front"
      ? Array.from({ length: 9 }, (_, index) => index)
      : Array.from({ length: 9 }, (_, index) => index + 9);
  }

  function buildHoleSequence(startingHole = 1, holesToPlay = totalHoles) {
    const start = Math.max(1, Math.min(totalHoles, Number(startingHole) || 1));
    const count = Math.max(1, Math.min(totalHoles, Number(holesToPlay) || totalHoles));

    return Array.from({ length: count }, (_, index) =>
      ((start - 1 + index) % totalHoles) + 1
    );
  }

  function getPlayerRoundHoleIndexes() {
    const groupIndex = (roundState.roundSettings?.groups || []).findIndex((group) =>
      group.includes(player.id)
    );
    const groupRecord = groupIndex >= 0
      ? roundState.roundSettings?.groupRecords?.[groupIndex]
      : null;
    const sequence = groupRecord
      ? buildHoleSequence(groupRecord.startingHole || 1, groupRecord.holesToPlay || totalHoles)
      : Array.from({ length: totalHoles }, (_, index) => index + 1);

    return sequence.map((holeNumber) => holeNumber - 1);
  }

  function getSideSummary(side) {
    const holeIndexes = side === "total"
      ? Array.from({ length: totalHoles }, (_, index) => index)
      : getSideHoleIndexes(side);
    const completedIndexes = holeIndexes.filter((holeIndex) => hasScore(roundState.savedScores[player.id]?.[holeIndex]));
    const par = completedIndexes.reduce((sum, holeIndex) =>
      sum + Number(roundState.getHoleForPlayer(player, holeIndex).par || 0),
    0);
    const gross = completedIndexes.reduce((sum, holeIndex) =>
      sum + Number(roundState.savedScores[player.id]?.[holeIndex] || 0),
    0);
    const net = completedIndexes.reduce((sum, holeIndex) => {
      const result = roundState.getPlayerHoleResult(player, holeIndex);
      return Number.isFinite(Number(result?.netScore)) ? sum + Number(result.netScore) : sum;
    }, 0);
    const points = completedIndexes.reduce((sum, holeIndex) => {
      const grossScore = roundState.savedScores[player.id]?.[holeIndex];
      const hole = roundState.getHoleForPlayer(player, holeIndex);
      return sum + (roundState.isInPoints(player) && !dnfStatus ? getPoints(grossScore, hole.par) : 0);
    }, 0);
    const skinsWon = completedIndexes.filter((holeIndex) =>
      roundState.getSkinForHole(holeIndex)?.winnerId === player.id
    ).length;
    const pointsResult = side === "front" || side === "back"
      ? roundState.getPointsDifferential(player, side)
      : roundState.getPointsDifferential(player, "overall");

    return {
      holes: completedIndexes.length,
      par,
      gross,
      net,
      points,
      pointsTarget: roundState.isInPoints(player) ? pointsResult.target : null,
      pointsVsTarget: roundState.isInPoints(player) ? pointsResult.display : "-",
      grossToPar: completedIndexes.length ? gross - par : null,
      netToPar: completedIndexes.length ? net - par : null,
      skinsWon
    };
  }

  function getGrossClass(score, par) {
    if (!hasScore(score)) return "";

    const result = getHoleResult(score, par);
    if (result === "Eagle" || result === "Albatross" || result === "Condor") return "score-result-badge score-result-eagle";
    if (result === "Birdie") return "score-result-badge score-result-birdie";
    if (result === "Bogey") return "score-result-badge score-result-bogey";
    if (result === "Double Bogey" || result === "Triple Bogey" || result === "Quadruple Bogey" || result.startsWith("+")) {
      return "score-result-badge score-result-double";
    }
    return "score-result-neutral";
  }

  function renderCell(value, className = "", cellClass = "") {
    const cellClassAttribute = cellClass ? ` class="${cellClass}"` : "";
    return `<td${cellClassAttribute}>${value === null || value === undefined || value === "" ? "-" : `<span class="${className}">${value}</span>`}</td>`;
  }

  function renderHandicapDots(strokesReceived) {
    const strokeCount = Math.max(0, Math.floor(Number(strokesReceived) || 0));

    if (strokeCount === 0) return "";

    const dots = Array.from({ length: strokeCount }, () => "&bull;").join("");
    return `<span class="scorecard-stroke-dots" aria-label="${strokeCount} handicap stroke${strokeCount === 1 ? "" : "s"}">${dots}</span>`;
  }

  function renderGrossCell(score, hole, holeIndex) {
    if (!hasScore(score)) {
      return renderCell("-");
    }

    const result = roundState.getPlayerHoleResult(player, holeIndex);
    const dots = renderHandicapDots(result?.strokesReceived);
    return `<td><span class="scorecard-gross-cell"><span class="${getGrossClass(score, hole.par)}">${score}</span>${dots}</span></td>`;
  }

  function getCompletedGrossTotal(holeIndexes) {
    const completedIndexes = holeIndexes.filter((holeIndex) => hasScore(roundState.savedScores[player.id]?.[holeIndex]));

    return completedIndexes.length
      ? completedIndexes.reduce((sum, holeIndex) => sum + Number(roundState.savedScores[player.id]?.[holeIndex] || 0), 0)
      : "-";
  }

  function getCompletedParTotal(holeIndexes) {
    const completedIndexes = holeIndexes.filter((holeIndex) => hasScore(roundState.savedScores[player.id]?.[holeIndex]));

    return completedIndexes.length
      ? completedIndexes.reduce((sum, holeIndex) => sum + Number(roundState.getHoleForPlayer(player, holeIndex).par || 0), 0)
      : "-";
  }

  function getCompletedPointsTotal(holeIndexes) {
    if (!roundState.isInPoints(player) || dnfStatus) return "-";

    const completedIndexes = holeIndexes.filter((holeIndex) => hasScore(roundState.savedScores[player.id]?.[holeIndex]));

    return completedIndexes.length
      ? completedIndexes.reduce((sum, holeIndex) => {
        const grossScore = roundState.savedScores[player.id]?.[holeIndex];
        return sum + getPoints(grossScore, roundState.getHoleForPlayer(player, holeIndex).par);
      }, 0)
      : "-";
  }

  function getCompletedSkinTotal(holeIndexes) {
    const skinCount = holeIndexes.filter((holeIndex) =>
      hasScore(roundState.savedScores[player.id]?.[holeIndex])
      && roundState.getSkinForHole(holeIndex)?.winnerId === player.id
    ).length;

    return skinCount || "-";
  }

  function renderTotalCells(totalColumns, valueGetter) {
    return totalColumns
      .map((column) => renderCell(valueGetter(column.holeIndexes), "", "player-scorecard-total-cell"))
      .join("");
  }

  function renderGrid(title, holeIndexes, totalColumns = []) {
    const holeHeader = holeIndexes.map((holeIndex) => `<th scope="col">${holeIndex + 1}</th>`).join("");
    const totalHeader = totalColumns
      .map((column) => `<th scope="col" class="player-scorecard-total-heading">${column.label}</th>`)
      .join("");
    const holes = holeIndexes.map((holeIndex) => roundState.getHoleForPlayer(player, holeIndex));
    const scores = holeIndexes.map((holeIndex) => roundState.savedScores[player.id]?.[holeIndex]);

    return `
      <section class="player-scorecard-card">
        <h3>${title}</h3>
        <div class="player-scorecard-table-wrap">
          <table class="player-scorecard-table">
            <thead>
              <tr><th scope="col">Hole</th>${holeHeader}${totalHeader}</tr>
            </thead>
            <tbody>
              <tr><th scope="row">Par</th>${holes.map((hole) => renderCell(hole.par)).join("")}${renderTotalCells(totalColumns, getCompletedParTotal)}</tr>
              <tr><th scope="row">HCP</th>${holes.map((hole) => renderCell(hole.handicap)).join("")}${renderTotalCells(totalColumns, () => "-")}</tr>
              <tr><th scope="row">Gross</th>${holeIndexes.map((holeIndex, index) => {
                const score = scores[index];
                const hole = holes[index];
                return renderGrossCell(score, hole, holeIndex);
              }).join("")}${renderTotalCells(totalColumns, getCompletedGrossTotal)}</tr>
              <tr><th scope="row">Points</th>${holeIndexes.map((holeIndex, index) => {
                const score = scores[index];
                return renderCell(hasScore(score) && roundState.isInPoints(player) && !dnfStatus
                  ? getPoints(score, holes[index].par)
                  : "-");
              }).join("")}${renderTotalCells(totalColumns, getCompletedPointsTotal)}</tr>
              <tr><th scope="row">Skin</th>${holeIndexes.map((holeIndex) => {
                const skin = roundState.getSkinForHole(holeIndex);
                return renderCell(skin?.winnerId === player.id ? `<span class="skin-badge">SKIN</span>` : "-");
              }).join("")}${renderTotalCells(totalColumns, getCompletedSkinTotal)}</tr>
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderSummaryRow(label, formatter) {
    const front = getSideSummary("front");
    const back = getSideSummary("back");
    const total = getSideSummary("total");

    return `
      <tr>
        <th scope="row">${label}</th>
        <td>${formatter(front, "front")}</td>
        <td>${formatter(back, "back")}</td>
        <td>${formatter(total, "total")}</td>
      </tr>
    `;
  }

  const frontSummary = getSideSummary("front");
  const backSummary = getSideSummary("back");
  const totalSummary = getSideSummary("total");
  const pointsPayout = getPlayerPointsPayout("front") + getPlayerPointsPayout("back") + getPlayerPointsPayout("overall");
  const skinsPayout = getPlayerSkinsPayout();
  const totalPayout = pointsPayout + skinsPayout;
  const roundHoleIndexes = getPlayerRoundHoleIndexes();
  const frontHoleIndexes = getSideHoleIndexes("front").filter((holeIndex) => roundHoleIndexes.includes(holeIndex));
  const backHoleIndexes = getSideHoleIndexes("back").filter((holeIndex) => roundHoleIndexes.includes(holeIndex));
  const isNineHoleRound = roundHoleIndexes.length <= 9;
  const scorecardSections = [];

  if (frontHoleIndexes.length) {
    scorecardSections.push(renderGrid(
      "Front Nine",
      frontHoleIndexes,
      isNineHoleRound && !backHoleIndexes.length
        ? [{ label: "TOTAL", holeIndexes: roundHoleIndexes }]
        : [{ label: "OUT", holeIndexes: getSideHoleIndexes("front") }]
    ));
  }

  if (backHoleIndexes.length) {
    const backTotalColumns = isNineHoleRound
      ? [{ label: "TOTAL", holeIndexes: roundHoleIndexes }]
      : [
          { label: "IN", holeIndexes: getSideHoleIndexes("back") },
          { label: "TOTAL", holeIndexes: roundHoleIndexes }
        ];
    scorecardSections.push(renderGrid("Back Nine", backHoleIndexes, backTotalColumns));
  }

  const throughText = dnfStatus
    ? `${dnfStatus.holesCompleted} holes - ${dnfStatus.grossStrokes} strokes`
    : `${totals.holesPlayed}/${totalHoles} holes`;

  elements.playerScorecard.innerHTML = `
    <section class="player-scorecard-view">
      <div class="player-scorecard-header">
        <button id="backFromPlayerScorecard" type="button" class="secondary-button">${returnLabel}</button>
        <h2>${player.name}</h2>
      </div>

      ${scorecardSections.join("")}

      <div class="player-scorecard-meta">
        <span>Tee <strong>${player.tee || "-"}</strong></span>
        <span>Index <strong>${player.handicap ?? player.handicapIndex ?? "-"}</strong></span>
        <span>Course HCP <strong>${roundState.courseHandicaps[player.id] ?? player.courseHandicap ?? "-"}</strong></span>
        <span>Status <strong>${statusText}</strong></span>
      </div>

      <section class="player-scorecard-card">
        <h3>Summary</h3>
        ${totals.holesPlayed < totalHoles || dnfStatus ? `<p class="player-details">Through ${throughText}. Unplayed holes are not counted.</p>` : ""}
        <div class="player-scorecard-table-wrap">
          <table class="player-scorecard-summary-table">
            <thead>
              <tr><th scope="col">Total</th><th scope="col">Front 9</th><th scope="col">Back 9</th><th scope="col">Total</th></tr>
            </thead>
            <tbody>
              ${renderSummaryRow("Par", (side) => side.holes ? side.par : "-")}
              ${renderSummaryRow("Gross Score", (side) => side.holes ? side.gross : "-")}
              ${renderSummaryRow("Gross to Par", (side) => side.holes ? formatSigned(side.grossToPar) : "-")}
              ${renderSummaryRow("Net Score", (side) => side.holes ? side.net : "-")}
              ${renderSummaryRow("Net to Par", (side) => side.holes ? formatSigned(side.netToPar) : "-")}
              ${renderSummaryRow("Points", (side) => roundState.isInPoints(player) && side.holes ? side.points : "-")}
              ${renderSummaryRow("Points Target", (side) => roundState.isInPoints(player) ? side.pointsTarget : "-")}
              ${renderSummaryRow("Points vs Target", (side) => roundState.isInPoints(player) ? side.pointsVsTarget : "-")}
              ${renderSummaryRow("Skins Won", (side) => roundState.isInSkins(player) ? side.skinsWon : "-")}
              <tr><th scope="row">Skins Payout</th><td>-</td><td>-</td><td>${formatCurrency(skinsPayout)}</td></tr>
              <tr><th scope="row">Points Payout</th><td>${formatCurrency(getPlayerPointsPayout("front"))}</td><td>${formatCurrency(getPlayerPointsPayout("back"))}</td><td>${formatCurrency(pointsPayout)}</td></tr>
              <tr class="player-scorecard-payout-row"><th scope="row">Total Payout</th><td></td><td></td><td>${formatCurrency(totalPayout)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="player-scorecard-card">
        <h3>Skins</h3>
        <p class="player-details">${roundState.isInSkins(player)
          ? playerSkins.totalSkins
            ? `${playerSkins.totalSkins} skin${playerSkins.totalSkins === 1 ? "" : "s"} won: ${playerSkins.holesWon.join(", ")}`
            : "No skins won yet."
          : "Not in Skins."}</p>
      </section>
    </section>
  `;
};
