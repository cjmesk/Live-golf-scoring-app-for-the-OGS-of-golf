const { courses, players: defaultPlayers, maxRosterSize } = window.OGSGolf.data;
const { createRoundState, playerStorage, roundStorage, scorerStorage } = window.OGSGolf.state;
const { roundCloudService } = window.OGSGolf.cloud;
const { getHoleResult } = window.OGSGolf.rules;
const {
  clearPlayerForm,
  fillPlayerForm,
  getElements,
  readSetupSettings,
  readGroupAssignments,
  readGroupPlaySettings,
  readGroupScorers,
  readPlayerForm,
  renderCompletedScorecard,
  renderFinalSummary,
  renderEventSummary,
  renderGroupScorerOptions,
  renderGroupSetupView,
  renderHoleView,
  renderLeaderboard,
  renderPlayerManagement,
  renderPointsPayout,
  renderPreviousRounds,
  renderRoundSettingsSummary,
  renderSetupView,
  renderSkinsSummary
} = window.OGSGolf.ui;

const elements = getElements();
let members = playerStorage.getAll(defaultPlayers);
let selectedCourse = courses[0];
let selectedPlayers = [];
let roundSettings = null;
let pendingRoundSettings = null;
let roundState = null;
let statusTimer = null;
let completedRoundSaved = false;
let currentGroupIndex = 0;
let groupHoleIndexes = [];
let currentScorerId = null;
let commissionerMode = scorerStorage.isCommissioner();
let viewOnlyMode = false;
let pendingDnfPlayerId = null;
let scoreOverrideOpen = false;
let scoreOverrideActive = false;
let scoreOverrideReturnGroupIndex = 0;
let summaryDisplayRoundState = null;
let summaryReadOnlyMode = false;
let finalRoundSyncInFlight = false;
let latestCloudActiveRoundInfo = {
  id: "",
  cloudUpdatedAt: "",
  details: ""
};

function isDebugModeEnabled() {
  const urlDebugMode = new URLSearchParams(window.location.search).get("debug") === "1";
  return urlDebugMode || window.localStorage.getItem("ogsGolfDebugMode") === "true";
}

function setActiveScreen(screenName) {
  const isScoringScreen = screenName === "round";

  elements.todayScreen.classList.toggle("is-hidden", screenName !== "today");
  elements.resumeScreen.classList.toggle("is-hidden", screenName !== "resume");
  elements.scorerScreen.classList.toggle("is-hidden", screenName !== "scorer");
  elements.setupScreen.classList.toggle("is-hidden", screenName !== "setup");
  elements.groupSetupScreen.classList.toggle("is-hidden", screenName !== "groups");
  elements.eventSummaryScreen.classList.toggle("is-hidden", screenName !== "eventSummary");
  elements.roundScreen.classList.toggle("is-hidden", screenName !== "round");
  elements.summaryScreen.classList.toggle("is-hidden", screenName !== "summary");
  elements.previousRoundsScreen.classList.toggle("is-hidden", screenName !== "previous");
  elements.playerManagementScreen.classList.toggle("is-hidden", screenName !== "players");
  elements.courseInfoScreen.classList.toggle("is-hidden", screenName !== "courseInfo");
  elements.handicapVerifyScreen.classList.toggle("is-hidden", screenName !== "handicapVerify");
  elements.courseManagementScreen.classList.toggle("is-hidden", screenName !== "courses");
  elements.betSettingsScreen.classList.toggle("is-hidden", screenName !== "bets");
  elements.helpScreen.classList.toggle("is-hidden", screenName !== "help");
  elements.aboutScreen.classList.toggle("is-hidden", screenName !== "about");
  document.body.classList.toggle("is-scoring", isScoringScreen);
  elements.modeStatus.classList.toggle("is-hidden", isScoringScreen);
  elements.rosterCloudStatus.classList.toggle("is-hidden", isScoringScreen || screenName === "today");
  renderAccessMode();
}

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function scrollToScoring() {
  elements.holePlayers.scrollIntoView({ behavior: "auto", block: "start" });
}

function clearSaveConfirmation() {
  if (elements.saveConfirmation) {
    elements.saveConfirmation.innerHTML = "";
  }
}

function renderActiveRoundDiagnostics({ loadedFrom = "" } = {}) {
  if (!elements.activeRoundDiagnostics) return;

  const debugModeEnabled = isDebugModeEnabled();
  elements.activeRoundDiagnostics.classList.toggle("is-hidden", !debugModeEnabled);

  if (!debugModeEnabled) return;

  const localRound = roundStorage.getUnfinished();
  const localRoundId = localRound?.id || "none";
  const cloudRoundId = latestCloudActiveRoundInfo.id || "none";
  const loadedRoundId = roundState?.id || "none";
  const cloudUpdatedAt = latestCloudActiveRoundInfo.cloudUpdatedAt || "unknown";
  const detailsText = latestCloudActiveRoundInfo.details ? ` | ${latestCloudActiveRoundInfo.details}` : "";
  const loadedText = loadedFrom ? ` | Source: ${loadedFrom}` : "";

  elements.activeRoundDiagnostics.textContent =
    `Local round ID: ${localRoundId} | Cloud active round ID: ${cloudRoundId} | Loaded round ID: ${loadedRoundId} | Cloud updated time: ${cloudUpdatedAt}${detailsText}${loadedText}`;
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCurrentScorerName() {
  return members.find((member) => member.id === currentScorerId)?.name || "Scorer";
}

function getCurrentRoundId() {
  return roundState?.id || null;
}

function loadScorerForCurrentRound() {
  currentScorerId = getCurrentRoundId()
    ? scorerStorage.getScorerId(getCurrentRoundId())
    : null;
  return currentScorerId;
}

function clearScorerForCurrentRound() {
  scorerStorage.clearScorerId(getCurrentRoundId());
  currentScorerId = null;
}

function formatTodayDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function renderTodayRoundScreen() {
  const eventCourseName = roundSettings?.course?.name || selectedCourse?.name || "Twelve Stones Golf Club";
  const playerCount = selectedPlayers.length || roundSettings?.players?.length || 0;
  const groupCount = roundSettings?.groups?.length || 0;
  const startTime = roundSettings?.startTime || roundSettings?.teeTime || "Not set";
  const hasActiveRound = Boolean(roundState);

  elements.todayDate.textContent = formatTodayDate();
  elements.todayCourseName.textContent = eventCourseName;
  elements.todayEventStatus.textContent = hasActiveRound
    ? roundSettings?.eventStatus || "Open"
    : "No active round yet";
  elements.todayPlayerCount.textContent = String(playerCount);
  elements.todayStartTime.textContent = startTime;
  elements.todayGroupCount.textContent = String(groupCount);
  elements.viewLiveMatch.disabled = !hasActiveRound;
  elements.choosePlayerScoring.disabled = !hasActiveRound;
  elements.todayStatus.textContent = hasActiveRound
    ? "Today's match is ready."
    : "No active round yet.";
  updateLastRoundResultsVisibility();
}

function showTodayRoundScreen() {
  renderTodayRoundScreen();
  setActiveScreen("today");
  scrollToTop();
}

function getLastCompletedRound() {
  return roundStorage.getAll()
    .filter((round) => round?.completed === true)
    .sort((firstRound, secondRound) => {
      const firstDate = new Date(firstRound.savedAt || firstRound.date || 0).getTime();
      const secondDate = new Date(secondRound.savedAt || secondRound.date || 0).getTime();
      return secondDate - firstDate;
    })[0] || null;
}

function updateLastRoundResultsVisibility() {
  const hasLastRound = Boolean(getLastCompletedRound());
  elements.menuLastRoundResults?.classList.toggle("is-hidden", !hasLastRound);
  elements.todayLastRoundResults?.classList.toggle("is-hidden", !hasLastRound);
}

function createReadOnlyRoundStateFromSavedRound(savedRound) {
  if (!savedRound?.course?.id || !savedRound?.players?.length) return null;
  if (!savedRound.savedScores) return null;

  const savedCourse = courses.find((course) => course.id === savedRound.course.id) || courses[0];
  const savedPlayers = savedRound.players.map((player) => ({
    ...player,
    handicap: player.handicapIndex ?? player.handicap
  }));
  const savedSettings = {
    ...(savedRound.roundSettings || {}),
    games: {
      pointsGame: { enabled: false },
      netSkins: { enabled: false },
      teamChallenge: { enabled: false },
      ...(savedRound.roundSettings?.games || {})
    },
    groups: savedRound.roundSettings?.groups || [savedPlayers.map((player) => player.id)],
    groupRecords: savedRound.roundSettings?.groupRecords || [{ holesToPlay: savedCourse.tees.white.length }],
    course: savedCourse,
    players: savedPlayers
  };

  return createRoundState(savedCourse, savedPlayers, savedSettings, savedRound);
}

function renderAccessMode() {
  if (!elements.modeStatus) return;

  updateLastRoundResultsVisibility();
  elements.adminOnlyItems.forEach((item) => {
    item.classList.toggle("is-hidden", !commissionerMode);
  });

  elements.toggleCommissionerMode.textContent = commissionerMode
    ? "Commissioner Mode: On"
    : "Commissioner Mode: Off";
  elements.toggleCommissionerMode.classList.toggle("is-on", commissionerMode);
  elements.menuCommissionerPinLabel.classList.toggle("is-hidden", commissionerMode);

  if (commissionerMode) {
    elements.modeStatus.textContent = "Commissioner View: event setup, player management, reset, and all groups are unlocked.";
    elements.showPlayerManagement.disabled = false;
    return;
  }

  if (viewOnlyMode) {
    elements.modeStatus.textContent = "Viewing live match. Score entry is locked.";
    elements.showPlayerManagement.disabled = true;
    return;
  }

  elements.modeStatus.textContent = currentScorerId
    ? `Scorer View: ${getCurrentScorerName()} can enter scores for their assigned group.`
    : "Scorer View: choose your name, or enter the Commissioner PIN to create/manage an event.";
  elements.showPlayerManagement.disabled = true;
}

function closeMenu() {
  elements.appMenu.classList.add("is-hidden");
  elements.menuToggle.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
  const isOpen = elements.appMenu.classList.toggle("is-hidden") === false;
  elements.menuToggle.setAttribute("aria-expanded", String(isOpen));
}

function showAdminRequiredMessage(message) {
  renderScorerSelection();
  elements.scorerAccessStatus.textContent = message || "Turn on Commissioner Mode from the menu to use that tool.";
}

async function openSetupWizard({ focusTeamSetup = false } = {}) {
  if (!commissionerMode) {
    showAdminRequiredMessage("Turn on Commissioner Mode to start the setup wizard.");
    return;
  }

  if (roundSettings?.eventStatus === "Started" || roundSettings?.setupLocked) {
    setActiveScreen("round");
    renderApp();
    elements.modeStatus.textContent = "Round setup is locked because this event has started. Use Edit Round Setup for commissioner-only corrections.";
    scrollToScoring();
    return;
  }

  await loadRosterFromCloud();

  if (roundState || roundStorage.getUnfinished()) {
    await clearRoundCacheForReset();
  }

  roundSettings = null;
  pendingRoundSettings = null;
  roundState = null;
  selectedPlayers = [];
  currentGroupIndex = 0;
  groupHoleIndexes = [];
  completedRoundSaved = false;
  elements.roundDate.value = "";
  elements.roundName.value = "";
  elements.memberSearch.value = "";
  elements.memberList.selectedMemberIds = new Set();
  elements.memberList.teeOverrides = new Map();
  renderSetupView(elements, courses, members);
  setActiveScreen("setup");
  scrollToTop();

  if (focusTeamSetup) {
    elements.gameList.querySelector('[data-game-enabled="teamChallenge"]')?.focus();
  }
}

async function showLiveScoring() {
  if (!roundState) {
    if (commissionerMode) {
      openSetupWizard();
      return;
    }

    renderScorerSelection();
    elements.scorerAccessStatus.textContent = "No active round yet. Ask the commissioner to start one.";
    return;
  }

  if (!commissionerMode && !currentScorerId) {
    renderScorerSelection();
    elements.scorerAccessStatus.textContent = "Choose the scorer assigned to this device for this match.";
    return;
  }

  if (commissionerMode) {
    await showCommissionerGroupSelection();
    return;
  }

  setActiveScreen("round");
  renderApp();
  showScoreMyGroup();
  scrollToScoring();
}

async function showLeaderboard() {
  await showLiveScoring();

  if (roundState) {
    showLeaderboardPage();
  }
}

function showSimpleScreen(screenName) {
  setActiveScreen(screenName);
  scrollToTop();
}

function formatRatingValue(value) {
  return value === null || value === undefined ? "Not set" : value;
}

function renderCourseInfo() {
  const course = selectedCourse || courses[0];
  const teeIds = course.teeOrder;
  const teeCards = teeIds
    .map((teeId) => {
      const tee = course.teeRatings[teeId];

      return `
        <div class="summary-card">
          <span>${tee.label}</span>
          <strong>${tee.totalYardage ?? "Not set"} yds</strong>
          <small>Rating ${formatRatingValue(tee.courseRating)} | Slope ${formatRatingValue(tee.slopeRating)}</small>
        </div>
      `;
    })
    .join("");
  const holeRows = course.tees[teeIds[0]]
    .map((hole, index) => `
      <tr>
        <td>${hole.hole}</td>
        <td>${hole.par}</td>
        <td>${hole.handicap}</td>
        ${teeIds.map((teeId) => `<td>${course.tees[teeId][index].yards ?? "Not set"}</td>`).join("")}
      </tr>
    `)
    .join("");

  elements.courseInfoContent.innerHTML = `
    <div class="setup-panel">
      <strong>${course.name}</strong>
      <span class="player-details">Read-only verification. This page uses the same course data source as scoring.</span>
    </div>

    <section class="summary-block">
      <h3>Tee Summary</h3>
      <div class="summary-grid">${teeCards}</div>
    </section>

    <section class="summary-block">
      <h3>Hole-by-Hole Data</h3>
      <div class="course-table-wrap">
        <table class="course-info-table">
          <thead>
            <tr>
              <th>Hole</th>
              <th>Par</th>
              <th>HCP</th>
              ${teeIds.map((teeId) => `<th>${course.teeRatings[teeId].label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${holeRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function formatHandicapNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "Not available";
}

function getHandicapDetailsFor(player, course, teeId) {
  return window.OGSGolf.rules.getCourseHandicapDetails(
    { ...player, tee: teeId },
    course,
    teeId
  );
}

function renderHandicapVerificationResult() {
  const player = members.find((member) => member.id === elements.handicapVerifyPlayer.value) || members[0];
  const course = courses.find((item) => item.id === elements.handicapVerifyCourse.value) || courses[0];
  const teeId = elements.handicapVerifyTee.value || player?.tee || course.teeOrder[0];

  if (!player || !course) {
    elements.handicapVerifyResult.innerHTML = `<span class="player-details">No player or course available.</span>`;
    return;
  }

  const tee = course.teeRatings[teeId];

  if (!tee || tee.courseRating === null || tee.slopeRating === null) {
    elements.handicapVerifyResult.innerHTML = `<span class="player-details">This tee is missing rating or slope data.</span>`;
    return;
  }

  const details = getHandicapDetailsFor(player, course, teeId);

  elements.handicapVerifyResult.innerHTML = `
    <strong>Player: ${player.name}</strong>
    <span class="player-details">Handicap Index: ${details.handicapIndex}</span>
    <span class="player-details">Course: ${course.name}</span>
    <span class="player-details">Tee: ${tee.label}</span>
    <span class="player-details">Course Rating: ${details.courseRating}</span>
    <span class="player-details">Slope Rating: ${details.slopeRating}</span>
    <span class="player-details">Par: ${details.par}</span>
    <span class="player-details">Unrounded: ${formatHandicapNumber(details.unrounded)}</span>
    <strong>Course Handicap: ${details.courseHandicap}</strong>
  `;
}

function renderHandicapVerificationExamples() {
  const course = courses[0];
  const examplePlayers = members.slice(0, 3);
  const exampleTees = ["white", "silver", "gold"];

  elements.handicapVerifyExamples.innerHTML = examplePlayers
    .map((player, index) => {
      const teeId = exampleTees[index] || player.tee || course.teeOrder[0];
      const tee = course.teeRatings[teeId];
      const details = getHandicapDetailsFor(player, course, teeId);

      return `
        <div class="summary-row">
          <span>${player.name}</span>
          <strong>${tee.label}: CH ${details.courseHandicap}</strong>
          <small>Index ${details.handicapIndex} | Rating ${details.courseRating} | Slope ${details.slopeRating} | Par ${details.par}</small>
          <small>Unrounded ${formatHandicapNumber(details.unrounded)}</small>
        </div>
      `;
    })
    .join("");
}

function renderHandicapVerification() {
  const currentPlayerId = elements.handicapVerifyPlayer.value;
  const currentCourseId = elements.handicapVerifyCourse.value || selectedCourse.id;
  const course = courses.find((item) => item.id === currentCourseId) || selectedCourse || courses[0];
  const player = members.find((member) => member.id === currentPlayerId) || members[0];

  elements.handicapVerifyPlayer.innerHTML = members
    .map((member) => `<option value="${member.id}"${member.id === player?.id ? " selected" : ""}>${member.name}</option>`)
    .join("");
  elements.handicapVerifyCourse.innerHTML = courses
    .map((item) => `<option value="${item.id}"${item.id === course.id ? " selected" : ""}>${item.name}</option>`)
    .join("");
  elements.handicapVerifyTee.innerHTML = course.teeOrder
    .map((teeId) => {
      const tee = course.teeRatings[teeId];
      const selected = teeId === (elements.handicapVerifyTee.value || player?.tee || course.teeOrder[0]);
      return `<option value="${teeId}"${selected ? " selected" : ""}>${tee.label}</option>`;
    })
    .join("");

  renderHandicapVerificationResult();
  renderHandicapVerificationExamples();
}

function setCommissionerMode(isOn) {
  commissionerMode = isOn;
  currentScorerId = isOn ? null : currentScorerId;
  clearSaveConfirmation();

  if (isOn) {
    clearScorerForCurrentRound();
    scoreOverrideReturnGroupIndex = currentGroupIndex;
  } else {
    scoreOverrideOpen = false;
    scoreOverrideActive = false;
  }

  scorerStorage.setCommissionerMode(isOn);
  renderAccessMode();

  if (!isOn) {
    if (roundState && currentScorerId) {
      currentGroupIndex = getAssignedGroupIndex(currentScorerId);
      setActiveScreen("round");
      renderApp();
      showScoreMyGroup();
      scrollToScoring();
      return;
    }

    renderScorerSelection();
  }
}

function turnOnCommissionerFromMenu() {
  if (elements.menuCommissionerPin.value !== scorerStorage.commissionerPin) {
    elements.modeStatus.textContent = "Wrong Commissioner PIN. Admin tools stayed locked.";
    elements.menuCommissionerPin.value = "";
    elements.menuCommissionerPin.focus();
    return false;
  }

  elements.menuCommissionerPin.value = "";
  setCommissionerMode(true);
  return true;
}

async function handleMenuAction(action) {
  closeMenu();

  if (action === "setup") {
    await openSetupWizard();
    return;
  }

  if (action === "editSetup") {
    if (!commissionerMode) {
      showAdminRequiredMessage("Turn on Commissioner Mode to edit round setup.");
      return;
    }

    if (!roundState) {
      await openSetupWizard();
      return;
    }

    setActiveScreen("round");
    renderApp();
    elements.modeStatus.textContent = "Edit Round Setup is commissioner-only. Setup is locked for scorers; make beta corrections from Commissioner View.";
    scrollToScoring();
    return;
  }

  if (action === "scoring") {
    showLiveScoring();
    return;
  }

  if (action === "leaderboard") {
    await showLeaderboard();
    return;
  }

  if (action === "lastResults") {
    showLastRoundResults();
    return;
  }

  if (action === "courseInfo") {
    renderCourseInfo();
    showSimpleScreen("courseInfo");
    return;
  }

  if (action === "handicapVerify") {
    if (!commissionerMode) {
      showAdminRequiredMessage("Turn on Commissioner Mode to verify course handicaps.");
      return;
    }

    renderHandicapVerification();
    showSimpleScreen("handicapVerify");
    return;
  }

  if (action === "players") {
    showPlayerManagement();
    return;
  }

  if (action === "courses") {
    if (!commissionerMode) {
      showAdminRequiredMessage("Turn on Commissioner Mode to manage courses.");
      return;
    }

    showSimpleScreen("courses");
    return;
  }

  if (action === "bets") {
    if (!commissionerMode) {
      showAdminRequiredMessage("Turn on Commissioner Mode to edit bet settings.");
      return;
    }

    showSimpleScreen("bets");
    return;
  }

  if (action === "teams") {
    await openSetupWizard({ focusTeamSetup: true });
    return;
  }

  if (action === "previous") {
    showPreviousRounds();
    return;
  }

  if (action === "help" || action === "about") {
    showSimpleScreen(action);
  }
}

function showRosterCloudStatus(message) {
  if (!elements.rosterCloudStatus) return;

  elements.rosterCloudStatus.textContent = message;

  const shouldShowRosterStatus = commissionerMode
    || !elements.setupScreen.classList.contains("is-hidden")
    || !elements.playerManagementScreen.classList.contains("is-hidden");
  elements.rosterCloudStatus.classList.toggle("is-hidden", !shouldShowRosterStatus);
}

function getGroupScorerName(groupIndex) {
  const scorerId = roundSettings?.groupScorers?.[groupIndex]
    || roundSettings?.groupRecords?.[groupIndex]?.scorekeeperId;
  const scorer = selectedPlayers.find((player) => player.id === scorerId)
    || members.find((member) => member.id === scorerId);

  return scorer?.name || "Not assigned";
}

function getGroupDisplayStatus(groupIndex) {
  const record = getGroupRecord(groupIndex);

  if (isGroupComplete(groupIndex) || record.status === "completed") {
    return "Completed";
  }

  return "In progress";
}

function renderScoreOverrideControls() {
  if (!elements.commissionerGroupControls) return;

  const shouldShow = Boolean(commissionerMode && roundState && roundSettings?.groups?.length);
  elements.commissionerGroupControls.classList.toggle("is-hidden", !shouldShow);

  if (!shouldShow) {
    scoreOverrideOpen = false;
    elements.scoreOverrideList?.classList.add("is-hidden");
    elements.scoreOverrideBanner?.classList.add("is-hidden");
    return;
  }

  elements.scoreOverrideBanner?.classList.toggle("is-hidden", !scoreOverrideActive);

  if (elements.scoreOverrideBannerText) {
    elements.scoreOverrideBannerText.textContent =
      `Commissioner Override - Scoring Group ${currentGroupIndex + 1}`;
  }

  if (elements.scoreOverrideList) {
    elements.scoreOverrideList.classList.toggle("is-hidden", !scoreOverrideOpen);
    elements.scoreOverrideList.innerHTML = roundSettings.groups
      .map((group, index) => {
        const record = getGroupRecord(index);
        const activeClass = index === currentGroupIndex ? " is-active" : "";

        return `
          <button type="button" class="score-override-row${activeClass}" data-override-group-index="${index}">
            <strong>Group ${index + 1}</strong>
            <span>Scorer: ${getGroupScorerName(index)}</span>
            <span>Current hole: ${record.currentHole || 1}</span>
            <span>Status: ${getGroupDisplayStatus(index)}</span>
          </button>
        `;
      })
      .join("");
  }
}

function hideCommissionerGroupSelection() {
  elements.roundScreen?.classList.remove("is-commissioner-group-selection");
  elements.commissionerGroupSelection?.classList.add("is-hidden");
}

function getCommissionerGroupRowText(groupIndex) {
  const record = getGroupRecord(groupIndex);
  const complete = isGroupComplete(groupIndex) || record.status === "completed";
  const statusText = complete ? "Complete" : `Hole ${record.currentHole || 1}`;
  const actionText = complete ? "Review Scores" : "Open Scoring";

  return {
    statusText,
    actionText
  };
}

function renderCommissionerGroupSelection() {
  if (!elements.commissionerGroupSelection || !elements.commissionerGroupSelectionList) return;

  syncAllGroupCompletionsFromScores();
  setActiveScreen("round");
  elements.roundScreen.classList.remove("is-leaderboard-view", "is-group-complete");
  elements.roundScreen.classList.add("is-commissioner-group-selection");
  elements.commissionerGroupSelection.classList.remove("is-hidden");

  elements.commissionerGroupSelectionList.innerHTML = roundSettings.groups
    .map((group, index) => {
      const record = getGroupRecord(index);
      const activeClass = index === currentGroupIndex ? " is-active" : "";
      const { statusText, actionText } = getCommissionerGroupRowText(index);

      return `
        <button type="button" class="score-override-row${activeClass}" data-commissioner-group-index="${index}">
          <strong>Group ${index + 1} - ${statusText} - ${actionText}</strong>
          <span>Scorer: ${getGroupScorerName(index)}</span>
          <span>${group.length} players | Starting hole ${record.startingHole || 1} | ${record.completedHoleNumbers.length}/${record.holesToPlay} holes saved</span>
        </button>
      `;
    })
    .join("");

  renderLeaderboard(elements, selectedPlayers, roundState);
}

async function showCommissionerGroupSelection({ refresh = true } = {}) {
  if (!commissionerMode || !roundState || !roundSettings?.groups?.length) return;

  if (refresh && roundState.id) {
    elements.liveRefreshStatus.textContent = "Checking live group status...";
    const refreshResult = await applyCloudScoreStateForActiveRound(roundState.id);
    elements.liveRefreshStatus.textContent = refreshResult.ok
      ? "Live group status updated."
      : (refreshResult.message || "Cloud status check failed. Showing this device's saved copy.");
  }

  renderCommissionerGroupSelection();
  scrollToTop();
}

async function openCommissionerGroup(groupIndex) {
  if (!commissionerMode || !roundSettings?.groups?.length) return;

  if (roundState?.id) {
    elements.liveRefreshStatus.textContent = "Loading selected group from cloud...";
    const refreshResult = await applyCloudScoreStateForActiveRound(roundState.id);
    elements.liveRefreshStatus.textContent = refreshResult.ok
      ? `Group ${groupIndex + 1} loaded.`
      : (refreshResult.message || "Cloud load failed. Showing this device's saved copy.");
  }

  goToGroup(groupIndex);
}

function mergeRoster(localPlayers, cloudPlayers) {
  const mergedById = new Map();

  localPlayers.forEach((player) => {
    mergedById.set(player.id, player);
  });

  cloudPlayers.forEach((player) => {
    mergedById.set(player.id, player);
  });

  return Array.from(mergedById.values()).sort((firstPlayer, secondPlayer) =>
    firstPlayer.name.localeCompare(secondPlayer.name)
  );
}

async function loadRosterFromCloud({ manual = false } = {}) {
  if (manual && elements.playerManagementStatus) {
    elements.playerManagementStatus.textContent = "Loading roster from Supabase...";
  }

  const result = await roundCloudService.loadPlayers();

  if (result.ok) {
    members = result.players;
    playerStorage.saveAll(members);
    renderSetupView(elements, courses, members);

    if (!elements.playerManagementScreen.classList.contains("is-hidden")) {
      renderPlayerManagement(elements, members, maxRosterSize);
    }

    if (manual && elements.playerManagementStatus) {
      elements.playerManagementStatus.textContent = result.message;
    }

    showRosterCloudStatus(result.message || "Roster loaded from Supabase.");
    return true;
  }

  const failureMessage = "Cloud roster failed, using default roster.";

  if (!playerStorage.hasSavedRoster()) {
    members = defaultPlayers;
    renderSetupView(elements, courses, members);
  }

  if (manual && elements.playerManagementStatus) {
    elements.playerManagementStatus.textContent = failureMessage;
  }

  showRosterCloudStatus(failureMessage);
  return false;
}

function renderHoleStatus() {
  if (!roundState) return;

  syncGroupCompletionFromScores(currentGroupIndex);
  const visibleGroups = commissionerMode
    ? roundSettings.groups.map((group, index) => ({ group, index }))
    : [{ group: roundSettings.groups[currentGroupIndex], index: currentGroupIndex }];
  const groupRecord = getGroupRecord(currentGroupIndex);
  const groupComplete = groupRecord.status === "completed" || isGroupComplete(currentGroupIndex);
  const canEdit = canEditCurrentGroup() && !groupComplete;

  elements.roundNameStatus.textContent = roundSettings.roundName || "OG's Golf";
  elements.courseNameStatus.textContent = roundSettings.course?.name || selectedCourse.name;
  elements.commissionerViewBadge.classList.toggle("is-hidden", !commissionerMode);
  elements.currentHoleStatus.textContent =
    groupComplete
      ? `Group ${currentGroupIndex + 1} complete`
      : `Hole ${roundState.currentHoleIndex + 1} of ${roundState.totalHoles}`;
  elements.currentGroupStatus.textContent =
    `Group ${currentGroupIndex + 1}`;
  elements.groupSwitcher.innerHTML = visibleGroups
    .map(({ group, index }) => {
      const groupRecord = getGroupRecord(index);
      const completeText = isGroupComplete(index) ? "complete" : `Hole ${groupRecord.currentHole}`;
      return `<option value="${index}"${index === currentGroupIndex ? " selected" : ""}>Group ${index + 1} - ${completeText} - ${group.length} players</option>`;
    })
    .join("");
  const sequence = getGroupHoleSequence(currentGroupIndex);
  elements.holeSelector.innerHTML = getValidHoleNumbers()
    .map((holeNumber) => {
      const isRequired = sequence.includes(holeNumber);
      const label = isRequired ? `Hole ${holeNumber}` : `Hole ${holeNumber} (extra)`;
      return `<option value="${holeNumber}"${holeNumber === roundState.currentHoleIndex + 1 ? " selected" : ""}>${label}</option>`;
    })
    .join("");
  elements.holeSelector.disabled = !canEdit;
  elements.commissionerGroupControls.classList.toggle("is-hidden", !commissionerMode);
  elements.previousGroup.classList.add("is-hidden");
  elements.nextGroup.classList.add("is-hidden");
  elements.previousGroup.disabled = true;
  elements.nextGroup.disabled = true;
  elements.groupSwitcher.disabled = !commissionerMode;
  renderScoreOverrideControls();
  elements.roundScreen.classList.toggle("is-group-complete", groupComplete);
  elements.saveHole.classList.toggle("is-hidden", groupComplete);
  elements.saveHole.disabled = !canEdit || groupComplete;
  elements.previousHole.disabled = !canEdit;
  elements.nextHole.classList.add("is-hidden");
  elements.undoLastHole.classList.add("is-hidden");
  elements.nextHole.disabled = true;
  elements.undoLastHole.disabled = !canEdit;
  elements.holePlayers.querySelectorAll("button[data-player-id]").forEach((button) => {
    button.disabled = !canEdit;
  });
  if (groupComplete) {
    renderCompletedGroupPage();
  } else {
    elements.completedGroupPanel.classList.add("is-hidden");
    renderGroupCompletionSummary();
  }
}

function renderCurrentHole() {
  syncGroupCompletionFromScores(currentGroupIndex);
  if (getGroupRecord(currentGroupIndex).status === "completed" || isGroupComplete(currentGroupIndex)) {
    syncRoundStateToCurrentGroup();
  } else {
    renderHoleView(elements, selectedCourse, getCurrentGroupPlayers(), roundState, { commissionerMode });
  }
  renderHoleStatus();
}

function getCurrentGroupPlayers() {
  const groupIds = roundSettings?.groups?.[currentGroupIndex] || selectedPlayers.slice(0, 4).map((player) => player.id);
  return selectedPlayers.filter((player) => groupIds.includes(player.id));
}

function getGroupPlayers(groupIndex) {
  const groupIds = roundSettings?.groups?.[groupIndex] || [];
  return selectedPlayers.filter((player) => groupIds.includes(player.id));
}

function getValidHoleNumbers() {
  const courseHoleCount = selectedCourse?.tees?.[selectedCourse.teeOrder?.[0]]?.length || 18;
  return Array.from({ length: roundState?.totalHoles || courseHoleCount }, (_, index) => index + 1);
}

function buildHoleSequence(startingHole = 1, holesToPlay = 18) {
  const totalHoles = roundState?.totalHoles || 18;
  const start = Math.max(1, Math.min(totalHoles, Number(startingHole) || 1));
  const count = Math.max(1, Math.min(totalHoles, Number(holesToPlay) || totalHoles));

  return Array.from({ length: count }, (_, index) =>
    ((start - 1 + index) % totalHoles) + 1
  );
}

function getGroupRecord(groupIndex = currentGroupIndex) {
  if (!roundSettings) return null;

  roundSettings.groupRecords = roundSettings.groupRecords || [];
  if (!roundSettings.groupRecords[groupIndex]) {
    roundSettings.groupRecords[groupIndex] = {
      id: `group-${groupIndex + 1}`,
      label: `Group ${groupIndex + 1}`,
      playerIds: roundSettings.groups[groupIndex] || [],
      scorekeeperId: roundSettings.groupScorers?.[groupIndex] || "",
      startingHole: (groupHoleIndexes[groupIndex] ?? 0) + 1,
      currentHole: (groupHoleIndexes[groupIndex] ?? 0) + 1,
      holesToPlay: roundState?.totalHoles || 18,
      completedHoleNumbers: [],
      status: "in_progress"
    };
  }

  const record = roundSettings.groupRecords[groupIndex];
  record.playerIds = roundSettings.groups[groupIndex] || record.playerIds || [];
  record.scorekeeperId = roundSettings.groupScorers?.[groupIndex] || record.scorekeeperId || "";
  record.startingHole = Number(record.startingHole || 1);
  record.currentHole = Number(record.currentHole || record.startingHole || 1);
  record.holesToPlay = Number(record.holesToPlay || roundState?.totalHoles || 18);
  record.completedHoleNumbers = Array.from(new Set((record.completedHoleNumbers || []).map(Number))).sort((a, b) => a - b);
  record.status = record.completedHoleNumbers.length >= record.holesToPlay ? "completed" : (record.status || "in_progress");

  return record;
}

function getGroupHoleSequence(groupIndex = currentGroupIndex) {
  const record = getGroupRecord(groupIndex);
  return buildHoleSequence(record?.startingHole || 1, record?.holesToPlay || 18);
}

function setCurrentHoleForGroup(groupIndex, holeNumber) {
  const validHoleNumbers = getValidHoleNumbers();
  const nextHoleNumber = validHoleNumbers.includes(Number(holeNumber))
    ? Number(holeNumber)
    : validHoleNumbers[0];
  const record = getGroupRecord(groupIndex);

  record.currentHole = nextHoleNumber;
  groupHoleIndexes[groupIndex] = nextHoleNumber - 1;
}

function markGroupHoleComplete(groupIndex, holeNumber) {
  const record = getGroupRecord(groupIndex);
  const sequence = getGroupHoleSequence(groupIndex);

  if (!sequence.includes(holeNumber)) return;

  record.completedHoleNumbers = Array.from(new Set([
    ...(record.completedHoleNumbers || []),
    holeNumber
  ])).sort((a, b) => a - b);
  record.status = record.completedHoleNumbers.length >= record.holesToPlay
    ? "completed"
    : "in_progress";
}

function getGroupCompletedHoleNumbersFromScores(groupIndex) {
  if (!roundState) return [];

  const sequence = getGroupHoleSequence(groupIndex);
  const activePlayers = getGroupPlayers(groupIndex)
    .filter((player) => !roundState.isPlayerDnf(player));

  return sequence.filter((holeNumber) =>
    activePlayers.every((player) => {
      const score = roundState.savedScores[player.id]?.[holeNumber - 1];
      return Number.isFinite(Number(score)) && Number(score) > 0;
    })
  );
}

function syncGroupCompletionFromScores(groupIndex) {
  const record = getGroupRecord(groupIndex);
  const completedFromScores = getGroupCompletedHoleNumbersFromScores(groupIndex);

  record.completedHoleNumbers = completedFromScores;

  record.status = record.completedHoleNumbers.length >= record.holesToPlay
    ? "completed"
    : "in_progress";

  return record;
}

function syncAllGroupCompletionsFromScores() {
  if (!roundSettings?.groups?.length || !roundState) return;

  roundSettings.groups.forEach((group, index) => {
    syncGroupCompletionFromScores(index);
  });
}

function applyCloudGroupsToRoundSettings(groups = []) {
  if (!roundSettings?.groupRecords?.length) return;

  groups.forEach((cloudGroup) => {
    const groupIndex = Number(cloudGroup.group_number) - 1;
    const record = roundSettings.groupRecords[groupIndex];

    if (!record) return;

    record.cloudId = cloudGroup.id;
    record.startingHole = Number(cloudGroup.starting_hole || record.startingHole || 1);
    record.holesToPlay = Number(cloudGroup.holes_to_play || record.holesToPlay || 18);
    record.status = cloudGroup.status || record.status || "in_progress";
    record.completedAt = cloudGroup.completed_at || record.completedAt || null;
  });
}

function getGroupGrossRows(groupIndex = currentGroupIndex) {
  const record = getGroupRecord(groupIndex);
  const sequence = getGroupHoleSequence(groupIndex);
  const isNineHoleRound = Number(record.holesToPlay) === 9;
  const nineLabel = sequence.every((holeNumber) => holeNumber <= 9)
    ? "Front"
    : sequence.every((holeNumber) => holeNumber >= 10)
      ? "Back"
      : "Nine";

  return getGroupPlayers(groupIndex).map((player) => {
    const front = sequence
      .filter((holeNumber) => holeNumber <= 9)
      .reduce((total, holeNumber) => total + Number(roundState.savedScores[player.id][holeNumber - 1] || 0), 0);
    const back = sequence
      .filter((holeNumber) => holeNumber >= 10)
      .reduce((total, holeNumber) => total + Number(roundState.savedScores[player.id][holeNumber - 1] || 0), 0);
    const gross = sequence.reduce((total, holeNumber) =>
      total + Number(roundState.savedScores[player.id][holeNumber - 1] || 0), 0
    );

    return {
      player,
      holes: sequence.length,
      front,
      back,
      gross,
      isNineHoleRound,
      nineLabel
    };
  });
}

function renderGroupCompletionSummary() {
  if (!isGroupComplete(currentGroupIndex)) {
    elements.groupCompletionSummary.classList.add("is-hidden");
    elements.groupCompletionSummary.textContent = "";
    return;
  }

  const record = getGroupRecord(currentGroupIndex);
  const summaryRows = getGroupGrossRows(currentGroupIndex)
    .map((row) => `${row.player.name}: Gross ${row.gross}`)
    .join(" | ");

  elements.groupCompletionSummary.classList.remove("is-hidden");
  elements.groupCompletionSummary.textContent =
    `Group ${currentGroupIndex + 1} complete: ${record.completedHoleNumbers.length} of ${record.holesToPlay} required holes saved. ${summaryRows}`;
}

function renderCompletedGroupPage() {
  const record = getGroupRecord(currentGroupIndex);
  const rows = getGroupGrossRows(currentGroupIndex);
  const allGroupsComplete = areAllGroupsComplete();
  const compactRows = rows.map((row) => `
    <div class="completed-gross-row">
      <strong>${row.player.name}</strong>
      <span>${roundState.isPlayerDnf(row.player) ? roundState.formatDnfStatus(row.player) : `${row.holes} holes`}</span>
      <b>${roundState.isPlayerDnf(row.player) ? "DNF" : `Gross ${row.gross}`}</b>
    </div>
  `).join("");

  elements.completedGroupTitle.textContent = `Group ${currentGroupIndex + 1} Round Complete`;
  elements.completedGroupMessage.textContent =
    commissionerMode && !allGroupsComplete
      ? "Your group is complete. Other groups are still playing."
      : `Group ${currentGroupIndex + 1} has completed all required holes. All gross scores have been saved.`;
  elements.completedGroupGrossSummary.innerHTML = compactRows;
  elements.completedGroupStatus.textContent = allGroupsComplete
    ? "All groups have completed the round. The commissioner may now review and close the event."
    : commissionerMode
      ? "Manage remaining groups to score or review another group."
      : "Waiting for the remaining groups to finish.";
  elements.reviewGroupScores.textContent = commissionerMode ? "Review This Group" : "Review My Group Scores";
  elements.activeRoundManagement.textContent = commissionerMode && !allGroupsComplete
    ? "Manage Remaining Groups"
    : "Active Round Management";
  elements.activeRoundManagement.classList.toggle("is-hidden", !commissionerMode);
  elements.groupScoreReview.classList.add("is-hidden");
  elements.groupScoreReview.innerHTML = "";
  elements.completedGroupPanel.classList.remove("is-hidden");
}

function getCompactPlayerLabels(players) {
  const usedLabels = new Set();

  return players.map((player) => {
    const nameParts = player.name.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || player.name;
    const lastName = nameParts[nameParts.length - 1] || "";
    const candidates = [
      `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase(),
      `${firstName[0] || ""}${lastName.slice(0, 2)}`.toUpperCase(),
      player.name.slice(0, 3).toUpperCase()
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

function renderGroupScoreReview() {
  const sequence = getGroupHoleSequence(currentGroupIndex);
  const players = getCurrentGroupPlayers();
  const playerLabels = getCompactPlayerLabels(players);
  const holeRows = sequence.map((holeNumber) => {
    const scores = playerLabels
      .map(({ player, label }) => `
        <span class="group-review-score" title="${escapeText(player.name)}">
          <b>${escapeText(label)}</b>
          ${roundState.savedScores[player.id][holeNumber - 1] ?? "-"}
        </span>
      `)
      .join("");

    return `
      <div class="group-review-row">
        <strong>Hole ${holeNumber}</strong>
        <div class="group-review-score-grid">${scores}</div>
      </div>
    `;
  }).join("");
  const grossRows = getGroupGrossRows(currentGroupIndex);
  const firstRow = grossRows[0];
  const isNineHoleRound = firstRow?.isNineHoleRound;
  const nineLabel = firstRow?.nineLabel || "Nine";

  function renderTotalRow(label, valueGetter) {
    const scores = playerLabels
      .map(({ player, label: playerLabel }) => {
        const row = grossRows.find((grossRow) => grossRow.player.id === player.id);
        return `
          <span class="group-review-score" title="${escapeText(player.name)}">
            <b>${escapeText(playerLabel)}</b>
            ${valueGetter(row)}
          </span>
        `;
      })
      .join("");

    return `
      <div class="group-review-row group-review-total-row">
        <strong>${escapeText(label)}</strong>
        <div class="group-review-score-grid">${scores}</div>
      </div>
    `;
  }

  elements.groupScoreReview.innerHTML = `
    <h3>Review Group ${currentGroupIndex + 1} Scores</h3>
    <div class="group-review-list">
      ${holeRows}
      ${isNineHoleRound
        ? renderTotalRow(`${nineLabel} Gross`, (row) => row?.gross ?? "-")
        : `
          ${renderTotalRow("Front Gross", (row) => row?.front || "-")}
          ${renderTotalRow("Back Gross", (row) => row?.back || "-")}
        `}
      ${renderTotalRow("Total Gross", (row) => row?.gross ?? "-")}
    </div>
  `;
  elements.groupScoreReview.classList.toggle("is-hidden");
}

function showActiveRoundManagement() {
  if (!commissionerMode) return;

  showCommissionerGroupSelection({ refresh: false });
}

function openDnfConfirmation(playerId) {
  if (!roundState || !canEditCurrentGroup()) return;

  const player = getCurrentGroupPlayers().find((item) => item.id === playerId);
  if (!player || roundState.isPlayerDnf(player)) return;

  const totals = roundState.getPlayerTotals(player);
  pendingDnfPlayerId = playerId;
  elements.dnfConfirmMessage.textContent =
    `Mark ${player.name} as DNF after ${totals.holesPlayed} holes and ${totals.gross} strokes?`;
  elements.dnfConfirmPanel.classList.remove("is-hidden");
  elements.dnfConfirmPanel.scrollIntoView({ behavior: "auto", block: "center" });
}

function closeDnfConfirmation() {
  pendingDnfPlayerId = null;
  elements.dnfConfirmPanel.classList.add("is-hidden");
  elements.dnfConfirmMessage.textContent = "";
}

async function confirmPlayerDnf() {
  if (!pendingDnfPlayerId || !roundState || !canEditCurrentGroup()) return;

  const status = roundState.markPlayerDnf(pendingDnfPlayerId);
  const player = getCurrentGroupPlayers().find((item) => item.id === pendingDnfPlayerId);
  closeDnfConfirmation();

  if (!status || !player) return;

  await autoSaveUnfinishedRound(currentGroupIndex, roundState.currentHoleIndex);
  renderApp();
  elements.saveStatusMessage.textContent =
    `${player.name}: DNF - ${status.holesCompleted} holes - ${status.grossStrokes} strokes`;
}

async function restorePlayerToActive(playerId) {
  if (!commissionerMode || !roundState) return;

  const player = getCurrentGroupPlayers().find((item) => item.id === playerId);
  if (!player) return;

  roundState.restorePlayerActive(playerId);
  const missingHole = getGroupHoleSequence(currentGroupIndex)
    .find((holeNumber) => roundState.savedScores[playerId]?.[holeNumber - 1] === null);

  if (missingHole) {
    const record = getGroupRecord(currentGroupIndex);
    record.status = "in_progress";
    setCurrentHoleForGroup(currentGroupIndex, missingHole);
  }

  await autoSaveUnfinishedRound(currentGroupIndex, roundState.currentHoleIndex);
  renderApp();
  elements.saveStatusMessage.textContent = `${player.name} restored to active scoring.`;
}

function getNextUncompletedHole(groupIndex) {
  const record = getGroupRecord(groupIndex);
  const completed = new Set(record.completedHoleNumbers || []);
  return getGroupHoleSequence(groupIndex).find((holeNumber) => !completed.has(holeNumber)) || null;
}

function isGroupComplete(groupIndex) {
  if (!roundState || !roundSettings?.groups?.[groupIndex]) return false;

  const record = syncGroupCompletionFromScores(groupIndex);
  const sequence = getGroupHoleSequence(groupIndex);
  const activePlayersHaveScores = getGroupPlayers(groupIndex)
    .filter((player) => !roundState.isPlayerDnf(player))
    .every((player) =>
      sequence.every((holeNumber) => {
        const score = roundState.savedScores[player.id]?.[holeNumber - 1];
        return Number.isFinite(Number(score)) && Number(score) > 0;
      })
    );

  return (record.status === "completed" || record.completedHoleNumbers.length >= record.holesToPlay)
    && activePlayersHaveScores;
}

function getNextOpenGroupIndex(startingIndex) {
  if (!roundSettings) return 0;

  for (let offset = 1; offset <= roundSettings.groups.length; offset += 1) {
    const nextIndex = (startingIndex + offset) % roundSettings.groups.length;

    if (!isGroupComplete(nextIndex)) {
      return nextIndex;
    }
  }

  return null;
}

function areAllGroupsComplete() {
  if (!roundSettings?.groups?.length) return false;

  return roundSettings.groups.every((group, index) => isGroupComplete(index));
}

function logFinalCompletionCheck(context) {
  if (!roundSettings?.groups?.length) return false;

  syncAllGroupCompletionsFromScores();
  const groupStatuses = roundSettings.groups.map((group, index) => {
    const record = getGroupRecord(index);
    const complete = isGroupComplete(index);

    return {
      group: index + 1,
      status: record.status,
      completedHoleNumbers: record.completedHoleNumbers,
      holesToPlay: record.holesToPlay,
      complete
    };
  });
  const allComplete = groupStatuses.every((groupStatus) => groupStatus.complete);

  console.log("[OGS Golf] Final completion check", {
    context,
    groups: groupStatuses,
    allGroupsComplete: allComplete
  });

  return allComplete;
}

function syncRoundStateToCurrentGroup() {
  if (!roundState) return;

  const record = getGroupRecord(currentGroupIndex);
  roundState.goToHole(Math.max(0, Number(record.currentHole || 1) - 1));
}

function goToGroup(nextGroupIndex) {
  if (!roundSettings) return;
  if (!commissionerMode && roundSettings.groupScorers?.[nextGroupIndex] !== currentScorerId) return;

  hideCommissionerGroupSelection();
  const previousGroupIndex = currentGroupIndex;
  currentGroupIndex = Math.max(0, Math.min(roundSettings.groups.length - 1, nextGroupIndex));
  if (currentGroupIndex !== previousGroupIndex) {
    clearSaveConfirmation();
  }
  syncRoundStateToCurrentGroup();
  renderApp();
  scrollToScoring();
}

function enterScoreOverride(groupIndex) {
  if (!commissionerMode || !roundSettings?.groups?.length) return;

  const targetGroupIndex = Math.max(0, Math.min(roundSettings.groups.length - 1, groupIndex));

  if (!scoreOverrideActive) {
    scoreOverrideReturnGroupIndex = currentGroupIndex;
  }

  scoreOverrideActive = targetGroupIndex !== scoreOverrideReturnGroupIndex;
  scoreOverrideOpen = false;
  goToGroup(targetGroupIndex);
}

function exitScoreOverride() {
  if (!commissionerMode || !roundSettings?.groups?.length) return;

  const returnIndex = Math.max(
    0,
    Math.min(roundSettings.groups.length - 1, scoreOverrideReturnGroupIndex)
  );

  scoreOverrideActive = false;
  scoreOverrideOpen = false;
  goToGroup(returnIndex);
}

function goToHoleForCurrentGroup(nextHoleIndex) {
  if (!roundState) return;

  setCurrentHoleForGroup(currentGroupIndex, Math.max(1, Math.min(roundState.totalHoles, nextHoleIndex + 1)));
  syncRoundStateToCurrentGroup();
  renderCurrentHole();
}

function renderApp() {
  if (!elements.roundScreen.classList.contains("is-commissioner-group-selection")) {
    hideCommissionerGroupSelection();
  }
  renderRoundSettingsSummary(elements, roundSettings);
  renderCurrentHole();
  renderLeaderboard(elements, selectedPlayers, roundState);
  elements.roundSettingsSummary.closest(".round-settings-section").classList.add("is-hidden");
  elements.pointsPayout.closest(".points-payout-section").classList.add("is-hidden");
  elements.skinsSummary.closest(".skins-section").classList.add("is-hidden");
}

function showScoreMyGroup() {
  if (!roundState) return;

  if (commissionerMode) {
    showCommissionerGroupSelection({ refresh: false });
    return;
  }

  if (!commissionerMode && !currentScorerId) {
    renderScorerSelection();
    elements.scorerAccessStatus.textContent = "Choose the scorer assigned to this device for this match.";
    return;
  }

  if (!commissionerMode && !viewOnlyMode && currentScorerId) {
    const previousGroupIndex = currentGroupIndex;
    currentGroupIndex = getAssignedGroupIndex(currentScorerId);
    if (currentGroupIndex !== previousGroupIndex) {
      clearSaveConfirmation();
    }
    syncRoundStateToCurrentGroup();
    renderCurrentHole();
  }

  elements.roundScreen.classList.remove("is-leaderboard-view");
  hideCommissionerGroupSelection();
  scrollToScoring();
}

function showLeaderboardPage(leaderboardState = roundState, leaderboardPlayers = selectedPlayers) {
  const stateToRender = leaderboardState?.getFinalSummary ? leaderboardState : roundState;
  const playersToRender = leaderboardState?.getFinalSummary ? leaderboardPlayers : selectedPlayers;

  if (!stateToRender) return;

  hideCommissionerGroupSelection();
  setActiveScreen("round");
  renderLeaderboard(elements, playersToRender, stateToRender);
  elements.roundScreen.classList.add("is-leaderboard-view");
  scrollToTop();
}

function getAssignedGroupIndex(playerId) {
  if (!roundSettings?.groupScorers) return 0;
  const groupIndex = roundSettings.groupScorers.findIndex((scorerId) => scorerId === playerId);
  return groupIndex >= 0 ? groupIndex : 0;
}

function getPlayerGroupIndex(playerId) {
  if (!roundSettings?.groups) return 0;
  const groupIndex = roundSettings.groups.findIndex((group) => group.includes(playerId));
  return groupIndex >= 0 ? groupIndex : 0;
}

function canEditCurrentGroup() {
  if (!roundState) return false;
  if (roundSettings?.groupRecords?.[currentGroupIndex]?.status === "completed") return false;
  if (commissionerMode) return true;
  if (viewOnlyMode) return false;
  return Boolean(currentScorerId && roundSettings?.groupScorers?.[currentGroupIndex] === currentScorerId);
}

function renderScorerSelection() {
  clearSaveConfirmation();
  const assignedScorerIds = roundSettings?.groupScorers
    ? Array.from(new Set(roundSettings.groupScorers.filter(Boolean)))
    : [];
  const assignedScorers = assignedScorerIds
    .map((scorerId) => selectedPlayers.find((player) => player.id === scorerId)
      || members.find((member) => member.id === scorerId))
    .filter(Boolean);

  elements.scorerList.innerHTML = roundState
    ? `
      ${assignedScorers
        .map((player) => {
          const groupIndex = getAssignedGroupIndex(player.id);
          return `
            <button type="button" class="secondary-button" data-scorer-id="${player.id}">
              ${player.name} - Group ${groupIndex + 1} scorer
            </button>
          `;
        })
        .join("")}
      <button type="button" class="secondary-button" data-view-leaderboard-only="true">
        View Leaderboard Only
      </button>
    `
    : `<span class="player-details">No active match is ready yet.</span>`;
  elements.scorerAccessStatus.textContent = "";
  setActiveScreen("scorer");
  scrollToTop();
}

function continueFromTodayRound() {
  viewOnlyMode = false;
  if (roundState) {
    if (commissionerMode) {
      showCommissionerGroupSelection();
      return;
    }

    if (currentScorerId) {
      if (roundSettings.groupScorers && !roundSettings.groupScorers.includes(currentScorerId)) {
        clearScorerForCurrentRound();
        renderScorerSelection();
        elements.scorerAccessStatus.textContent = "Choose the scorer assigned to this group.";
        return;
      }

      const previousGroupIndex = currentGroupIndex;
      currentGroupIndex = getAssignedGroupIndex(currentScorerId);
      if (currentGroupIndex !== previousGroupIndex) {
        clearSaveConfirmation();
      }
      syncRoundStateToCurrentGroup();
      setActiveScreen("round");
      renderApp();
      showScoreMyGroup();
      scrollToScoring();
      return;
    }

    renderScorerSelection();
    return;
  }

  if (commissionerMode) {
    setActiveScreen("setup");
    scrollToTop();
    return;
  }

  renderScorerSelection();
  elements.scorerAccessStatus.textContent = "No active event found yet. Ask the commissioner to create one.";
}

function viewLiveMatch() {
  if (!roundState) {
    showTodayRoundScreen();
    elements.todayStatus.textContent = "No active round yet.";
    return;
  }

  viewOnlyMode = true;
  clearSaveConfirmation();
  setActiveScreen("round");
  renderApp();
  showLeaderboardPage();
}

function choosePlayerOrScorer() {
  if (!roundState) {
    showTodayRoundScreen();
    elements.todayStatus.textContent = "No active round yet.";
    return;
  }

  if (currentScorerId) {
    enterScorer(currentScorerId);
    return;
  }

  renderScorerSelection();
}

function openCommissionerFromToday() {
  if (commissionerMode) {
    if (roundState) {
      showCommissionerGroupSelection();
      return;
    }

    openSetupWizard();
    return;
  }

  elements.todayStatus.textContent = "Open the menu, enter the Commissioner PIN, then tap Commissioner Mode.";
  elements.menuCommissionerPin.focus();
}

function enterScorer(playerId) {
  if (roundState && roundSettings.groupScorers && !roundSettings.groupScorers.includes(playerId)) {
    viewLiveMatch();
    return;
  }

  currentScorerId = playerId;
  commissionerMode = false;
  viewOnlyMode = false;
  scorerStorage.saveScorerId(playerId, getCurrentRoundId());
  scorerStorage.setCommissionerMode(false);
  clearSaveConfirmation();

  if (roundState) {
    currentGroupIndex = getAssignedGroupIndex(playerId);
    syncRoundStateToCurrentGroup();
    setActiveScreen("round");
    renderApp();
    showScoreMyGroup();
    scrollToScoring();
    return;
  }

  renderScorerSelection();
  elements.scorerAccessStatus.textContent = "Scorers wait here. Commissioner View creates the active event.";
}

function showSaveStatus(savedHoleIndex, savedGroupIndex) {
  window.clearTimeout(statusTimer);
  elements.saveStatusMessage.innerHTML =
    `&#10003; Hole ${savedHoleIndex + 1} Group ${savedGroupIndex + 1} Saved`;

  statusTimer = window.setTimeout(() => {
    elements.saveStatusMessage.textContent = "";
  }, 2000);
}

function getCloudGroupId(groupIndex) {
  const record = getGroupRecord(groupIndex);
  return record.cloudId || `${roundState.id}-group-${groupIndex + 1}`;
}

function buildCloudGroupPayload(groupIndex) {
  const record = getGroupRecord(groupIndex);

  return {
    id: getCloudGroupId(groupIndex),
    round_id: roundState.id,
    group_number: groupIndex + 1,
    starting_hole: record.startingHole || record.starting_hole || 1,
    holes_to_play: record.holesToPlay || record.holes_to_play || 18,
    status: record.status || "in_progress",
    completed_at: record.completedAt || record.completed_at || null
  };
}

function buildCloudScorePayload(playersToScore, holeNumber, groupIndex) {
  return playersToScore.map((player) => {
    const gross = Number(roundState.draftScores[player.id]);
    const strokesReceived = Number(roundState.getStrokesForPlayerOnHole(player, holeNumber - 1) || 0);

    return {
      playerId: player.id,
      gross,
      strokesReceived
    };
  });
}

function getDisplayedScoreValue(playerId) {
  const input = Array.from(elements.holePlayers.querySelectorAll("[data-score-input]"))
    .find((scoreInput) => scoreInput.dataset.playerId === playerId);

  return input ? input.value : "";
}

function syncDraftScoresFromDisplayedInputs(playersToScore) {
  playersToScore.forEach((player) => {
    const displayedScore = getDisplayedScoreValue(player.id);

    if (displayedScore !== "") {
      roundState.setDraftScore(player.id, displayedScore);
    }
  });
}

function renderSaveConfirmation({ holeNumber, groupIndex, playersToScore, savedScores }) {
  if (!elements.saveConfirmation) return;
  if (groupIndex !== currentGroupIndex) return;

  const savedByPlayer = new Map(savedScores.map((score) => [score.player_id, score]));

  elements.saveConfirmation.innerHTML = `
    <strong class="save-confirmation-title">\u2713 Hole ${holeNumber} Saved</strong>
    ${playersToScore.map((player) => {
      const savedScore = savedByPlayer.get(player.id);
      const gross = Number(savedScore?.gross);
      const hole = roundState.getHoleForPlayer(player, holeNumber - 1);
      const par = Number(hole?.par);
      const result = getHoleResult(gross, par);

      return `
        <div class="save-confirmation-row">
          <strong>${escapeText(player.name)}</strong>
          <span>${escapeText(result)} (${gross})</span>
        </div>
      `;
    }).join("")}
  `;
}

function logBetaSaveHole(eventName, details) {
  console.log("[OGS Golf Beta Save Hole]", {
    event: eventName,
    ...details
  });
}

function verifyCloudReadBack({ expectedScores, returnedScores, holeNumber }) {
  const returnedByPlayer = new Map(returnedScores.map((score) => [score.player_id, score]));

  return expectedScores.every((expected) => {
    const returned = returnedByPlayer.get(expected.playerId);
    const expectedNet = expected.gross - expected.strokesReceived;

    return returned
      && Number(returned.hole) === Number(holeNumber)
      && Number(returned.gross) === Number(expected.gross)
      && Number(returned.strokes_received || 0) === Number(expected.strokesReceived)
      && Number(returned.net) === Number(expectedNet);
  });
}

async function saveHoleScoresToCloud({ playersToScore, holeNumber, groupIndex }) {
  const groupId = getCloudGroupId(groupIndex);
  const scores = buildCloudScorePayload(playersToScore, holeNumber, groupIndex);

  scores.forEach((score) => {
    logBetaSaveHole("attempt", {
      roundId: roundState.id,
      groupId,
      hole: holeNumber,
      playerId: score.playerId,
      gross: score.gross,
      strokesReceived: score.strokesReceived,
      net: score.gross - score.strokesReceived
    });
  });

  const groupResult = await roundCloudService.upsertRoundGroup(buildCloudGroupPayload(groupIndex));

  if (!groupResult.ok) {
    logBetaSaveHole("group-save-failed", {
      roundId: roundState.id,
      groupId,
      hole: holeNumber,
      message: groupResult.message
    });
    return groupResult;
  }

  const saveResult = await roundCloudService.upsertGroupHoleScores({
    roundId: roundState.id,
    groupId,
    hole: holeNumber,
    scores,
    updatedBy: currentScorerId || (commissionerMode ? "commissioner" : "unknown")
  });

  if (!saveResult.ok) {
    logBetaSaveHole("save-failed", {
      roundId: roundState.id,
      groupId,
      hole: holeNumber,
      message: saveResult.message
    });
    return saveResult;
  }

  const readBackResult = await roundCloudService.fetchGroupHoleScores({
    roundId: roundState.id,
    groupId,
    hole: holeNumber
  });

  if (!readBackResult.ok) {
    logBetaSaveHole("readback-failed", {
      roundId: roundState.id,
      groupId,
      hole: holeNumber,
      message: readBackResult.message
    });
    return readBackResult;
  }

  const verified = verifyCloudReadBack({
    expectedScores: scores,
    returnedScores: readBackResult.scores,
    holeNumber
  });

  if (!verified) {
    logBetaSaveHole("readback-mismatch", {
      roundId: roundState.id,
      groupId,
      hole: holeNumber,
      expectedScores: scores,
      returnedScores: readBackResult.scores
    });
    return {
      ok: false,
      reason: "readback-mismatch",
      message: "Save failed - cloud read-back did not match."
    };
  }

  readBackResult.scores.forEach((score) => {
    logBetaSaveHole("saved", {
      roundId: roundState.id,
      groupId,
      hole: holeNumber,
      playerId: score.player_id,
      gross: Number(score.gross),
      strokesReceived: Number(score.strokes_received || 0),
      net: Number(score.net)
    });
  });

  return {
    ok: true,
    scores: readBackResult.scores
  };
}

function mergeActiveRound(localRound, cloudRound, savedGroupIndex, savedHoleIndex) {
  if (!cloudRound || cloudRound.id !== localRound.id || savedGroupIndex === undefined || savedHoleIndex === undefined) {
    return localRound;
  }

  const mergedRound = {
    ...cloudRound,
    roundSettings: {
      ...(cloudRound.roundSettings || {}),
      ...(localRound.roundSettings || {}),
      playerStatuses: localRound.roundSettings?.playerStatuses || cloudRound.roundSettings?.playerStatuses || {},
      groupRecords: localRound.roundSettings?.groupRecords || cloudRound.roundSettings?.groupRecords || []
    },
    currentGroupIndex: localRound.currentGroupIndex,
    currentHoleIndex: localRound.currentHoleIndex,
    currentHole: localRound.currentHole,
    groupHoleIndexes: [...(cloudRound.groupHoleIndexes || localRound.groupHoleIndexes || [])],
    playerStatuses: localRound.playerStatuses || cloudRound.playerStatuses || {},
    savedScores: {
      ...(cloudRound.savedScores || {})
    },
    savedHoleResults: [...(cloudRound.savedHoleResults || localRound.savedHoleResults || [])]
  };
  const savedPlayerIds = new Set(roundSettings.groups[savedGroupIndex] || []);

  mergedRound.groupHoleIndexes[savedGroupIndex] = localRound.groupHoleIndexes[savedGroupIndex];

  savedPlayerIds.forEach((playerId) => {
    mergedRound.savedScores[playerId] = [
      ...((cloudRound.savedScores || localRound.savedScores)[playerId] || localRound.savedScores[playerId])
    ];
    mergedRound.savedScores[playerId][savedHoleIndex] = localRound.savedScores[playerId][savedHoleIndex];
  });

  const cloudHoleResults = mergedRound.savedHoleResults[savedHoleIndex] || [];
  const localHoleResults = localRound.savedHoleResults[savedHoleIndex] || [];
  mergedRound.savedHoleResults[savedHoleIndex] = [
    ...cloudHoleResults.filter((result) => !savedPlayerIds.has(result.playerId)),
    ...localHoleResults.filter((result) => savedPlayerIds.has(result.playerId))
  ];
  mergedRound.skinResults = cloudRound.skinResults || localRound.skinResults;

  return mergedRound;
}

async function autoSaveUnfinishedRound(savedGroupIndex, savedHoleIndex) {
  if (!roundState || completedRoundSaved) return;

  const autoSaveData = roundState.getAutoSaveExport();
  autoSaveData.groupHoleIndexes = groupHoleIndexes;
  autoSaveData.currentGroupIndex = currentGroupIndex;
  autoSaveData.currentHoleIndex = Math.min(
    groupHoleIndexes[currentGroupIndex] ?? roundState.currentHoleIndex,
    roundState.totalHoles - 1
  );
  autoSaveData.currentHole = autoSaveData.currentHoleIndex + 1;
  const cloudResult = await roundCloudService.loadActiveRound();
  const mergedData = mergeActiveRound(autoSaveData, cloudResult.round, savedGroupIndex, savedHoleIndex);
  roundStorage.saveUnfinished(mergedData);
  const saveResult = await roundCloudService.saveActiveRound(mergedData);
  const savedData = saveResult.ok && saveResult.round ? saveResult.round : mergedData;

  if (saveResult.ok) {
    latestCloudActiveRoundInfo = {
      id: savedData.id,
      cloudUpdatedAt: saveResult.cloudUpdatedAt || savedData.cloudUpdatedAt || ""
    };
    roundStorage.saveUnfinished(savedData);
    renderActiveRoundDiagnostics({ loadedFrom: "saved to cloud" });
  }

  return savedData;
}

function saveCompletedRound() {
  if (!roundState || completedRoundSaved) return null;

  const completedRound = roundState.getRoundExport();
  roundStorage.save(completedRound);
  roundStorage.clearUnfinished();
  completedRoundSaved = true;
  updateLastRoundResultsVisibility();
  return completedRound;
}

function setSummaryButtonsForReadOnly(isReadOnly) {
  elements.saveRound.classList.toggle("is-hidden", isReadOnly);
  elements.saveRoundCloud.classList.toggle("is-hidden", isReadOnly);
  elements.summaryUndoLastHole.classList.toggle("is-hidden", isReadOnly);
  elements.startNewRound.classList.toggle("is-hidden", isReadOnly || !commissionerMode);
  elements.summaryPreviousRounds.classList.toggle("is-hidden", isReadOnly);
}

function showFinalSummary(summaryState = roundState, { readOnly = false, statusMessage = "" } = {}) {
  if (!summaryState) return;

  summaryDisplayRoundState = summaryState;
  summaryReadOnlyMode = readOnly;
  if (elements.summaryTitle) {
    elements.summaryTitle.textContent = readOnly ? "Last Round Results" : "Round Complete";
  }
  setActiveScreen("summary");
  renderFinalSummary(elements, summaryState);
  setSummaryButtonsForReadOnly(readOnly);
  elements.cloudSaveStatus.textContent = statusMessage || (readOnly
    ? "Showing the most recently completed round saved on this device."
    : completedRoundSaved
    ? "Final scores recorded."
    : "Round complete. Review scores, then tap Confirm Final Scores.");
  scrollToTop();
}

function showLastRoundResults() {
  const lastRound = getLastCompletedRound();

  if (!lastRound) {
    showTodayRoundScreen();
    elements.todayStatus.textContent = "No completed round found yet.";
    return;
  }

  const lastRoundState = createReadOnlyRoundStateFromSavedRound(lastRound);

  if (!lastRoundState) {
    showTodayRoundScreen();
    elements.todayStatus.textContent = "Last completed round is missing data needed to recreate the results screen.";
    return;
  }

  showFinalSummary(lastRoundState, {
    readOnly: true,
    statusMessage: "Read-only results from the most recently completed round."
  });
}

function transitionToCompletedRound(completedRound, source = "cloud completed round") {
  if (!completedRound) return false;

  roundStorage.clearUnfinished();
  roundStorage.save(completedRound);
  updateLastRoundResultsVisibility();
  loadSavedRoundIntoState(completedRound);
  completedRoundSaved = true;
  showFinalSummary();
  elements.cloudSaveStatus.textContent =
    `Round Complete. Final results loaded from ${source}.`;
  renderActiveRoundDiagnostics({ loadedFrom: source });
  return true;
}

async function checkCompletedRoundFromCloud({ silent = false } = {}) {
  if (!roundState || completedRoundSaved || finalRoundSyncInFlight) return false;

  finalRoundSyncInFlight = true;
  const currentRoundId = roundState.id;

  try {
    const completedResult = await roundCloudService.loadCompletedRoundById(currentRoundId);

    if (completedResult.ok && completedResult.round) {
      return transitionToCompletedRound(completedResult.round, "completed cloud round");
    }

    if (!silent && elements.liveRefreshStatus) {
      elements.liveRefreshStatus.textContent =
        completedResult.message || "Round is not complete in cloud yet.";
    }

    return false;
  } finally {
    finalRoundSyncInFlight = false;
  }
}

async function completeFullRoundIfReady(context = "completion-check") {
  if (!roundState) return false;

  const allComplete = logFinalCompletionCheck(context);

  if (!allComplete) return false;

  saveCompletedRound();
  showFinalSummary();

  try {
    await roundCloudService.saveCompletedRound(roundState.getRoundExport());
    await roundCloudService.clearActiveRound();
    elements.cloudSaveStatus.textContent = "Round Complete. Final scores saved locally and to cloud.";
  } catch (error) {
    elements.cloudSaveStatus.textContent = "Round Complete. Final scores saved locally. Cloud save did not finish.";
  }

  return true;
}

function reviewScorecard() {
  const scorecardState = summaryDisplayRoundState || roundState;
  if (!scorecardState) return;

  setActiveScreen("summary");
  renderCompletedScorecard(elements, scorecardState);
  setSummaryButtonsForReadOnly(summaryReadOnlyMode);
  elements.cloudSaveStatus.textContent = "Showing compact scorecard.";
  scrollToTop();
}

function startFreshRound({ clearSavedRound = false } = {}) {
  if (!commissionerMode) {
    renderScorerSelection();
    elements.scorerAccessStatus.textContent = "Enter Commissioner View to start a new event.";
    return;
  }

  if (clearSavedRound) {
    clearRoundCacheForReset().then((result) => {
      elements.modeStatus.textContent = result.ok
        ? "Commissioner View: old saved round cleared."
        : "Commissioner View: local saved round cleared. Cloud active round could not be cleared.";
    });
  }

  roundSettings = null;
  pendingRoundSettings = null;
  roundState = null;
  selectedCourse = courses[0];
  selectedPlayers = [];
  currentGroupIndex = 0;
  groupHoleIndexes = [];
  completedRoundSaved = false;
  elements.saveStatusMessage.textContent = "";
  setActiveScreen("setup");
  renderSetupView(elements, courses, members);
}

function startNewRound() {
  roundStorage.clearUnfinished();
  startFreshRound();
}

async function clearRoundCacheForReset() {
  roundStorage.clearUnfinished();
  clearScorerForCurrentRound();
  roundSettings = null;
  pendingRoundSettings = null;
  roundState = null;
  selectedPlayers = [];
  currentGroupIndex = 0;
  groupHoleIndexes = [];
  completedRoundSaved = false;
  viewOnlyMode = false;
  scoreOverrideOpen = false;
  scoreOverrideActive = false;
  clearSaveConfirmation();
  return { ok: true };
}

function discardSavedRound() {
  roundStorage.clearUnfinished();
  startFreshRound({ clearSavedRound: true });
}

function saveRound() {
  saveCompletedRound();
  elements.cloudSaveStatus.textContent = "Final scores recorded on this device.";
  showFinalSummary();
}

async function saveRoundToCloud() {
  if (!roundState || !roundState.isRoundComplete()) {
    elements.cloudSaveStatus.textContent = "Finish the round before saving to cloud.";
    return;
  }

  if (!completedRoundSaved) {
    elements.cloudSaveStatus.textContent = "Confirm final scores before saving to cloud.";
    return;
  }

  elements.cloudSaveStatus.textContent = "Saving to cloud...";
  const result = await roundCloudService.saveCompletedRound(roundState.getRoundExport());
  elements.cloudSaveStatus.textContent = result.message;
}

async function loadPreviousRoundsFromCloud() {
  elements.previousRoundsStatus.textContent = "Loading cloud rounds...";

  const result = await roundCloudService.loadCompletedRounds();

  if (result.ok) {
    renderPreviousRounds(elements, result.rounds);
    elements.previousRoundsStatus.textContent = "Loaded rounds from cloud";
    return;
  }

  renderPreviousRounds(elements, roundStorage.getAll());
  elements.previousRoundsStatus.textContent = "Cloud load failed, showing local rounds";
}

function showPreviousRounds() {
  loadPreviousRoundsFromCloud();
  setActiveScreen("previous");
  scrollToTop();
}

async function showPlayerManagement() {
  if (!commissionerMode) {
    renderScorerSelection();
    elements.scorerAccessStatus.textContent = "Enter Commissioner View to manage players.";
    return;
  }

  elements.playerManagementStatus.textContent = "Loading latest roster from Supabase...";
  setActiveScreen("players");
  await loadRosterFromCloud({ manual: true });
  renderPlayerManagement(elements, members, maxRosterSize);
  if (!elements.playerManagementStatus.textContent) {
    elements.playerManagementStatus.textContent = "Roster loaded.";
  }
  scrollToTop();
}

function returnFromPlayerManagement() {
  renderSetupView(elements, courses, members);

  if (roundState && roundState.isRoundComplete()) {
    setActiveScreen("summary");
    renderFinalSummary(elements, roundState);
    return;
  }

  if (roundState) {
    setActiveScreen("round");
    renderApp();
    return;
  }

  setActiveScreen("setup");
}

function returnFromPreviousRounds() {
  if (roundState && roundState.isRoundComplete()) {
    setActiveScreen("summary");
    renderFinalSummary(elements, roundState);
    return;
  }

  if (roundState) {
    setActiveScreen("round");
    renderApp();
    return;
  }

  setActiveScreen("setup");
}

function getUniquePlayerId(playerId) {
  let uniqueId = playerId || `player-${Date.now()}`;
  let counter = 2;

  while (members.some((player) => player.id === uniqueId)) {
    uniqueId = `${playerId}-${counter}`;
    counter += 1;
  }

  return uniqueId;
}

function getAvailableTeeIds() {
  return new Set((selectedCourse || courses[0]).teeOrder);
}

function findDuplicatePlayer(formPlayer, editingId) {
  const normalizedName = formPlayer.name.trim().toLowerCase();
  const normalizedGhin = formPlayer.ghin.trim().toLowerCase();

  return members.find((player) => {
    if (player.id === editingId) return false;
    const sameName = player.name.trim().toLowerCase() === normalizedName;
    const sameGhin = normalizedGhin && (player.ghin || "").trim().toLowerCase() === normalizedGhin;
    return sameName || sameGhin;
  });
}

async function savePlayer(event) {
  event.preventDefault();

  const formResult = readPlayerForm(elements);

  if (formResult.error) {
    elements.playerManagementStatus.textContent = formResult.error;
    return;
  }

  const formPlayer = formResult.player;
  const editingId = elements.editingPlayerId.value;
  const availableTeeIds = getAvailableTeeIds();

  if (!availableTeeIds.has(formPlayer.tee)) {
    elements.playerManagementStatus.textContent = "Default tee must match an available tee for this course.";
    return;
  }

  const duplicatePlayer = findDuplicatePlayer(formPlayer, editingId);

  if (duplicatePlayer) {
    elements.playerManagementStatus.textContent = `Possible duplicate: ${duplicatePlayer.name}. Edit that player instead of creating a new record.`;
    return;
  }

  if (!editingId && members.length >= maxRosterSize) {
    elements.playerManagementStatus.textContent = "The roster already has 50 members.";
    return;
  }

  const wasEditing = Boolean(editingId);
  let nextMembers;

  if (editingId) {
    if (!members.some((player) => player.id === editingId)) {
      elements.playerManagementStatus.textContent = "Could not find the existing player record to update.";
      return;
    }

    nextMembers = members.map((player) => (player.id === editingId ? formPlayer : player));
  } else {
    nextMembers = [...members, { ...formPlayer, id: getUniquePlayerId(formPlayer.id) }];
  }

  elements.playerManagementStatus.textContent = wasEditing
    ? "Updating player in Supabase..."
    : "Saving player to Supabase...";
  members = nextMembers;
  playerStorage.saveAll(members);
  renderPlayerManagement(elements, members, maxRosterSize);

  const result = await roundCloudService.savePlayers(members);

  if (!result.ok) {
    elements.playerManagementStatus.textContent =
      `${result.message} Local cache was updated on this device only.`;
    return;
  }

  clearPlayerForm(elements);
  renderPlayerManagement(elements, members, maxRosterSize);
  elements.playerManagementStatus.textContent = wasEditing
    ? "Player updated in cloud"
    : "Player saved to cloud";
}

function exportRosterBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    source: "OGS Golf Player Management",
    playerCount: members.length,
    players: members
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `ogs-golf-roster-backup-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  elements.playerManagementStatus.textContent = `Roster backup exported with ${members.length} players.`;
}

async function saveRosterToCloud() {
  playerStorage.saveAll(members);
  elements.playerManagementStatus.textContent = "Saving roster to Supabase...";

  const result = await roundCloudService.savePlayers(members);
  elements.playerManagementStatus.textContent = result.message;
}

async function removePlayerFromRoster(playerId) {
  const player = members.find((member) => member.id === playerId);

  if (!player) return;

  const confirmed = window.confirm(`Remove ${player.name} from the shared roster?`);

  if (!confirmed) return;

  elements.playerManagementStatus.textContent = `Removing ${player.name} from Supabase...`;

  const result = await roundCloudService.deletePlayer(playerId);

  if (!result.ok) {
    elements.playerManagementStatus.textContent = result.message;
    return;
  }

  members = members.filter((member) => member.id !== playerId);
  playerStorage.saveAll(members);
  clearPlayerForm(elements);
  renderPlayerManagement(elements, members, maxRosterSize);
  elements.playerManagementStatus.textContent = "Player removed from cloud";
}

function undoLastHole() {
  if (!roundState) return;
  if (!canEditCurrentGroup()) return;

  const currentGroupPlayers = getCurrentGroupPlayers();
  const lastSavedHoleIndex = roundState.getLastSavedHoleIndexForPlayers(currentGroupPlayers);

  if (lastSavedHoleIndex < 0) {
    elements.saveStatusMessage.textContent = "No saved holes to undo for this group.";
    return;
  }

  roundState.clearHoleForPlayers(lastSavedHoleIndex, currentGroupPlayers);
  groupHoleIndexes[currentGroupIndex] = lastSavedHoleIndex;

  if (completedRoundSaved) {
    roundStorage.remove(roundState.id);
    completedRoundSaved = false;
  }

  window.clearTimeout(statusTimer);
  elements.saveStatusMessage.textContent = `Hole ${lastSavedHoleIndex + 1} undone for Group ${currentGroupIndex + 1}.`;
  setActiveScreen("round");
  syncRoundStateToCurrentGroup();
  renderApp();
  autoSaveUnfinishedRound();
  scrollToScoring();
}

function continueToGroups() {
  if (!commissionerMode) {
    renderScorerSelection();
    elements.scorerAccessStatus.textContent = "Commissioner View creates events.";
    return;
  }

  pendingRoundSettings = readSetupSettings(elements, courses, members);

  if (!pendingRoundSettings.course || !pendingRoundSettings.date) {
    elements.modeStatus.textContent = "Choose a course and date before continuing.";
    return;
  }

  if (pendingRoundSettings.players.length === 0) {
    elements.modeStatus.textContent = "Select at least one active player before continuing.";
    return;
  }

  renderGroupSetupView(elements, pendingRoundSettings);
  setActiveScreen("groups");
  scrollToTop();
}

function backToRoundSetup() {
  setActiveScreen("setup");
  scrollToTop();
}

function updateGroupCount(amount) {
  if (!pendingRoundSettings) return;

  const currentGroups = readGroupAssignments(elements, pendingRoundSettings.players);
  const currentCount = elements.groupSetupList.groupCount || Math.max(1, currentGroups.length);
  const nextCount = Math.max(1, currentCount + amount);
  pendingRoundSettings.groups = currentGroups;
  pendingRoundSettings.groupCount = nextCount;
  renderGroupSetupView(elements, pendingRoundSettings);
}

function refreshScorekeeperChoices() {
  if (!pendingRoundSettings) return;

  const groups = readGroupAssignments(elements, pendingRoundSettings.players);
  renderGroupScorerOptions(elements, pendingRoundSettings.players, groups);
}

function createGroupRecords(groups, groupScorers, groupPlaySettings = []) {
  return groups.map((group, index) => ({
    id: `group-${index + 1}`,
    label: `Group ${index + 1}`,
    playerIds: group,
    scorekeeperId: groupScorers[index],
    startingHole: groupPlaySettings[index]?.startingHole || 1,
    currentHole: groupPlaySettings[index]?.startingHole || 1,
    holesToPlay: groupPlaySettings[index]?.holesToPlay || 18,
    completedHoleNumbers: [],
    status: "in_progress"
  }));
}

function validateGroupSetup(groups, groupScorers, players) {
  const selectedPlayerIds = players.map((player) => player.id);
  const assignedPlayerIds = groups.flat();
  const assignedSet = new Set(assignedPlayerIds);

  if (groups.length === 0) {
    return "Create at least one group.";
  }

  if (assignedPlayerIds.length !== selectedPlayerIds.length || assignedSet.size !== selectedPlayerIds.length) {
    return "Every selected player must be assigned to exactly one group.";
  }

  const missingPlayer = selectedPlayerIds.find((playerId) => !assignedSet.has(playerId));
  if (missingPlayer) {
    return "Every selected player must be assigned to a group.";
  }

  const groupWithoutScorer = groups.findIndex((group, index) => {
    const scorerId = groupScorers[index];
    return !scorerId || !group.includes(scorerId);
  });

  if (groupWithoutScorer >= 0) {
    return `Choose a scorekeeper from Group ${groupWithoutScorer + 1}.`;
  }

  return "";
}

function reviewEventSummary() {
  if (!pendingRoundSettings) return;

  const groups = readGroupAssignments(elements, pendingRoundSettings.players);
  const groupScorers = readGroupScorers(elements, groups);
  const groupPlaySettings = readGroupPlaySettings(elements, groups);
  const validationMessage = validateGroupSetup(groups, groupScorers, pendingRoundSettings.players);

  if (validationMessage) {
    elements.groupSetupStatus.textContent = validationMessage;
    return;
  }

  roundSettings = {
    ...pendingRoundSettings,
    groups,
    groupScorers,
    groupRecords: createGroupRecords(groups, groupScorers, groupPlaySettings),
    eventStatus: "Pre-Round Review",
    setupLocked: false,
    preRoundReviewComplete: false
  };
  renderEventSummary(elements, roundSettings);
  setActiveScreen("eventSummary");
  scrollToTop();
}

function backToGroupSetup() {
  setActiveScreen("groups");
  scrollToTop();
}

async function beginGroupedRound() {
  if (!roundSettings) return;

  roundSettings = {
    ...roundSettings,
    groupRecords: roundSettings.groupRecords,
    startingHole: roundSettings.groupRecords?.[0]?.startingHole || 1,
    currentHole: roundSettings.groupRecords?.[0]?.currentHole || 1,
    eventStatus: "Started",
    setupLocked: true,
    preRoundReviewComplete: true,
    startedAt: new Date().toISOString()
  };
  selectedCourse = roundSettings.course;
  selectedPlayers = roundSettings.players;
  roundState = createRoundState(selectedCourse, selectedPlayers, roundSettings);
  currentGroupIndex = 0;
  groupHoleIndexes = roundSettings.groups.map((group, index) =>
    Math.max(0, (getGroupRecord(index).currentHole || 1) - 1)
  );
  completedRoundSaved = false;
  roundStorage.clearUnfinished();

  setActiveScreen("round");
  renderApp();
  const publishedRound = await autoSaveUnfinishedRound();
  elements.liveRefreshStatus.textContent = publishedRound?.cloudUpdatedAt
    ? "Active match published to cloud."
    : "Active match is open on this device. Cloud publish did not confirm.";
  renderActiveRoundDiagnostics({ loadedFrom: publishedRound?.cloudUpdatedAt ? "new round published" : "new round local" });
  scrollToScoring();
}

function loadSavedRoundIntoState(savedRound) {
  selectedCourse = courses.find((course) => course.id === savedRound.course.id) || courses[0];
  selectedPlayers = savedRound.players.map((player) => ({
    ...player,
    handicap: player.handicapIndex ?? player.handicap
  }));
  roundSettings = {
    ...savedRound.roundSettings,
    course: selectedCourse,
    players: selectedPlayers
  };
  roundState = createRoundState(selectedCourse, selectedPlayers, roundSettings, savedRound);
  currentGroupIndex = commissionerMode ? (savedRound.currentGroupIndex || 0) : 0;
  roundSettings.groupRecords = roundSettings.groupRecords || savedRound.roundSettings?.groupRecords || [];
  groupHoleIndexes = savedRound.groupHoleIndexes || roundSettings.groups.map((group, index) =>
    Math.max(0, (getGroupRecord(index).currentHole || savedRound.currentHole || 1) - 1)
  );
  syncAllGroupCompletionsFromScores();
  loadScorerForCurrentRound();

  if (!commissionerMode && currentScorerId) {
    currentGroupIndex = getAssignedGroupIndex(currentScorerId);
  }

  syncRoundStateToCurrentGroup();
  completedRoundSaved = false;
}

async function applyCloudScoreStateForActiveRound(roundId) {
  if (!roundState || !roundId) {
    return { ok: false, message: "No active round loaded." };
  }

  const [groupsResult, playersResult, scoresResult, statusesResult] = await Promise.all([
    roundCloudService.fetchRoundGroups(roundId),
    roundCloudService.fetchRoundPlayers(roundId),
    roundCloudService.fetchHoleScores(roundId),
    roundCloudService.fetchPlayerStatuses(roundId)
  ]);

  if (!groupsResult.ok || !playersResult.ok || !scoresResult.ok || !statusesResult.ok) {
    return {
      ok: false,
      message: "Unable to refresh live scores."
    };
  }

  applyCloudGroupsToRoundSettings(groupsResult.groups);
  roundState.replaceSavedScoresFromCloud(scoresResult.scores);
  roundState.applyCloudPlayerStatuses(statusesResult.statuses);
  syncAllGroupCompletionsFromScores();
  syncRoundStateToCurrentGroup();
  roundStorage.saveUnfinished(roundState.getAutoSaveExport());

  return {
    ok: true,
    groups: groupsResult.groups,
    players: playersResult.players,
    scores: scoresResult.scores,
    statuses: statusesResult.statuses
  };
}

async function loadActiveRoundFromCloudFirst() {
  const cloudResult = await roundCloudService.loadActiveRound();

  if (!cloudResult.ok || !cloudResult.round) {
    latestCloudActiveRoundInfo = {
      id: "",
      cloudUpdatedAt: "",
      details: cloudResult.ok
        ? `Cloud rows found: ${cloudResult.rowsFound || 0}, readable: ${cloudResult.readableRows || 0}`
        : `Cloud lookup failed: ${cloudResult.message || "unknown error"}`
    };
    renderActiveRoundDiagnostics({ loadedFrom: "no cloud active round" });
    return { ok: false, round: null };
  }

  latestCloudActiveRoundInfo = {
    id: cloudResult.round.id || cloudResult.record?.id || "",
    cloudUpdatedAt: cloudResult.cloudUpdatedAt || cloudResult.round.cloudUpdatedAt || cloudResult.record?.played_at || "",
    details: `Cloud rows found: ${cloudResult.rowsFound || 0}, readable: ${cloudResult.readableRows || 0}`
  };
  loadSavedRoundIntoState(cloudResult.round);
  const scoreResult = await applyCloudScoreStateForActiveRound(roundState.id);

  if (!scoreResult.ok) {
    roundStorage.saveUnfinished(roundState.getAutoSaveExport());
    renderActiveRoundDiagnostics({ loadedFrom: "cloud active round, score refresh pending" });
    return {
      ok: true,
      round: cloudResult.round,
      scoreRefreshOk: false,
      message: scoreResult.message || "Loaded active match setup. Live scores did not refresh yet."
    };
  }

  roundStorage.saveUnfinished(roundState.getAutoSaveExport());
  renderActiveRoundDiagnostics({ loadedFrom: "cloud active round" });
  return { ok: true, round: cloudResult.round, scoreRefreshOk: true };
}

async function refreshLiveScores({ keepLeaderboard = false } = {}) {
  const wasLeaderboard = keepLeaderboard || elements.roundScreen.classList.contains("is-leaderboard-view");
  const previousRoundId = roundState?.id || "";
  elements.liveRefreshStatus.textContent = "Checking cloud for the active round...";

  const activeResult = await loadActiveRoundFromCloudFirst();

  if (!activeResult.ok) {
    if (!roundState) {
      elements.liveRefreshStatus.textContent = "No active cloud round found.";
      renderActiveRoundDiagnostics({ loadedFrom: "refresh failed" });
      return false;
    }

    const completedTransitioned = await checkCompletedRoundFromCloud();

    if (completedTransitioned) {
      return true;
    }

    elements.liveRefreshStatus.textContent = "Cloud active round lookup failed. Refreshing this device's loaded round...";
    const fallbackResult = await applyCloudScoreStateForActiveRound(roundState.id);

    if (!fallbackResult.ok) {
      elements.liveRefreshStatus.textContent = fallbackResult.message || "Cloud refresh failed. Showing saved device copy.";
      renderActiveRoundDiagnostics({ loadedFrom: "local fallback" });
      return false;
    }
  }

  renderApp();

  if (wasLeaderboard) {
    showLeaderboardPage();
  } else {
    showScoreMyGroup();
  }

  const roundChangedText = previousRoundId && previousRoundId !== roundState.id
    ? ` Loaded new active round ${roundState.id}.`
    : "";
  elements.liveRefreshStatus.textContent = activeResult.scoreRefreshOk === false
    ? `Loaded active match from cloud. Scores did not refresh yet.${roundChangedText}`
    : `Live match updated from cloud.${roundChangedText}`;
  renderActiveRoundDiagnostics({ loadedFrom: "live refresh" });
  return true;
}

function showResumePrompt(savedRound) {
  elements.resumeCourseName.textContent = savedRound.course.name;
  const groupText = savedRound.currentGroupIndex !== undefined
    ? `Group ${savedRound.currentGroupIndex + 1}, `
    : "";
  elements.resumeHoleStatus.textContent = `${groupText}Current Hole: ${savedRound.currentHole} of 18`;
  setActiveScreen("resume");
}

function resumeSavedRound() {
  const savedRound = roundStorage.getUnfinished();

  if (!savedRound) {
    setActiveScreen("setup");
    return;
  }

  loadSavedRoundIntoState(savedRound);

  setActiveScreen("round");
  renderApp();
  scrollToScoring();
}

async function initializeApp() {
  await loadRosterFromCloud();
  renderSetupView(elements, courses, members);

  const cloudActiveResult = await loadActiveRoundFromCloudFirst();

  if (cloudActiveResult.ok && roundState) {
    showTodayRoundScreen();
    return;
  }

  const localRound = roundStorage.getUnfinished();

  if (localRound && !localRound.completed) {
    const completedRoundsResult = await roundCloudService.loadCompletedRounds();
    const completedMatch = completedRoundsResult.rounds?.find((round) => round.id === localRound.id);

    if (completedMatch) {
      roundStorage.clearUnfinished();
      roundStorage.save(completedMatch);
      loadSavedRoundIntoState(completedMatch);
      completedRoundSaved = true;
      showFinalSummary();
      return;
    }
  }

  if (localRound) {
    loadSavedRoundIntoState(localRound);
    showTodayRoundScreen();
    return;
  }

  showTodayRoundScreen();
}

initializeApp();

window.setInterval(() => {
  if (!roundState || completedRoundSaved) return;
  checkCompletedRoundFromCloud({ silent: true });
}, 30000);

elements.menuToggle.addEventListener("click", toggleMenu);
elements.toggleCommissionerMode.addEventListener("click", () => {
  const changed = commissionerMode
    ? (setCommissionerMode(false), true)
    : turnOnCommissionerFromMenu();

  if (!changed) return;

  closeMenu();

  if (commissionerMode && !roundState) {
    setActiveScreen("setup");
    return;
  }

  if (commissionerMode && roundState) {
    showCommissionerGroupSelection();
  }
});
function submitCommissionerPinFromKeyboard(event) {
  if (event.key && event.key !== "Enter") return;
  if (commissionerMode) return;

  event?.preventDefault();
  const changed = turnOnCommissionerFromMenu();

  if (!changed) return;

  closeMenu();

  if (commissionerMode && !roundState) {
    setActiveScreen("setup");
    return;
  }

  if (commissionerMode && roundState) {
    showCommissionerGroupSelection();
  }
}

elements.menuCommissionerPin.addEventListener("keydown", submitCommissionerPinFromKeyboard);
elements.menuCommissionerPin.addEventListener("keyup", submitCommissionerPinFromKeyboard);
elements.appMenu.addEventListener("click", (event) => {
  const menuButton = event.target.closest("[data-menu-action]");

  if (!menuButton) return;

  handleMenuAction(menuButton.dataset.menuAction);
});
elements.startRound.addEventListener("click", continueToGroups);
elements.backToRoundSetup.addEventListener("click", backToRoundSetup);
elements.addGroup.addEventListener("click", () => updateGroupCount(1));
elements.removeGroup.addEventListener("click", () => updateGroupCount(-1));
elements.groupSetupList.addEventListener("change", refreshScorekeeperChoices);
elements.beginGroupedRound.addEventListener("click", reviewEventSummary);
elements.backToGroupSetup.addEventListener("click", backToGroupSetup);
elements.confirmStartRound.addEventListener("click", beginGroupedRound);
elements.resumeRound.addEventListener("click", resumeSavedRound);
elements.startFreshRound.addEventListener("click", () => startFreshRound({ clearSavedRound: true }));
elements.discardSavedRound.addEventListener("click", discardSavedRound);
elements.viewLiveMatch.addEventListener("click", viewLiveMatch);
elements.choosePlayerScoring.addEventListener("click", choosePlayerOrScorer);
elements.todayLastRoundResults.addEventListener("click", showLastRoundResults);
elements.todayCommissionerMode.addEventListener("click", openCommissionerFromToday);
elements.scorerList.addEventListener("click", (event) => {
  const leaderboardOnlyButton = event.target.closest("[data-view-leaderboard-only]");
  const scorerButton = event.target.closest("[data-scorer-id]");

  if (leaderboardOnlyButton) {
    viewLiveMatch();
    return;
  }

  if (!scorerButton) return;

  enterScorer(scorerButton.dataset.scorerId);
});
elements.holePlayers.addEventListener("click", (event) => {
  if (!roundState) return;
  if (!canEditCurrentGroup()) return;

  const dnfButton = event.target.closest("[data-dnf-player-id]");
  const restoreButton = event.target.closest("[data-restore-player-id]");

  if (dnfButton) {
    openDnfConfirmation(dnfButton.dataset.dnfPlayerId);
    return;
  }

  if (restoreButton) {
    restorePlayerToActive(restoreButton.dataset.restorePlayerId);
    return;
  }

  const button = event.target.closest("button[data-player-id]");

  if (!button) return;

  const amount = button.dataset.action === "increase" ? 1 : -1;
  roundState.changeDraftScore(button.dataset.playerId, amount);
  renderCurrentHole();
});
elements.holePlayers.addEventListener("input", (event) => {
  if (!roundState) return;
  if (!canEditCurrentGroup()) return;

  const input = event.target.closest("[data-score-input]");

  if (!input) return;

  roundState.setDraftScore(input.dataset.playerId, input.value);
});
elements.cancelDnf.addEventListener("click", closeDnfConfirmation);
elements.confirmDnf.addEventListener("click", confirmPlayerDnf);

elements.previousHole.addEventListener("click", () => {
  if (!roundState) return;
  if (!canEditCurrentGroup()) return;

  const sequence = getGroupHoleSequence(currentGroupIndex);
  const currentHoleNumber = roundState.currentHoleIndex + 1;
  const currentSequenceIndex = sequence.indexOf(currentHoleNumber);
  const previousSequenceIndex = currentSequenceIndex > 0
    ? currentSequenceIndex - 1
    : Math.max(0, sequence.length - 1);
  setCurrentHoleForGroup(currentGroupIndex, sequence[previousSequenceIndex] || currentHoleNumber);
  syncRoundStateToCurrentGroup();
  renderCurrentHole();
});

elements.nextHole.addEventListener("click", () => {
  if (!roundState) return;
  if (!canEditCurrentGroup()) return;

  goToHoleForCurrentGroup((groupHoleIndexes[currentGroupIndex] ?? 0) + 1);
});

elements.previousGroup.addEventListener("click", () => {
  goToGroup(currentGroupIndex - 1);
});

elements.nextGroup.addEventListener("click", () => {
  goToGroup(currentGroupIndex + 1);
});

elements.groupSwitcher.addEventListener("change", () => {
  if (!commissionerMode) return;
  goToGroup(Number(elements.groupSwitcher.value));
});

elements.toggleScoreOverride.addEventListener("click", () => {
  if (!commissionerMode || !roundState) return;

  scoreOverrideOpen = !scoreOverrideOpen;
  renderScoreOverrideControls();
});

elements.scoreOverrideList.addEventListener("click", (event) => {
  const groupButton = event.target.closest("[data-override-group-index]");

  if (!groupButton) return;

  enterScoreOverride(Number(groupButton.dataset.overrideGroupIndex));
});

elements.commissionerGroupSelectionList.addEventListener("click", (event) => {
  const groupButton = event.target.closest("[data-commissioner-group-index]");

  if (!groupButton) return;

  openCommissionerGroup(Number(groupButton.dataset.commissionerGroupIndex));
});

elements.commissionerGroupSelectionLeaderboard.addEventListener("click", showLeaderboardPage);
elements.commissionerGroupSelectionDashboard.addEventListener("click", showTodayRoundScreen);
elements.exitScoreOverride.addEventListener("click", exitScoreOverride);

elements.holeSelector.addEventListener("change", () => {
  if (!roundState) return;
  if (!canEditCurrentGroup()) return;

  setCurrentHoleForGroup(currentGroupIndex, Number(elements.holeSelector.value));
  syncRoundStateToCurrentGroup();
  renderCurrentHole();
});

elements.saveHole.addEventListener("click", async () => {
  if (!roundState) return;
  if (!canEditCurrentGroup()) return;

  syncRoundStateToCurrentGroup();
  const groupPlayers = getCurrentGroupPlayers();
  const playersToScore = groupPlayers.filter((player) => !roundState.isPlayerDnf(player));
  syncDraftScoresFromDisplayedInputs(playersToScore);
  const hasInvalidScore = playersToScore.some((player) => {
    const score = roundState.draftScores[player.id];
    return !Number.isFinite(Number(score)) || Number(score) < 1;
  });

  if (hasInvalidScore) {
    elements.saveStatusMessage.textContent = "Enter a gross score for every player in this group.";
    return;
  }

  const savedHoleIndex = roundState.currentHoleIndex;
  const savedHoleNumber = savedHoleIndex + 1;
  const savedGroupIndex = currentGroupIndex;
  elements.saveStatusMessage.textContent = "Saving...";
  elements.saveHole.disabled = true;

  const cloudSaveResult = await saveHoleScoresToCloud({
    playersToScore,
    holeNumber: savedHoleNumber,
    groupIndex: savedGroupIndex
  });

  if (!cloudSaveResult.ok) {
    elements.saveHole.disabled = false;
    elements.saveStatusMessage.textContent = `${cloudSaveResult.message || "Save failed"} - retry`;
    return;
  }

  roundState.applyCloudHoleScores(cloudSaveResult.scores);
  markGroupHoleComplete(savedGroupIndex, savedHoleNumber);
  const nextHoleNumber = getNextUncompletedHole(savedGroupIndex);

  if (nextHoleNumber === null) {
    getGroupRecord(savedGroupIndex).status = "completed";
    groupHoleIndexes[savedGroupIndex] = savedHoleIndex;
  } else {
    setCurrentHoleForGroup(savedGroupIndex, nextHoleNumber);
  }

  currentGroupIndex = savedGroupIndex;

  syncRoundStateToCurrentGroup();
  let mergedRound = null;
  try {
    mergedRound = await autoSaveUnfinishedRound(savedGroupIndex, savedHoleIndex);
  } catch (error) {
    const localSave = roundState.getAutoSaveExport();
    localSave.groupHoleIndexes = groupHoleIndexes;
    localSave.currentGroupIndex = currentGroupIndex;
    localSave.currentHoleIndex = Math.min(
      groupHoleIndexes[currentGroupIndex] ?? roundState.currentHoleIndex,
      roundState.totalHoles - 1
    );
    localSave.currentHole = localSave.currentHoleIndex + 1;
    roundStorage.saveUnfinished(localSave);
    elements.saveStatusMessage.textContent = "Saved on this device. Cloud backup did not finish.";
  }

  if (mergedRound) {
    loadSavedRoundIntoState(mergedRound);
    roundState.applyCloudHoleScores(cloudSaveResult.scores);
  }

  const liveTotalsResult = await applyCloudScoreStateForActiveRound(roundState.id);

  if (!liveTotalsResult.ok) {
    elements.liveRefreshStatus.textContent =
      "Saved. Live leaderboard refresh failed, showing this device's saved copy.";
  }

  renderSaveConfirmation({
    holeNumber: savedHoleNumber,
    groupIndex: savedGroupIndex,
    playersToScore,
    savedScores: cloudSaveResult.scores
  });

  const fullRoundCompleted = await completeFullRoundIfReady("after-save-hole");

  if (fullRoundCompleted) {
    return;
  }

  renderApp();
  if (mergedRound) {
    elements.saveStatusMessage.textContent = "Saved";
    showSaveStatus(savedHoleIndex, savedGroupIndex);
  }
  scrollToScoring();
});

elements.resetScores.addEventListener("click", async () => {
  if (!commissionerMode) {
    renderScorerSelection();
    elements.scorerAccessStatus.textContent = "Only the commissioner can cancel the active event.";
    return;
  }

  const resetResult = await clearRoundCacheForReset();
  renderSetupView(elements, courses, members);
  setActiveScreen("setup");
  elements.modeStatus.textContent = resetResult.ok
    ? "Commissioner View: this device was reset. Shared cloud rounds were not deleted."
    : "Commissioner View: reset failed.";
  renderActiveRoundDiagnostics({ loadedFrom: "device reset" });
  scrollToTop();
});

elements.reviewScorecard.addEventListener("click", reviewScorecard);
elements.viewFinalLeaderboard.addEventListener("click", () => {
  const leaderboardState = summaryDisplayRoundState || roundState;

  if (!leaderboardState) return;

  setActiveScreen("round");
  renderLeaderboard(
    elements,
    leaderboardState.getFinalSummary().playerTotals.map((item) => item.player),
    leaderboardState
  );
  elements.roundScreen.classList.add("is-leaderboard-view");
  scrollToTop();
});
elements.summaryPreviousRounds.addEventListener("click", showPreviousRounds);
elements.summaryReturnHome.addEventListener("click", showTodayRoundScreen);
elements.undoLastHole.addEventListener("click", undoLastHole);
elements.summaryUndoLastHole.addEventListener("click", undoLastHole);
elements.startNewRound.addEventListener("click", startNewRound);
elements.saveRound.addEventListener("click", saveRound);
elements.saveRoundCloud.addEventListener("click", saveRoundToCloud);
elements.showPreviousRounds.addEventListener("click", showPreviousRounds);
elements.refreshCloudRounds.addEventListener("click", loadPreviousRoundsFromCloud);
elements.backFromPreviousRounds.addEventListener("click", returnFromPreviousRounds);
elements.showPlayerManagement.addEventListener("click", showPlayerManagement);
elements.changeScorer.addEventListener("click", () => {
  clearScorerForCurrentRound();
  scorerStorage.setCommissionerMode(false);
  commissionerMode = false;
  renderScorerSelection();
});
elements.changeScorerQuick.addEventListener("click", () => {
  clearScorerForCurrentRound();
  scorerStorage.setCommissionerMode(false);
  commissionerMode = false;
  viewOnlyMode = false;
  renderScorerSelection();
});
elements.scoreMyGroup.addEventListener("click", showScoreMyGroup);
elements.viewOverallLeaderboard.addEventListener("click", showLeaderboardPage);
elements.refreshLiveScores.addEventListener("click", () => refreshLiveScores());
elements.changeScorerLeaderboard.addEventListener("click", showLeaderboardPage);
elements.completedViewLeaderboard.addEventListener("click", showLeaderboardPage);
elements.reviewGroupScores.addEventListener("click", renderGroupScoreReview);
elements.activeRoundManagement.addEventListener("click", showActiveRoundManagement);
elements.playerForm.addEventListener("submit", savePlayer);
elements.handicapVerifyPlayer.addEventListener("change", renderHandicapVerificationResult);
elements.handicapVerifyCourse.addEventListener("change", renderHandicapVerification);
elements.handicapVerifyTee.addEventListener("change", renderHandicapVerificationResult);
elements.clearPlayerForm.addEventListener("click", () => {
  clearPlayerForm(elements);
  renderPlayerManagement(elements, members, maxRosterSize);
});
elements.loadRosterCloud.addEventListener("click", () => loadRosterFromCloud({ manual: true }));
elements.exportRosterBackup.addEventListener("click", exportRosterBackup);
elements.saveRosterCloud.addEventListener("click", saveRosterToCloud);
elements.backFromPlayerManagement.addEventListener("click", returnFromPlayerManagement);
elements.playerManagementList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-player]");
  const removeButton = event.target.closest("[data-remove-player]");

  if (removeButton) {
    removePlayerFromRoster(removeButton.dataset.removePlayer);
    return;
  }

  if (!editButton) return;

  const player = members.find((member) => member.id === editButton.dataset.editPlayer);

  if (!player) return;

  fillPlayerForm(elements, player);
  renderPlayerManagement(elements, members, maxRosterSize);
  elements.playerManagementStatus.textContent = `Editing ${player.name}.`;
  elements.playerForm.scrollIntoView({ behavior: "auto", block: "start" });
});
