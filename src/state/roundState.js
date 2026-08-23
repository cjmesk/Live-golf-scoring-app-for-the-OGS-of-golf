window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.state = window.OGSGolf.state || {};

window.OGSGolf.state.createRoundState = function createRoundState(
  course,
  players,
  roundSettings,
  savedRound
) {
  const {
    getCourseHandicap,
    getCourseHandicapDetails,
    getNetScore,
    getPoints,
    getSkinWinner,
    getStrokesOnHole
  } = window.OGSGolf.rules;
  const defaultTeeId = course.teeOrder?.[0] || Object.keys(course.tees || {})[0];
  const totalHoles = course.tees[defaultTeeId].length;
  const savedScores = {};
  const courseHandicaps = {};
  const draftScores = {};
  const roundId = savedRound?.id || `round-${new Date().toISOString()}`;
  let savedHoleResults = savedRound?.savedHoleResults || Array(totalHoles).fill(null);
  let skinResults = savedRound?.skinResults || Array(totalHoles).fill(null);
  let currentHoleIndex = savedRound?.currentHoleIndex || 0;
  const playerStatuses = {
    ...(roundSettings.playerStatuses || {}),
    ...(savedRound?.playerStatuses || {})
  };

  players.forEach((player) => {
    savedScores[player.id] = savedRound?.savedScores?.[player.id] || Array(totalHoles).fill(null);
    const savedCourseHandicap = Number(player.courseHandicap);
    courseHandicaps[player.id] = Number.isFinite(savedCourseHandicap)
      ? savedCourseHandicap
      : getCourseHandicap(player, course);
  });

  function isInSkins(player) {
    return player.inSkins === true;
  }

  function isInPoints(player) {
    return player.inPoints === true;
  }

  function getSkinsPlayers() {
    return players.filter((player) => isInSkins(player) && !isPlayerDnf(player));
  }

  function getPointsPlayers() {
    return players.filter((player) => isInPoints(player) && !isPlayerDnf(player));
  }

  function isPlayerDnf(player) {
    return playerStatuses[player.id]?.status === "dnf";
  }

  function getPlayerDnfStatus(player) {
    return playerStatuses[player.id] || null;
  }

  function formatDnfStatus(player) {
    const status = getPlayerDnfStatus(player);
    return status?.status === "dnf"
      ? `DNF - ${status.holesCompleted} holes - ${status.grossStrokes} strokes`
      : "";
  }

  function formatPointsNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function formatPointsResult(value) {
    if (value === 0) return "E";
    return value > 0 ? `+${formatPointsNumber(value)}` : formatPointsNumber(value);
  }

  function getPointsQuota(player) {
    const playingHandicap = courseHandicaps[player.id] ?? getCourseHandicap(player, course);
    return 36 - playingHandicap;
  }

  function getPlayerHolesToPlay(player) {
    const groupIndex = (roundSettings.groups || []).findIndex((group) => group.includes(player.id));
    const groupRecord = groupIndex >= 0 ? roundSettings.groupRecords?.[groupIndex] : null;
    return Number(groupRecord?.holesToPlay || groupRecord?.holes_to_play || totalHoles);
  }

  function getPointsTarget(player, section = "overall") {
    const overallQuota = getPointsQuota(player);
    const sideQuota = overallQuota / 2;
    const holesToPlay = getPlayerHolesToPlay(player);

    if (section === "front" || section === "back") return sideQuota;
    return holesToPlay <= 9 ? sideQuota : overallQuota;
  }

  function getPointsHolesNeeded(player, section = "overall") {
    if (section === "front" || section === "back") return 9;
    return getPlayerHolesToPlay(player) <= 9 ? 9 : totalHoles;
  }

  function getHoleForPlayer(player, holeIndex = currentHoleIndex) {
    return course.tees[player.tee][holeIndex];
  }

  function loadDraftScores() {
    players.forEach((player) => {
      const savedScore = savedScores[player.id][currentHoleIndex];
      const par = getHoleForPlayer(player).par;
      draftScores[player.id] = savedScore ?? par;
    });
  }

  function isSavedGrossScore(score) {
    const numericScore = Number(score);
    return score !== null
      && score !== undefined
      && score !== ""
      && Number.isFinite(numericScore)
      && numericScore > 0;
  }

  function getPlayerTotals(player) {
    return savedScores[player.id].reduce(
      (totals, score, index) => {
        if (isSavedGrossScore(score)) {
          const grossScore = Number(score);
          const par = getHoleForPlayer(player, index).par;
          const points = getPoints(grossScore, par);
          const holeResult = savedHoleResults[index]?.find(
            (result) => result.playerId === player.id
          );
          const strokesReceived = getStrokesForPlayerOnHole(player, index);
          const netScore = holeResult?.netScore ?? getNetScore(grossScore, strokesReceived);
          totals.gross += grossScore;
          totals.net += Number(netScore);
          totals.holesPlayed += 1;
          if (index < 9) {
            totals.frontGross += grossScore;
            totals.frontGrossHoles += 1;
          } else {
            totals.backGross += grossScore;
            totals.backGrossHoles += 1;
          }
          if (isInPoints(player)) {
            totals.points += points;
            if (index < 9) {
              totals.frontPoints += points;
              totals.frontHolesPlayed += 1;
            } else {
              totals.backPoints += points;
              totals.backHolesPlayed += 1;
            }
          }
        }

        return totals;
      },
      {
        gross: 0,
        frontGross: 0,
        backGross: 0,
        frontGrossHoles: 0,
        backGrossHoles: 0,
        net: 0,
        points: 0,
        frontPoints: 0,
        backPoints: 0,
        frontHolesPlayed: 0,
        backHolesPlayed: 0,
        holesPlayed: 0,
        pointsQuota: getPointsQuota(player),
        frontPointsTarget: getPointsTarget(player, "front"),
        backPointsTarget: getPointsTarget(player, "back"),
        overallPointsTarget: getPointsTarget(player, "overall")
      }
    );
  }

  function getSavedGrossRecordsForPlayer(player) {
    return (savedScores[player.id] || [])
      .map((score, index) => ({
        hole: index + 1,
        gross: isSavedGrossScore(score) ? Number(score) : null
      }))
      .filter((record) => record.gross !== null);
  }

  function formatGrossTotal(totals, section = "overall") {
    const values = {
      front: {
        label: "Front Gross",
        gross: totals.frontGross,
        holesPlayed: totals.frontGrossHoles,
        holesNeeded: 9
      },
      back: {
        label: "Back Gross",
        gross: totals.backGross,
        holesPlayed: totals.backGrossHoles,
        holesNeeded: 9
      },
      overall: {
        label: "Gross",
        gross: totals.gross,
        holesPlayed: totals.holesPlayed,
        holesNeeded: totalHoles
      }
    }[section];

    if (values.holesPlayed === 0) return `${values.label}: -`;
    if (values.holesPlayed >= values.holesNeeded) return `${values.label}: ${values.gross}`;
    return `${values.label}: ${values.gross} through ${values.holesPlayed} holes`;
  }

  function getPointsDifferential(player, section = "overall") {
    if (isPlayerDnf(player)) {
      return {
        points: 0,
        target: 0,
        quota: getPointsQuota(player),
        holesPlayed: getPlayerTotals(player).holesPlayed,
        holesNeeded: getPointsHolesNeeded(player, section),
        isComplete: false,
        differential: Number.NEGATIVE_INFINITY,
        display: formatDnfStatus(player)
      };
    }

    const totals = getPlayerTotals(player);
    const target = {
      front: totals.frontPointsTarget,
      back: totals.backPointsTarget,
      overall: totals.overallPointsTarget
    }[section];
    const points = {
      front: totals.frontPoints,
      back: totals.backPoints,
      overall: totals.points
    }[section];
    const holesPlayed = {
      front: totals.frontHolesPlayed,
      back: totals.backHolesPlayed,
      overall: totals.holesPlayed
    }[section];
    const holesNeeded = getPointsHolesNeeded(player, section);
    const isComplete = holesPlayed >= holesNeeded;
    const differential = points - target;

    return {
      points,
      target,
      quota: totals.pointsQuota,
      holesPlayed,
      holesNeeded,
      isComplete,
      differential,
      display: isComplete ? formatPointsResult(differential) : `${points} pts thru ${holesPlayed}`
    };
  }

  function getPointsLeaders(section) {
    const pointsPlayers = getPointsPlayers();
    const totals = pointsPlayers.map((player) => ({
      player,
      ...getPointsDifferential(player, section)
    }));
    if (totals.length === 0) {
      return {
        points: 0,
        target: 0,
        differential: null,
        display: "-",
        leaders: []
      };
    }
    const highDifferential = Math.max(...totals.map((item) => item.differential));
    const leaders = totals.filter((item) => item.differential === highDifferential);

    return {
      points: leaders[0].points,
      target: leaders[0].target,
      differential: highDifferential,
      display: formatPointsResult(highDifferential),
      leaders
    };
  }

  function getPointsSummary() {
    return {
      front: getPointsLeaders("front"),
      back: getPointsLeaders("back"),
      overall: getPointsLeaders("overall")
    };
  }

  function getPointsResultStandings() {
    let currentRank = 1;
    const standings = getPointsPlayers()
      .map((player) => {
        const totals = getPlayerTotals(player);

        return {
          player,
          totals,
          front: getPointsDifferential(player, "front"),
          back: getPointsDifferential(player, "back"),
          overall: getPointsDifferential(player, "overall")
        };
      })
      .sort((a, b) => {
        if (b.overall.differential !== a.overall.differential) {
          return b.overall.differential - a.overall.differential;
        }

        if (b.totals.points !== a.totals.points) {
          return b.totals.points - a.totals.points;
        }

        return a.player.name.localeCompare(b.player.name);
      });

    return standings.map((standing, index) => {
      const previousStanding = standings[index - 1];
      const nextStanding = standings[index + 1];
      const tiedWithPrevious = previousStanding
        && previousStanding.overall.differential === standing.overall.differential
        && previousStanding.totals.points === standing.totals.points;
      const tiedWithNext = nextStanding
        && nextStanding.overall.differential === standing.overall.differential
        && nextStanding.totals.points === standing.totals.points;

      if (!tiedWithPrevious) {
        currentRank = index + 1;
      }

      return {
        ...standing,
        rank: currentRank,
        rankLabel: tiedWithPrevious || tiedWithNext ? `T-${currentRank}` : String(currentRank)
      };
    });
  }

  function getLeaderboardStandings() {
    return players
      .map((player) => ({
        player,
        totals: getPlayerTotals(player),
        dnf: isPlayerDnf(player)
      }))
      .sort((a, b) => {
        if (a.dnf !== b.dnf) {
          return a.dnf ? 1 : -1;
        }

        const aPointsResult = getPointsDifferential(a.player, "overall");
        const bPointsResult = getPointsDifferential(b.player, "overall");

        if (bPointsResult.differential !== aPointsResult.differential) {
          return bPointsResult.differential - aPointsResult.differential;
        }

        if (b.totals.points !== a.totals.points) {
          return b.totals.points - a.totals.points;
        }

        return a.totals.gross - b.totals.gross;
      });
  }

  function getLowestScoreLeaders(scoreKey) {
    const eligiblePlayers = players.filter((player) => !isPlayerDnf(player));

    if (eligiblePlayers.length === 0) {
      return {
        score: "-",
        leaders: []
      };
    }

    const totals = eligiblePlayers.map((player) => ({
      player,
      score: getPlayerTotals(player)[scoreKey]
    }));
    const lowScore = Math.min(...totals.map((item) => item.score));

    return {
      score: lowScore,
      leaders: totals.filter((item) => item.score === lowScore)
    };
  }

  function getPlayerHoleResult(player, holeIndex = currentHoleIndex) {
    return savedHoleResults[holeIndex]?.find((result) => result.playerId === player.id) ?? null;
  }

  function getHolePointsResults(holeIndex) {
    return players.map((player) => {
      const grossScore = savedScores[player.id][holeIndex];
      const par = getHoleForPlayer(player, holeIndex).par;

        return {
          player,
          points: grossScore === null || !isInPoints(player) || isPlayerDnf(player) ? 0 : getPoints(grossScore, par)
        };
      });
  }

  function getSkinForHole(holeIndex) {
    return skinResults[holeIndex] ?? null;
  }

  function getStrokesForPlayerOnHole(player, holeIndex = currentHoleIndex) {
    const hole = getHoleForPlayer(player, holeIndex);
    return getStrokesOnHole(courseHandicaps[player.id], hole.handicap);
  }

  function getSkinScore(grossScore, strokesReceived) {
    const mode = roundSettings.games.netSkins?.skinsHandicapMode || "half";
    const skinStrokeValue = mode === "half" ? 0.5 : 1;
    return Number(grossScore) - (strokesReceived * skinStrokeValue);
  }

  function rebuildSavedHoleResultForPlayer(player) {
    savedScores[player.id].forEach((score, holeIndex) => {
      if (!isSavedGrossScore(score)) return;

      const grossScore = Number(score);
      const strokesReceived = getStrokesForPlayerOnHole(player, holeIndex);
      const netScore = getNetScore(grossScore, strokesReceived);
      const skinScore = getSkinScore(grossScore, strokesReceived);
      const existingHoleResults = savedHoleResults[holeIndex] || [];

      savedHoleResults[holeIndex] = [
        ...existingHoleResults.filter((result) => result.playerId !== player.id),
        {
          playerId: player.id,
          grossScore,
          strokesReceived,
          netScore,
          skinScore
        }
      ];
    });
  }

  function recalculateSkins() {
    const skinsPlayers = getSkinsPlayers();

    skinResults = savedHoleResults.map((holeResults, index) => {
      if (!holeResults) return null;
      const skinHoleResults = holeResults
        .filter((result) => skinsPlayers.some((player) => player.id === result.playerId))
        .map((result) => {
          const player = skinsPlayers.find((item) => item.id === result.playerId);
          const grossScore = Number(result.grossScore);
          const strokesReceived = getStrokesForPlayerOnHole(player, index);

          return {
            ...result,
            grossScore,
            strokesReceived,
            netScore: getNetScore(grossScore, strokesReceived),
            skinScore: getSkinScore(grossScore, strokesReceived)
          };
        });
      const hasEveryPlayer = skinsPlayers.length > 0 && skinsPlayers.every((player) =>
        skinHoleResults.some((result) => result.playerId === player.id)
      );

      if (!hasEveryPlayer) {
        return {
          hole: index + 1,
          winnerId: null,
          holeResults: skinHoleResults
        };
      }

      const winnerId = getSkinWinner(skinHoleResults);

      return {
        hole: index + 1,
        winnerId,
        holeResults: skinHoleResults
      };
    });
  }

  function getSkinSummary() {
    const summary = {};

    getSkinsPlayers().forEach((player) => {
      summary[player.id] = {
        player,
        totalSkins: 0,
        holesWon: [],
        holesWonDetails: []
      };
    });

    skinResults.forEach((skin) => {
      if (!skin?.winnerId) return;
      if (!summary[skin.winnerId]) return;

      const winnerHoleResult = skin.holeResults?.find((result) => result.playerId === skin.winnerId);
      summary[skin.winnerId].totalSkins += 1;
      summary[skin.winnerId].holesWon.push(skin.hole);
      summary[skin.winnerId].holesWonDetails.push({
        hole: skin.hole,
        skinsNetScore: winnerHoleResult?.skinScore ?? null,
        netScore: winnerHoleResult?.skinScore ?? null,
        scorecardNetScore: winnerHoleResult?.netScore ?? null
      });
    });

    return summary;
  }

  function getGameAmount(gameId) {
    const amount = Number(roundSettings.games?.[gameId]?.amount || 0);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  function roundMoney(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.round(numericValue * 100) / 100;
  }

  function moneyToCents(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.round(numericValue * 100));
  }

  function centsToMoney(cents) {
    return roundMoney(Number(cents || 0) / 100);
  }

  function allocateRoundedDollars(totalDollars, unitCount) {
    if (!Number.isFinite(totalDollars) || unitCount <= 0) return [];

    const wholeDollarPot = Math.round(totalDollars);
    const exactShare = wholeDollarPot / unitCount;
    const payouts = Array.from({ length: unitCount }, () => Math.round(exactShare));
    let difference = wholeDollarPot - payouts.reduce((total, payout) => total + payout, 0);

    if (difference > 0) {
      for (let index = 0; difference > 0; index = (index + 1) % payouts.length) {
        payouts[index] += 1;
        difference -= 1;
      }
    }

    if (difference < 0) {
      for (let index = payouts.length - 1; difference < 0 && index >= 0; index -= 1) {
        if (payouts[index] <= 0) continue;
        payouts[index] -= 1;
        difference += 1;
      }
    }

    return payouts;
  }

  const pointsPayoutScheduleByPlayerCount = {
    20: [45, 25, 15, 10, 5],
    19: [45, 25, 15, 10],
    18: [45, 20, 15, 10],
    17: [40, 20, 15, 10],
    16: [35, 20, 15, 10],
    15: [45, 20, 10],
    14: [40, 20, 10],
    13: [35, 20, 10],
    12: [30, 20, 10],
    11: [35, 20],
    10: [30, 20],
    9: [25, 20],
    8: [25, 15],
    7: [20, 15],
    6: [20, 10],
    5: [15, 10]
  };

  function getPointsPayoutSchedule(participantCount, pot) {
    if (participantCount <= 4) return [pot];
    return pointsPayoutScheduleByPlayerCount[participantCount] || [];
  }

  function getPointsPayoutStandings(section) {
    let currentRank = 1;
    const standings = getPointsPlayers()
      .map((player) => {
        const result = getPointsDifferential(player, section);

        return {
          player,
          points: result.points || 0,
          target: result.target || 0,
          differential: result.differential,
          display: result.display || "-"
        };
      })
      .sort((firstPlayer, secondPlayer) => {
        if (secondPlayer.differential !== firstPlayer.differential) {
          return secondPlayer.differential - firstPlayer.differential;
        }

        if (secondPlayer.points !== firstPlayer.points) {
          return secondPlayer.points - firstPlayer.points;
        }

        return firstPlayer.player.name.localeCompare(secondPlayer.player.name);
      });

    return standings.map((standing, index) => {
      const previousStanding = standings[index - 1];
      const nextStanding = standings[index + 1];
      const tiedWithPrevious = previousStanding
        && previousStanding.differential === standing.differential
        && previousStanding.points === standing.points;
      const tiedWithNext = nextStanding
        && nextStanding.differential === standing.differential
        && nextStanding.points === standing.points;

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

  function getPaidPointsWinners(section, pot, participantCount) {
    const standings = getPointsPayoutStandings(section);
    const payoutSchedule = getPointsPayoutSchedule(participantCount, pot);
    const paidWinners = [];

    for (let index = 0; index < standings.length; index += 1) {
      const tiedPlayers = standings.filter((standing) => standing.rank === standings[index].rank);
      const firstPositionIndex = standings[index].rank - 1;
      const paidPositions = Array.from({ length: tiedPlayers.length }, (_, offset) =>
        payoutSchedule[firstPositionIndex + offset] || 0
      );
      const tiedPot = paidPositions.reduce((total, payout) => total + payout, 0);

      if (tiedPot > 0) {
        const tiedPayouts = allocateRoundedDollars(tiedPot, tiedPlayers.length);

        tiedPlayers.forEach((standing, tiedIndex) => {
          paidWinners.push({
            place: standing.rank,
            playerId: standing.player.id,
            playerName: standing.player.name,
            rank: standing.rank,
            rankLabel: standing.rankLabel,
            points: standing.points,
            target: standing.target,
            differential: standing.differential,
            display: standing.display,
            payout: tiedPayouts[tiedIndex] || 0
          });
        });
      }

      index += tiedPlayers.length - 1;
    }

    return {
      standings,
      payoutSchedule,
      winners: paidWinners
    };
  }

  function getPointsPayoutSummary() {
    const pointsPlayers = getPointsPlayers();
    const amountPerPlayer = getGameAmount("pointsGame");
    const enabled = roundSettings.games?.pointsGame?.enabled === true && pointsPlayers.length > 0;
    const perSectionAmount = Math.round(amountPerPlayer / 3);
    const sectionPot = enabled ? perSectionAmount * pointsPlayers.length : 0;
    const totalPot = sectionPot * 3;

    function getSection(section) {
      const paidResults = getPaidPointsWinners(section, sectionPot, pointsPlayers.length);
      const firstWinner = paidResults.standings[0] || null;
      const payouts = paidResults.winners.map((winner) => ({
        place: winner.place || winner.rank,
        playerId: winner.playerId,
        playerName: winner.playerName,
        score: winner.differential,
        points: winner.points,
        target: winner.target,
        payout: winner.payout,
        rank: winner.rank,
        rankLabel: winner.rankLabel,
        differential: winner.differential,
        display: winner.display
      }));

      return {
        section,
        pot: sectionPot,
        points: firstWinner?.points || 0,
        target: firstWinner?.target || 0,
        differential: firstWinner?.differential ?? null,
        display: firstWinner?.display || "-",
        payoutSchedule: paidResults.payoutSchedule,
        standings: paidResults.standings.map((standing) => ({
          playerId: standing.player.id,
          playerName: standing.player.name,
          rank: standing.rank,
          rankLabel: standing.rankLabel,
          points: standing.points,
          target: standing.target,
          differential: standing.differential,
          display: standing.display
        })),
        winners: payouts,
        payouts
      };
    }

    const front = getSection("front");
    const back = getSection("back");
    const overall = getSection("overall");

    return {
      enabled,
      amountPerPlayer,
      participantCount: pointsPlayers.length,
      totalPot,
      sectionPot,
      sectionPots: [sectionPot, sectionPot, sectionPot],
      front,
      back,
      overall,
      frontPayouts: front.payouts,
      backPayouts: back.payouts,
      overallPayouts: overall.payouts
    };
  }

  function getSkinsPayoutSummary() {
    const skinsPlayers = getSkinsPlayers();
    const amountPerPlayer = getGameAmount("netSkins");
    const enabled = roundSettings.games?.netSkins?.enabled === true && skinsPlayers.length > 0;
    const totalPot = enabled ? Math.round(amountPerPlayer * skinsPlayers.length) : 0;
    const totalPotCents = totalPot * 100;
    const skinSummary = getSkinSummary();
    const winners = Object.values(skinSummary).filter((item) => item.totalSkins > 0);
    const totalWinningSkins = winners.reduce((total, item) => total + item.totalSkins, 0);
    const winningSkinUnits = winners
      .flatMap((item) => (item.holesWonDetails || []).map((detail) => ({
        playerId: item.player.id,
        hole: detail.hole
      })))
      .sort((firstSkin, secondSkin) => {
        if (firstSkin.hole !== secondSkin.hole) return firstSkin.hole - secondSkin.hole;
        return firstSkin.playerId.localeCompare(secondSkin.playerId);
      });
    const skinDollarPayouts = allocateRoundedDollars(totalPot, winningSkinUnits.length);
    const playerPayoutCents = {};

    winningSkinUnits.forEach((skinUnit, index) => {
      const skinPayoutCents = (skinDollarPayouts[index] || 0) * 100;
      playerPayoutCents[skinUnit.playerId] =
        (playerPayoutCents[skinUnit.playerId] || 0) + skinPayoutCents;
    });

    return {
      enabled,
      amountPerPlayer,
      participantCount: skinsPlayers.length,
      totalPot,
      totalPotCents,
      totalWinningSkins,
      valuePerSkin: totalWinningSkins > 0 ? roundMoney(totalPot / totalWinningSkins) : 0,
      payoutPerSkin: skinDollarPayouts[0] || 0,
      winners: winners.map((item) => ({
        playerId: item.player.id,
        playerName: item.player.name,
        totalSkins: item.totalSkins,
        holesWon: item.holesWon,
        holesWonDetails: item.holesWonDetails || [],
        payout: centsToMoney(playerPayoutCents[item.player.id] || 0),
        payoutCents: playerPayoutCents[item.player.id] || 0
      }))
    };
  }

  function getPayoutSummary() {
    if (savedRound?.completed && !savedRound.payoutSummary) {
      return null;
    }

    if (savedRound?.payoutSummary) {
      if (!savedPointsPayoutLooksCurrent(savedRound.payoutSummary)) {
        console.info("OGS payout trace: rebuilding stale saved points payout snapshot", {
          roundId,
          participantCount: getPointsPlayers().length,
          savedFrontWinners: savedRound.payoutSummary.points?.front?.winners?.length || 0,
          savedBackWinners: savedRound.payoutSummary.points?.back?.winners?.length || 0,
          savedOverallWinners: savedRound.payoutSummary.points?.overall?.winners?.length || 0
        });
        return buildFreshPayoutSummary();
      }

      return savedRound.payoutSummary;
    }

    return buildFreshPayoutSummary();
  }

  function savedPointsPayoutLooksCurrent(payoutSummary) {
    const points = payoutSummary?.points;

    if (points?.enabled !== true) return true;

    const participantCount = Number(points.participantCount || getPointsPlayers().length);
    const sectionPot = Number(points.sectionPot || points.front?.pot || 0);
    const expectedPaidPlaces = getPointsPayoutSchedule(participantCount, sectionPot).length;

    if (expectedPaidPlaces <= 1) return true;

    return ["front", "back", "overall"].every((section) => {
      const savedWinners = points[section]?.payouts || points[section]?.winners || [];
      const savedPayouts = points[`${section}Payouts`] || [];
      const rowCount = Math.max(savedWinners.length, savedPayouts.length);
      const winnerTakeAllValue = Number(savedWinners[0]?.payout || savedPayouts[0]?.payout || 0);

      if (rowCount < expectedPaidPlaces) return false;
      if (rowCount === 1 && winnerTakeAllValue === sectionPot) return false;

      return true;
    });
  }

  function buildFreshPayoutSummary() {
    const points = getPointsPayoutSummary();
    const skins = getSkinsPayoutSummary();
    const frontPointWinnings = {};
    const backPointWinnings = {};
    const overallPointWinnings = {};
    const skinWinnings = {};

    [
      { section: "front", winnings: frontPointWinnings },
      { section: "back", winnings: backPointWinnings },
      { section: "overall", winnings: overallPointWinnings }
    ].forEach(({ section, winnings }) => {
      points[section].winners.forEach((winner) => {
        winnings[winner.playerId] = roundMoney((winnings[winner.playerId] || 0) + winner.payout);
      });
    });

    skins.winners.forEach((winner) => {
      skinWinnings[winner.playerId] = roundMoney((skinWinnings[winner.playerId] || 0) + winner.payout);
    });

    return {
      points,
      skins,
      playerTotals: players
        .map((player) => {
          const frontPointsWinnings = frontPointWinnings[player.id] || 0;
          const backPointsWinnings = backPointWinnings[player.id] || 0;
          const overallPointsWinnings = overallPointWinnings[player.id] || 0;
          const pointsWinnings = roundMoney(frontPointsWinnings + backPointsWinnings + overallPointsWinnings);
          const skinsWinnings = skinWinnings[player.id] || 0;

          return {
            playerId: player.id,
            playerName: player.name,
            frontPointsWinnings,
            backPointsWinnings,
            overallPointsWinnings,
            pointsWinnings,
            skinsWinnings,
            totalWinnings: roundMoney(pointsWinnings + skinsWinnings)
          };
        })
        .sort((firstPlayer, secondPlayer) => {
          if (secondPlayer.totalWinnings !== firstPlayer.totalWinnings) {
            return secondPlayer.totalWinnings - firstPlayer.totalWinnings;
          }

          return firstPlayer.playerName.localeCompare(secondPlayer.playerName);
        })
    };
  }

  function isRoundComplete() {
    const matchSummary = getFourBallMatchSummary();
    if (matchSummary?.settings.enabled) return matchSummary.complete;

    return players.every((player) =>
      isPlayerDnf(player) || savedScores[player.id].every((score, holeIndex) =>
        !isHoleRequiredForPlayer(player, holeIndex) || score !== null
      )
    );
  }

  function isHoleRequiredForPlayer(player, holeIndex) {
    const lateJoinHole = Number(player.lateJoinHole || player.late_join_hole || 0);
    if (!lateJoinHole) return true;

    const groupIndex = (roundSettings.groups || []).findIndex((group) => group.includes(player.id));
    const groupRecord = groupIndex >= 0 ? roundSettings.groupRecords?.[groupIndex] : null;
    const startingHole = Number(groupRecord?.startingHole || groupRecord?.starting_hole || 1);
    const holesToPlay = Number(groupRecord?.holesToPlay || groupRecord?.holes_to_play || totalHoles);
    const sequence = Array.from({ length: holesToPlay }, (_, offset) =>
      ((startingHole - 1 + offset) % totalHoles) + 1
    );
    const joinIndex = sequence.indexOf(lateJoinHole);
    const holeSequenceIndex = sequence.indexOf(holeIndex + 1);

    if (joinIndex < 0 || holeSequenceIndex < 0) return true;
    return holeSequenceIndex >= joinIndex;
  }

  function getLastSavedHoleIndex() {
    for (let index = totalHoles - 1; index >= 0; index -= 1) {
      const isSaved = players.every((player) =>
        !isHoleRequiredForPlayer(player, index) || savedScores[player.id][index] !== null
      );

      if (isSaved) return index;
    }

    return -1;
  }

  function getLastSavedHoleIndexForPlayers(playersToCheck = players) {
    for (let index = totalHoles - 1; index >= 0; index -= 1) {
      const isSaved = playersToCheck.every((player) =>
        !isHoleRequiredForPlayer(player, index) || savedScores[player.id][index] !== null
      );

      if (isSaved) return index;
    }

    return -1;
  }

  function getFinalSummary() {
    return {
      grossWinner: getLowestScoreLeaders("gross"),
      netWinner: getLowestScoreLeaders("net"),
      points: getPointsSummary(),
      pointsResultStandings: getPointsResultStandings(),
      payoutSummary: getPayoutSummary(),
      skins: getSkinSummary(),
      playerTotals: players.map((player) => ({
        player,
        totals: getPlayerTotals(player),
        dnf: getPlayerDnfStatus(player),
        skins: getSkinSummary()[player.id] || {
          player,
          totalSkins: 0,
          holesWon: [],
          holesWonDetails: []
        }
      }))
    };
  }

  function getPlayerExportTotals(player) {
    const dnfStatus = getPlayerDnfStatus(player);
    const totals = savedScores[player.id].reduce(
      (playerTotals, score, holeIndex) => {
        if (score === null || score === undefined) return playerTotals;

        const grossScore = Number(score);
        const holeResult = getPlayerHoleResult(player, holeIndex);
        const netScore = holeResult?.netScore;

        playerTotals.gross += grossScore;
        playerTotals.holesPlayed += 1;

        if (Number.isFinite(Number(netScore))) {
          playerTotals.net += Number(netScore);
        }

        if (holeIndex < 9) {
          playerTotals.frontGross += grossScore;
          playerTotals.frontGrossHoles += 1;

          if (Number.isFinite(Number(netScore))) {
            playerTotals.frontNet += Number(netScore);
          }
        } else {
          playerTotals.backGross += grossScore;
          playerTotals.backGrossHoles += 1;

          if (Number.isFinite(Number(netScore))) {
            playerTotals.backNet += Number(netScore);
          }
        }

        return playerTotals;
      },
      {
        gross: 0,
        frontGross: 0,
        backGross: 0,
        frontGrossHoles: 0,
        backGrossHoles: 0,
        net: 0,
        frontNet: 0,
        backNet: 0,
        holesPlayed: 0
      }
    );

    const completedFront = totals.frontGrossHoles >= 9;
    const completedBack = totals.backGrossHoles >= 9;
    const completedRound = totals.holesPlayed >= totalHoles;

    return {
      ...totals,
      frontGross: completedFront ? totals.frontGross : null,
      backGross: completedBack ? totals.backGross : null,
      gross: completedRound ? totals.gross : totals.gross,
      frontNet: completedFront ? totals.frontNet : null,
      backNet: completedBack ? totals.backNet : null,
      net: completedRound ? totals.net : null,
      completedFront,
      completedBack,
      completedRound,
      dnf: dnfStatus,
      dnfGrossStrokes: dnfStatus?.grossStrokes ?? null,
      dnfHolesCompleted: dnfStatus?.holesCompleted ?? null
    };
  }

  function getTeamChallengeTeams() {
    if (!roundSettings.games.teamChallenge?.enabled) return [];

    const teamMap = new Map();

    players.forEach((player) => {
      if (!player.teamId) return;

      if (!teamMap.has(player.teamId)) {
        teamMap.set(player.teamId, {
          id: player.teamId,
          label: player.teamId.replace("team-", "Team "),
          players: []
        });
      }

      teamMap.get(player.teamId).players.push(player);
    });

    return Array.from(teamMap.values()).sort((firstTeam, secondTeam) =>
      firstTeam.id.localeCompare(secondTeam.id)
    );
  }

  function getFourBallMatchSummary() {
    if (!window.OGSGolf.rules.fourBallMatch) return null;

    // Match assignments are round-specific metadata and are not columns in the
    // live round_players score feed. Rehydrate them from the durable round
    // snapshot whenever the active player objects came from that detail feed.
    const savedMatchTeams = savedRound?.fourBallMatch?.teams || {};
    const savedPlayingHandicaps = savedRound?.fourBallMatch?.playingHandicaps || {};
    const settingsPlayers = roundSettings.players || [];
    const matchPlayers = players.map((player) => {
      const settingsPlayer = settingsPlayers.find((item) => item.id === player.id) || {};
      const savedTeam = ["A", "B"].find((teamId) =>
        (savedMatchTeams[teamId] || []).some((item) => (item.id || item.playerId) === player.id)
      ) || "";

      return {
        ...settingsPlayer,
        ...player,
        matchTeam: player.matchTeam || settingsPlayer.matchTeam || savedTeam,
        matchPlayingHandicap: player.matchPlayingHandicap
          ?? settingsPlayer.matchPlayingHandicap
          ?? savedPlayingHandicaps[player.id]
          ?? null
      };
    });

    return window.OGSGolf.rules.fourBallMatch.getSummary({
      players: matchPlayers,
      savedScores,
      course,
      courseHandicaps,
      roundSettings
    });
  }

  function getRoundExport() {
    const completedAt = new Date().toISOString();
    const holeByHole = Array.from({ length: totalHoles }, (_, holeIndex) => ({
      hole: holeIndex + 1,
      scores: players.map((player) => {
        const hole = getHoleForPlayer(player, holeIndex);
        const result = getPlayerHoleResult(player, holeIndex);

        return {
          playerId: player.id,
          playerName: player.name,
          tee: player.tee,
          par: hole.par,
          handicap: hole.handicap,
          yards: hole.yards,
          gross: savedScores[player.id][holeIndex],
          strokesReceived: result?.strokesReceived ?? 0,
          net: result?.netScore ?? null,
          skinScore: result?.skinScore ?? null,
          points: savedScores[player.id][holeIndex] === null || !isInPoints(player) || isPlayerDnf(player)
            ? 0
            : getPoints(savedScores[player.id][holeIndex], hole.par)
        };
      }),
      netSkin: getSkinForHole(holeIndex)
    }));
    const finalSummary = getFinalSummary();
    const teamChallengeTeams = getTeamChallengeTeams();

    return {
      id: roundId,
      date: completedAt,
      savedAt: completedAt,
      completed: true,
      roundType: roundSettings.roundType === "test" ? "test" : "official",
      countsTowardStats: roundSettings.roundType !== "test",
      roundSettings,
      course: {
        id: course.id,
        name: course.name,
        par: course.par
      },
      players: players.map((player) => ({
        id: player.id,
        name: player.name,
        ghin: player.ghin,
        handicapIndex: player.handicap,
        tee: player.tee,
        inSkins: isInSkins(player),
        inPoints: isInPoints(player),
        inTeamChallenge: player.inTeamChallenge === true,
        teamId: player.teamId || "",
        matchTeam: player.matchTeam || "",
        matchPlayingHandicap: player.matchPlayingHandicap ?? null,
        lateJoinHole: player.lateJoinHole || null,
        courseHandicap: courseHandicaps[player.id],
        dnf: getPlayerDnfStatus(player)
      })),
      holeByHole,
      savedScores,
      savedHoleResults,
      skinResults,
      playerStatuses,
      teamChallenge: {
        enabled: roundSettings.games.teamChallenge?.enabled === true,
        teams: teamChallengeTeams.map((team) => ({
          id: team.id,
          label: team.label,
          playerIds: team.players.map((player) => player.id),
          playerNames: team.players.map((player) => player.name)
        }))
      },
      fourBallMatch: getFourBallMatchSummary(),
      totals: finalSummary.playerTotals.map((item) => {
        const exportTotals = getPlayerExportTotals(item.player);

        return {
        playerId: item.player.id,
        playerName: item.player.name,
        gross: exportTotals.gross,
        frontGross: exportTotals.frontGross,
        backGross: exportTotals.backGross,
        frontGrossHoles: exportTotals.frontGrossHoles,
        backGrossHoles: exportTotals.backGrossHoles,
        holesPlayed: exportTotals.holesPlayed,
        net: exportTotals.net,
        frontNet: exportTotals.frontNet,
        backNet: exportTotals.backNet,
        completedFront: exportTotals.completedFront,
        completedBack: exportTotals.completedBack,
        completedRound: exportTotals.completedRound,
        points: item.totals.points,
        frontPoints: item.totals.frontPoints,
        backPoints: item.totals.backPoints,
        frontHolesPlayed: item.totals.frontHolesPlayed,
        backHolesPlayed: item.totals.backHolesPlayed,
        pointsQuota: item.totals.pointsQuota,
        frontPointsTarget: item.totals.frontPointsTarget,
        backPointsTarget: item.totals.backPointsTarget,
        overallPointsTarget: item.totals.overallPointsTarget,
        frontPointsResult: getPointsDifferential(item.player, "front").display,
        backPointsResult: getPointsDifferential(item.player, "back").display,
        overallPointsResult: getPointsDifferential(item.player, "overall").display,
        skinsWon: item.skins.totalSkins,
        skinHoles: item.skins.holesWon,
        dnf: exportTotals.dnf,
        dnfGrossStrokes: exportTotals.dnfGrossStrokes,
        dnfHolesCompleted: exportTotals.dnfHolesCompleted
        };
      }),
      winners: {
        gross: finalSummary.grossWinner,
        net: finalSummary.netWinner,
        frontPoints: finalSummary.points.front,
        backPoints: finalSummary.points.back,
        overallPoints: finalSummary.points.overall,
        netSkins: getSkinSummary()
      },
      payoutSummary: finalSummary.payoutSummary,
      pointsResults: {
        winners: finalSummary.points,
        standings: finalSummary.pointsResultStandings.map((standing) => ({
          rank: standing.rank,
          rankLabel: standing.rankLabel,
          playerId: standing.player.id,
          playerName: standing.player.name,
          frontPoints: standing.totals.frontPoints,
          frontResult: standing.front.display,
          frontDifferential: standing.front.differential,
          frontQuota: standing.front.target,
          backPoints: standing.totals.backPoints,
          backResult: standing.back.display,
          backDifferential: standing.back.differential,
          backQuota: standing.back.target,
          totalPoints: standing.totals.points,
          overallResult: standing.overall.display,
          overallDifferential: standing.overall.differential,
          overallQuota: standing.overall.target
        }))
      },
      finalSummary
    };
  }

  function getAutoSaveExport() {
    const autoSavedAt = new Date().toISOString();
    const totals = players.map((player) => {
      const playerTotals = getPlayerTotals(player);

      return {
        playerId: player.id,
        playerName: player.name,
        gross: playerTotals.gross,
        frontGross: playerTotals.frontGross,
        backGross: playerTotals.backGross,
        frontGrossHoles: playerTotals.frontGrossHoles,
        backGrossHoles: playerTotals.backGrossHoles,
        holesPlayed: playerTotals.holesPlayed,
        net: playerTotals.net,
        points: playerTotals.points,
        frontPoints: playerTotals.frontPoints,
        backPoints: playerTotals.backPoints,
        frontHolesPlayed: playerTotals.frontHolesPlayed,
        backHolesPlayed: playerTotals.backHolesPlayed,
        overallPoints: playerTotals.points,
        pointsQuota: playerTotals.pointsQuota,
        frontPointsTarget: playerTotals.frontPointsTarget,
        backPointsTarget: playerTotals.backPointsTarget,
        overallPointsTarget: playerTotals.overallPointsTarget,
        frontPointsResult: getPointsDifferential(player, "front").display,
        backPointsResult: getPointsDifferential(player, "back").display,
        overallPointsResult: getPointsDifferential(player, "overall").display,
        dnf: getPlayerDnfStatus(player)
      };
    });

    return {
      id: roundId,
      date: savedRound?.date || autoSavedAt,
      autoSavedAt,
      completed: false,
      currentHoleIndex,
      currentHole: currentHoleIndex + 1,
      roundSettings,
      course: {
        id: course.id,
        name: course.name,
        par: course.par
      },
      players: players.map((player) => ({
        id: player.id,
        name: player.name,
        ghin: player.ghin,
        handicap: player.handicap,
        handicapIndex: player.handicap,
        tee: player.tee,
        inSkins: isInSkins(player),
        inPoints: isInPoints(player),
        inTeamChallenge: player.inTeamChallenge === true,
        teamId: player.teamId || "",
        matchTeam: player.matchTeam || "",
        matchPlayingHandicap: player.matchPlayingHandicap ?? null,
        lateJoinHole: player.lateJoinHole || null,
        courseHandicap: courseHandicaps[player.id],
        dnf: getPlayerDnfStatus(player)
      })),
      savedScores,
      savedHoleResults,
      skinResults,
      playerStatuses,
      teamChallenge: {
        enabled: roundSettings.games.teamChallenge?.enabled === true,
        teams: getTeamChallengeTeams().map((team) => ({
          id: team.id,
          label: team.label,
          playerIds: team.players.map((player) => player.id),
          playerNames: team.players.map((player) => player.name)
        }))
      },
      fourBallMatch: getFourBallMatchSummary(),
      totals,
      points: getPointsSummary(),
      netSkins: getSkinSummary()
    };
  }

  function changeDraftScore(playerId, amount) {
    const nextScore = Number(draftScores[playerId]) + amount;
    draftScores[playerId] = Math.max(1, Math.min(12, nextScore));
  }

  function setDraftScore(playerId, value) {
    const nextScore = Number(value);

    if (!Number.isFinite(nextScore)) return;

    draftScores[playerId] = Math.max(1, Math.min(12, Math.round(nextScore)));
  }

  function saveCurrentHole(playersToSave = players) {
    const existingHoleResults = savedHoleResults[currentHoleIndex] || [];
    const activePlayersToSave = playersToSave.filter((player) => !isPlayerDnf(player));
    const playerIdsToSave = new Set(activePlayersToSave.map((player) => player.id));
    const holeResults = existingHoleResults.filter(
      (result) => !playerIdsToSave.has(result.playerId)
    );

    activePlayersToSave.forEach((player) => {
      const grossScore = draftScores[player.id];
      const strokesReceived = getStrokesForPlayerOnHole(player);
      const netScore = getNetScore(grossScore, strokesReceived);
      const skinScore = getSkinScore(grossScore, strokesReceived);

      savedScores[player.id][currentHoleIndex] = grossScore;
      holeResults.push({
        playerId: player.id,
        grossScore,
        strokesReceived,
        netScore,
        skinScore
      });
    });

    savedHoleResults[currentHoleIndex] = holeResults;
    recalculateSkins();
  }

  function applyCloudHoleScores(scoreRows = []) {
    scoreRows.forEach((scoreRow) => {
      const player = players.find((item) => item.id === scoreRow.player_id);
      const holeIndex = Number(scoreRow.hole) - 1;

      if (!player || holeIndex < 0 || holeIndex >= totalHoles) return;

      const grossScore = Number(scoreRow.gross);
      const strokesReceived = Number(scoreRow.strokes_received || 0);
      const netScore = Number(scoreRow.net ?? grossScore - strokesReceived);
      const skinScore = getSkinScore(grossScore, strokesReceived);
      const existingHoleResults = savedHoleResults[holeIndex] || [];

      savedScores[player.id][holeIndex] = grossScore;
      savedHoleResults[holeIndex] = [
        ...existingHoleResults.filter((result) => result.playerId !== player.id),
        {
          playerId: player.id,
          grossScore,
          strokesReceived,
          netScore,
          skinScore
        }
      ];
    });

    recalculateSkins();
    loadDraftScores();
  }

  function replaceSavedScoresFromCloud(scoreRows = []) {
    players.forEach((player) => {
      savedScores[player.id] = Array(totalHoles).fill(null);
    });
    savedHoleResults = Array(totalHoles).fill(null);
    applyCloudHoleScores(scoreRows);
  }

  function updateRoundPlayerParticipation(playerId, participation = {}) {
    const player = players.find((item) => item.id === playerId);

    if (!player) return null;

    const previousInPoints = isInPoints(player);
    const previousInSkins = isInSkins(player);
    const inPoints = participation.inPoints === true;
    const inSkins = participation.inSkins === true;

    player.inPoints = inPoints;
    player.inSkins = inSkins;

    if (Array.isArray(roundSettings.players)) {
      roundSettings.players = roundSettings.players.map((item) =>
        item.id === playerId ? { ...item, inPoints, inSkins } : item
      );
    }

    roundSettings.games = roundSettings.games || {};
    roundSettings.games.pointsGame = {
      ...(roundSettings.games.pointsGame || {}),
      enabled: players.some((item) => isInPoints(item))
    };
    roundSettings.games.netSkins = {
      ...(roundSettings.games.netSkins || {}),
      enabled: players.some((item) => isInSkins(item))
    };

    recalculateSkins();
    loadDraftScores();

    return {
      player,
      previousInPoints,
      previousInSkins,
      inPoints,
      inSkins,
      payoutSummary: buildFreshPayoutSummary()
    };
  }

  function updateRoundPlayerHandicap(playerId, handicapIndex) {
    const player = players.find((item) => item.id === playerId);
    const newHandicapIndex = Number(handicapIndex);

    if (!player || !Number.isFinite(newHandicapIndex)) return null;

    const previousHandicapIndex = Number(player.handicap ?? player.handicapIndex ?? 0);
    const previousCourseHandicap = Number(courseHandicaps[player.id] ?? getCourseHandicap(player, course));
    const details = getCourseHandicapDetails(
      {
        ...player,
        handicap: newHandicapIndex,
        handicapIndex: newHandicapIndex
      },
      course,
      player.tee
    );

    player.handicap = newHandicapIndex;
    player.handicapIndex = newHandicapIndex;
    player.courseHandicap = details.courseHandicap;
    courseHandicaps[player.id] = details.courseHandicap;

    rebuildSavedHoleResultForPlayer(player);
    recalculateSkins();
    loadDraftScores();

    return {
      player,
      previousHandicapIndex,
      previousCourseHandicap,
      newHandicapIndex,
      newCourseHandicap: details.courseHandicap,
      details
    };
  }

  function updateRoundPlayerTee(playerId, teeId) {
    const player = players.find((item) => item.id === playerId);

    if (!player || !course.tees?.[teeId] || !course.teeRatings?.[teeId]) return null;

    const previousTee = player.tee;
    const previousCourseHandicap = Number(courseHandicaps[player.id] ?? getCourseHandicap(player, course));
    const details = getCourseHandicapDetails(player, course, teeId);

    player.tee = teeId;
    player.courseHandicap = details.courseHandicap;
    courseHandicaps[player.id] = details.courseHandicap;

    rebuildSavedHoleResultForPlayer(player);
    recalculateSkins();
    loadDraftScores();

    return {
      player,
      previousTee,
      newTee: teeId,
      previousCourseHandicap,
      newCourseHandicap: details.courseHandicap,
      details
    };
  }

  function applyCloudRoundPlayers(roundPlayerRows = []) {
    roundPlayerRows.forEach((row) => {
      const player = players.find((item) => item.id === row.player_id);

      if (!player) return;

      const handicapIndex = Number(row.handicap_index ?? player.handicap ?? player.handicapIndex ?? 0);
      const courseHandicap = Number(row.course_handicap);

      if (row.tee) player.tee = row.tee;

      if (row.points_enabled !== undefined) {
        player.inPoints = row.points_enabled === true;
      }

      if (row.skins_enabled !== undefined) {
        player.inSkins = row.skins_enabled === true;
      }

      if (Number.isFinite(handicapIndex)) {
        player.handicap = handicapIndex;
        player.handicapIndex = handicapIndex;
      }

      if (Number.isFinite(courseHandicap)) {
        player.courseHandicap = courseHandicap;
        courseHandicaps[player.id] = courseHandicap;
      } else if (Number.isFinite(handicapIndex)) {
        courseHandicaps[player.id] = getCourseHandicap(player, course);
        player.courseHandicap = courseHandicaps[player.id];
      }

      rebuildSavedHoleResultForPlayer(player);
    });

    if (Array.isArray(roundSettings.players)) {
      roundSettings.players = roundSettings.players.map((roundPlayer) => {
        const player = players.find((item) => item.id === roundPlayer.id);
        return player
          ? { ...roundPlayer, inPoints: isInPoints(player), inSkins: isInSkins(player) }
          : roundPlayer;
      });
    }

    roundSettings.games = roundSettings.games || {};
    roundSettings.games.pointsGame = {
      ...(roundSettings.games.pointsGame || {}),
      enabled: players.some((item) => isInPoints(item))
    };
    roundSettings.games.netSkins = {
      ...(roundSettings.games.netSkins || {}),
      enabled: players.some((item) => isInSkins(item))
    };

    recalculateSkins();
    loadDraftScores();
  }

  function applyCloudPlayerStatuses(statusRows = []) {
    if (statusRows.length === 0) {
      roundSettings.playerStatuses = playerStatuses;
      return;
    }

    Object.keys(playerStatuses).forEach((playerId) => {
      delete playerStatuses[playerId];
    });

    statusRows.forEach((statusRow) => {
      if (statusRow.status !== "dnf") return;

      playerStatuses[statusRow.player_id] = {
        status: "dnf",
        holesCompleted: Number(statusRow.holes_completed || 0),
        grossStrokes: Number(statusRow.gross_strokes || 0),
        reason: statusRow.reason || "",
        markedAt: statusRow.updated_at || statusRow.created_at || new Date().toISOString()
      };
    });

    roundSettings.playerStatuses = playerStatuses;
  }

  function clearHoleForPlayers(holeIndex, playersToClear = players) {
    const playerIdsToClear = new Set(playersToClear.map((player) => player.id));

    playersToClear.forEach((player) => {
      savedScores[player.id][holeIndex] = null;
    });

    savedHoleResults[holeIndex] = (savedHoleResults[holeIndex] || [])
      .filter((result) => !playerIdsToClear.has(result.playerId));

    if (savedHoleResults[holeIndex].length === 0) {
      savedHoleResults[holeIndex] = null;
    }

    recalculateSkins();
    goToHole(holeIndex);
  }

  function goToHole(nextHoleIndex) {
    currentHoleIndex = Math.max(0, Math.min(totalHoles - 1, nextHoleIndex));
    loadDraftScores();
  }

  function resetScores() {
    players.forEach((player) => {
      savedScores[player.id] = Array(totalHoles).fill(null);
    });

    savedHoleResults = Array(totalHoles).fill(null);
    skinResults = Array(totalHoles).fill(null);
    currentHoleIndex = 0;
    Object.keys(playerStatuses).forEach((playerId) => {
      delete playerStatuses[playerId];
    });
    roundSettings.playerStatuses = playerStatuses;
    loadDraftScores();
  }

  function markPlayerDnf(playerId) {
    const player = players.find((item) => item.id === playerId);
    if (!player) return null;

    const totals = getPlayerTotals(player);
    playerStatuses[playerId] = {
      status: "dnf",
      holesCompleted: totals.holesPlayed,
      grossStrokes: totals.gross,
      markedAt: new Date().toISOString()
    };
    roundSettings.playerStatuses = playerStatuses;
    return playerStatuses[playerId];
  }

  function restorePlayerActive(playerId) {
    delete playerStatuses[playerId];
    roundSettings.playerStatuses = playerStatuses;
  }

  recalculateSkins();
  loadDraftScores();

  return {
    id: roundId,
    roundSettings,
    totalHoles,
    savedScores,
    courseHandicaps,
    draftScores,
    playerStatuses,
    get currentHoleIndex() {
      return currentHoleIndex;
    },
    get skinResults() {
      return skinResults;
    },
    getHoleForPlayer,
    getPlayerHoleResult,
    getHolePointsResults,
    getSkinForHole,
    getPlayerTotals,
    getSavedGrossRecordsForPlayer,
    getPlayerDnfStatus,
    formatDnfStatus,
    formatGrossTotal,
    getPointsQuota,
    getPointsDifferential,
    getPointsSummary,
    getPointsResultStandings,
    getPayoutSummary,
    getLeaderboardStandings,
    getStrokesForPlayerOnHole,
    getSkinSummary,
    getTeamChallengeTeams,
    getFourBallMatchSummary,
    isInSkins,
    isInPoints,
    isPlayerDnf,
    isRoundComplete,
    getLastSavedHoleIndex,
    getLastSavedHoleIndexForPlayers,
    getFinalSummary,
    getRoundExport,
    getAutoSaveExport,
    changeDraftScore,
    setDraftScore,
    saveCurrentHole,
    applyCloudHoleScores,
    replaceSavedScoresFromCloud,
    updateRoundPlayerParticipation,
    updateRoundPlayerHandicap,
    updateRoundPlayerTee,
    applyCloudRoundPlayers,
    applyCloudPlayerStatuses,
    markPlayerDnf,
    restorePlayerActive,
    clearHoleForPlayers,
    goToHole,
    resetScores
  };
};
