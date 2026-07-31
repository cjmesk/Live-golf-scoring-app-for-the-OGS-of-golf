window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.ui = window.OGSGolf.ui || {};

window.OGSGolf.ui.gameOptions = [
  { id: "netSkins", label: "Net Skins", defaultEnabled: false, defaultAmount: 0 },
  { id: "pointsGame", label: "Points Game", defaultEnabled: false, defaultAmount: 0 },
  { id: "teamChallenge", label: "Team Challenge", defaultEnabled: false, defaultAmount: 0 }
];

function getTodayInputValue() {
  const today = new Date();
  const offsetDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function createDisabledGames() {
  return window.OGSGolf.ui.gameOptions.reduce((games, game) => {
    games[game.id] = {
      label: game.label,
      enabled: false,
      amount: 0,
      skinsHandicapMode: game.id === "netSkins" ? "half" : undefined
    };
    return games;
  }, {});
}

function getValidCourseTeeId(course, teeId) {
  if (course.teeOrder.includes(teeId)) {
    return teeId;
  }

  return course.teeOrder[0];
}

window.OGSGolf.ui.renderSetupView = function renderSetupView(elements, courses, members) {
  elements.courseSelect.innerHTML = courses
    .map((course) => `<option value="${course.id}">${course.name}</option>`)
    .join("");

  if (!elements.roundDate.value) {
    elements.roundDate.value = getTodayInputValue();
  }

  const selectedMemberIds = elements.memberList.selectedMemberIds || new Set();
  const teeOverrides = elements.memberList.teeOverrides || new Map();
  const pointsParticipation = elements.memberList.pointsParticipation || new Map();
  const skinsParticipation = elements.memberList.skinsParticipation || new Map();
  elements.memberList.selectedMemberIds = selectedMemberIds;
  elements.memberList.teeOverrides = teeOverrides;
  elements.memberList.pointsParticipation = pointsParticipation;
  elements.memberList.skinsParticipation = skinsParticipation;
  elements.gameList.innerHTML = "";
  elements.teamAssignmentPanel.classList.add("is-hidden");
  elements.teamAssignmentList.innerHTML = "";

  function updateSelectedCount() {
    elements.selectedPlayerCount.textContent =
      `Players selected: ${selectedMemberIds.size}`;
  }

  function renderMemberRows() {
    const selectedCourse = courses.find((course) => course.id === elements.courseSelect.value) || courses[0];
    const teeOptions = selectedCourse.teeOrder.map((teeId) => {
      const tee = selectedCourse.teeRatings[teeId];
      return {
        id: teeId,
        label: tee.label
      };
    });
    const searchText = elements.memberSearch.value.trim().toLowerCase();
    const visibleMembers = members.filter((member) => {
      if (!member.active) return false;
      if (!searchText) return true;

      return `${member.name} ${member.ghin || ""}`.toLowerCase().includes(searchText);
    });

    elements.memberList.innerHTML = "";

    visibleMembers.forEach((member) => {
      const isPlayingToday = selectedMemberIds.has(member.id);
      const isInPointsGame = isPlayingToday && pointsParticipation.get(member.id) === true;
      const isInSkinsGame = isPlayingToday && skinsParticipation.get(member.id) === true;
      const selectedTeeId = getValidCourseTeeId(selectedCourse, teeOverrides.get(member.id) || member.tee);
      const row = document.createElement("div");
      row.className = "member-row";
      row.innerHTML = `
        <label class="member-check">
          <input type="checkbox" data-member-id="${member.id}"${isPlayingToday ? " checked" : ""}>
          <span>
            <strong>${member.name}</strong>
            <span>${member.ghin ? `GHIN ${member.ghin}` : "No GHIN"} | Index ${member.handicap} | Default ${member.tee} tees</span>
          </span>
        </label>
        <label class="tee-select-label">
          <span>Tees</span>
          <select class="field-control" data-tee-for="${member.id}">
            ${teeOptions.map((tee) => `
              <option value="${tee.id}"${selectedTeeId === tee.id ? " selected" : ""}>${tee.label}</option>
            `).join("")}
          </select>
        </label>
        <label class="member-game-check">
          <input type="checkbox" data-points-for="${member.id}"${isInPointsGame ? " checked" : ""}${isPlayingToday ? "" : " disabled"}>
          <span>Points Game</span>
        </label>
        <label class="member-game-check">
          <input type="checkbox" data-skins-for="${member.id}"${isInSkinsGame ? " checked" : ""}${isPlayingToday ? "" : " disabled"}>
          <span>Skins Game</span>
        </label>
      `;
      elements.memberList.appendChild(row);
    });
  }

  renderMemberRows();
  updateSelectedCount();

  elements.courseSelect.onchange = renderMemberRows;
  elements.memberSearch.oninput = renderMemberRows;
  elements.memberList.onchange = (event) => {
    const checkbox = event.target.closest("[data-member-id]");
    const teeSelect = event.target.closest("[data-tee-for]");
    const pointsCheckbox = event.target.closest("[data-points-for]");
    const skinsCheckbox = event.target.closest("[data-skins-for]");

    if (checkbox?.checked) {
      selectedMemberIds.add(checkbox.dataset.memberId);
    } else if (checkbox) {
      selectedMemberIds.delete(checkbox.dataset.memberId);
      pointsParticipation.delete(checkbox.dataset.memberId);
      skinsParticipation.delete(checkbox.dataset.memberId);
    }

    if (teeSelect) {
      teeOverrides.set(teeSelect.dataset.teeFor, teeSelect.value);
    }

    if (pointsCheckbox) {
      pointsParticipation.set(pointsCheckbox.dataset.pointsFor, pointsCheckbox.checked);
    }

    if (skinsCheckbox) {
      skinsParticipation.set(skinsCheckbox.dataset.skinsFor, skinsCheckbox.checked);
    }

    updateSelectedCount();
    if (checkbox) {
      renderMemberRows();
    }
  };
};

window.OGSGolf.ui.readSetupSettings = function readSetupSettings(elements, courses, members) {
  const course = courses.find((item) => item.id === elements.courseSelect.value) || courses[0];
  const selectedMemberIds = elements.memberList.selectedMemberIds || new Set();
  const teeOverrides = elements.memberList.teeOverrides || new Map();
  const pointsParticipation = elements.memberList.pointsParticipation || new Map();
  const skinsParticipation = elements.memberList.skinsParticipation || new Map();
  const roundDate = elements.roundDate.value || getTodayInputValue();
  const enteredRoundName = elements.roundName.value.trim();
  const roundName = enteredRoundName || `${course.name} - ${roundDate}`;
  const pointsAmount = Math.max(1, Math.round(Number(elements.pointsGameAmount?.value || 15)));
  const skinsAmount = Math.max(1, Math.round(Number(elements.skinsGameAmount?.value || 5)));
  const selectedPlayers = members
    .filter((member) => selectedMemberIds.has(member.id))
    .map((member) => ({
      ...member,
      tee: getValidCourseTeeId(course, teeOverrides.get(member.id) || member.tee),
      inSkins: skinsParticipation.get(member.id) === true,
      inPoints: pointsParticipation.get(member.id) === true,
      inTeamChallenge: false,
      teamId: ""
    }));
  const hasPointsPlayers = selectedPlayers.some((player) => player.inPoints === true);
  const hasSkinsPlayers = selectedPlayers.some((player) => player.inSkins === true);
  const games = createDisabledGames();

  games.pointsGame.enabled = hasPointsPlayers;
  games.pointsGame.amount = Number.isFinite(pointsAmount) ? pointsAmount : 0;
  games.netSkins.enabled = hasSkinsPlayers;
  games.netSkins.amount = Number.isFinite(skinsAmount) ? skinsAmount : 0;

  return {
    id: `round-${Date.now()}`,
    course,
    courseId: course.id,
    date: roundDate,
    roundName,
    players: selectedPlayers,
    selectedPlayerIds: selectedPlayers.map((player) => player.id),
    teamAssignments: {},
    groups: [],
    groupScorers: [],
    groupRecords: [],
    startingHole: 1,
    currentHole: 1,
    eventStatus: "Setup",
    setupLocked: false,
    preRoundReviewComplete: false,
    games
  };
};

window.OGSGolf.ui.renderRoundSettingsSummary = function renderRoundSettingsSummary(elements, roundSettings) {
  const groupsText = roundSettings.groups
    .map((group, index) => `Group ${index + 1}: ${group.length}`)
    .join(" | ");

  elements.roundSettingsSummary.innerHTML = `
    <div class="settings-card">
      <div>
        <strong>${roundSettings.roundName || roundSettings.course.name}</strong>
        <span>${roundSettings.date || ""}</span>
      </div>
      <div>${roundSettings.players.length} players | ${roundSettings.groups.length} group${roundSettings.groups.length === 1 ? "" : "s"}</div>
      <div>${groupsText}</div>
    </div>
  `;
};
