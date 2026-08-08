window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

window.OGSGolf.ui.renderHoleView = function renderHoleView(elements, course, players, roundState, options = {}) {
  const currentHoleIndex = roundState.currentHoleIndex;
  const firstPlayer = players[0];
  const defaultTeeId = course.teeOrder?.[0] || Object.keys(course.tees || {})[0];
  const currentHole = firstPlayer
    ? roundState.getHoleForPlayer(firstPlayer)
    : course.tees[defaultTeeId][currentHoleIndex];

  elements.holeTitle.textContent = `Hole ${currentHoleIndex + 1}`;
  elements.holeDetails.innerHTML = `
    <span>Par ${currentHole.par}</span>
    <span>HCP ${currentHole.handicap}</span>
  `;
  const matchSummary = roundState.getFourBallMatchSummary?.();
  if (matchSummary?.settings.enabled) {
    elements.holeDetails.innerHTML += `
      <span class="match-live-status">${matchSummary.status}</span>
      <span>${matchSummary.settings.scoring === "net" ? `Net at ${matchSummary.settings.allowance}%` : "Gross"} Four-Ball</span>
    `;
  }

  elements.previousHole.disabled = currentHoleIndex === 0;
  elements.nextHole.disabled = currentHoleIndex === roundState.totalHoles - 1;
  elements.holePlayers.innerHTML = "";

  players.forEach((player) => {
    const score = roundState.draftScores[player.id];
    const dnfStatus = roundState.getPlayerDnfStatus(player);
    const isDnf = Boolean(dnfStatus);
    const canChangeTee = options.commissionerMode || options.currentScorerId === player.id;
    const changeTeeButton = canChangeTee
      ? `<button type="button" class="player-option-button" data-change-tee-player-id="${player.id}">Change Tee</button>`
      : "";
    const playerOptions = isDnf
      ? options.commissionerMode
        ? `${changeTeeButton}<button type="button" class="player-option-button" data-restore-player-id="${player.id}">Restore Player to Active</button>`
        : changeTeeButton
      : `
        ${changeTeeButton}
        <button type="button" class="player-option-button" data-dnf-player-id="${player.id}">End Player Round - DNF</button>
        ${options.commissionerMode ? `<button type="button" class="player-option-button" data-adjust-handicap-player-id="${player.id}">Adjust Handicap</button>` : ""}
      `;
    const playerRow = document.createElement("article");
    playerRow.className = `hole-player scorekeeper-player${isDnf ? " is-dnf-player" : ""}`;
    playerRow.innerHTML = `
      <div class="hole-player-info">
        <div class="player-name">${player.name}</div>
        ${matchSummary?.settings.enabled ? `<div class="player-details">${player.matchTeam === "A" ? matchSummary.settings.teamALabel : matchSummary.settings.teamBLabel}${matchSummary.settings.scoring === "net" ? ` | Playing HCP ${matchSummary.playingHandicaps[player.id]}` : " | Gross"}</div>` : ""}
        ${isDnf ? `<div class="player-details dnf-status">${roundState.formatDnfStatus(player)}</div>` : ""}
      </div>
      ${isDnf ? "" : `
        <div class="score-stepper" aria-label="${player.name} gross score controls">
          <button type="button" class="step-button" data-action="decrease" data-player-id="${player.id}" aria-label="Decrease ${player.name} score">-</button>
          <input class="score-value score-input" id="${player.id}-score" data-score-input data-player-id="${player.id}" type="number" inputmode="numeric" min="1" max="12" value="${score}" aria-label="${player.name} gross score">
          <button type="button" class="step-button" data-action="increase" data-player-id="${player.id}" aria-label="Increase ${player.name} score">+</button>
        </div>
      `}
      ${playerOptions ? `
        <details class="player-options-menu">
          <summary aria-label="${player.name} player options">Options</summary>
          <div class="player-options-list">
            ${playerOptions}
          </div>
        </details>
      ` : ""}
    `;

    elements.holePlayers.appendChild(playerRow);
  });
};
