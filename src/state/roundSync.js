window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.state = window.OGSGolf.state || {};

function copyArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function copyGroups(groups) {
  return (groups || []).map((group) => copyArray(group));
}

function copyGroupRecords(records) {
  return (records || []).map((record) => ({
    ...record,
    playerIds: copyArray(record?.playerIds),
    completedHoleNumbers: copyArray(record?.completedHoleNumbers)
  }));
}

function mergeActiveRound({
  localRound,
  cloudRound,
  savedGroupIndex,
  savedHoleIndex,
  preferLocalSetup = false
}) {
  if (!cloudRound || cloudRound.id !== localRound?.id) return localRound;

  const localSettings = localRound.roundSettings || {};
  const cloudSettings = cloudRound.roundSettings || {};
  const setupRound = preferLocalSetup ? localRound : cloudRound;
  const setupSettings = preferLocalSetup ? localSettings : cloudSettings;
  const setupPlayers = setupRound.players || [];
  const setupGroups = copyGroups(setupSettings.groups);
  const cloudGroupRecords = copyGroupRecords(cloudSettings.groupRecords);
  const localGroupRecords = copyGroupRecords(localSettings.groupRecords);
  const groupRecords = preferLocalSetup ? localGroupRecords : cloudGroupRecords;
  const groupHoleIndexes = copyArray(cloudRound.groupHoleIndexes || localRound.groupHoleIndexes);
  const savedScores = {
    ...(localRound.savedScores || {}),
    ...(cloudRound.savedScores || {})
  };
  let savedHoleResults = copyArray(cloudRound.savedHoleResults || localRound.savedHoleResults);

  if (Number.isInteger(savedGroupIndex) && Number.isInteger(savedHoleIndex)) {
    if (!preferLocalSetup && localGroupRecords[savedGroupIndex]) {
      groupRecords[savedGroupIndex] = localGroupRecords[savedGroupIndex];
    }
    groupHoleIndexes[savedGroupIndex] = localRound.groupHoleIndexes?.[savedGroupIndex]
      ?? groupHoleIndexes[savedGroupIndex];

    const authoritativePlayerIds = new Set(setupGroups[savedGroupIndex] || []);
    authoritativePlayerIds.forEach((playerId) => {
      const cloudPlayerScores = cloudRound.savedScores?.[playerId];
      const localPlayerScores = localRound.savedScores?.[playerId];
      savedScores[playerId] = copyArray(cloudPlayerScores || localPlayerScores);

      if (localPlayerScores && localPlayerScores[savedHoleIndex] !== undefined) {
        savedScores[playerId][savedHoleIndex] = localPlayerScores[savedHoleIndex];
      }
    });

    const cloudHoleResults = savedHoleResults[savedHoleIndex] || [];
    const localHoleResults = localRound.savedHoleResults?.[savedHoleIndex] || [];
    savedHoleResults[savedHoleIndex] = [
      ...cloudHoleResults.filter((result) => !authoritativePlayerIds.has(result.playerId)),
      ...localHoleResults.filter((result) => authoritativePlayerIds.has(result.playerId))
    ];
  }

  const activePlayerIds = new Set(setupPlayers.map((player) => player.id));
  Object.keys(savedScores).forEach((playerId) => {
    if (!activePlayerIds.has(playerId)) delete savedScores[playerId];
  });
  savedHoleResults = savedHoleResults.map((holeResults) =>
    Array.isArray(holeResults)
      ? holeResults.filter((result) => activePlayerIds.has(result.playerId))
      : holeResults
  );

  return {
    ...cloudRound,
    ...(preferLocalSetup ? localRound : {}),
    id: cloudRound.id,
    currentGroupIndex: localRound.currentGroupIndex,
    currentHoleIndex: localRound.currentHoleIndex,
    currentHole: localRound.currentHole,
    players: setupPlayers.map((player) => ({ ...player })),
    groupHoleIndexes,
    savedScores,
    savedHoleResults,
    skinResults: cloudRound.skinResults || localRound.skinResults,
    playerStatuses: preferLocalSetup
      ? (localRound.playerStatuses || {})
      : (cloudRound.playerStatuses || {}),
    roundSettings: {
      ...setupSettings,
      players: setupPlayers.map((player) => ({ ...player })),
      selectedPlayerIds: setupPlayers.map((player) => player.id),
      groups: setupGroups,
      groupRecords,
      playerStatuses: preferLocalSetup
        ? (localSettings.playerStatuses || localRound.playerStatuses || {})
        : (cloudSettings.playerStatuses || cloudRound.playerStatuses || {})
    }
  };
}

window.OGSGolf.state.roundSync = {
  mergeActiveRound
};
