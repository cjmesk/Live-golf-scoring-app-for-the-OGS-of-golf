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
  const matchTeams = elements.memberList.matchTeams || new Map();
  const manualMatchHandicaps = elements.memberList.manualMatchHandicaps || new Map();
  const groupAssignments = elements.memberList.groupAssignments || new Map();
  elements.memberList.selectedMemberIds = selectedMemberIds;
  elements.memberList.teeOverrides = teeOverrides;
  elements.memberList.pointsParticipation = pointsParticipation;
  elements.memberList.skinsParticipation = skinsParticipation;
  elements.memberList.matchTeams = matchTeams;
  elements.memberList.manualMatchHandicaps = manualMatchHandicaps;
  elements.memberList.groupAssignments = groupAssignments;
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
    const matchEnabled = elements.roundFormat?.value === "four-ball-match";
    const manualMatchHandicapsEnabled = matchEnabled
      && elements.matchScoring?.value === "net"
      && elements.matchHandicapSource?.value === "manual";

    visibleMembers.forEach((member) => {
      const isPlayingToday = selectedMemberIds.has(member.id);
      const isInPointsGame = isPlayingToday && pointsParticipation.get(member.id) === true;
      const isInSkinsGame = isPlayingToday && skinsParticipation.get(member.id) === true;
      const selectedTeeId = getValidCourseTeeId(selectedCourse, teeOverrides.get(member.id) || member.tee);
      const selectedIndex = Array.from(selectedMemberIds).indexOf(member.id);
      const defaultGroupNumber = Math.min(8, Math.floor(Math.max(0, selectedIndex) / 4) + 1);
      const groupNumber = Math.max(1, Math.min(8, Number(groupAssignments.get(member.id) || defaultGroupNumber)));
      const defaultTeam = selectedIndex >= 2 ? "B" : "A";
      const matchTeam = matchTeams.get(member.id) || defaultTeam;
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
        ${isPlayingToday ? `
          <label class="tee-select-label">
            <span>Playing Group</span>
            <select class="field-control" data-group-for="${member.id}">
              ${Array.from({ length: 8 }, (_, groupIndex) => groupIndex + 1)
                .map((number) => `<option value="${number}"${number === groupNumber ? " selected" : ""}>Group ${number}</option>`)
                .join("")}
            </select>
          </label>
        ` : ""}
        <label class="member-game-check">
          <input type="checkbox" data-points-for="${member.id}"${isInPointsGame ? " checked" : ""}${isPlayingToday ? "" : " disabled"}>
          <span>Points Game</span>
        </label>
        ${matchEnabled && isPlayingToday ? `
          <label class="tee-select-label">
            <span>Match Team</span>
            <select class="field-control" data-match-team-for="${member.id}">
              <option value="A"${matchTeam === "A" ? " selected" : ""}>${elements.matchTeamALabel?.value || "Team A"}</option>
              <option value="B"${matchTeam === "B" ? " selected" : ""}>${elements.matchTeamBLabel?.value || "Team B"}</option>
            </select>
          </label>
          ${manualMatchHandicapsEnabled ? `
            <label class="tee-select-label">
              <span>Playing HCP</span>
              <input class="field-control" data-match-handicap-for="${member.id}" type="number" step="1" value="${manualMatchHandicaps.get(member.id) ?? member.courseHandicap ?? member.handicap ?? 0}">
            </label>
          ` : ""}
        ` : ""}
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
    const matchTeamSelect = event.target.closest("[data-match-team-for]");
    const matchHandicapInput = event.target.closest("[data-match-handicap-for]");
    const groupSelect = event.target.closest("[data-group-for]");

    if (checkbox?.checked) {
      selectedMemberIds.add(checkbox.dataset.memberId);
    } else if (checkbox) {
      selectedMemberIds.delete(checkbox.dataset.memberId);
      pointsParticipation.delete(checkbox.dataset.memberId);
      skinsParticipation.delete(checkbox.dataset.memberId);
      matchTeams.delete(checkbox.dataset.memberId);
      manualMatchHandicaps.delete(checkbox.dataset.memberId);
      groupAssignments.delete(checkbox.dataset.memberId);
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

    if (matchTeamSelect) matchTeams.set(matchTeamSelect.dataset.matchTeamFor, matchTeamSelect.value);
    if (matchHandicapInput) manualMatchHandicaps.set(matchHandicapInput.dataset.matchHandicapFor, Number(matchHandicapInput.value));
    if (groupSelect) groupAssignments.set(groupSelect.dataset.groupFor, Number(groupSelect.value));

    updateSelectedCount();
    if (checkbox) {
      renderMemberRows();
    }
  };

  function updateMatchOptions() {
    const matchEnabled = elements.roundFormat?.value === "four-ball-match";
    const nineHoles = elements.matchHoles?.value === "9";
    const netScoring = elements.matchScoring?.value !== "gross";
    const automaticHandicaps = elements.matchHandicapSource?.value !== "manual";
    elements.fourBallMatchPanel?.classList.toggle("is-hidden", !matchEnabled);
    elements.matchNineLabel?.classList.toggle("is-hidden", !nineHoles);
    elements.matchHandicapSourceLabel?.classList.toggle("is-hidden", !netScoring);
    elements.matchAllowanceLabel?.classList.toggle("is-hidden", !netScoring || !automaticHandicaps);
    renderMemberRows();
  }

  if (elements.roundFormat) elements.roundFormat.onchange = updateMatchOptions;
  if (elements.matchHoles) elements.matchHoles.onchange = updateMatchOptions;
  if (elements.matchScoring) elements.matchScoring.onchange = updateMatchOptions;
  if (elements.matchHandicapSource) elements.matchHandicapSource.onchange = updateMatchOptions;
  if (elements.matchTeamALabel) elements.matchTeamALabel.oninput = renderMemberRows;
  if (elements.matchTeamBLabel) elements.matchTeamBLabel.oninput = renderMemberRows;
  updateMatchOptions();
};

window.OGSGolf.ui.readSetupSettings = function readSetupSettings(elements, courses, members) {
  const course = courses.find((item) => item.id === elements.courseSelect.value) || courses[0];
  const selectedMemberIds = elements.memberList.selectedMemberIds || new Set();
  const teeOverrides = elements.memberList.teeOverrides || new Map();
  const pointsParticipation = elements.memberList.pointsParticipation || new Map();
  const skinsParticipation = elements.memberList.skinsParticipation || new Map();
  const matchTeams = elements.memberList.matchTeams || new Map();
  const manualMatchHandicaps = elements.memberList.manualMatchHandicaps || new Map();
  const groupAssignments = elements.memberList.groupAssignments || new Map();
  const roundDate = elements.roundDate.value || getTodayInputValue();
  const enteredRoundName = elements.roundName.value.trim();
  const roundName = enteredRoundName || `${course.name} - ${roundDate}`;
  const roundType = Array.from(elements.roundTypeOptions || [])
    .find((option) => option.checked)?.value === "test" ? "test" : "official";
  const format = elements.roundFormat?.value === "four-ball-match" ? "four-ball-match" : "standard";
  const matchHoles = Number(elements.matchHoles?.value) === 9 ? 9 : 18;
  const fourBallMatch = {
    enabled: format === "four-ball-match",
    holes: matchHoles,
    startingHole: matchHoles === 9 && Number(elements.matchStartingHole?.value) === 10 ? 10 : 1,
    scoring: elements.matchScoring?.value === "gross" ? "gross" : "net",
    handicapSource: elements.matchHandicapSource?.value === "manual" ? "manual" : "automatic",
    allowance: Math.max(0, Math.min(100, Number(elements.matchAllowance?.value ?? 90))),
    teamALabel: elements.matchTeamALabel?.value.trim() || "Team A",
    teamBLabel: elements.matchTeamBLabel?.value.trim() || "Team B"
  };
  const pointsAmount = Math.max(1, Math.round(Number(elements.pointsGameAmount?.value || 15)));
  const skinsAmount = Math.max(1, Math.round(Number(elements.skinsGameAmount?.value || 5)));
  const selectedPlayers = members
    .filter((member) => selectedMemberIds.has(member.id))
    .map((member, selectedIndex) => ({
      ...member,
      tee: getValidCourseTeeId(course, teeOverrides.get(member.id) || member.tee),
      inSkins: skinsParticipation.get(member.id) === true,
      inPoints: pointsParticipation.get(member.id) === true,
      inTeamChallenge: false,
      teamId: "",
      matchTeam: format === "four-ball-match" ? (matchTeams.get(member.id) || (selectedIndex < 2 ? "A" : "B")) : "",
      matchPlayingHandicap: format === "four-ball-match" && fourBallMatch.handicapSource === "manual"
        ? Number(manualMatchHandicaps.get(member.id) ?? member.courseHandicap ?? member.handicap ?? 0)
        : null,
      setupGroupNumber: format === "four-ball-match"
        ? 1
        : Math.max(1, Math.min(8, Number(groupAssignments.get(member.id) || Math.floor(selectedIndex / 4) + 1)))
    }));
  const setupGroupCount = format === "four-ball-match"
    ? 1
    : Math.max(1, ...selectedPlayers.map((player) => player.setupGroupNumber));
  const setupGroups = Array.from({ length: setupGroupCount }, () => []);
  selectedPlayers.forEach((player) => setupGroups[player.setupGroupNumber - 1].push(player.id));
  const assignedGroups = setupGroups.filter((group) => group.length > 0);
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
    roundType,
    countsTowardStats: roundType === "official",
    format,
    fourBallMatch,
    players: selectedPlayers,
    selectedPlayerIds: selectedPlayers.map((player) => player.id),
    teamAssignments: {},
    groups: assignedGroups,
    groupCount: assignedGroups.length,
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
      <div>${roundSettings.roundType === "test" ? "Test Round - excluded from official statistics" : "Official Round - counts toward statistics"}</div>
      <div>${roundSettings.players.length} players | ${roundSettings.groups.length} group${roundSettings.groups.length === 1 ? "" : "s"}</div>
      <div>${groupsText}</div>
    </div>
  `;
};

