window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

window.OGSGolf.ui.renderEventSummary = function renderEventSummary(elements, roundSettings) {
  const groupRows = roundSettings.groups
    .map((group, index) => {
      const playerNames = group
        .map((playerId) => {
          const player = roundSettings.players.find((item) => item.id === playerId);
          if (!player) return "";
          const index = window.OGSGolf.ui.formatHandicapIndex?.(player.handicap) ?? player.handicap;
          const games = [player.inPoints ? "Points" : "", player.inSkins ? "Skins" : ""].filter(Boolean).join(" + ") || "No money games";
          return `${player.name} — Index ${index} — ${player.tee} tees — ${games}`;
        })
        .filter(Boolean)
        .join("<br>");
      const scorer = roundSettings.players.find((player) => player.id === roundSettings.groupScorers?.[index]);

      return `
        <div class="summary-row">
          <span>Group ${index + 1}</span>
          <strong>${group.length} players</strong>
          <small>${playerNames}</small>
          <small>Scorekeeper: ${scorer?.name || "Not assigned"}</small>
        </div>
      `;
    })
    .join("");
  const pointsPlayers = roundSettings.players.filter((player) => player.inPoints === true);
  const skinsPlayers = roundSettings.players.filter((player) => player.inSkins === true);
  const pointsAmount = Number(roundSettings.games?.pointsGame?.amount || 0);
  const skinsAmount = Number(roundSettings.games?.netSkins?.amount || 0);
  const gameRows = [
    {
      label: "Points Game",
      count: pointsPlayers.length,
      amount: pointsAmount,
      enabled: roundSettings.games?.pointsGame?.enabled === true
    },
    {
      label: "Skins Game",
      count: skinsPlayers.length,
      amount: skinsAmount,
      enabled: roundSettings.games?.netSkins?.enabled === true
    }
  ].map((game) => `
    <div class="summary-row">
      <span>${game.label}</span>
      <strong>${game.enabled ? `$${game.amount.toFixed(2)}` : "Off"}</strong>
      <small>${game.count} participating player${game.count === 1 ? "" : "s"}</small>
    </div>
  `).join("");
  const matchSettings = roundSettings.fourBallMatch;
  const matchSummary = matchSettings?.enabled ? `
    <section class="summary-block">
      <h3>Four-Ball Match Play</h3>
      <div class="summary-list">
        <div class="summary-row"><span>Match</span><strong>${matchSettings.holes} holes${matchSettings.holes === 9 ? (matchSettings.startingHole === 10 ? " - Back 9" : " - Front 9") : ""}</strong></div>
        <div class="summary-row"><span>Scoring</span><strong>${matchSettings.scoring === "net" ? `Net - ${matchSettings.allowance}% allowance` : "Gross"}</strong><small>${matchSettings.handicapSource === "manual" ? "Manual playing handicaps" : "Automatic playing handicaps"}</small></div>
        <div class="summary-row"><span>${matchSettings.teamALabel}</span><strong>${roundSettings.players.filter((player) => player.matchTeam === "A").map((player) => player.name).join(" / ")}</strong></div>
        <div class="summary-row"><span>${matchSettings.teamBLabel}</span><strong>${roundSettings.players.filter((player) => player.matchTeam === "B").map((player) => player.name).join(" / ")}</strong></div>
      </div>
    </section>
  ` : "";

  elements.eventSummary.innerHTML = `
    <section class="summary-block">
      <div class="summary-grid">
        <div class="summary-card">
          <span>Course</span>
          <strong>${roundSettings.course.name}</strong>
        </div>
        <div class="summary-card">
          <span>Date</span>
          <strong>${roundSettings.date}</strong>
        </div>
        <div class="summary-card">
          <span>Round Name</span>
          <strong>${roundSettings.roundName}</strong>
        </div>
        <div class="summary-card">
          <span>Round Type</span>
          <strong>${roundSettings.roundType === "test" ? "Test Round" : "Official Round"}</strong>
          <small>${roundSettings.roundType === "test" ? "Excluded from official statistics" : "Counts toward statistics and winnings"}</small>
        </div>
        <div class="summary-card">
          <span>Total Players</span>
          <strong>${roundSettings.players.length}</strong>
        </div>
        <div class="summary-card">
          <span>Total Groups</span>
          <strong>${roundSettings.groups.length}</strong>
        </div>
      </div>
    </section>

    ${matchSummary}

    <section class="summary-block">
      <h3>Groups and Scorekeepers</h3>
      <div class="summary-list">${groupRows}</div>
    </section>

    <section class="summary-block">
      <h3>Game Values / Payouts</h3>
      <div class="summary-list">${gameRows}</div>
    </section>
  `;
};
