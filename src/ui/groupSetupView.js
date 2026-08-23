window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

function getDefaultGroupCount(playerCount) {
  if (playerCount <= 4) return 1;
  return Math.ceil(playerCount / 4);
}

function getDefaultGroupNumber(index, playerCount) {
  const groupCount = getDefaultGroupCount(playerCount);
  const baseSize = Math.floor(playerCount / groupCount);
  const largerGroups = playerCount % groupCount;
  let runningTotal = 0;

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const groupSize = baseSize + (groupIndex < largerGroups ? 1 : 0);
    runningTotal += groupSize;

    if (index < runningTotal) {
      return groupIndex + 1;
    }
  }

  return groupCount;
}

function getExistingGroupNumber(playerId, groups) {
  const groupIndex = groups.findIndex((group) => group.includes(playerId));
  return groupIndex >= 0 ? groupIndex + 1 : null;
}

function formatGroupHandicapIndex(value) {
  return window.OGSGolf.ui.formatHandicapIndex
    ? window.OGSGolf.ui.formatHandicapIndex(value)
    : String(value);
}

window.OGSGolf.ui.renderGroupSetupView = function renderGroupSetupView(elements, roundSettings) {
  const players = roundSettings.players;
  const isFourBallMatch = roundSettings.format === "four-ball-match";
  const groupCount = isFourBallMatch ? 1 : (roundSettings.groupCount || Math.max(1, roundSettings.groups?.length || getDefaultGroupCount(players.length)));
  const existingGroups = roundSettings.groups || [];

  elements.groupSetupList.groupCount = groupCount;
  elements.groupSetupCount.textContent =
    `${players.length} player${players.length === 1 ? "" : "s"} selected | ${groupCount} group${groupCount === 1 ? "" : "s"}`;
  elements.groupSetupStatus.textContent = "Create groups, then choose one scorekeeper from each group.";
  elements.removeGroup.disabled = groupCount <= 1;
  elements.addGroup.disabled = isFourBallMatch;
  if (isFourBallMatch) {
    elements.groupSetupStatus.textContent = `${roundSettings.fourBallMatch.holes}-hole Four-Ball match: keep all four golfers together and choose the scorekeeper.`;
  }

  elements.groupSetupList.innerHTML = players
    .map((player, index) => {
      const currentGroup = Math.min(
        groupCount,
        getExistingGroupNumber(player.id, existingGroups) || getDefaultGroupNumber(index, players.length)
      );
      const options = Array.from({ length: groupCount }, (_, groupIndex) => groupIndex + 1)
        .map((groupNumber) => `
          <option value="${groupNumber}"${groupNumber === currentGroup ? " selected" : ""}>Group ${groupNumber}</option>
        `)
        .join("");

      return `
        <div class="member-row">
          <div>
            <strong>${player.name}</strong>
            <span class="player-details">${player.tee} tees | Index ${formatGroupHandicapIndex(player.handicap)}</span>
          </div>
          <label class="tee-select-label">
            <span>Group</span>
            <select class="field-control" data-group-player="${player.id}">
              ${options}
            </select>
          </label>
        </div>
      `;
    })
    .join("");

  window.OGSGolf.ui.renderGroupScorerOptions(elements, players, window.OGSGolf.ui.readGroupAssignments(elements, players));
};

window.OGSGolf.ui.renderGroupScorerOptions = function renderGroupScorerOptions(elements, players, groups) {
  elements.groupScorerList.innerHTML = groups
    .map((group, index) => {
      const groupPlayers = players.filter((player) => group.includes(player.id));
      const previousScorer = elements.groupScorerList.querySelector(`[data-group-scorer="${index}"]`)?.value;
      const previousStartingHole = elements.groupScorerList.querySelector(`[data-group-starting-hole="${index}"]`)?.value || "1";
      const selectedScorer = group.includes(previousScorer) ? previousScorer : group[0];
      const scorerOptions = groupPlayers
        .map((player) => `<option value="${player.id}"${player.id === selectedScorer ? " selected" : ""}>${player.name}</option>`)
        .join("");
      const holeOptions = Array.from({ length: 18 }, (_, holeIndex) => holeIndex + 1)
        .map((holeNumber) => `<option value="${holeNumber}"${String(holeNumber) === previousStartingHole ? " selected" : ""}>Hole ${holeNumber}</option>`)
        .join("");

      return `
        <div class="member-row">
          <div>
            <strong>Group ${index + 1} Scorekeeper</strong>
            <span class="player-details">Set the scorekeeper and starting hole for this group. New rounds are scheduled for 18 holes.</span>
          </div>
          <label class="tee-select-label">
            <span>Scorekeeper</span>
            <select class="field-control" data-group-scorer="${index}">
              ${scorerOptions}
            </select>
          </label>
          <label class="tee-select-label">
            <span>Starting Hole</span>
            <select class="field-control" data-group-starting-hole="${index}">
              ${holeOptions}
            </select>
          </label>
        </div>
      `;
    })
    .join("");
};

window.OGSGolf.ui.readGroupAssignments = function readGroupAssignments(elements, players) {
  const groupCount = elements.groupSetupList.groupCount || getDefaultGroupCount(players.length);
  const groupsByNumber = Array.from({ length: groupCount }, () => []);

  players.forEach((player, index) => {
    const select = elements.groupSetupList.querySelector(`[data-group-player="${player.id}"]`);
    const groupNumber = Math.max(1, Math.min(groupCount, Number(select?.value || getDefaultGroupNumber(index, players.length))));
    groupsByNumber[groupNumber - 1].push(player.id);
  });

  return groupsByNumber.filter((group) => group.length > 0);
};

window.OGSGolf.ui.readGroupScorers = function readGroupScorers(elements, groups) {
  return groups.map((group, index) => {
    const select = elements.groupScorerList.querySelector(`[data-group-scorer="${index}"]`);
    return select?.value || group[0] || "";
  });
};

window.OGSGolf.ui.readGroupPlaySettings = function readGroupPlaySettings(elements, groups) {
  return groups.map((group, index) => {
    const startingHoleSelect = elements.groupScorerList.querySelector(`[data-group-starting-hole="${index}"]`);

    return {
      startingHole: Number(startingHoleSelect?.value || 1),
      holesToPlay: 18
    };
  });
};
