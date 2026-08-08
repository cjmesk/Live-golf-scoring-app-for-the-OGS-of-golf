window.OGSGolf = window.OGSGolf || {};
window.OGSGolf.cloud = window.OGSGolf.cloud || {};

function getRoundCloudUpdatedAt(roundData, row = {}) {
  return row.updated_at
    || roundData?.cloudUpdatedAt
    || roundData?.roundSettings?.cloudUpdatedAt
    || roundData?.roundSettings?.startedAt
    || roundData?.startedAt
    || row.played_at
    || roundData?.date
    || "";
}

function getRoundSortTime(roundData, row = {}) {
  const timeText = getRoundCloudUpdatedAt(roundData, row);
  const parsedTime = Date.parse(timeText);

  if (Number.isFinite(parsedTime)) return parsedTime;

  const idText = String(row.id || roundData?.id || "");
  const timestampMatch = idText.match(/(\d{10,})/);
  return timestampMatch ? Number(timestampMatch[1]) : 0;
}

function normalizeRawRound(rawData) {
  if (!rawData) return null;
  if (typeof rawData !== "string") return rawData;

  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.warn("[OGS Golf] Skipping active round row with unreadable raw_data.", error);
    return null;
  }
}

async function upsertRestRows({ table, rows, onConflict, config }) {
  const rowList = Array.isArray(rows) ? rows : [rows];

  if (rowList.length === 0) {
    return { ok: true };
  }

  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(Array.isArray(rows) ? rows : rows)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${table} upsert failed. ${details || ""}`.trim());
  }

  return { ok: true, rows: await response.json() };
}

window.OGSGolf.cloud.roundCloudService = {
  async loadActiveRound() {
    const config = window.OGSGolf.cloud.supabaseConfig;

    if (!config.url || !config.anonKey) {
      return { ok: false, round: null };
    }

    try {
      const response = await fetch(
        `${config.url}/rest/v1/rounds?select=id,played_at,raw_data&completed=eq.false&order=played_at.desc&limit=25`,
        {
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`
          }
        }
      );

      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || "Active event request failed.");
      }

      const data = await response.json();
      const activeRows = (data || [])
        .map((row) => ({
          row,
          round: normalizeRawRound(row.raw_data)
        }))
        .filter((item) => item.round)
        .sort((a, b) => getRoundSortTime(b.round, b.row) - getRoundSortTime(a.round, a.row));
      const activeRound = activeRows[0] || null;

      return {
        ok: true,
        round: activeRound?.round || null,
        record: activeRound?.row || null,
        cloudUpdatedAt: activeRound ? getRoundCloudUpdatedAt(activeRound.round, activeRound.row) : "",
        rowsFound: data.length,
        readableRows: activeRows.length
      };
    } catch (error) {
      return { ok: false, round: null, message: error.message || "Active round lookup failed." };
    }
  },

  async saveActiveRound(roundData) {
    const config = window.OGSGolf.cloud.supabaseConfig;

    if (!config.url || !config.anonKey) {
      return { ok: false, reason: "not-configured", message: "Supabase is not configured." };
    }

    try {
      const cloudUpdatedAt = new Date().toISOString();
      const activeRoundData = {
        ...roundData,
        cloudUpdatedAt,
        roundSettings: {
          ...(roundData.roundSettings || {}),
          cloudUpdatedAt
        }
      };
      const groupRecords = activeRoundData.roundSettings?.groupRecords || [];
      const groups = activeRoundData.roundSettings?.groups || [];
      const groupRows = groupRecords.map((group, index) => ({
        id: group.cloudId || `${activeRoundData.id}-group-${index + 1}`,
        round_id: activeRoundData.id,
        group_number: index + 1,
        starting_hole: Number(group.startingHole || group.starting_hole || 1),
        holes_to_play: Number(group.holesToPlay || group.holes_to_play || 18),
        status: group.status || "in_progress",
        completed_at: group.completedAt || group.completed_at || null
      }));
      const groupIdByPlayerId = new Map();

      groups.forEach((playerIds, groupIndex) => {
        playerIds.forEach((playerId) => {
          groupIdByPlayerId.set(playerId, groupRows[groupIndex]?.id || `${activeRoundData.id}-group-${groupIndex + 1}`);
        });
      });

      const roundPlayerRows = (activeRoundData.players || []).map((player) => ({
        id: `${activeRoundData.id}:${player.id}`,
        round_id: activeRoundData.id,
        player_id: player.id,
        tee: player.tee || "white",
        handicap_index: Number(player.handicapIndex ?? player.handicap ?? 0),
        course_handicap: Number(player.courseHandicap ?? 0),
        group_id: groupIdByPlayerId.get(player.id) || null,
        playing: player.playing !== false,
        skins_enabled: player.inSkins === true,
        points_enabled: player.inPoints === true
      }));

      await upsertRestRows({
        table: "courses",
        onConflict: "id",
        config,
        rows: {
        id: activeRoundData.course.id,
        name: activeRoundData.course.name,
        par: activeRoundData.course.par
        }
      });
      await upsertRestRows({
        table: "rounds",
        onConflict: "id",
        config,
        rows: {
        id: activeRoundData.id,
        played_at: activeRoundData.roundSettings?.startedAt || activeRoundData.date || cloudUpdatedAt,
        course_id: activeRoundData.course.id,
        completed: false,
        raw_data: activeRoundData
        }
      });

      let detailSyncOk = true;

      try {
        await upsertRestRows({
          table: "round_groups",
          rows: groupRows,
          onConflict: "round_id,group_number",
          config
        });
        await upsertRestRows({
          table: "round_players",
          rows: roundPlayerRows,
          onConflict: "round_id,player_id",
          config
        });
      } catch (detailError) {
        detailSyncOk = false;
        console.warn("[OGS Golf] Active round detail rows did not sync, but main active round was saved.", detailError);
      }

      return { ok: true, round: activeRoundData, cloudUpdatedAt, detailSyncOk };
    } catch (error) {
      return { ok: false, reason: "failed", message: `Active round cloud save failed. ${error.message || ""}`.trim() };
    }
  },

  async clearActiveRound() {
    const client = window.OGSGolf.cloud.getSupabaseClient();

    if (!client) {
      return { ok: false };
    }

    try {
      await client.from("rounds").update({
        completed: true
      }).eq("completed", false).throwOnError();

      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  },

  async savePlayers(players) {
    const client = window.OGSGolf.cloud.getSupabaseClient();

    if (!client) {
      return {
        ok: false,
        reason: "not-configured",
        message: "Player cloud save is not set up yet. Your roster is saved on this device."
      };
    }

    const playerRows = players.map((player) => ({
      id: player.id,
      name: player.name,
      ghin: player.ghin || null,
      handicap_index: player.handicap,
      preferred_tee: player.tee,
      active: player.active
    }));

    try {
      await client.from("players").upsert(playerRows).throwOnError();

      return {
        ok: true,
        message: "Roster saved to Supabase ✓"
      };
    } catch (error) {
      return {
        ok: false,
        reason: "failed",
        message: "Cloud roster save failed. Your roster is still saved on this device."
      };
    }
  },

  async loadCompletedRounds() {
    const config = window.OGSGolf.cloud.supabaseConfig;

    if (!config.url || !config.anonKey) {
      return {
        ok: false,
        reason: "not-configured",
        message: "Cloud load failed, showing local rounds",
        rounds: []
      };
    }

    try {
      const response = await fetch(
        `${config.url}/rest/v1/rounds?select=id,played_at,raw_data&completed=eq.true&order=played_at.desc`,
        {
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Cloud rounds request failed.");
      }

      const data = await response.json();
      const rounds = (data || [])
        .map((row) => normalizeRawRound(row.raw_data))
        .filter(Boolean);

      return {
        ok: true,
        message: "Loaded rounds from cloud",
        rounds
      };
    } catch (error) {
      return {
        ok: false,
        reason: "failed",
        message: "Cloud load failed, showing local rounds",
        rounds: []
      };
    }
  },

  async loadCompletedRoundById(roundId) {
    const config = window.OGSGolf.cloud.supabaseConfig;

    if (!config.url || !config.anonKey || !roundId) {
      return {
        ok: false,
        reason: "not-configured",
        round: null,
        message: "Cloud completed-round lookup is not available."
      };
    }

    try {
      const response = await fetch(
        `${config.url}/rest/v1/rounds?select=id,played_at,raw_data&completed=eq.true&id=eq.${encodeURIComponent(roundId)}&limit=1`,
        {
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`
          }
        }
      );

      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || "Completed round lookup failed.");
      }

      const rows = await response.json();
      const rawData = rows[0]?.raw_data;
      const round = normalizeRawRound(rawData);

      return {
        ok: true,
        round,
        record: rows[0] || null
      };
    } catch (error) {
      return {
        ok: false,
        reason: "failed",
        round: null,
        message: error.message || "Completed round lookup failed."
      };
    }
  },

  async saveCompletedRound(roundData) {
    const client = window.OGSGolf.cloud.getSupabaseClient();

    if (!client) {
      return {
        ok: false,
        reason: "not-configured",
        message: "Cloud save is not set up yet. Your round is still saved locally."
      };
    }

    const course = {
      id: roundData.course.id,
      name: roundData.course.name,
      par: roundData.course.par
    };
    const completedAt = roundData.completedAt || roundData.savedAt || new Date().toISOString();
    const completedRoundData = {
      ...roundData,
      completed: true,
      status: "complete",
      completedAt,
      roundSettings: {
        ...(roundData.roundSettings || {}),
        eventStatus: "Complete",
        completedAt
      }
    };
    const round = {
      id: completedRoundData.id,
      played_at: completedRoundData.date,
      course_id: completedRoundData.course.id,
      completed: true,
      raw_data: completedRoundData
    };
    const roundPlayers = roundData.players.map((player) => ({
      round_id: roundData.id,
      player_id: player.id,
      tee: player.tee,
      handicap_index: player.handicapIndex,
      course_handicap: player.courseHandicap
    }));
    const holeScores = roundData.holeByHole.flatMap((hole) =>
      hole.scores.map((score) => ({
        round_id: roundData.id,
        player_id: score.playerId,
        hole: hole.hole,
        tee: score.tee,
        par: score.par,
        handicap: score.handicap,
        yards: score.yards,
        gross: score.gross,
        strokes_received: score.strokesReceived,
        net: score.net,
        points: score.points
      }))
    );
    const results = roundData.totals.map((total) => ({
      round_id: roundData.id,
      player_id: total.playerId,
      gross_total: total.gross,
      net_total: total.net,
      points_total: total.points,
      front_points: total.frontPoints,
      back_points: total.backPoints,
      skins_won: total.skinsWon,
      skin_holes: total.skinHoles
    }));

    try {
      await client.from("courses").upsert(course).throwOnError();
      await client.from("rounds").upsert(round).throwOnError();
      await client.from("round_players").upsert(roundPlayers).throwOnError();
      await client.from("hole_scores").delete().eq("round_id", roundData.id).throwOnError();
      await client.from("hole_scores").insert(holeScores).throwOnError();
      await client.from("round_results").upsert(results).throwOnError();

      return {
        ok: true,
        message: "Round saved to cloud ✓"
      };
    } catch (error) {
      return {
        ok: false,
        reason: "failed",
        message: "Cloud save failed. Round is still saved locally."
      };
    }
  }
};

window.OGSGolf.cloud.roundCloudService.savePlayers = async function savePlayers(players) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return {
      ok: false,
      reason: "not-configured",
      message: "Player cloud save is not set up yet. Your roster is saved on this device."
    };
  }

  const playerRows = players.map((player) => ({
    id: player.id,
    name: player.name,
    ghin: player.ghin || null,
    handicap_index: player.handicap,
    preferred_tee: player.tee,
    active: player.active
  }));

  try {
    const response = await fetch(`${config.url}/rest/v1/players?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify(playerRows)
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 401 && errorText.includes("row-level security")) {
        return {
          ok: false,
          reason: "players-policy-missing",
          message: "Supabase roster permissions need to be updated. Your roster is still saved on this device."
        };
      }

      throw new Error("Player roster request failed.");
    }

    return {
      ok: true,
      message: "Roster saved to Supabase."
    };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      message: "Cloud roster save failed. Your roster is still saved on this device."
    };
  }
};

window.OGSGolf.cloud.roundCloudService.loadPlayers = async function loadPlayers() {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return {
      ok: false,
      reason: "not-configured",
      players: [],
      message: "Cloud roster failed, using default roster."
    };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/players?select=id,name,ghin,handicap_index,preferred_tee,active&order=name.asc`,
      {
        method: "GET",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Player roster load failed.");
    }

    const rows = await response.json();
    const players = rows.map((row) => ({
      id: row.id,
      name: row.name,
      ghin: row.ghin || "",
      handicap: Number(row.handicap_index ?? 0),
      tee: row.preferred_tee || "white",
      active: row.active !== false
    }));

    return {
      ok: true,
      players,
      message: "Roster loaded from Supabase."
    };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      players: [],
      message: "Cloud roster failed, using default roster."
    };
  }
};

window.OGSGolf.cloud.roundCloudService.deletePlayer = async function deletePlayer(playerId) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return {
      ok: false,
      reason: "not-configured",
      message: "Cloud roster remove is not set up yet. The player was not removed from the shared roster."
    };
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/players?id=eq.${encodeURIComponent(playerId)}`, {
      method: "DELETE",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      }
    });

    if (!response.ok) {
      throw new Error("Player roster delete failed.");
    }

    return {
      ok: true,
      message: "Player removed from cloud"
    };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      message: "Cloud remove failed. The player was not removed from the shared roster."
    };
  }
};

window.OGSGolf.cloud.roundCloudService.fetchCurrentActiveRoundRecord = async function fetchCurrentActiveRoundRecord() {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", round: null };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rounds?select=*&completed=eq.false&order=played_at.desc&limit=25`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        }
      }
    );

    if (!response.ok) throw new Error("Active round fetch failed.");

    const rows = await response.json();
    const activeRows = (rows || [])
      .map((row) => ({
        ...row,
        raw_data: normalizeRawRound(row.raw_data)
      }))
      .filter((row) => row.raw_data)
      .sort((a, b) => getRoundSortTime(b.raw_data, b) - getRoundSortTime(a.raw_data, a));

    return {
      ok: true,
      round: activeRows[0] || null
    };
  } catch (error) {
    return { ok: false, reason: "failed", round: null, message: "Active round fetch failed." };
  }
};

window.OGSGolf.cloud.roundCloudService.fetchRoundGroups = async function fetchRoundGroups(roundId) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", groups: [] };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/round_groups?select=*&round_id=eq.${encodeURIComponent(roundId)}&order=group_number.asc`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        }
      }
    );

    if (!response.ok) throw new Error("Round groups fetch failed.");

    return { ok: true, groups: await response.json() };
  } catch (error) {
    return { ok: false, reason: "failed", groups: [], message: "Round groups fetch failed." };
  }
};

window.OGSGolf.cloud.roundCloudService.fetchRoundPlayers = async function fetchRoundPlayers(roundId) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", players: [] };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/round_players?select=*&round_id=eq.${encodeURIComponent(roundId)}&order=player_id.asc`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        }
      }
    );

    if (!response.ok) throw new Error("Round players fetch failed.");

    return { ok: true, players: await response.json() };
  } catch (error) {
    return { ok: false, reason: "failed", players: [], message: "Round players fetch failed." };
  }
};

window.OGSGolf.cloud.roundCloudService.upsertRoundPlayer = async function upsertRoundPlayer(player) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", message: "Supabase is not configured." };
  }

  const row = {
    id: player.id || `${player.round_id}:${player.player_id}`,
    round_id: player.round_id,
    player_id: player.player_id,
    tee: player.tee || "white",
    handicap_index: Number(player.handicap_index ?? 0),
    course_handicap: Number(player.course_handicap ?? 0),
    group_id: player.group_id || null,
    playing: player.playing !== false,
    skins_enabled: player.skins_enabled === true,
    points_enabled: player.points_enabled === true
  };

  try {
    const response = await fetch(`${config.url}/rest/v1/round_players?on_conflict=round_id,player_id`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(row)
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Round player upsert failed.");
    }

    return { ok: true, player: (await response.json())[0] || row };
  } catch (error) {
    return { ok: false, reason: "failed", message: `Round player update failed. ${error.message || ""}`.trim() };
  }
};

window.OGSGolf.cloud.roundCloudService.fetchPlayerHoleScores = async function fetchPlayerHoleScores({
  roundId,
  playerId
}) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", scores: [] };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/hole_scores?select=*&round_id=eq.${encodeURIComponent(roundId)}&player_id=eq.${encodeURIComponent(playerId)}&order=hole.asc`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        }
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Player hole scores fetch failed.");
    }

    return { ok: true, scores: await response.json() };
  } catch (error) {
    return { ok: false, reason: "failed", scores: [], message: `Player hole scores fetch failed. ${error.message || ""}`.trim() };
  }
};

window.OGSGolf.cloud.roundCloudService.fetchHoleScores = async function fetchHoleScores(roundId) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", scores: [] };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/hole_scores?select=*&round_id=eq.${encodeURIComponent(roundId)}&order=group_id.asc,hole.asc,player_id.asc`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        }
      }
    );

    if (!response.ok) throw new Error("Hole scores fetch failed.");

    return { ok: true, scores: await response.json() };
  } catch (error) {
    return { ok: false, reason: "failed", scores: [], message: "Hole scores fetch failed." };
  }
};

window.OGSGolf.cloud.roundCloudService.fetchPlayerStatuses = async function fetchPlayerStatuses(roundId) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", statuses: [] };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/player_statuses?select=*&round_id=eq.${encodeURIComponent(roundId)}&order=player_id.asc`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        }
      }
    );

    if (!response.ok) throw new Error("Player statuses fetch failed.");

    return { ok: true, statuses: await response.json() };
  } catch (error) {
    return { ok: false, reason: "failed", statuses: [], message: "Player statuses fetch failed." };
  }
};

window.OGSGolf.cloud.roundCloudService.validateHoleScoreRow = function validateHoleScoreRow(score) {
  const hole = Number(score.hole);
  const gross = Number(score.gross);
  const strokesReceived = Number(score.strokes_received ?? score.strokesReceived ?? 0);
  const net = Number(score.net ?? gross - strokesReceived);

  if (!score.round_id || !score.player_id) {
    return { ok: false, message: "Score needs round_id and player_id." };
  }

  if (!Number.isInteger(hole) || hole < 1 || hole > 18) {
    return { ok: false, message: "Hole must be between 1 and 18." };
  }

  if (!Number.isFinite(gross) || gross <= 0) {
    return { ok: false, message: "Gross score must be a positive number." };
  }

  if (net !== gross - strokesReceived) {
    return { ok: false, message: "Net must equal gross minus strokes received." };
  }

  return { ok: true };
};

window.OGSGolf.cloud.roundCloudService.upsertPlayerHoleScore = async function upsertPlayerHoleScore(score) {
  const config = window.OGSGolf.cloud.supabaseConfig;
  const validation = this.validateHoleScoreRow(score);

  if (!validation.ok) {
    return { ok: false, reason: "invalid-score", message: validation.message };
  }

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", message: "Supabase is not configured." };
  }

  const gross = Number(score.gross);
  const strokesReceived = Number(score.strokes_received ?? score.strokesReceived ?? 0);
  const row = {
    round_id: score.round_id,
    group_id: score.group_id || null,
    player_id: score.player_id,
    hole: Number(score.hole),
    gross,
    strokes_received: strokesReceived,
    net: gross - strokesReceived,
    updated_by: score.updated_by || null
  };

  try {
    const response = await fetch(`${config.url}/rest/v1/hole_scores?on_conflict=round_id,player_id,hole`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(row)
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Hole score upsert failed.");
    }

    return { ok: true, score: (await response.json())[0] || row };
  } catch (error) {
    return { ok: false, reason: "failed", message: `Hole score upsert failed. ${error.message || ""}`.trim() };
  }
};

window.OGSGolf.cloud.roundCloudService.upsertRoundGroup = async function upsertRoundGroup(group) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", message: "Supabase is not configured." };
  }

  const row = {
    id: group.id,
    round_id: group.round_id,
    group_number: Number(group.group_number),
    starting_hole: Number(group.starting_hole || 1),
    holes_to_play: Number(group.holes_to_play || 18),
    status: group.status || "in_progress",
    completed_at: group.completed_at || null
  };

  try {
    const response = await fetch(`${config.url}/rest/v1/round_groups?on_conflict=round_id,group_number`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(row)
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Round group upsert failed.");
    }

    return { ok: true, group: (await response.json())[0] || row };
  } catch (error) {
    return { ok: false, reason: "failed", message: `Round group upsert failed. ${error.message || ""}`.trim() };
  }
};

window.OGSGolf.cloud.roundCloudService.upsertGroupHoleScores = async function upsertGroupHoleScores({
  roundId,
  groupId,
  hole,
  scores,
  updatedBy
}) {
  const results = [];

  for (const score of scores) {
    const result = await this.upsertPlayerHoleScore({
      round_id: roundId,
      group_id: groupId,
      player_id: score.playerId || score.player_id,
      hole,
      gross: score.gross,
      strokes_received: score.strokesReceived ?? score.strokes_received ?? 0,
      updated_by: updatedBy
    });

    if (!result.ok) {
      return result;
    }

    results.push(result.score);
  }

  return { ok: true, scores: results };
};

window.OGSGolf.cloud.roundCloudService.fetchGroupHoleScores = async function fetchGroupHoleScores({
  roundId,
  groupId,
  hole
}) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", scores: [] };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/hole_scores?select=*&round_id=eq.${encodeURIComponent(roundId)}&group_id=eq.${encodeURIComponent(groupId)}&hole=eq.${Number(hole)}&order=player_id.asc`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        }
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Group hole scores fetch failed.");
    }

    return { ok: true, scores: await response.json() };
  } catch (error) {
    return { ok: false, reason: "failed", scores: [], message: `Group hole scores fetch failed. ${error.message || ""}`.trim() };
  }
};

window.OGSGolf.cloud.roundCloudService.updateRoundGroupStatus = async function updateRoundGroupStatus({
  groupId,
  status,
  completedAt = null
}) {
  const config = window.OGSGolf.cloud.supabaseConfig;

  if (!config.url || !config.anonKey) {
    return { ok: false, reason: "not-configured", message: "Supabase is not configured." };
  }

  if (!["not_started", "in_progress", "completed"].includes(status)) {
    return { ok: false, reason: "invalid-status", message: "Invalid group status." };
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/round_groups?id=eq.${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        status,
        completed_at: status === "completed" ? (completedAt || new Date().toISOString()) : null
      })
    });

    if (!response.ok) throw new Error("Group status update failed.");

    return { ok: true, group: (await response.json())[0] || null };
  } catch (error) {
    return { ok: false, reason: "failed", message: "Group status update failed." };
  }
};

window.OGSGolf.cloud.roundCloudService.getGroupCompletionFromScoreRows = function getGroupCompletionFromScoreRows({
  group,
  players,
  scores,
  statuses
}) {
  const requiredHoles = Number(group.holes_to_play || group.holesToPlay || 18);
  const startHole = Number(group.starting_hole || group.startingHole || 1);
  const holeSequence = Array.from({ length: requiredHoles }, (_, index) =>
    ((startHole - 1 + index) % 18) + 1
  );
  const dnfPlayerIds = new Set(
    (statuses || [])
      .filter((status) => status.status === "dnf")
      .map((status) => status.player_id)
  );
  const activePlayers = (players || []).filter((player) =>
    player.playing !== false && !dnfPlayerIds.has(player.player_id)
  );
  const scoreKeys = new Set((scores || []).map((score) =>
    `${score.player_id}:${Number(score.hole)}`
  ));
  const completedHoleNumbers = holeSequence.filter((holeNumber) =>
    activePlayers.every((player) => scoreKeys.has(`${player.player_id}:${holeNumber}`))
  );

  return {
    completedHoleNumbers,
    completedCount: completedHoleNumbers.length,
    requiredHoles,
    complete: completedHoleNumbers.length >= requiredHoles
  };
};

window.OGSGolf.cloud.roundCloudService.markRoundCompletedIfAllGroupsComplete = async function markRoundCompletedIfAllGroupsComplete(roundId) {
  const groupsResult = await this.fetchRoundGroups(roundId);
  const playersResult = await this.fetchRoundPlayers(roundId);
  const scoresResult = await this.fetchHoleScores(roundId);
  const statusesResult = await this.fetchPlayerStatuses(roundId);

  if (!groupsResult.ok || !playersResult.ok || !scoresResult.ok || !statusesResult.ok) {
    return { ok: false, reason: "fetch-failed", completed: false };
  }

  const groupChecks = groupsResult.groups.map((group) => this.getGroupCompletionFromScoreRows({
    group,
    players: playersResult.players.filter((player) => player.group_id === group.id),
    scores: scoresResult.scores.filter((score) => score.group_id === group.id),
    statuses: statusesResult.statuses
  }));
  const allGroupsComplete = groupChecks.length > 0 && groupChecks.every((check) => check.complete);

  if (!allGroupsComplete) {
    return { ok: true, completed: false, groupChecks };
  }

  const config = window.OGSGolf.cloud.supabaseConfig;

  try {
    const response = await fetch(`${config.url}/rest/v1/rounds?id=eq.${encodeURIComponent(roundId)}`, {
      method: "PATCH",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ completed: true })
    });

    if (!response.ok) throw new Error("Round completion update failed.");

    return { ok: true, completed: true, groupChecks };
  } catch (error) {
    return { ok: false, reason: "failed", completed: false, groupChecks };
  }
};
