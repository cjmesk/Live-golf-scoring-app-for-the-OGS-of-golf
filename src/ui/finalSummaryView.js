window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

window.OGSGolf.ui.renderFinalSummary = function renderFinalSummary(elements, roundState) {
  const summary = roundState.getFinalSummary();
  const roundSettings = roundState.roundSettings || {};

  function formatDate(value) {
    if (!value) return "Date not saved";

    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatCurrency(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? `$${numericValue.toFixed(2)}` : "$0.00";
  }

  function formatRankLabel(rankLabel, rank) {
    const label = rankLabel || (rank ? String(rank) : "");
    return label.replace(/^T(\d+)$/, "T-$1");
  }

  function renderPlayerNameButton(playerId, playerName) {
    return `<button type="button" class="player-name player-scorecard-link" data-open-player-scorecard="${playerId}">${playerName}</button>`;
  }

  function getHolesPlayedText() {
    const holesPlayed = summary.playerTotals.reduce((highestCount, item) => {
      const playerHoles = item.dnf?.holesCompleted ?? item.totals.holesPlayed ?? 0;
      return Math.max(highestCount, Number(playerHoles) || 0);
    }, 0);
    const holesRequired = (roundSettings.groupRecords || []).reduce((highestCount, record) =>
      Math.max(highestCount, Number(record?.holesToPlay || record?.holes_to_play || 0)),
    0) || roundState.totalHoles;

    return `${holesPlayed}/${holesRequired} holes`;
  }

  function formatWinner(result, label) {
    if (!result.leaders.length) {
      return `
        <div class="summary-card">
          <span>${label}</span>
          <strong>No eligible players</strong>
          <small>DNF players excluded</small>
        </div>
      `;
    }

    const names = result.leaders
      .map((item) => renderPlayerNameButton(item.player.id, item.player.name))
      .join(", ");
    return `
      <div class="summary-card">
        <span>${label}</span>
        <strong>${names}</strong>
        <small>${result.score}</small>
      </div>
    `;
  }

  function renderPayoutWinnerRows(winners = []) {
    if (!winners.length) {
      return `
        <div class="summary-row">
          <span>No winner</span>
          <strong>${formatCurrency(0)}</strong>
          <small>No payout assigned</small>
        </div>
      `;
    }

    return winners.map((winner) => {
      const rankLabel = formatRankLabel(winner.rankLabel, winner.rank);
      const positionText = rankLabel ? `${rankLabel}. ` : "";

      return `
      <div class="summary-row payout-winner-row">
        <span><b>${positionText}</b>${renderPlayerNameButton(winner.playerId, winner.playerName)}</span>
        <strong>${winner.display}</strong>
        <small>${winner.points} points / ${winner.target} needed</small>
        <small class="summary-money">${formatCurrency(winner.payout)}</small>
      </div>
    `;
    }).join("");
  }

  function formatSkinHoleDetails(details = [], fallbackHoles = []) {
    const holeDetails = details.length
      ? details
      : fallbackHoles.map((hole) => ({ hole, netScore: null }));

    if (!holeDetails.length) return "-";

    return holeDetails
      .map((detail) => {
        const skinsNetScore = detail.skinsNetScore ?? detail.skinScore ?? detail.netScore;
        const netText = Number.isFinite(Number(skinsNetScore))
          ? ` - Net ${skinsNetScore}`
          : "";
        return `Hole ${detail.hole}${netText}`;
      })
      .join(", ");
  }

  function formatSkinHoles(details = [], fallbackHoles = []) {
    const holes = details.length
      ? details.map((detail) => detail.hole)
      : fallbackHoles;

    if (!holes.length) return "Holes -";

    return `Holes ${holes.join(", ")}`;
  }

  function renderPayoutSection() {
    const payoutSummary = summary.payoutSummary;

    if (!payoutSummary) {
      return "";
    }

    const hasPointsPayout = payoutSummary.points?.enabled === true;
    const hasSkinsPayout = payoutSummary.skins?.enabled === true;

    if (!hasPointsPayout && !hasSkinsPayout) return "";

    const skinsRows = hasSkinsPayout && payoutSummary.skins.winners.length
        ? payoutSummary.skins.winners.map((winner) => {
          const holeText = formatSkinHoleDetails(winner.holesWonDetails, winner.holesWon);
          const holeListText = formatSkinHoles(winner.holesWonDetails, winner.holesWon);
          const averageValue = winner.totalSkins > 0 ? Number(winner.payout || 0) / winner.totalSkins : 0;

          return `
            <div class="summary-row skins-payout-row">
              <span>${renderPlayerNameButton(winner.playerId, winner.playerName)}</span>
              <strong>${formatCurrency(winner.payout)}</strong>
              <small>${winner.totalSkins} skin${winner.totalSkins === 1 ? "" : "s"} - ${formatCurrency(winner.payout)} total</small>
              <small>${holeListText}</small>
              <small>${holeText}</small>
              ${winner.totalSkins > 1 ? `<small>Average value: ${formatCurrency(averageValue)} per skin</small>` : ""}
            </div>
          `;
        }).join("")
        : `
          <div class="summary-row">
            <span>No skins won</span>
            <strong>${formatCurrency(0)}</strong>
            <small>No skins payout assigned</small>
          </div>
        `;
    const playerPayoutRows = (payoutSummary.playerTotals || [])
      .map((playerTotal) => `
        <div class="summary-row payout-total-row ${Number(playerTotal.totalWinnings || 0) <= 0 ? "is-zero-payout" : ""}">
          <span>${renderPlayerNameButton(playerTotal.playerId, playerTotal.playerName)}</span>
          <strong>${formatCurrency(playerTotal.totalWinnings)}</strong>
          <small>Front ${formatCurrency(playerTotal.frontPointsWinnings)} | Back ${formatCurrency(playerTotal.backPointsWinnings)} | Overall ${formatCurrency(playerTotal.overallPointsWinnings)}</small>
          <small>Skins ${formatCurrency(playerTotal.skinsWinnings)} | Total ${formatCurrency(playerTotal.totalWinnings)}</small>
        </div>
      `)
      .join("");

    return `
      <section class="summary-block payout-summary-block">
        <h3>Points & Skins Payouts</h3>
        ${hasPointsPayout ? `<section class="points-category">
          <h4>Points</h4>
          <div class="payout-subtitle">Overall</div>
          <div class="summary-list">${renderPayoutWinnerRows(payoutSummary.points.overallPayouts || payoutSummary.points.overall?.payouts || payoutSummary.points.overall?.winners)}</div>
          <div class="payout-subtitle">Front Nine</div>
          <div class="summary-list">${renderPayoutWinnerRows(payoutSummary.points.frontPayouts || payoutSummary.points.front?.payouts || payoutSummary.points.front?.winners)}</div>
          <div class="payout-subtitle">Back Nine</div>
          <div class="summary-list">${renderPayoutWinnerRows(payoutSummary.points.backPayouts || payoutSummary.points.back?.payouts || payoutSummary.points.back?.winners)}</div>
        </section>` : ""}
        ${hasSkinsPayout ? `<section class="points-category">
          <h4>Skins</h4>
          <div class="summary-list">${skinsRows}</div>
        </section>` : ""}
        <section class="points-category">
          <h4>Player Payout Summary</h4>
          <div class="summary-list">${playerPayoutRows}</div>
        </section>
      </section>
    `;
  }

  const skinsRows = summary.playerTotals
    .map((item) => {
      const holes = item.skins.holesWon.length ? item.skins.holesWon.join(", ") : "-";
      const skinsText = roundState.isInSkins(item.player)
        ? formatSkinHoleDetails(item.skins.holesWonDetails, item.skins.holesWon)
        : "Not in Skins";
      return `
        <div class="summary-row">
          <span>${renderPlayerNameButton(item.player.id, item.player.name)}</span>
          <strong>${roundState.isInSkins(item.player) ? item.skins.totalSkins : "-"}</strong>
          <small>${skinsText}</small>
        </div>
      `;
    })
    .join("");

  function getPointsStandingsForSection(section) {
    let currentRank = 1;
    const standings = [...summary.pointsResultStandings]
      .sort((firstItem, secondItem) => {
        if (secondItem[section].differential !== firstItem[section].differential) {
          return secondItem[section].differential - firstItem[section].differential;
        }

        if (secondItem[section].points !== firstItem[section].points) {
          return secondItem[section].points - firstItem[section].points;
        }

        return firstItem.player.name.localeCompare(secondItem.player.name);
      });

    return standings.map((item, index) => {
      const previousItem = standings[index - 1];
      const nextItem = standings[index + 1];
      const tiedWithPrevious = previousItem
        && previousItem[section].differential === item[section].differential
        && previousItem[section].points === item[section].points;
      const tiedWithNext = nextItem
        && nextItem[section].differential === item[section].differential
        && nextItem[section].points === item[section].points;

      if (!tiedWithPrevious) {
        currentRank = index + 1;
      }

      return {
        ...item,
        sectionRank: currentRank,
        sectionRankLabel: tiedWithPrevious || tiedWithNext ? `T-${currentRank}` : String(currentRank)
      };
    });
  }

  function renderPointsStandingRow(item, section, isHighlight = false) {
    const result = item[section];
    const pointLabel = result.points === 1 ? "point" : "points";

    return `
      <div class="summary-row points-result-row">
        <span>${item.sectionRankLabel}. ${renderPlayerNameButton(item.player.id, item.player.name)}</span>
        <strong>${isHighlight ? result.display : ""}</strong>
        <small>${result.points} ${pointLabel} / ${result.target} needed</small>
        <small>${result.display}</small>
      </div>
    `;
  }

  function renderPointsTopThreeCategory(title, section) {
    const standings = getPointsStandingsForSection(section);
    const topThree = standings.filter((item) => item.sectionRank <= 3);
    const topRows = topThree.map((item) => renderPointsStandingRow(item, section, true)).join("");

    return `
      <section class="points-category">
        <h4>${title}</h4>
        <div class="summary-list">${topRows}</div>
      </section>
    `;
  }

  function renderPointsFullStandings(title, section) {
    const standings = getPointsStandingsForSection(section);
    const fullRows = standings.map((item) => renderPointsStandingRow(item, section)).join("");

    return `
      <details class="points-full-standings" open>
        <summary>${title}</summary>
        <div class="summary-list">${fullRows}</div>
      </details>
    `;
  }

  const pointsResultsSection = summary.pointsResultStandings.length
    ? `
      <section class="summary-block">
        <h3>Points Results</h3>
        ${renderPointsTopThreeCategory("Overall Points", "overall")}
        ${renderPointsTopThreeCategory("Front Nine Points", "front")}
        ${renderPointsTopThreeCategory("Back Nine Points", "back")}
        <section class="points-category points-full-category">
          <h4>Full Points Standings</h4>
          ${renderPointsFullStandings("Overall Points", "overall")}
          ${renderPointsFullStandings("Front Nine Points", "front")}
          ${renderPointsFullStandings("Back Nine Points", "back")}
        </section>
      </section>
    `
    : "";

  const totalRows = summary.playerTotals
    .map((item) => {
      const dnfText = item.dnf ? `DNF - ${item.dnf.holesCompleted} holes - ${item.dnf.grossStrokes} strokes` : "";
      const frontGrossText = roundState.formatGrossTotal(item.totals, "front");
      const backGrossText = roundState.formatGrossTotal(item.totals, "back");
      const overallGrossText = roundState.formatGrossTotal(item.totals, "overall");

      return `
        <div class="summary-row">
          <span>${renderPlayerNameButton(item.player.id, item.player.name)}</span>
          <strong>${item.dnf ? "DNF" : overallGrossText}</strong>
          <small>${frontGrossText} | ${backGrossText}</small>
          <small>${item.dnf ? dnfText : `Net ${item.totals.net}`}</small>
        </div>
      `;
    })
    .join("");

  elements.finalSummary.innerHTML = `
    <section class="summary-hero">
      <p class="eyebrow dark">${elements.summaryTitle?.textContent === "Last Round Results" ? "Saved Results" : "Final Results"}</p>
      <h3>${elements.summaryTitle?.textContent || "Round Complete"}</h3>
      <div class="summary-meta-grid">
        <span>${roundSettings.course?.name || "Course not saved"}</span>
        <span>${formatDate(roundSettings.date)}</span>
        <span>${summary.playerTotals.length} players</span>
        <span>${getHolesPlayedText()}</span>
      </div>
    </section>

    ${renderPayoutSection()}

    ${pointsResultsSection}

    <section class="summary-block">
      <h3>Gross Results</h3>
      <div class="summary-grid">
        ${formatWinner(summary.grossWinner, "Gross Winner")}
      </div>
      <div class="summary-list">${totalRows}</div>
    </section>

    <section class="summary-block">
      <h3>Net Results</h3>
      <div class="summary-grid">
        ${formatWinner(summary.netWinner, "Net Winner")}
      </div>
    </section>

    <section class="summary-block">
      <h3>Net Skins Winners</h3>
      <div class="summary-list">${skinsRows}</div>
    </section>
  `;
};

window.OGSGolf.ui.renderCompletedScorecard = function renderCompletedScorecard(elements, roundState) {
  const summary = roundState.getFinalSummary();
  const players = summary.playerTotals.map((item) => item.player);

  function getBaseInitials(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function getUniquePlayerLabels() {
    const usedLabels = new Set();

    return players.map((player) => {
      const nameParts = player.name.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || player.name;
      const lastName = nameParts[nameParts.length - 1] || "";
      const candidates = [
        getBaseInitials(player.name),
        `${firstName[0] || ""}${lastName.slice(0, 2)}`.toUpperCase(),
        `${firstName.slice(0, 2)}${lastName[0] || ""}`.toUpperCase(),
        player.name.slice(0, 4).toUpperCase()
      ].filter(Boolean);
      let label = candidates.find((candidate) => !usedLabels.has(candidate));
      let extraLetterCount = 3;

      while (!label) {
        const candidate = `${firstName[0] || ""}${lastName.slice(0, extraLetterCount)}`.toUpperCase();
        if (!usedLabels.has(candidate)) {
          label = candidate;
        }
        extraLetterCount += 1;
      }

      usedLabels.add(label);
      return {
        player,
        label
      };
    });
  }

  function getScore(player, holeIndex) {
    return roundState.savedScores[player.id]?.[holeIndex] ?? "-";
  }

  function getTotal(player, startIndex, endIndex) {
    return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => startIndex + offset)
      .reduce((total, holeIndex) => {
        const score = roundState.savedScores[player.id]?.[holeIndex];
        return score === null || score === undefined ? total : total + Number(score);
      }, 0);
  }

  const playerLabels = getUniquePlayerLabels();
  const headerCells = playerLabels
    .map(({ label, player }) => `<th title="${player.name}">${label}</th>`)
    .join("");
  const holeRows = Array.from({ length: roundState.totalHoles }, (_, holeIndex) => `
    <tr>
      <th scope="row">${holeIndex + 1}</th>
      ${players.map((player) => `<td>${getScore(player, holeIndex)}</td>`).join("")}
    </tr>
  `).join("");
  const frontRow = players.map((player) => `<td>${getTotal(player, 0, 8)}</td>`).join("");
  const backRow = players.map((player) => `<td>${getTotal(player, 9, 17)}</td>`).join("");
  const totalRow = players.map((player) => `<td>${getTotal(player, 0, roundState.totalHoles - 1)}</td>`).join("");
  const legend = playerLabels
    .map(({ label, player }) => {
      const dnfText = roundState.formatDnfStatus(player);
      return `<span><strong>${label}</strong> ${player.name}${dnfText ? ` (${dnfText})` : ""}</span>`;
    })
    .join("");

  elements.finalSummary.innerHTML = `
    <section class="summary-block">
      <h3>Scorecard</h3>
      <div class="scorecard-legend">${legend}</div>
      <div class="scorecard-table-wrap">
        <table class="mobile-scorecard-table">
          <thead>
            <tr>
              <th scope="col">H</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${holeRows}
            <tr class="scorecard-total-row"><th scope="row">F</th>${frontRow}</tr>
            <tr class="scorecard-total-row"><th scope="row">B</th>${backRow}</tr>
            <tr class="scorecard-total-row"><th scope="row">T</th>${totalRow}</tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
};
